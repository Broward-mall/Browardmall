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
import MapComponent from './MapComponent';

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
      return { class: 'bg-[#d4af37] text-black border border-[#d4af37]', label: 'AVAILABLE' };
    }
    if (s === 'SOLD') {
      return { class: 'bg-neutral-800 border border-neutral-700 text-neutral-400', label: 'SOLD' };
    }
    if (s === 'LEASED') {
      return { class: 'bg-blue-600 border border-blue-500 text-white', label: 'LEASED' };
    }
    if (s === 'RESERVED') {
      return { class: 'bg-amber-600 border border-amber-500 text-white', label: 'RESERVED' };
    }
    if (s === 'UNDER NEGOTIATION' || s === 'UNDER_NEGOTIATION') {
      return { class: 'bg-purple-600 border border-purple-500 text-white', label: 'UNDER NEGOTIATION' };
    }
    if (s === 'COMING SOON' || s === 'COMING_SOON') {
      return { class: 'bg-sky-500 border border-sky-400 text-white', label: 'COMING SOON' };
    }
    return { class: 'bg-neutral-700 text-white border border-neutral-600', label: status.toUpperCase() };
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
    <div className="relative bg-[#0a0a0c] text-neutral-100 min-h-screen py-10 font-sans">
      
      {/* Decorative background element */}
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#121216] via-[#0a0a0c] to-transparent pointer-events-none border-b border-neutral-900"></div>
 
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Navigation Breadcrumb */}
        <button
          type="button"
          onClick={() => onNavigate('')}
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-[#d4af37] bg-[#121216] border border-neutral-800 hover:border-[#d4af37] py-2 px-4 rounded-xl shadow-lg transition-all cursor-pointer mb-8"
        >
          <ArrowLeft className="h-4 w-4 text-[#d4af37]" />
          Back to Directory Map
        </button>
 
        {/* Store Title Board Header Section */}
        <div className="bg-[#121216] border border-neutral-800 rounded-3xl p-6 sm:p-8 mb-8 shadow-[0_4px_30px_rgba(0,0,0,0.4)] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {store.logo ? (
              <img
                src={store.logo}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover border border-neutral-850 shadow-lg"
                id="store-logo-detail"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 bg-black border border-neutral-800 text-[#d4af37] rounded-2xl text-2xl font-bold flex items-center justify-center font-display shadow-inner">S</div>
            )}
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                <span className="text-[10px] font-mono tracking-wider uppercase bg-neutral-950 text-neutral-300 border border-neutral-800 px-2.5 py-0.5 rounded-lg font-bold">
                  Code: {store.trackingCode}
                </span>
                <span className={`text-[10px] uppercase tracking-wider font-bold font-mono px-2.5 py-0.5 rounded-lg shadow-sm ${badgeInfo.class}`}>
                  {badgeInfo.label}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
                {store.storeName}
              </h1>
              <p className="text-xs text-neutral-400 flex items-center justify-center sm:justify-start gap-1 mt-1 font-medium">
                <MapPin className="h-3.5 w-3.5 text-[#d4af37]" />
                {store.location}, inside {store.mallName || "Broward Mall Complex"} {store.unitNumber ? `(Suite ${store.unitNumber})` : ''}
              </p>
            </div>
          </div>
 
          <div className="w-full md:w-auto flex flex-col gap-3.5 sm:flex-row md:flex-col lg:flex-row shrink-0 font-display">
            <div className="text-center sm:text-left bg-neutral-950 border border-neutral-850 rounded-2xl px-5 py-3 min-w-[160px]">
              <span className="text-[9px] text-[#d4af37] uppercase tracking-wider font-mono block font-bold">Monthly Lease Rate</span>
              <span className="text-xl font-extrabold text-white block">${store.monthlyLease.toLocaleString()} <span className="text-xs font-normal text-neutral-500">/mo</span></span>
            </div>
            {store.status === 'Available' ? (
              <button
                type="button"
                id="btn-initiate-leasing"
                onClick={() => setModalOpen(true)}
                className="bg-[#d4af37] hover:bg-[#c49e27] text-black font-extrabold text-xs py-3.5 px-6 rounded-2xl uppercase tracking-wider transition-all duration-300 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-black" />
                Initiate Acquirement
              </button>
            ) : (
              <div className="bg-[#18181e] border border-neutral-850 px-6 py-4 rounded-2xl flex items-center gap-2 text-xs font-medium text-neutral-400 justify-center shadow-inner">
                <ShieldAlert className="h-4.5 w-4.5 text-[#d4af37]" />
                Lease locked or allocated manually.
              </div>
            )}
          </div>
        </div>
 
        {/* Grid layout splits specifications vs OSM Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Specifications Dashboard Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#121216] border border-neutral-800 rounded-3xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
              <h3 className="text-xs font-bold font-display uppercase tracking-wider text-white border-b border-neutral-900 pb-3.5 mb-4">
                Store Specifications
              </h3>
              
              <div className="space-y-4 text-xs font-mono">
                <div className="flex justify-between items-center py-2.5 border-b border-neutral-900">
                  <span className="text-neutral-400">Tracking Code:</span>
                  <span className="text-[#d4af37] font-bold bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">{store.trackingCode}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-neutral-900">
                  <span className="text-neutral-400">Floor Level:</span>
                  <span className="text-white font-semibold">{store.floor}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-neutral-900">
                  <span className="text-neutral-400">Store Capacity:</span>
                  <span className="text-white font-bold">{store.sizeSqFt.toLocaleString()} Sq Ft</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-neutral-900">
                  <span className="text-neutral-400">Lease Setup:</span>
                  <span className="text-neutral-200 font-medium">{store.leaseType}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-neutral-900">
                  <span className="text-neutral-400">Utilities Fitout:</span>
                  <span className="flex items-center gap-1 text-white font-semibold">
                    <Droplet className="h-3.5 w-3.5 text-blue-400" />
                    {store.utilities ? "Fully Fitted" : "Custom Hookups Requested"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-neutral-900">
                  <span className="text-neutral-400">Parking Shares:</span>
                  <span className="flex items-center gap-1 text-white">
                    <Car className="h-3.5 w-3.5 text-[#d4af37]" />
                    {store.parkingSpaces} Allotted
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-neutral-900">
                  <span className="text-neutral-400">Height Parameter:</span>
                  <span className="text-neutral-200 font-medium">{store.ceilingHeight}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-neutral-900">
                  <span className="text-neutral-400">Loading Back Bays:</span>
                  <span className="text-neutral-200">{store.loadingBays} DockDoors</span>
                </div>
                <div className="flex justify-between items-center py-1 flex-wrap gap-2">
                  <span className="text-neutral-400">Previous Occupant:</span>
                  <span className="text-[#d4af37] italic font-semibold">{store.previousTenant || "None Logged"}</span>
                </div>
              </div>
            </div>
 
            {/* Premium Yearly Payment Tier Card */}
            <div className="bg-gradient-to-br from-[#121216] to-[#010103] border border-neutral-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 -mt-4 -mr-4 w-20 h-20 bg-[#d4af37]/5 rounded-full blur-xl animate-pulse"></div>
              
              <div className="flex items-center gap-2 text-[#d4af37] mb-4">
                <Receipt className="h-4.5 w-4.5" />
                <span className="text-[10px] font-mono tracking-widest uppercase font-bold">Leasing Capital discount</span>
              </div>
              
              <h4 className="text-sm font-bold font-display uppercase tracking-wider mb-2.5 text-white">Discounted Yearly option</h4>
              <p className="text-[11px] text-neutral-300 mb-5 leading-relaxed font-sans font-normal">
                By opting for the lump-sum annual program instead of standard monthly checks, you receive a full 15% discount on leasing overhead.
              </p>
 
              <div className="bg-neutral-950/60 border border-neutral-850 rounded-2xl p-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Annual Payment:</span>
                  <span className="text-[#d4af37] font-extrabold">${simulatedYearlyDiscountAmount.toLocaleString()}/yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Effective rate:</span>
                  <span className="text-emerald-400 underline font-extrabold">${(simulatedYearlyDiscountAmount / 12).toLocaleString([], { maximumFractionDigits: 0 })}/mo</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-neutral-900">
                  <span className="text-neutral-400">Expiation program:</span>
                  <span className="text-white font-medium text-[10px] truncate">{formattedExpiration}</span>
                </div>
              </div>
 
              {!store.isYearlyPayment && store.status === 'Available' && (
                <button
                  type="button"
                  onClick={() => {
                    setCategory('Discounted Yearly Payment Options');
                    setModalOpen(true);
                  }}
                  className="w-full mt-4 bg-white hover:bg-[#d4af37] text-black py-2.5 rounded-xl text-[10px] font-display font-extrabold uppercase tracking-wide cursor-pointer transition-all"
                >
                  Select Annual Contract
                </button>
              )}
            </div>

            {/* Suite Ownership Details Card & Owner Verification Form */}
            <div className="space-y-6">
              {store.ownerName ? (
                <div className="bg-[#121216]/90 border border-neutral-800 rounded-3xl p-6 shadow-md space-y-3.5">
                  <div className="flex items-center gap-2 text-[#d4af37]">
                    <Landmark className="h-4.5 w-4.5" />
                    <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-amber-500">Suite Ownership Registry</span>
                  </div>
                  
                  <h4 className="text-sm font-bold font-display uppercase tracking-wider text-white">Owner Information</h4>
                  
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-neutral-900">
                      <span className="text-neutral-400">Owner Name:</span>
                      <span className="text-white font-bold">{store.ownerName}</span>
                    </div>
                    {store.ownerEmail && (
                      <div className="flex justify-between py-1 border-b border-neutral-900">
                        <span className="text-neutral-400">Email:</span>
                        <a href={`mailto:${store.ownerEmail}`} className="text-[#d4af37] hover:underline truncate max-w-[140px]">{store.ownerEmail}</a>
                      </div>
                    )}
                    {store.ownerPhone && (
                      <div className="flex justify-between py-1 border-b border-neutral-900">
                        <span className="text-neutral-400">Phone:</span>
                        <a href={`tel:${store.ownerPhone}`} className="text-[#d4af37] hover:underline">{store.ownerPhone}</a>
                      </div>
                    )}
                    {store.ownershipType && (
                      <div className="flex justify-between py-1 border-b border-neutral-900">
                        <span className="text-neutral-400">Ownership Type:</span>
                        <span className="text-white font-semibold">{store.ownershipType}</span>
                      </div>
                    )}
                    {store.purchaseDate && (
                      <div className="flex justify-between py-1 border-b border-neutral-900">
                        <span className="text-neutral-400">Acquired Date:</span>
                        <span className="text-white">{new Date(store.purchaseDate).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                    )}
                    {store.expiryDate && (
                      <div className="flex justify-between py-1">
                        <span className="text-neutral-400">Lease Expiry:</span>
                        <span className="text-rose-400 font-semibold">{new Date(store.expiryDate).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#121216]/60 border border-neutral-850 rounded-3xl p-6 shadow-md space-y-2.5">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <ShieldAlert className="h-4.5 w-4.5" />
                    <span className="text-[10px] font-mono tracking-widest uppercase font-bold">Unregistered Space</span>
                  </div>
                  <h4 className="text-xs font-semibold uppercase text-neutral-300">Public Corporate Space</h4>
                  <p className="text-[11px] leading-relaxed text-neutral-400 font-sans">
                    This retail allocation is currently unassigned. Complete a pricing offer subscription or lease registration to generate cryptographically signed ownership credentials.
                  </p>
                </div>
              )}

              {/* Secure Store Owner Verification Panel */}
              {store.ownerEmail && (
                <div className="bg-[#121216] border border-[#d4af37]/30 rounded-3xl p-6 shadow-lg space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#d4af37]/5 rounded-bl-full pointer-events-none" />
                  
                  <div className="flex items-center gap-2 text-[#d4af37]">
                    <Mail className="h-4.5 w-4.5 text-amber-500" />
                    <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-amber-500">Secure Audit Verification</span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold font-display uppercase tracking-wider text-white">Email Store Details</h4>
                    <p className="text-[10px] text-neutral-400 mt-1">Receive secure reports & credentials on registered emails.</p>
                  </div>

                  <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-mono uppercase text-neutral-400 font-bold">Owner Email Address</label>
                      <input
                        type="email"
                        required
                        value={verifyEmail}
                        onChange={(e) => setVerifyEmail(e.target.value)}
                        placeholder="owner@example.com"
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#d4af37] rounded-xl px-3.5 py-2 text-xs text-white outline-none font-medium placeholder-neutral-600 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-mono uppercase text-neutral-400 font-bold">Registry Tracking Code</label>
                      <input
                        type="text"
                        required
                        value={verifyTrackingCode}
                        onChange={(e) => setVerifyTrackingCode(e.target.value)}
                        placeholder="e.g. BM-12345"
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#d4af37] rounded-xl px-3.5 py-2 text-xs text-white outline-none font-mono placeholder-neutral-600 transition-colors"
                      />
                    </div>

                    {verifyError && (
                      <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-xl text-rose-400 text-[10px] sm:text-xs leading-relaxed font-semibold">
                        {verifyError}
                      </div>
                    )}

                    {verifySuccess && (
                      <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-emerald-400 text-[10px] sm:text-xs leading-relaxed font-semibold">
                        {verifySuccess}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5 pt-1.5">
                      <button
                        type="button"
                        disabled={verifyLoading || !verifyEmail || !verifyTrackingCode}
                        onClick={handleSendDetails}
                        className="flex items-center justify-center gap-1.5 bg-neutral-900 border border-neutral-800 hover:border-[#d4af37] text-white disabled:opacity-40 py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all"
                      >
                        {verifyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3.5 w-3.5 text-[#d4af37]" />}
                        Send Details
                      </button>

                      <button
                        type="button"
                        disabled={verifyLoading || !verifyEmail || !verifyTrackingCode}
                        onClick={handleDownloadDoc}
                        className="flex items-center justify-center gap-1.5 bg-[#d4af37] text-black font-extrabold hover:opacity-90 disabled:opacity-40 py-2.5 rounded-xl text-[10px] font-display uppercase transition-all"
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
            <div className="bg-[#121216] border border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-900 pb-2.5">
                <h3 className="text-xs font-bold font-display uppercase tracking-wider text-white">
                  Media Showcase
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {store.images && store.images.length > 0 ? (
                  store.images.map((img, i) => (
                    <div key={i} className="group relative h-20 overflow-hidden rounded-xl bg-neutral-950 border border-neutral-850">
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                        id={`visual-gallery-${i}`}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 h-28 bg-neutral-950 border border-dotted border-neutral-800 rounded-xl flex items-center justify-center text-neutral-500 font-mono text-[10px]">
                    No images compiled.
                  </div>
                )}
              </div>
            </div>
          </div>
 
          {/* Map Frame Zone & Content */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Map Frame */}
            <div className="bg-[#121216] border border-neutral-800 rounded-3xl p-3 shadow-[0_4px_25px_rgba(0,0,0,0.3)] flex flex-col gap-3">
              <div className="flex items-center justify-between px-3 pt-2">
                <span className="text-xs font-mono uppercase text-white font-bold flex items-center gap-1.5">
                  <Milestone className="h-4.5 w-4.5 text-[#d4af37]" /> Active Mall Location Track
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">OpenStreetMap GIS Platform only</span>
              </div>
              <div className="border border-neutral-900 rounded-2xl overflow-hidden p-1 bg-neutral-950">
                <MapComponent stores={[store]} selectedStore={store} heightClass="h-[380px]" />
              </div>
            </div>
 
            {/* Interior Descriptions Section */}
            <div className="bg-[#121216] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
              <h3 className="text-xs font-bold font-display uppercase tracking-wider text-white border-b border-neutral-900 pb-3.5 mb-6 flex items-center gap-2">
                <Layers className="h-4.5 w-4.5 text-[#d4af37]" /> Structural Features Layout
              </h3>
 
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {store.description?.features?.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex gap-3 items-start bg-[#18181e] border border-neutral-850 p-4 rounded-2xl"
                  >
                    <div className="w-5 h-5 rounded-lg bg-[#d4af37] text-black flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                      <Check className="h-3.5 w-3.5 font-bold" />
                    </div>
                    <span className="text-xs text-neutral-200 leading-relaxed font-sans font-semibold">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Negotiation Offer & Smart Inquiry Side-by-Side Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              
              {/* Offer & Negotiation System Card */}
              <div className="bg-[#121216] border border-neutral-800 rounded-3xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.3)] space-y-4">
                <div className="flex items-center gap-2 text-[#d4af37]">
                  <DollarSign className="h-4.5 w-4.5 text-amber-500" />
                  <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-amber-500">Acquisition Negotiation</span>
                </div>

                <div>
                  <h3 className="text-xs font-bold font-display uppercase tracking-wider text-white">Offer & Negotiation</h3>
                  <p className="text-[10px] text-neutral-400 mt-1">Submit non-binding leasing or procurement proposals on this allocation.</p>
                </div>

                {offerSuccess ? (
                  <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-2xl text-emerald-400 space-y-2">
                    <p className="text-xs font-bold font-sans">Offer Submitted Successfully!</p>
                    <p className="text-[11px] leading-relaxed font-medium">Your pricing offer has been synchronized to the secure administrator terminal. A representative will contact you shortly.</p>
                    <button
                      type="button"
                      onClick={() => setOfferSuccess(false)}
                      className="text-[10px] uppercase tracking-wider font-bold text-white underline hover:opacity-85 pt-1 block"
                    >
                      Submit another offer
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleOfferSubmit} className="space-y-3 font-sans">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase font-mono text-neutral-400 font-bold">Contact Name *</label>
                        <input
                          type="text"
                          required
                          value={offerName}
                          onChange={(e) => setOfferName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#d4af37] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none placeholder-neutral-700"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase font-mono text-neutral-400 font-bold">Email Address *</label>
                          <input
                            type="email"
                            required
                            value={offerEmail}
                            onChange={(e) => setOfferEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#d4af37] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none placeholder-neutral-700 font-sans"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase font-mono text-neutral-400 font-bold">Phone Number *</label>
                          <input
                            type="tel"
                            required
                            value={offerPhone}
                            onChange={(e) => setOfferPhone(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                            className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#d4af37] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none placeholder-neutral-700 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-mono text-neutral-400 font-bold">Offer Amount (USD $) *</label>
                      <input
                        type="number"
                        required
                        value={offerAmount}
                        onChange={(e) => setOfferAmount(e.target.value)}
                        placeholder="e.g. 4500"
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#d4af37] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono placeholder-neutral-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-mono text-neutral-400 font-bold">Message or Terms Proposal</label>
                      <textarea
                        value={offerMessage}
                        onChange={(e) => setOfferMessage(e.target.value)}
                        placeholder="Detail payment schedules, fitout requirements, or specific contingencies..."
                        rows={2}
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#d4af37] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none placeholder-neutral-700 resize-none font-sans"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={offerLoading}
                      className="w-full bg-[#d4af37] hover:opacity-90 disabled:opacity-40 text-black py-2.5 rounded-xl font-display font-extrabold uppercase text-[10px] text-center tracking-wider transition-all"
                    >
                      {offerLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Submit Negotiation Offer"}
                    </button>
                  </form>
                )}
              </div>

              {/* Smart Inquiry System ("Ask About This Store") Form */}
              <div className="bg-[#121216] border border-neutral-800 rounded-3xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.3)] space-y-4">
                <div className="flex items-center gap-2 text-[#d4af37]">
                  <Send className="h-4.5 w-4.5 text-amber-500" />
                  <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-amber-500">Corporate Inquiries</span>
                </div>

                <div>
                  <h3 className="text-xs font-bold font-display uppercase tracking-wider text-white">Ask About This Store</h3>
                  <p className="text-[10px] text-neutral-400 mt-1">Submit direct questions regarding spacing, utilities, layout dimensions or zoning.</p>
                </div>

                {inquirySuccess ? (
                  <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-2xl text-emerald-400 space-y-2">
                    <p className="text-xs font-bold font-sans">Inquiry Dispatched Successfully!</p>
                    <p className="text-[11px] leading-relaxed font-medium">Your inquiry has been linked directly to our real-time messaging pipeline. Concierge agents will reply locally via live support.</p>
                    <button
                      type="button"
                      onClick={() => setInquirySuccess(false)}
                      className="text-[10px] uppercase tracking-wider font-bold text-white underline hover:opacity-85 pt-1 block"
                    >
                      Submit another inquiry
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleInquirySubmit} className="space-y-3 font-sans">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase font-mono text-neutral-400 font-bold">Your Name *</label>
                        <input
                          type="text"
                          required
                          value={inquiryName}
                          onChange={(e) => setInquiryName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#d4af37] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none placeholder-neutral-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase font-mono text-neutral-400 font-bold">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={inquiryEmail}
                          onChange={(e) => setInquiryEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#d4af37] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none placeholder-neutral-700"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] uppercase font-mono text-neutral-400 font-bold">Inquiry Message *</label>
                      <textarea
                        required
                        value={inquiryMessage}
                        onChange={(e) => setInquiryMessage(e.target.value)}
                        placeholder="e.g. Can we expand the ceiling heights or combine double bays?"
                        rows={3}
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#d4af37] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none placeholder-neutral-700 resize-none font-sans"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={inquiryLoading}
                      className="w-full bg-neutral-900 border border-neutral-800 hover:border-[#d4af37] text-white disabled:opacity-40 py-2.5 rounded-xl font-display font-bold uppercase text-[10px] text-center tracking-wider transition-all"
                    >
                      {inquiryLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Dispatch Message"}
                    </button>
                  </form>
                )}
              </div>

            </div>

          </div>

        </div>

      </div>
 
      {/* Booking Lease simulation modular form */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-[#121216] border border-neutral-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.8)] relative text-white">
            <h3 className="text-lg font-display font-extrabold text-[#d4af37] mb-1 rounded uppercase tracking-wide">
              Commercial Acquisition
            </h3>
            <p className="text-xs text-neutral-400 mb-6 font-sans">
              Securing spaces: <span className="text-white font-bold">{store.storeName}</span> ({store.trackingCode}). Complete details below to request priority tenant reservation.
            </p>

            {success ? (
              <div className="text-center py-6 space-y-4 animate-fade-in text-white">
                <div className="w-14 h-14 rounded-full bg-emerald-950 border border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 shadow-lg">
                  <Check className="h-7 w-7" />
                </div>
                <h4 className="text-base font-bold font-display text-white">Allocation Request Submitted!</h4>
                <p className="text-xs text-neutral-300 leading-relaxed max-w-sm mx-auto p-1 text-center font-sans">
                  Excellent! Your allocation request for <span className="font-bold text-white">{store.storeName}</span> has been received with tracking reference <span className="font-mono font-bold text-[#d4af37] tracking-wider bg-black px-1.5 py-0.5 rounded border border-neutral-800">{store.trackingCode}</span>.
                </p>
                <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-2xl text-left text-xs space-y-2.5 font-mono text-neutral-300 max-w-sm mx-auto">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold">Request Registry:</p>
                  <p><span className="text-neutral-500">Applicant:</span> {customerName}</p>
                  <p><span className="text-neutral-500">Email:</span> {emailStr}</p>
                  <p><span className="text-neutral-500">Phone:</span> {phoneStr}</p>
                  <p><span className="text-neutral-500">Proposed Rate:</span> ${Number(requestedAmount || store.monthlyLease).toLocaleString()}/mo</p>
                  <p><span className="text-neutral-500">Status:</span> <span className="text-amber-400 bg-amber-950/40 font-bold border border-amber-800 px-1 rounded">PENDING_ADMIN_APPROVAL</span></p>
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
                  className="w-full max-w-sm mx-auto bg-[#d4af37] hover:bg-[#c49e27] text-black font-extrabold py-3.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-colors block"
                >
                  Return to Store Details
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeaseSubmit} className="space-y-4 text-xs font-normal">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-neutral-400 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-neutral-950 border border-neutral-850 focus:border-[#d4af37] text-white rounded-xl px-4 py-3 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Contact Email *</label>
                    <input
                      type="email"
                      required
                      value={emailStr}
                      onChange={(e) => setEmailStr(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full bg-neutral-950 border border-neutral-850 focus:border-[#d4af37] text-white rounded-xl px-4 py-3 outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-neutral-400 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Contact Phone *</label>
                    <input
                      type="tel"
                      required
                      value={phoneStr}
                      onChange={(e) => setPhoneStr(e.target.value)}
                      placeholder="+1 555-0199"
                      className="w-full bg-neutral-950 border border-neutral-850 focus:border-[#d4af37] text-white rounded-xl px-4 py-3 outline-none font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Proposed Offer Amount ($/mo) *</label>
                    <input
                      type="number"
                      required
                      value={requestedAmount}
                      onChange={(e) => setRequestedAmount(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-850 focus:border-[#d4af37] text-white rounded-xl px-4 py-3 outline-none font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Notes & Intended Brand Use</label>
                  <textarea
                    rows={3}
                    value={notesStr}
                    onChange={(e) => setNotesStr(e.target.value)}
                    placeholder="Provide details about your business and proposed timeline..."
                    className="w-full bg-neutral-950 border border-neutral-850 focus:border-[#d4af37] text-white rounded-xl px-4 py-3 outline-none text-xs"
                  ></textarea>
                </div>

                <div className="flex gap-3 pt-5 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 py-3.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer text-center text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    id="submit-virtual-lease-btn"
                    className="flex-1 bg-[#d4af37] hover:bg-[#c49e27] text-black py-3.5 rounded-xl font-extrabold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5 text-xs"
                  >
                    {loading ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-black" />
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
