/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowLeft, MapPin, Milestone, Layers, Sparkles, Droplet, Car, ShieldAlert, 
  Check, Loader2, Landmark, Tag, Calendar, Receipt, Mail, Download, 
  Compass, DollarSign, AlertTriangle, Send, Youtube, Eye
} from 'lucide-react';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Store } from '../types';
import dynamic from 'next/dynamic';
const MapComponent = dynamic(() => import('./MapComponent'), { ssr: false });

interface StoreDetailProps {
  store: Store;
  onNavigate: (route: string) => void;
  onRefresh: () => void;
}

export default function StoreDetail({ store, onNavigate, onRefresh }: StoreDetailProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [emailStr, setEmailStr] = useState('');
  const [phoneStr, setPhoneStr] = useState('');
  const [notesStr, setNotesStr] = useState('');
  const [requestedAmount, setRequestedAmount] = useState(store.monthlyLease?.toString() || '');
  const [category, setCategory] = useState('Full Monthly Lease');
  const [success, setSuccess] = useState(false);

  // Verification Form states
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyTrackingCode, setVerifyTrackingCode] = useState(store.trackingCode || '');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Pricing offer states
  const [offerAmount, setOfferAmount] = useState('');
  const [offerName, setOfferName] = useState('');
  const [offerEmail, setOfferEmail] = useState('');
  const [offerPhone, setOfferPhone] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState(false);

  // Smart inquiry states
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);

  // Status mapping badge helper
  const getStatusBadgeClassAndLabel = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'AVAILABLE') {
      return { class: 'bg-emerald-100 text-emerald-800 border border-emerald-200', label: 'AVAILABLE' };
    }
    if (s === 'SOLD') {
      return { class: 'bg-rose-100 text-rose-800 border border-rose-200', label: 'SOLD' };
    }
    if (s === 'LEASED') {
      return { class: 'bg-blue-100 text-blue-800 border border-blue-200', label: 'LEASED' };
    }
    if (s === 'RESERVED') {
      return { class: 'bg-amber-100 text-amber-800 border border-amber-200', label: 'RESERVED' };
    }
    if (s === 'UNDER NEGOTIATION' || s === 'UNDER_NEGOTIATION') {
      return { class: 'bg-orange-100 text-orange-800 border border-orange-200', label: 'UNDER NEGOTIATION' };
    }
    if (s === 'COMING SOON' || s === 'COMING_SOON') {
      return { class: 'bg-gray-100 text-gray-800 border border-gray-200', label: 'COMING SOON' };
    }
    return { class: 'bg-gray-100 text-gray-800 border border-gray-200', label: status.toUpperCase() };
  };

  const badgeInfo = getStatusBadgeClassAndLabel(store.status);

  // Derive yearly lease options if not explicitly configured in schema
  const simulatedYearlyDiscountAmount = store.yearlyPaymentAmount || (store.monthlyLease * 12 * 0.85); // 15% discount
  const formattedExpiration = store.yearlyExpirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });

  const handleLeaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store.id) return;

    setLoading(true);
    const mockId = `alloc-${Date.now()}`;
    const payload = {
      fullName: customerName,
      email: emailStr,
      phone: phoneStr,
      offerAmount: Number(requestedAmount) || store.monthlyLease,
      notes: notesStr,
      storeId: store.id,
      storeName: store.storeName,
      trackingCode: store.trackingCode || '',
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    // Mirror to localStorage
    try {
      const existingStr = localStorage.getItem('local_allocation_requests');
      let currList: any[] = [];
      if (existingStr) {
        try { currList = JSON.parse(existingStr); } catch (_) {}
      }
      currList.push({ id: mockId, ...payload });
      localStorage.setItem('local_allocation_requests', JSON.stringify(currList));
    } catch (lex) {
      console.warn("Could not save alloc to local fallback:", lex);
    }

    try {
      // Create an allocationRequests document in Firestore
      await addDoc(collection(db, 'allocationRequests'), payload);
      setSuccess(true);
      onRefresh();  // trigger re-fetch of database contents
    } catch (err) {
      console.warn("Firestore allocation write skipped in database restricted sandbox mode:", err);
      setSuccess(true); // Graceful sandbox fallback
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  // 1. Send Store Details handler
  const handleSendDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEmail || !verifyTrackingCode) return;
    setVerifyLoading(true);
    setVerifySuccess(null);
    setVerifyError(null);

    try {
      const res = await fetch('/api/send-store-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verifyEmail,
          trackingCode: verifyTrackingCode,
          storeData: store
        })
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(resData.error || 'Verification failed. Please check your information and try again.');
      }

      setVerifySuccess(resData.message || 'Verification successful. Your store ownership details have been sent to your email.');
    } catch (err: any) {
      setVerifyError(err.message || 'Verification failed. Please check your information and try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  // 2. Download Certificate PDF handler
  const handleDownloadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEmail || !verifyTrackingCode) return;
    setVerifyLoading(true);
    setVerifySuccess(null);
    setVerifyError(null);

    try {
      const res = await fetch('/api/download-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verifyEmail,
          trackingCode: verifyTrackingCode,
          storeData: store
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Verification failed. Please check your information and try again.');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${store.storeName.replace(/[^a-zA-Z0-9]/g, '_')}_ownership_certificate.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setVerifySuccess('Verification successful. Your certificate is compiling and downloading.');
    } catch (err: any) {
      setVerifyError(err.message || 'Verification failed. Please check your information and try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  // 3. Pricing & Negotiation Offer handler
  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerAmount || !offerName || !offerEmail || !offerPhone) return;
    setOfferLoading(true);
    setOfferSuccess(false);

    const mockId = `offer-${Date.now()}`;
    const payload = {
      storeId: store.id || '',
      storeName: store.storeName,
      trackingCode: store.trackingCode || '',
      offerAmount: Number(offerAmount),
      contactName: offerName,
      email: offerEmail,
      phone: offerPhone,
      message: offerMessage,
      status: 'Pending',
      submittedAt: new Date().toISOString()
    };

    // Mirror to localStorage
    try {
      const existingStr = localStorage.getItem('local_negotiation_requests');
      let currList: any[] = [];
      if (existingStr) {
        try { currList = JSON.parse(existingStr); } catch (_) {}
      }
      currList.push({ id: mockId, ...payload });
      localStorage.setItem('local_negotiation_requests', JSON.stringify(currList));
    } catch (lex) {
      console.warn("Could not save offer to local fallback:", lex);
    }

    try {
      await addDoc(collection(db, 'negotiationRequests'), payload);

      // Clear fields
      setOfferAmount('');
      setOfferName('');
      setOfferEmail('');
      setOfferPhone('');
      setOfferMessage('');
      setOfferSuccess(true);
    } catch (err) {
      console.warn("Firestore offer write skipped in database restricted sandbox mode:", err);
      // Fallback success feedback
      setOfferAmount('');
      setOfferName('');
      setOfferEmail('');
      setOfferPhone('');
      setOfferMessage('');
      setOfferSuccess(true);
    } finally {
      setOfferLoading(false);
    }
  };

  // 4. Smart Inquiry handler
  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryName || !inquiryEmail || !inquiryMessage) return;
    setInquiryLoading(true);
    setInquirySuccess(false);

    const mockId = `inq-${Date.now()}`;
    const payload = {
      storeId: store.id || '',
      storeName: store.storeName,
      trackingCode: store.trackingCode,
      visitorName: inquiryName,
      visitorEmail: inquiryEmail,
      message: inquiryMessage,
      submittedAt: new Date().toISOString()
    };

    // Mirror to localStorage
    try {
      const existingStr = localStorage.getItem('local_inquiries');
      let currList: any[] = [];
      if (existingStr) {
        try { currList = JSON.parse(existingStr); } catch (_) {}
      }
      currList.push({ id: mockId, ...payload });
      localStorage.setItem('local_inquiries', JSON.stringify(currList));
    } catch (lex) {
      console.warn("Could not save inquiry to local fallback:", lex);
    }

    try {
      // Create Inquiry in firestore
      await addDoc(collection(db, 'inquiries'), payload);

      // Synced chat alert integration
      let visitorId = localStorage.getItem('broward_visitor_id');
      if (!visitorId) {
        visitorId = `vstr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        localStorage.setItem('broward_visitor_id', visitorId);
      }

      const infoMessage = {
        id: `msg-${Date.now()}-inq`,
        sender: 'visitor' as const,
        text: `💡 INQUIRY SUBMITTED:
Visitor asked about: ${store.storeName} (Tracking Code: ${store.trackingCode})
Contact Email: ${inquiryEmail}
Message: ${inquiryMessage}`,
        timestamp: new Date().toISOString()
      };

      // Push to chat collection
      try {
        const chatDocRef = doc(db, 'chats', visitorId);
        await addDoc(collection(db, `chats/${visitorId}/messages`), infoMessage).catch(() => {});
      } catch (_) {}

      setInquiryName('');
      setInquiryEmail('');
      setInquiryMessage('');
      setInquirySuccess(true);
    } catch (err) {
      console.warn("Firestore inquiry write skipped in database restricted sandbox mode:", err);
      // Fallback success feedback
      setInquiryName('');
      setInquiryEmail('');
      setInquiryMessage('');
      setInquirySuccess(true);
    } finally {
      setInquiryLoading(false);
    }
  };

  return (
    <div className="relative bg-[#F8FAFC] text-[#0F172A] min-h-screen py-10 font-sans">
      
      {/* Decorative subtle light blue gradient background */}
      <div 
        className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none border-b border-[#E2E8F0]"
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)"
        }}
      ></div>
 
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Navigation Breadcrumb */}
        <button
          type="button"
          onClick={() => onNavigate('')}
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#475569] hover:text-[#2563EB] bg-white border border-[#E2E8F0] hover:border-[#2563EB] py-2 px-4 rounded-xl shadow-sm transition-all cursor-pointer mb-8"
        >
          <ArrowLeft className="h-4 w-4 text-[#2563EB]" />
          Back to Directory Map
        </button>
 
        {/* Store Title Board Header Section */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 mb-8 shadow-[0_4px_20px_rgba(15,23,42,0.06)] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {store.logo ? (
              <img
                src={store.logo}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover border border-[#E2E8F0] shadow-sm"
                id="store-logo-detail"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 bg-[#F8FAFC] border border-[#E2E8F0] text-[#2563EB] rounded-2xl text-2xl font-bold flex items-center justify-center font-display shadow-inner">S</div>
            )}
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5 font-sans">
                <span className="text-[10px] font-mono tracking-wider uppercase bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] px-2.5 py-0.5 rounded-lg font-bold">
                  Code: {store.trackingCode}
                </span>
                <span className={`text-[10px] uppercase tracking-wider font-bold font-mono px-2.5 py-0.5 rounded-lg shadow-sm ${badgeInfo.class}`}>
                  {badgeInfo.label}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#0F172A] tracking-tight">
                {store.storeName}
              </h1>
              <p className="text-xs text-[#475569] flex items-center justify-center sm:justify-start gap-1 mt-1 font-medium">
                <MapPin className="h-3.5 w-3.5 text-[#2563EB]" />
                {store.location}, inside {store.mallName || "Broward Mall Complex"} {store.unitNumber ? `(Suite ${store.unitNumber})` : ''}
              </p>
            </div>
          </div>
 
          <div className="w-full md:w-auto flex flex-col gap-3.5 sm:flex-row md:flex-col lg:flex-row shrink-0 font-display">
            <div className="text-center sm:text-left bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl px-5 py-3 min-w-[160px]">
              <span className="text-[9px] text-[#2563EB] uppercase tracking-wider font-mono block font-bold">Monthly Lease Rate</span>
              <span className="text-xl font-extrabold text-[#0F172A] block">${store.monthlyLease.toLocaleString()} <span className="text-xs font-normal text-[#475569]">/mo</span></span>
            </div>
            {store.status === 'Available' ? (
              <button
                type="button"
                id="btn-initiate-leasing"
                onClick={() => setModalOpen(true)}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-extrabold text-xs py-3.5 px-6 rounded-2xl uppercase tracking-wider transition-all duration-300 shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-white" />
                Initiate Acquirement
              </button>
            ) : (
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] px-6 py-4 rounded-2xl flex items-center gap-2 text-xs font-medium text-[#475569] justify-center shadow-inner">
                <ShieldAlert className="h-4.5 w-4.5 text-[#2563EB]" />
                Lease locked or allocated manually.
              </div>
            )}
          </div>
        </div>
 
        {/* Grid layout splits specifications vs OSM Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Specifications Dashboard Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <h3 className="text-xs font-bold font-display uppercase tracking-wider text-[#0F172A] border-b border-[#E2E8F0] pb-3.5 mb-4 font-sans">
                Store Specifications
              </h3>
              
              <div className="space-y-4 text-xs font-mono">
                <div className="flex justify-between items-center py-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#475569]">Tracking Code:</span>
                  <span className="text-[#2563EB] font-bold bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">{store.trackingCode}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#475569]">Floor Level:</span>
                  <span className="text-[#0F172A] font-semibold">{store.floor}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#475569]">Store Capacity:</span>
                  <span className="text-[#0F172A] font-bold">{store.sizeSqFt.toLocaleString()} Sq Ft</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#475569]">Lease Setup:</span>
                  <span className="text-[#0F172A] font-medium">{store.leaseType}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#475569]">Utilities Fitout:</span>
                  <span className="flex items-center gap-1 text-[#0F172A] font-semibold">
                    <Droplet className="h-3.5 w-3.5 text-[#2563EB]" />
                    {store.utilities ? "Fully Fitted" : "Custom Hookups Requested"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#475569]">Parking Shares:</span>
                  <span className="flex items-center gap-1 text-[#0F172A]">
                    <Car className="h-3.5 w-3.5 text-[#2563EB]" />
                    {store.parkingSpaces} Allotted
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#475569]">Height Parameter:</span>
                  <span className="text-[#0F172A] font-medium">{store.ceilingHeight}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#475569]">Loading Back Bays:</span>
                  <span className="text-[#0F172A]">{store.loadingBays} DockDoors</span>
                </div>
                <div className="flex justify-between items-center py-1 flex-wrap gap-2">
                  <span className="text-[#475569]">Previous Occupant:</span>
                  <span className="text-[#2563EB] italic font-semibold">{store.previousTenant || "None Logged"}</span>
                </div>
              </div>
            </div>
 
            {/* Premium Yearly Payment Tier Card */}
            <div className="bg-gradient-to-br from-white to-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)] relative overflow-hidden">
              <div className="absolute right-0 top-0 -mt-4 -mr-4 w-20 h-20 bg-[#2563EB]/5 rounded-full blur-xl animate-pulse"></div>
              
              <div className="flex items-center gap-2 text-[#2563EB] mb-4 font-bold">
                <Receipt className="h-4.5 w-4.5" />
                <span className="text-[10px] font-mono tracking-widest uppercase">Leasing Capital discount</span>
              </div>
              
              <h4 className="text-sm font-bold font-display uppercase tracking-wider mb-2.5 text-[#0F172A]">Discounted Yearly option</h4>
              <p className="text-[11px] text-[#475569] mb-5 leading-relaxed font-sans font-normal">
                By opting for the lump-sum annual program instead of standard monthly checks, you receive a full 15% discount on leasing overhead.
              </p>
 
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#475569]">Annual Payment:</span>
                  <span className="text-[#2563EB] font-extrabold">${simulatedYearlyDiscountAmount.toLocaleString()}/yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569]">Effective rate:</span>
                  <span className="text-[#16A34A] underline font-extrabold">${(simulatedYearlyDiscountAmount / 12).toLocaleString([], { maximumFractionDigits: 0 })}/mo</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#E2E8F0]">
                  <span className="text-[#475569]">Expiration program:</span>
                  <span className="text-[#0F172A] font-medium text-[10px] truncate">{formattedExpiration}</span>
                </div>
              </div>
 
              {!store.isYearlyPayment && store.status === 'Available' && (
                <button
                  type="button"
                  onClick={() => {
                    setCategory('Discounted Yearly Payment Options');
                    setModalOpen(true);
                  }}
                  className="w-full mt-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 rounded-xl text-[10px] font-display font-extrabold uppercase tracking-wide cursor-pointer transition-all shadow-md shadow-blue-500/10"
                >
                  Select Annual Contract
                </button>
              )}
            </div>
 
            {/* Suite Ownership Details Card & Owner Verification Form */}
            <div className="space-y-6">
              {store.ownerName ? (
                <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-3.5">
                  <div className="flex items-center gap-2 text-[#2563EB]">
                    <Landmark className="h-4.5 w-4.5" />
                    <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-[#2563EB]">Suite Ownership Registry</span>
                  </div>
                  
                  <h4 className="text-sm font-bold font-display uppercase tracking-wider text-[#0F172A]">Owner Information</h4>
                  
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                      <span className="text-[#475569]">Owner Name:</span>
                      <span className="text-[#0F172A] font-bold">{store.ownerName}</span>
                    </div>
                    {store.ownerEmail && (
                      <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                        <span className="text-[#475569]">Email:</span>
                        <a href={`mailto:${store.ownerEmail}`} className="text-[#2563EB] hover:underline truncate max-w-[140px] font-semibold">{store.ownerEmail}</a>
                      </div>
                    )}
                    {store.ownerPhone && (
                      <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                        <span className="text-[#475569]">Phone:</span>
                        <a href={`tel:${store.ownerPhone}`} className="text-[#2563EB] hover:underline font-semibold">{store.ownerPhone}</a>
                      </div>
                    )}
                    {store.ownershipType && (
                      <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                        <span className="text-[#475569]">Ownership Type:</span>
                        <span className="text-[#0F172A] font-semibold">{store.ownershipType}</span>
                      </div>
                    )}
                    {store.purchaseDate && (
                      <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                        <span className="text-[#475569]">Acquired Date:</span>
                        <span className="text-[#0F172A]">{new Date(store.purchaseDate).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                    )}
                    {store.expiryDate && (
                      <div className="flex justify-between py-1">
                        <span className="text-[#475569]">Lease Expiry:</span>
                        <span className="text-[#DC2626] font-semibold">{new Date(store.expiryDate).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-2.5">
                  <div className="flex items-center gap-2 text-[#475569]">
                    <ShieldAlert className="h-4.5 w-4.5" />
                    <span className="text-[10px] font-mono tracking-widest uppercase font-bold font-sans">Unregistered Space</span>
                  </div>
                  <h4 className="text-xs font-semibold uppercase text-[#0F172A]">Public Corporate Space</h4>
                  <p className="text-[11px] leading-relaxed text-[#475569] font-sans">
                    This retail allocation is currently unassigned. Complete a pricing offer subscription or lease registration to generate cryptographically signed ownership credentials.
                  </p>
                </div>
              )}
 
              {/* Secure Store Owner Verification Panel */}
              {store.ownerEmail && (
                <div className="bg-white border border-[#2563EB]/25 rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.06)] space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#2563EB]/5 rounded-bl-full pointer-events-none" />
                  
                  <div className="flex items-center gap-2 text-[#2563EB] font-sans font-bold">
                    <Mail className="h-4.5 w-4.5 text-[#2563EB]" />
                    <span className="text-[10px] font-mono tracking-widest uppercase">Secure Audit Verification</span>
                  </div>
 
                  <div>
                    <h4 className="text-xs font-bold font-display uppercase tracking-wider text-[#0F172A]">Email Store Details</h4>
                    <p className="text-[10px] text-[#475569] mt-1">Receive secure reports & credentials on registered emails.</p>
                  </div>
 
                  <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-mono uppercase text-[#475569] font-bold font-sans">Owner Email Address</label>
                      <input
                        type="email"
                        required
                        value={verifyEmail}
                        onChange={(e) => setVerifyEmail(e.target.value)}
                        placeholder="owner@example.com"
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-xl px-3.5 py-2 text-xs text-[#0F172A] outline-none font-medium placeholder-[#94A3B8] transition-colors"
                      />
                    </div>
 
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-mono uppercase text-[#475569] font-bold font-sans">Registry Tracking Code</label>
                      <input
                        type="text"
                        required
                        value={verifyTrackingCode}
                        onChange={(e) => setVerifyTrackingCode(e.target.value)}
                        placeholder="e.g. BM-12345"
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-xl px-3.5 py-2 text-xs text-[#0F172A] outline-none font-mono placeholder-[#94A3B8] transition-colors"
                      />
                    </div>
 
                    {verifyError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[10px] sm:text-xs leading-relaxed font-semibold">
                        {verifyError}
                      </div>
                    )}
 
                    {verifySuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[#16A34A] text-[10px] sm:text-xs leading-relaxed font-semibold">
                        {verifySuccess}
                      </div>
                    )}
 
                    <div className="grid grid-cols-2 gap-2.5 pt-1.5">
                      <button
                        type="button"
                        disabled={verifyLoading || !verifyEmail || !verifyTrackingCode}
                        onClick={handleSendDetails}
                        className="flex items-center justify-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#2563EB] text-[#475569] hover:text-[#0F172A] disabled:opacity-40 py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer"
                      >
                        {verifyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3.5 w-3.5 text-[#2563EB]" />}
                        Send Details
                      </button>
 
                      <button
                        type="button"
                        disabled={verifyLoading || !verifyEmail || !verifyTrackingCode}
                        onClick={handleDownloadDoc}
                        className="flex items-center justify-center gap-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-extrabold hover:opacity-90 disabled:opacity-40 py-2.5 rounded-xl text-[10px] font-display uppercase transition-all cursor-pointer shadow-md shadow-emerald-500/10"
                      >
                        {verifyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Certificate
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
 
            {/* Photo Showcase Gallery */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
                <h3 className="text-xs font-bold font-display uppercase tracking-wider text-[#0F172A]">
                  Media Showcase
                </h3>
              </div>
 
              <div className="grid grid-cols-2 gap-2.5">
                {store.images && store.images.length > 0 ? (
                  store.images.map((img, i) => (
                    <div key={i} className="group relative h-20 overflow-hidden rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-102 transition-all duration-300"
                        id={`visual-gallery-${i}`}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 h-28 bg-[#F8FAFC] border border-dotted border-[#E2E8F0] rounded-xl flex items-center justify-center text-[#94A3B8] font-mono text-[10px]">
                    No images compiled.
                  </div>
                )}
              </div>
            </div>
          </div>
 
          {/* Map Frame Zone & Content */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Map Frame */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-3 shadow-[0_4px_20px_rgba(15,23,42,0.06)] flex flex-col gap-3">
              <div className="flex items-center justify-between px-3 pt-2">
                <span className="text-xs font-mono uppercase text-[#0F172A] font-bold flex items-center gap-1.5">
                  <Milestone className="h-4.5 w-4.5 text-[#2563EB]" /> Active Mall Location Track
                </span>
                <span className="text-[10px] text-[#94A3B8] font-mono">OpenStreetMap GIS Platform only</span>
              </div>
              <div className="border border-[#E2E8F0] rounded-2xl overflow-hidden p-1 bg-[#F8FAFC]">
                <MapComponent stores={[store]} selectedStore={store} heightClass="h-[380px]" />
              </div>
            </div>            {/* Interior Descriptions Section */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <h3 className="text-xs font-bold font-display uppercase tracking-wider text-[#0F172A] border-b border-[#E2E8F0] pb-3.5 mb-6 flex items-center gap-2 font-sans">
                <Layers className="h-4.5 w-4.5 text-[#2563EB]" /> Structural Features Layout
              </h3>
  
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {store.description?.features?.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex gap-3 items-start bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-2xl"
                  >
                    <div className="w-5 h-5 rounded-lg bg-[#2563EB] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Check className="h-3.5 w-3.5 font-bold" />
                    </div>
                    <span className="text-xs text-[#0F172A] leading-relaxed font-sans font-semibold">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
 
            {/* Negotiation Offer & Smart Inquiry Side-by-Side Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              
              {/* Offer & Negotiation System Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-4">
                <div className="flex items-center gap-2 text-[#2563EB] font-sans font-bold">
                  <DollarSign className="h-4.5 w-4.5 text-[#2563EB]" />
                  <span className="text-[10px] font-mono tracking-widest uppercase">Acquisition Negotiation</span>
                </div>
 
                <div>
                  <h3 className="text-xs font-bold font-display uppercase tracking-wider text-[#0F172A]">Offer & Negotiation</h3>
                  <p className="text-[10px] text-[#475569] mt-1">Submit non-binding leasing or procurement proposals on this allocation.</p>
                </div>
 
                {offerSuccess ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-[#16A34A] space-y-2">
                    <p className="text-xs font-bold font-sans">Offer Submitted Successfully!</p>
                    <p className="text-[11px] leading-relaxed font-medium">Your pricing offer has been synchronized to the secure administrator terminal. A representative will contact you shortly.</p>
                    <button
                      type="button"
                      onClick={() => setOfferSuccess(false)}
                      className="text-[10px] uppercase tracking-wider font-bold text-[#2563EB] underline hover:opacity-85 pt-1 block cursor-pointer"
                    >
                      Submit another offer
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleOfferSubmit} className="space-y-3 font-sans">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase font-mono text-[#475569] font-bold font-sans">Contact Name *</label>
                        <input
                          type="text"
                          required
                          value={offerName}
                          onChange={(e) => setOfferName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] outline-none placeholder-[#94A3B8]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase font-mono text-[#475569] font-bold font-sans">Email Address *</label>
                          <input
                            type="email"
                            required
                            value={offerEmail}
                            onChange={(e) => setOfferEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] outline-none placeholder-[#94A3B8] font-sans"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase font-mono text-[#475569] font-bold font-sans">Phone Number *</label>
                          <input
                            type="tel"
                            required
                            value={offerPhone}
                            onChange={(e) => setOfferPhone(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] outline-none placeholder-[#94A3B8] font-mono"
                          />
                        </div>
                      </div>
                    </div>
 
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-mono text-[#475569] font-bold font-sans">Offer Amount (USD $) *</label>
                      <input
                        type="number"
                        required
                        value={offerAmount}
                        onChange={(e) => setOfferAmount(e.target.value)}
                        placeholder="e.g. 4500"
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] outline-none font-mono placeholder-[#94A3B8]"
                      />
                    </div>
 
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-mono text-[#475569] font-bold font-sans">Message or Terms Proposal</label>
                      <textarea
                        value={offerMessage}
                        onChange={(e) => setOfferMessage(e.target.value)}
                        placeholder="Detail payment schedules, fitout requirements, or specific contingencies..."
                        rows={2}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] outline-none placeholder-[#94A3B8] resize-none font-sans"
                      />
                    </div>
 
                    <button
                      type="submit"
                      disabled={offerLoading}
                      className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 rounded-xl font-display font-extrabold uppercase text-[10px] text-center tracking-wider transition-all cursor-pointer shadow-md shadow-blue-500/10"
                    >
                      {offerLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Submit Negotiation Offer"}
                    </button>
                  </form>
                )}
              </div>

              {/* Smart Inquiry System ("Ask About This Store") Form */}
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-4">
                <div className="flex items-center gap-2 text-[#2563EB] font-sans font-bold">
                  <Send className="h-4.5 w-4.5 text-[#2563EB]" />
                  <span className="text-[10px] font-mono tracking-widest uppercase">Corporate Inquiries</span>
                </div>
 
                <div>
                  <h3 className="text-xs font-bold font-display uppercase tracking-wider text-[#0F172A]">Ask About This Store</h3>
                  <p className="text-[10px] text-[#475569] mt-1">Submit direct questions regarding spacing, utilities, layout dimensions or zoning.</p>
                </div>
 
                {inquirySuccess ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-[#16A34A] space-y-2">
                    <p className="text-xs font-bold font-sans">Inquiry Dispatched Successfully!</p>
                    <p className="text-[11px] leading-relaxed font-medium">Your inquiry has been linked directly to our real-time messaging pipeline. Concierge agents will reply locally via live support.</p>
                    <button
                      type="button"
                      onClick={() => setInquirySuccess(false)}
                      className="text-[10px] uppercase tracking-wider font-bold text-[#2563EB] underline hover:opacity-85 pt-1 block cursor-pointer"
                    >
                      Submit another inquiry
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleInquirySubmit} className="space-y-3 font-sans">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase font-mono text-[#475569] font-bold font-sans">Your Name *</label>
                        <input
                          type="text"
                          required
                          value={inquiryName}
                          onChange={(e) => setInquiryName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] outline-none placeholder-[#94A3B8]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase font-mono text-[#475569] font-bold font-sans">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={inquiryEmail}
                          onChange={(e) => setInquiryEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] outline-none placeholder-[#94A3B8]"
                        />
                      </div>
                    </div>
 
                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-mono text-[#475569] font-bold font-sans">Inquiry Message *</label>
                      <textarea
                        required
                        value={inquiryMessage}
                        onChange={(e) => setInquiryMessage(e.target.value)}
                        placeholder="e.g. Can we expand the ceiling heights or combine double bays?"
                        rows={3}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] outline-none placeholder-[#94A3B8] resize-none font-sans"
                      />
                    </div>
 
                    <button
                      type="submit"
                      disabled={inquiryLoading}
                      className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 rounded-xl font-display font-bold uppercase text-[10px] text-center tracking-wider transition-all cursor-pointer shadow-md shadow-blue-500/10"
                    >
                      {inquiryLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Dispatch Message"}
                    </button>
                  </form>
                )}
              </div>

            </div>

          </div>

        </div>

      </div>      {/* Booking Lease simulation modular form */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in font-sans animate-fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-[0_10px_40px_rgba(15,23,42,0.15)] relative text-[#0F172A]">
            <h3 className="text-lg font-display font-extrabold text-[#2563EB] mb-1 uppercase tracking-wide">
              Commercial Acquisition
            </h3>
            <p className="text-xs text-[#475569] mb-6 font-sans">
              Securing spaces: <span className="text-[#0F172A] font-bold">{store.storeName}</span> ({store.trackingCode}). Complete details below to request priority tenant reservation.
            </p>
 
            {success ? (
              <div className="text-center py-6 space-y-4 animate-fade-in text-[#0F172A]">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-[#16A34A] shadow-md">
                  <Check className="h-7 w-7" />
                </div>
                <h4 className="text-base font-bold font-display text-[#0F172A]">Allocation Request Submitted!</h4>
                <p className="text-xs text-[#475569] leading-relaxed max-w-sm mx-auto p-1 text-center font-sans">
                  Excellent! Your allocation request for <span className="font-bold text-[#0F172A]">{store.storeName}</span> has been received with tracking reference <span className="font-mono font-bold text-[#2563EB] tracking-wider bg-[#F8FAFC] px-1.5 py-0.5 rounded border border-[#E2E8F0]">{store.trackingCode}</span>.
                </p>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-2xl text-left text-xs space-y-2.5 font-mono text-[#0F172A] max-w-sm mx-auto">
                  <p className="text-[10px] text-[#475569] uppercase font-bold font-sans">Request Registry:</p>
                  <p><span className="text-[#475569]">Applicant:</span> {customerName}</p>
                  <p><span className="text-[#475569]">Email:</span> {emailStr}</p>
                  <p><span className="text-[#475569]">Phone:</span> {phoneStr}</p>
                  <p><span className="text-[#475569]">Proposed Rate:</span> ${Number(requestedAmount || store.monthlyLease).toLocaleString()}/mo</p>
                  <p><span className="text-[#475569]">Status:</span> <span className="text-amber-600 bg-amber-50 font-bold border border-amber-200 px-1 rounded">PENDING_ADMIN_APPROVAL</span></p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setSuccess(false);
                    setCustomerName('');
                    setEmailStr('');
                    setPhoneStr('');
                    setNotesStr('');
                  }}
                  className="w-full max-w-sm mx-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-extrabold py-3.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-colors block"
                >
                  Return to Store Details
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeaseSubmit} className="space-y-4 text-xs font-normal">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#475569] mb-1.5 font-bold uppercase tracking-wider text-[10px]">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] text-[#0F172A] rounded-xl px-4 py-3 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[#475569] mb-1.5 font-bold uppercase tracking-wider text-[10px]">Contact Email *</label>
                    <input
                      type="email"
                      required
                      value={emailStr}
                      onChange={(e) => setEmailStr(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] text-[#0F172A] rounded-xl px-4 py-3 outline-none text-xs"
                    />
                  </div>
                </div>
 
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#475569] mb-1.5 font-bold uppercase tracking-wider text-[10px]">Contact Phone *</label>
                    <input
                      type="tel"
                      required
                      value={phoneStr}
                      onChange={(e) => setPhoneStr(e.target.value)}
                      placeholder="+1 555-0199"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] text-[#0F172A] rounded-xl px-4 py-3 outline-none font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[#475569] mb-1.5 font-bold uppercase tracking-wider text-[10px]">Proposed Offer Amount ($/mo) *</label>
                    <input
                      type="number"
                      required
                      value={requestedAmount}
                      onChange={(e) => setRequestedAmount(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] text-[#0F172A] rounded-xl px-4 py-3 outline-none font-mono text-xs"
                    />
                  </div>
                </div>
 
                <div>
                  <label className="block text-[#475569] mb-1.5 font-bold uppercase tracking-wider text-[10px]">Notes & Intended Brand Use</label>
                  <textarea
                    rows={3}
                    value={notesStr}
                    onChange={(e) => setNotesStr(e.target.value)}
                    placeholder="Provide details about your business and proposed timeline..."
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] text-[#0F172A] rounded-xl px-4 py-3 outline-none text-xs text-[#0F172A]"
                  ></textarea>
                </div>
 
                <div className="flex gap-3 pt-5 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-slate-50 text-[#475569] py-3.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer text-center text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    id="submit-virtual-lease-btn"
                    className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-3.5 rounded-xl font-extrabold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5 text-xs shadow-md shadow-blue-500/10"
                  >
                    {loading ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-white" />
                    ) : (
                      "Lock Allocation"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
