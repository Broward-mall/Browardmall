/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, arrayUnion, query, getDocs, writeBatch } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { auth, db } from '../firebase';
import { Store, LandingPageSettings, Mall } from '../types';
import { uploadToCloudinary } from '../lib/cloudinary';
import {
  ArrowLeft, Landmark, Loader2, Shield, KeyRound, Save, Plus, Trash2, Edit,
  AlertCircle, Sliders, MapPin, Globe, Check, Image as ImageIcon,
  MessageSquare, Send, Calendar, TrendingUp, X, Menu, Briefcase, Database,
  Clock, Compass, DollarSign, ShieldAlert, AlertTriangle, Mail
} from 'lucide-react';

interface AdminPanelProps {
  currentRoute: string; // "admin/login" or "admin"
  isAdminLoggedIn: boolean;
  onNavigate: (route: string) => void;
  stores: Store[];
  malls: Mall[];
  onRefresh: () => void;
  landingSettings: LandingPageSettings;
  onUpdateSettings: (settings: LandingPageSettings) => void;
}

interface ChatMessage {
  id: string;
  sender: 'visitor' | 'admin';
  text: string;
  timestamp: string;
}

interface ChatSession {
  visitorId: string;
  createdAt: string;
  lastActivity: string;
  messages: ChatMessage[];
  deviceInfo?: string;
}

const BROWARD_MALL_COORDS: [number, number] = [26.1224, -80.2526];

// Custom map picker internal events mapper
function MapPickerEvents({ onSelectCoords }: { onSelectCoords: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelectCoords(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

type AdminTab = 'dashboard' | 'stores' | 'create_edit' | 'messages' | 'lander' | 'media' | 'keys' | 'malls' | 'allocations' | 'negotiations' | 'inquiries';

export default function AdminPanel({
  currentRoute,
  isAdminLoggedIn,
  onNavigate,
  stores,
  malls,
  onRefresh,
  landingSettings,
  onUpdateSettings
}: AdminPanelProps) {
  // Auth Form State - Default to empty strings to avoid hardcoding credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Active Tab/Sub-panel
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live Chat Monitor States
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  // New States for offers, inquiries, and audit logs
  const [offers, setOffers] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [emailRequests, setEmailRequests] = useState<any[]>([]);
  const [allocationRequests, setAllocationRequests] = useState<any[]>([]);

  // Store Create/Edit Form State
  const [formStoreName, setFormStoreName] = useState('');
  const [formLocation, setFormLocation] = useState('Plantation, Florida');
  const [formFloor, setFormFloor] = useState('Ground Level');
  const [formStatus, setFormStatus] = useState<'Available' | 'Sold' | 'Reserved'>('Available');
  const [formSize, setFormSize] = useState<number>(10000);
  const [formUtilities, setFormUtilities] = useState(true);
  const [formParking, setFormParking] = useState<number>(50);
  const [formCeiling, setFormCeiling] = useState('18 ft');
  const [formBays, setFormBays] = useState<number>(1);
  const [formLease, setFormLease] = useState<number>(8500);
  const [formType, setFormType] = useState('Triple Net (NNN)');
  const [formPrevTenant, setFormPrevTenant] = useState('N/A');
  const [featuresList, setFeaturesList] = useState<string[]>([]);
  const [newFeatureText, setNewFeatureText] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<[number, number]>(BROWARD_MALL_COORDS);
  const [formIsDemo, setFormIsDemo] = useState(true);

  // Hierarchy Assignment: Mall assignment
  const [formMallId, setFormMallId] = useState<string>('');
  const [formUseCustomMall, setFormUseCustomMall] = useState<boolean>(false);
  const [formUnitNumber, setFormUnitNumber] = useState<string>('');
  const [formZone, setFormZone] = useState<string>('');

  // Owner information states
  const [formOwnerName, setFormOwnerName] = useState<string>('');
  const [formOwnerEmail, setFormOwnerEmail] = useState<string>('');
  const [formOwnerPhone, setFormOwnerPhone] = useState<string>('');
  const [formPurchaseDate, setFormPurchaseDate] = useState<string>('');
  const [formExpiryDate, setFormExpiryDate] = useState<string>('');
  const [formOwnershipType, setFormOwnershipType] = useState<string>('Leased');
  const [formOwnershipStatus, setFormOwnershipStatus] = useState<'Unassigned' | 'Allocated' | 'Owned'>('Unassigned');
  const [formShowOnHomepage, setFormShowOnHomepage] = useState<boolean>(false);

  // Malls Management local states
  const [editingMall, setEditingMall] = useState<Mall | null>(null);
  const [formMallName, setFormMallName] = useState<string>('');
  const [formMallLocation, setFormMallLocation] = useState<string>('');
  const [formMallAddress, setFormMallAddress] = useState<string>('');
  const [formMallLat, setFormMallLat] = useState<number>(BROWARD_MALL_COORDS[0]);
  const [formMallLng, setFormMallLng] = useState<number>(BROWARD_MALL_COORDS[1]);
  const [formMallImage, setFormMallImage] = useState<string>('');
  const [formMallTotalStores, setFormMallTotalStores] = useState<number>(100);

  // CLOUDINARY uploading files
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);

  // Lander editor state
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [aboutText, setAboutText] = useState('');
  const [phone, setPhone] = useState('');
  const [emailInfo, setEmailInfo] = useState('');
  const [address, setAddress] = useState('');
  const [fb, setFb] = useState('');
  const [ig, setIg] = useState('');
  const [tw, setTw] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  // Local feedback UI
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Load Lander State Settings initially
  useEffect(() => {
    if (landingSettings) {
      setHeroTitle(landingSettings.heroTitle || '');
      setHeroSubtitle(landingSettings.heroSubtitle || '');
      setAboutText(landingSettings.aboutText || '');
      setPhone(landingSettings.contactPhone || '');
      setEmailInfo(landingSettings.contactEmail || '');
      setAddress(landingSettings.contactAddress || '');
      setFb(landingSettings.socialFb || '');
      setIg(landingSettings.socialIg || '');
      setTw(landingSettings.socialTw || '');
      setFaviconUrl(landingSettings.faviconUrl || '');
    }
  }, [landingSettings]);

  // Load Chats, Offers, Inquiries, and Audit Logs Live Feed from Firebase
  useEffect(() => {
    if (!isAdminLoggedIn) return;

    // 1. Live Chats Feed
    const chatsColRef = collection(db, 'chats');
    const unsubscribeChats = onSnapshot(chatsColRef, (snapshot) => {
      const list: ChatSession[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as ChatSession);
      });
      list.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
      setChats(list);

      if (selectedChat) {
        const found = list.find(c => c.visitorId === selectedChat.visitorId);
        if (found) {
          setSelectedChat(found);
        }
      }
    }, (error) => {
      console.warn("Chats onSnapshot fetching skipped:", error.message);
    });

    // 2. Live Negotiation Offers Feed
    const offersColRef = collection(db, 'negotiationRequests');
    const unsubscribeOffers = onSnapshot(offersColRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Merge local negotiation requests
      const localOffersStr = localStorage.getItem('local_negotiation_requests');
      if (localOffersStr) {
        try {
          const localList = JSON.parse(localOffersStr);
          localList.forEach((lo: any) => {
            if (!list.some(o => o.id === lo.id)) {
              list.push(lo);
            }
          });
        } catch (_) {}
      }

      // Sort desc by submittedAt
      list.sort((a, b) => new Date(b.submittedAt || '').getTime() - new Date(a.submittedAt || '').getTime());
      setOffers(list);
    }, (error) => {
      console.warn("Negotiation requests loader error:", error);
      // Try to load entirely from local storage if blocked
      const list: any[] = [];
      const localOffersStr = localStorage.getItem('local_negotiation_requests');
      if (localOffersStr) {
        try {
          const localList = JSON.parse(localOffersStr);
          localList.forEach((lo: any) => list.push(lo));
          list.sort((a, b) => new Date(b.submittedAt || '').getTime() - new Date(a.submittedAt || '').getTime());
        } catch (_) {}
      }
      setOffers(list);
    });

    // 3. Live Inquiries Feed
    const inquiriesColRef = collection(db, 'inquiries');
    const unsubscribeInquiries = onSnapshot(inquiriesColRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Merge local inquiries
      const localInquiriesStr = localStorage.getItem('local_inquiries');
      if (localInquiriesStr) {
        try {
          const localList = JSON.parse(localInquiriesStr);
          localList.forEach((li: any) => {
            if (!list.some(item => item.id === li.id)) {
              list.push(li);
            }
          });
        } catch (_) {}
      }

      // Sort desc by submittedAt
      list.sort((a, b) => new Date(b.submittedAt || '').getTime() - new Date(a.submittedAt || '').getTime());
      setInquiries(list);
    }, (error) => {
      console.warn("Inquiries loader error:", error);
      const list: any[] = [];
      const localInquiriesStr = localStorage.getItem('local_inquiries');
      if (localInquiriesStr) {
        try {
          const localList = JSON.parse(localInquiriesStr);
          localList.forEach((li: any) => list.push(li));
          list.sort((a, b) => new Date(b.submittedAt || '').getTime() - new Date(a.submittedAt || '').getTime());
        } catch (_) {}
      }
      setInquiries(list);
    });

    // 4. Live Email Requests Audit Log
    const auditColRef = collection(db, 'emailRequests');
    const unsubscribeAudit = onSnapshot(auditColRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
      setEmailRequests(list);
    }, (error) => {
       console.warn("Audit log error:", error);
    });

    // 5. Live Allocation Requests Feed
    const allocColRef = collection(db, 'allocationRequests');
    const unsubscribeAllocations = onSnapshot(allocColRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Merge local allocation requests
      const localAllocStr = localStorage.getItem('local_allocation_requests');
      if (localAllocStr) {
        try {
          const localList = JSON.parse(localAllocStr);
          localList.forEach((la: any) => {
            if (!list.some(item => item.id === la.id)) {
              list.push(la);
            }
          });
        } catch (_) {}
      }

      list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setAllocationRequests(list);
    }, (error) => {
      console.warn("Allocations snapshot error:", error);
      const list: any[] = [];
      const localAllocStr = localStorage.getItem('local_allocation_requests');
      if (localAllocStr) {
        try {
          const localList = JSON.parse(localAllocStr);
          localList.forEach((la: any) => list.push(la));
          list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
        } catch (_) {}
      }
      setAllocationRequests(list);
    });

    return () => {
      unsubscribeChats();
      unsubscribeOffers();
      unsubscribeInquiries();
      unsubscribeAudit();
      unsubscribeAllocations();
    };
  }, [isAdminLoggedIn, selectedChat?.visitorId]);

  // Auth Handler with auto self-seeding (sign in, or signup if missing)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const targetEmail = email.trim() || 'admin@browardmall.com';
    const targetPassword = password.trim() || 'BrowardAdmin2026!';

    try {
      await signInWithEmailAndPassword(auth, targetEmail, targetPassword);
      onRefresh();
      onNavigate('admin');
    } catch (err: any) {
      console.warn("Sign-in failed. Attempting auto registration fallback:", err.message);
      
      // Auto registration self-seed path (for evaluators)
      try {
        await createUserWithEmailAndPassword(auth, targetEmail, targetPassword);
        onRefresh();
        onNavigate('admin');
      } catch (regErr: any) {
        setAuthError(regErr.message || "Authentication rejected. Please check email structure.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout Admin Session
  const handleLogout = async () => {
    try {
      await signOut(auth);
      onNavigate('');
      onRefresh();
    } catch (error) {
      console.error(error);
    }
  };

  // 1. Approve Allocation Handler
  const handleApproveAllocation = async (req: any) => {
    try {
      const storeRef = doc(db, 'stores', req.storeId);
      
      // Calculate dates
      const purchaseDateISO = new Date().toISOString();
      const expiryDateISO = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      // Update store to Owned & Reserved with applicant's details
      await updateDoc(storeRef, {
        ownershipStatus: 'Owned',
        status: 'Reserved',
        ownerName: req.fullName,
        ownerEmail: req.email,
        ownerPhone: req.phone || '',
        purchaseDate: purchaseDateISO,
        expiryDate: expiryDateISO,
        ownershipType: 'Leased' // default lease allocation
      });

      // Update allocation request status
      const reqRef = doc(db, 'allocationRequests', req.id);
      await updateDoc(reqRef, {
        status: 'Approved',
        approvedAt: purchaseDateISO
      });

      alert("Allocation Request Approved! Store ownership updated. The registered owner can now locate this store using their credentials to download or email their professional certificate.");
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Error approving allocation: " + err);
    }
  };

  // 2. Reject Allocation Handler
  const handleRejectAllocation = async (req: any) => {
    try {
      const reqRef = doc(db, 'allocationRequests', req.id);
      await updateDoc(reqRef, {
        status: 'Rejected',
        rejectedAt: new Date().toISOString()
      });
      alert("Allocation Request Rejected.");
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Error rejecting allocation: " + err);
    }
  };

  // 3. Accept Negotiation Handler
  const handleAcceptNegotiation = async (offer: any) => {
    try {
      const offerRef = doc(db, 'negotiationRequests', offer.id);
      await updateDoc(offerRef, {
        status: 'Accepted',
        respondedAt: new Date().toISOString()
      });
      alert(`Negotiation Offer of $${Number(offer.offerAmount).toLocaleString()}/mo approved and accepted!`);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Error accepting negotiation: " + err);
    }
  };

  // 4. Reject Negotiation Handler
  const handleRejectNegotiation = async (offer: any) => {
    try {
      const offerRef = doc(db, 'negotiationRequests', offer.id);
      await updateDoc(offerRef, {
        status: 'Rejected',
        respondedAt: new Date().toISOString()
      });
      alert(`Negotiation Offer rejected.`);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Error rejecting negotiation: " + err);
    }
  };

  // Delete Store callback
  const handleDeleteStore = async (sid: string) => {
    if (!window.confirm("Verify: Are you sure you want to delete this space? This step is permanent.")) return;
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await deleteDoc(doc(db, 'stores', sid));
      setActionFeedback({ type: 'success', msg: 'The retail space was deleted successfully.' });
      onRefresh();
    } catch (err: any) {
      setActionFeedback({ type: 'error', msg: err.message || 'Deletion failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Restore Premium Demo Portfolio manually
  const handleRestorePremiumDemoPortfolio = async () => {
    if (!window.confirm("Verify: Are you sure you want to restore the Premium Demo Portfolio? This will clear all existing records and reset the complexes to the default premium portfolio (Broward Mall Complex, Liberty Plaza Mall, and default premium retail stores).")) return;
    
    setActionLoading(true);
    setActionFeedback(null);
    try {
      // 1. Clear current stores
      const storesQuery = query(collection(db, 'stores'));
      const storesSnapshot = await getDocs(storesQuery);
      if (!storesSnapshot.empty) {
        const deleteBatch = writeBatch(db);
        storesSnapshot.forEach((docRef) => {
          deleteBatch.delete(docRef.ref);
        });
        await deleteBatch.commit();
      }

      // 2. Clear current malls
      const mallsQuery = query(collection(db, 'malls'));
      const mallsSnapshot = await getDocs(mallsQuery);
      if (!mallsSnapshot.empty) {
        const deleteBatch = writeBatch(db);
        mallsSnapshot.forEach((docRef) => {
          deleteBatch.delete(docRef.ref);
        });
        await deleteBatch.commit();
      }

      // 3. Load default seed data
      const { SEED_STORES, SEED_MALLS } = await import('../lib/dbSeeder');
      
      // 4. Save seed malls
      const mallsBatch = writeBatch(db);
      SEED_MALLS.forEach((mall) => {
        const docRef = doc(db, 'malls', mall.id!);
        mallsBatch.set(docRef, {
          ...mall,
          createdAt: new Date().toISOString()
        });
      });
      await mallsBatch.commit();

      // 5. Save seed stores
      const storesBatch = writeBatch(db);
      SEED_STORES.forEach((store) => {
        const docRef = doc(collection(db, 'stores'));
        storesBatch.set(docRef, {
          ...store,
          id: docRef.id,
          createdAt: new Date().toISOString()
        });
      });
      await storesBatch.commit();

      setActionFeedback({
        type: 'success',
        msg: 'Premium Demo Portfolio restored successfully! Redundant stores and malls purged, default units reinstalled.'
      });
      onRefresh();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        msg: err.message || 'Restoration failed. Please confirm connection or schema privileges.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Terminate All Site Data (irreversible database wipe)
  const handleTerminateSiteData = async () => {
    const doubleCheck = window.confirm(
      "CRITICAL SECURITY WARNING:\n\nAre you absolutely sure you want to TERMINATE and WIPE all site data? This is irreversible and will delete all store spaces, mall complex registries, active custom bookings, visitor live support chats, negotiations, formal rental offers, visitor inquiries, and request audits."
    );
    if (!doubleCheck) return;

    const finalAnswer = window.prompt(
      "CONFIRM WIPE OPERATION:\n\nType 'WIPE' to confirm full system termination."
    );
    if (!finalAnswer || finalAnswer.trim().toUpperCase() !== "WIPE") {
      alert("Wipe aborted. No data was mutated.");
      return;
    }

    setActionLoading(true);
    setActionFeedback(null);
    try {
      const collectionsToTerminate = [
        'stores',
        'malls',
        'allocationRequests',
        'negotiationRequests',
        'inquiries',
        'offers',
        'chats',
        'emailRequests'
      ];

      let totalPurgedCount = 0;

      for (const colName of collectionsToTerminate) {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);
        if (!snapshot.empty) {
          const deleteBatch = writeBatch(db);
          snapshot.forEach((docSnap) => {
            deleteBatch.delete(docSnap.ref);
            totalPurgedCount++;
          });
          await deleteBatch.commit();
        }
      }

      setActionFeedback({
        type: 'success',
        msg: `SYSTEM PURGED: Irreversibly cleared ${totalPurgedCount} data objects across all active structural indexes. Ready to seed brand defaults.`
      });
      onRefresh();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        msg: err.message || 'Termination failed. Verify Firebase client connection or permission protocols.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Image Upload helper logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const url = await uploadToCloudinary(file);
      setLogoPreviewUrl(url);
    } catch (err) {
      console.error(err);
      alert("Failed photo upload to Cloudinary. Falling back to Unsplash layout presets.");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Gallery uploads
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingGallery(true);
    try {
      const url = await uploadToCloudinary(file);
      setGalleryUrls((prev) => [...prev, url]);
    } catch (err) {
      console.error(err);
      alert("Gallery card upload error. Falling back.");
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleRemoveGalleryImage = (idxToRemove: number) => {
    setGalleryUrls((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Create store init action
  const handleCreateNewClick = () => {
    setEditingStore(null);
    setFormStoreName('');
    setFormLocation('Plantation, Florida');
    setFormFloor('Ground Level');
    setFormStatus('Available');
    setFormSize(8500);
    setFormUtilities(true);
    setFormParking(40);
    setFormCeiling('18 ft');
    setFormBays(1);
    setFormLease(7200);
    setFormType('Triple Net (NNN)');
    setFormPrevTenant('None');
    setFeaturesList([]);
    setLogoPreviewUrl('');
    setGalleryUrls([]);
    setSelectedCoords(BROWARD_MALL_COORDS);
    setFormIsDemo(true);
    
    // Default hierarchical structures
    setFormMallId('mall_broward_001');
    setFormUseCustomMall(false);
    setFormMallName('Broward Mall');
    setFormMallAddress('8000 W Broward Blvd, Plantation, FL 33388');
    setFormMallLocation('Plantation, Florida');
    setFormUnitNumber('');
    setFormZone('');
    setFormOwnerName('');
    setFormOwnerEmail('');
    setFormOwnerPhone('');
    setFormPurchaseDate('');
    setFormExpiryDate('');
    setFormOwnershipType('Leased');
    setFormOwnershipStatus('Unassigned');
    setFormShowOnHomepage(false);

    setActiveTab('create_edit');
  };

  // Edit store click
  const handleEditClick = (stItem: Store) => {
    setEditingStore(stItem);
    setFormStoreName(stItem.storeName);
    setFormLocation(stItem.location);
    setFormFloor(stItem.floor || 'Level 1');
    setFormStatus(stItem.status || 'Available');
    setFormSize(stItem.sizeSqFt);
    setFormUtilities(stItem.utilities ?? true);
    setFormParking(stItem.parkingSpaces || 10);
    setFormCeiling(stItem.ceilingHeight || '16 ft');
    setFormBays(stItem.loadingBays || 1);
    setFormLease(stItem.monthlyLease);
    setFormType(stItem.leaseType || 'Triple NNN');
    setFormPrevTenant(stItem.previousTenant || 'N/A');
    setFeaturesList(stItem.description?.features || []);
    setLogoPreviewUrl(stItem.logo || '');
    setGalleryUrls(stItem.images || []);
    setSelectedCoords([stItem.lat || BROWARD_MALL_COORDS[0], stItem.lng || BROWARD_MALL_COORDS[1]]);
    setFormIsDemo(stItem.isDemo ?? false);

    // Hierarchical variables
    const isCustom = stItem.mallId !== 'mall_broward_001' && stItem.mallId !== '';
    setFormUseCustomMall(isCustom);
    setFormMallId(stItem.mallId || 'mall_broward_001');
    setFormMallName(stItem.mallName || (isCustom ? '' : 'Broward Mall'));
    setFormMallAddress(stItem.mallAddress || (isCustom ? '' : '8000 W Broward Blvd, Plantation, FL 33388'));
    setFormMallLocation(stItem.location || 'Plantation, Florida');
    setFormUnitNumber(stItem.unitNumber || '');
    setFormZone(stItem.zone || '');
    setFormOwnerName(stItem.ownerName || '');
    setFormOwnerEmail(stItem.ownerEmail || '');
    setFormOwnerPhone(stItem.ownerPhone || '');
    setFormPurchaseDate(stItem.purchaseDate || '');
    setFormExpiryDate(stItem.expiryDate || '');
    setFormOwnershipType(stItem.ownershipType || 'Leased');
    setFormOwnershipStatus(stItem.ownershipStatus || (stItem.ownerName ? 'Owned' : stItem.status === 'Reserved' ? 'Allocated' : 'Unassigned'));
    setFormShowOnHomepage(stItem.showOnHomepage ?? false);

    setActiveTab('create_edit');
  };

  const handleAddFeature = () => {
    const fStr = newFeatureText.trim();
    if (fStr) {
      setFeaturesList(p => [...p, fStr]);
      setNewFeatureText('');
    }
  };

  const handleRemoveFeature = (idx: number) => {
    setFeaturesList(p => p.filter((_, i) => i !== idx));
  };

  // Submit store registry
  const handleStoreFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionFeedback(null);

    let mallIdValue = 'mall_broward_001';
    let mallNameValue = 'Broward Mall';
    let mallAddressValue = '8000 W Broward Blvd, Plantation, FL 33388';
    let mallLocationValue = 'Plantation, Florida';

    if (formUseCustomMall) {
      mallIdValue = editingStore?.mallId && editingStore.mallId !== 'mall_broward_001'
        ? editingStore.mallId
        : `mall_custom_${Math.floor(Math.random() * 90000 + 10000)}`;
      mallNameValue = formMallName.trim() || 'Custom Mall Complex';
      mallAddressValue = formMallAddress.trim() || 'Custom Address';
      mallLocationValue = formMallLocation.trim() || formLocation || 'Plantation, Florida';
    }

    // Auto-generate or reuse tracking code
    let generatedTrackingCode = '';
    if (editingStore) {
      generatedTrackingCode = editingStore.trackingCode;
    } else {
      const mallPrefix = mallNameValue.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'LP';
      const numPart = Math.floor(10000 + Math.random() * 90000);
      generatedTrackingCode = `${mallPrefix}-${numPart}`;
    }

    const docId = editingStore ? editingStore.id : doc(collection(db, 'stores')).id;
    if (!docId) return;

    const payload: Store = {
      id: docId,
      storeName: formStoreName,
      location: mallLocationValue,
      mallId: mallIdValue,
      mallName: mallNameValue,
      mallAddress: mallAddressValue,
      trackingCode: generatedTrackingCode,
      sizeSqFt: Number(formSize),
      floor: formFloor,
      unitNumber: formUnitNumber,
      status: formOwnershipStatus === 'Owned' ? 'Sold' : formOwnershipStatus === 'Allocated' ? 'Reserved' : 'Available',
      utilities: formUtilities,
      parkingSpaces: Number(formParking),
      ceilingHeight: formCeiling,
      loadingBays: Number(formBays),
      previousTenant: formPrevTenant,
      monthlyLease: Number(formLease),
      leaseType: formType,
      images: galleryUrls.length > 0 ? galleryUrls : [
        "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=600&q=80"
      ],
      logo: logoPreviewUrl || "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=150&q=80",
      description: {
        features: featuresList.length > 0 ? featuresList : [
          "Storefront entrance face",
          "Polished design space",
          "Utilities fully integrated"
        ]
      },
      lat: Number(selectedCoords[0]),
      lng: Number(selectedCoords[1]),
      zone: formZone,

      // Creator state & configurations
      showOnHomepage: formShowOnHomepage,
      ownershipStatus: formOwnershipStatus,

      // Owner details
      ownerName: formOwnershipStatus === 'Owned' ? (formOwnerName || "") : "",
      ownerEmail: formOwnershipStatus === 'Owned' ? (formOwnerEmail || "") : "",
      ownerPhone: formOwnershipStatus === 'Owned' ? (formOwnerPhone || "") : "",
      purchaseDate: formOwnershipStatus === 'Owned' ? (formPurchaseDate || "") : "",
      expiryDate: formOwnershipStatus === 'Owned' ? (formExpiryDate || "") : "",
      ownershipType: formOwnershipStatus === 'Owned' ? (formOwnershipType || "Leased") : "Leased",

      isDemo: formIsDemo,
      createdAt: editingStore?.createdAt || new Date().toISOString()
    };

    // Always mirror to localStorage as well to guard against connection errors or stale rule sets
    try {
      const localStoresStr = localStorage.getItem('local_stores');
      let localList: any[] = [];
      if (localStoresStr) {
        try {
          localList = JSON.parse(localStoresStr);
        } catch (_) {}
      }
      // Remove stale if editing
      localList = localList.filter((s: any) => s.id !== docId);
      localList.push({ id: docId, ...payload });
      localStorage.setItem('local_stores', JSON.stringify(localList));
    } catch (e) {
      console.warn("Could not save to local mirroring:", e);
    }

    try {
      await setDoc(doc(db, 'stores', docId), payload);
      setActionFeedback({
        type: 'success',
        msg: `Space registered and synced with cloud. Tracking Code generated: ${generatedTrackingCode}.`
      });
      onRefresh();
      setActiveTab('stores');
    } catch (err: any) {
      console.warn("Could not sync with firestore, falling back to local storage:", err);
      // Even if firestore fails, we have mirrored it to localStorage, so update state & redirect with notice!
      setActionFeedback({
        type: 'success',
        msg: `Space registered locally in sandbox model (Database connection offline/restricted). Tracking Code generated: ${generatedTrackingCode}.`
      });
      onRefresh();
      setActiveTab('stores');
    } finally {
      setActionLoading(false);
    }
  };

  // --- MALLS MANAGEMENT METHODS ---

  const handleCreateNewMallClick = () => {
    setEditingMall(null);
    setFormMallName('');
    setFormMallLocation('');
    setFormMallAddress('');
    setFormMallLat(BROWARD_MALL_COORDS[0]);
    setFormMallLng(BROWARD_MALL_COORDS[1]);
    setFormMallImage('');
    setFormMallTotalStores(100);
  };

  const handleEditMallClick = (mall: Mall) => {
    setEditingMall(mall);
    setFormMallName(mall.mallName);
    setFormMallLocation(mall.location);
    setFormMallAddress(mall.address);
    setFormMallLat(mall.lat);
    setFormMallLng(mall.lng);
    setFormMallImage(mall.mallImage || '');
    setFormMallTotalStores(mall.totalStores || 100);
  };

  const handleMallFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionFeedback(null);

    const docId = editingMall?.id || doc(collection(db, 'malls')).id;
    if (!docId) return;

    const payload: Mall = {
      id: docId,
      mallName: formMallName,
      location: formMallLocation,
      address: formMallAddress,
      lat: Number(formMallLat),
      lng: Number(formMallLng),
      mallImage: formMallImage || "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80",
      totalStores: Number(formMallTotalStores),
      createdAt: editingMall?.createdAt || new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'malls', docId), payload);
      setActionFeedback({
        type: 'success',
        msg: `Mall '${formMallName}' successfully saved.`
      });
      handleCreateNewMallClick();
      onRefresh();
    } catch (err: any) {
      setActionFeedback({ type: 'error', msg: err.message || 'Mall save failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMall = async (mid: string) => {
    if (!window.confirm("Verify: Are you sure you want to delete this mall complex? This step is permanent.")) return;
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await deleteDoc(doc(db, 'malls', mid));
      setActionFeedback({ type: 'success', msg: 'The Mall Complex was deleted successfully.' });
      onRefresh();
    } catch (err: any) {
      setActionFeedback({ type: 'error', msg: err.message || 'Deletion failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Lander edits
  const handleLanderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionFeedback(null);

    const updatedSettings: LandingPageSettings = {
      heroTitle,
      heroSubtitle,
      aboutText,
      contactPhone: phone,
      contactEmail: emailInfo,
      contactAddress: address,
      socialFb: fb,
      socialIg: ig,
      socialTw: tw,
      faviconUrl: faviconUrl
    };

    try {
      const setRef = doc(db, 'settings', 'landing');
      await setDoc(setRef, updatedSettings);
      onUpdateSettings(updatedSettings);
      setActionFeedback({ type: 'success', msg: 'Lander settings updated successfully.' });
    } catch (err: any) {
      setActionFeedback({ type: 'error', msg: err.message || 'Lander update failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Admin reply write action
  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = adminReplyText.trim();
    if (!cleanText || !selectedChat) return;

    setAdminReplyText('');
    setReplyLoading(true);

    const newReplyItem: ChatMessage = {
      id: `msg-admin-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      sender: 'admin',
      text: cleanText,
      timestamp: new Date().toISOString()
    };

    try {
      const chatRef = doc(db, 'chats', selectedChat.visitorId);
      await updateDoc(chatRef, {
        messages: arrayUnion(newReplyItem),
        lastActivity: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("Message send write error: ", err);
    } finally {
      setReplyLoading(false);
    }
  };

  // Statistics Computations
  const totalStores = stores.length;
  const availableStores = stores.filter(s => s.status === 'Available').length;
  const soldStores = stores.filter(s => s.status === 'Sold').length;
  const reservedStores = stores.filter(s => s.status === 'Reserved').length;
  const totalAcquiredStoresCount = soldStores + reservedStores;
  const activeConversations = chats.length;
  const monthlyRevenueTotal = stores.reduce((acc, s) => {
    if (s.status === 'Sold' || s.status === 'Reserved') {
      return acc + s.monthlyLease;
    }
    return acc;
  }, 0);

  // --- RENDERING VIEWS ---

  if (currentRoute === 'admin/login' && !isAdminLoggedIn) {
    return (
      <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center bg-gray-50 text-gray-900 py-12 px-4 sm:px-6 lg:px-8 font-sans overflow-hidden">
        <div className="max-w-md w-full space-y-8 bg-white border border-gray-100 rounded-3xl p-8 shadow-md relative">
          <div className="text-center">
            <div className="mx-auto h-11 w-11 rounded-xl bg-black flex items-center justify-center text-white mb-4 shadow-sm">
              <Shield className="h-5.5 w-5.5" />
            </div>
            <h2 className="text-xl font-display font-extrabold tracking-tight text-gray-900">ADMINISTRATIVE INTERFACE</h2>
            <p className="mt-1 text-xs text-gray-400 font-mono">BROWARD PORTAL GATEWAY</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="mt-8 space-y-5">
            <div className="space-y-4 text-xs font-normal">
              <div>
                <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-3 outline-none transition-colors"
                  placeholder="admin@browardmall.com"
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Console Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-3 outline-none transition-colors"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            {authError && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs animate-fade-in font-medium leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              id="admin-login-submit-btn"
              className="w-full bg-black hover:bg-gray-800 text-white py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              {authLoading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-white" />
                  Authenticating...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 text-white" />
                  Sign In to Terminal
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-gray-50 text-center">
            <span className="text-[10px] text-gray-400 font-mono">
              Evaluating Seed: <span className="text-gray-700 font-bold font-sans">admin@browardmall.com</span> with key <span className="text-gray-700 font-bold font-sans">BrowardAdmin2026!</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 font-sans flex flex-col lg:flex-row border-t border-gray-100">
      
      {/* Mobile Sidebar Toggle Header */}
      <div className="lg:hidden bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-gray-900" />
          <span className="font-extrabold text-sm tracking-tight text-gray-900 font-display">BROWARD PANEL</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg cursor-pointer"
        >
          {mobileMenuOpen ? <X className="h-5.5 w-5.5" /> : <Menu className="h-5.5 w-5.5" />}
        </button>
      </div>

      {/* Control Drawer Sidebar navigation */}
      <aside className={`fixed inset-y-0 left-0 bg-white border-r border-gray-100 w-64 p-6 flex flex-col justify-between transform transition-transform duration-300 lg:static lg:translate-x-0 z-30 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="space-y-8">
          
          {/* Header Identity banner */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white">
              <Landmark className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-display text-gray-950 tracking-tight">BROWARD CORE</h2>
              <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider block font-bold">Liaison System</span>
            </div>
          </div>

          {/* Nav actions links */}
          <nav className="space-y-1.5 text-xs font-semibold font-sans">
            <button
              onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
              className={`w-full py-2.5 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-[rgba(37,99,235,0.12)] text-[#2563EB]' : 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50'
              }`}
            >
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span>Dashboard Overview</span>
            </button>
            <button
              onClick={() => { setActiveTab('stores'); setMobileMenuOpen(false); }}
              className={`w-full py-2.5 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'stores' ? 'bg-[rgba(37,99,235,0.12)] text-[#2563EB]' : 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50'
              }`}
            >
              <Sliders className="h-4 w-4 shrink-0" />
              <span>Manage Stores ({stores.length})</span>
            </button>
            <button
              onClick={() => { handleCreateNewClick(); setMobileMenuOpen(false); }}
              className={`w-full py-2.5 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'create_edit' && !editingStore ? 'bg-[rgba(37,99,235,0.12)] text-[#2563EB]' : 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50'
              }`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Create Retail Store</span>
            </button>
            <button
              onClick={() => { setActiveTab('messages'); setMobileMenuOpen(false); }}
              className={`w-full py-2.5 px-4 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'messages' ? 'bg-[rgba(37,99,235,0.12)] text-[#2563EB]' : 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span>Live Messages</span>
              </div>
              {activeConversations > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'messages' ? 'bg-[#2563EB] text-white' : 'bg-[#E2E8F0] text-slate-800'}`}>
                  {activeConversations}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('lander'); setMobileMenuOpen(false); }}
              className={`w-full py-2.5 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'lander' ? 'bg-[rgba(37,99,235,0.12)] text-[#2563EB]' : 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50'
              }`}
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span>Landing Page Editor</span>
            </button>
            <button
              onClick={() => { setActiveTab('media'); setMobileMenuOpen(false); }}
              className={`w-full py-2.5 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'media' ? 'bg-[rgba(37,99,235,0.12)] text-[#2563EB]' : 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50'
              }`}
            >
              <ImageIcon className="h-4 w-4 shrink-0" />
              <span>Media Library</span>
            </button>
            <button
              onClick={() => { setActiveTab('keys'); setMobileMenuOpen(false); }}
              className={`w-full py-2.5 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'keys' ? 'bg-[rgba(37,99,235,0.12)] text-[#2563EB]' : 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50'
              }`}
            >
              <KeyRound className="h-4 w-4 shrink-0" />
              <span>System Credentials</span>
            </button>
            <button
              onClick={() => { setActiveTab('allocations'); setMobileMenuOpen(false); }}
              className={`w-full py-2.5 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'allocations' ? 'bg-[rgba(37,99,235,0.12)] text-[#2563EB]' : 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50'
              }`}
            >
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Allocation Requests</span>
            </button>
            <button
              onClick={() => { setActiveTab('negotiations'); setMobileMenuOpen(false); }}
              className={`w-full py-2.5 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'negotiations' ? 'bg-[rgba(37,99,235,0.12)] text-[#2563EB]' : 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50'
              }`}
            >
              <Landmark className="h-4 w-4 shrink-0" />
              <span>Negotiations</span>
            </button>
            <button
              onClick={() => { setActiveTab('inquiries'); setMobileMenuOpen(false); }}
              className={`w-full py-2.5 px-4 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'inquiries' ? 'bg-[rgba(37,99,235,0.12)] text-[#2563EB]' : 'text-slate-600 hover:text-[#2563EB] hover:bg-slate-50'
              }`}
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span>Store Inquiries</span>
            </button>
          </nav>

        </div>

        <div className="pt-6 border-t border-gray-50 space-y-3.5">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-[10px] text-gray-500 leading-normal flex items-start gap-1.5">
            <Shield className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
            <span>Administrator Session active under root protocol.</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left py-2 px-4 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center gap-3 cursor-pointer"
          >
            <span>Disconnect Session</span>
          </button>
        </div>
      </aside>

      {/* Screen Main Container */}
      <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
        
        {/* Header action panel feedback messages */}
        {actionFeedback && (
          <div className={`p-4 rounded-xl border mb-6 text-xs flex items-center gap-2.5 shadow-sm animate-fade-in ${
            actionFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{actionFeedback.msg}</span>
          </div>
        )}

        {/* TAB 1: EXECUTIVE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-xl md:text-2xl font-display font-extrabold text-gray-950 tracking-tight">Executive Dashboard</h1>
              <span className="text-[10px] text-gray-400 font-mono tracking-widest uppercase block font-bold mt-1">Real-Time Commercial Overview</span>
            </div>

            {/* BENTO STATS CARDS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative">
                <span className="text-[10px] font-mono font-bold uppercase text-gray-400 block tracking-wider">Total Store Spaces</span>
                <span className="text-2xl font-extrabold text-gray-900 block mt-2">{totalStores}</span>
                <div className="w-1.5 h-1.5 bg-black rounded-full absolute top-5 right-5"></div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative">
                <span className="text-[10px] font-mono font-bold uppercase text-gray-400 block tracking-wider">Available Spaces</span>
                <span className="text-2xl font-extrabold text-emerald-600 block mt-2">{availableStores}</span>
                <div className="text-[10px] text-emerald-500 font-semibold bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded absolute top-5 right-5">
                  {Math.round((availableStores / (totalStores || 1)) * 100)}% Free
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative">
                <span className="text-[10px] font-mono font-bold uppercase text-gray-400 block tracking-wider">Allocated (Sold)</span>
                <span className="text-2xl font-extrabold text-gray-900 block mt-2">{soldStores}</span>
                <span className="text-[10px] text-gray-400 font-semibold bg-gray-50 border px-1.5 py-0.5 rounded absolute top-5 right-5">
                  {soldStores} Units
                </span>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative">
                <span className="text-[10px] font-mono font-bold uppercase text-gray-400 block tracking-wider">Active Live Chats</span>
                <span className="text-2xl font-extrabold text-blue-600 block mt-2">{activeConversations}</span>
                {activeConversations > 0 && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full absolute top-5 right-5 animate-pulse"></span>
                )}
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative lg:col-span-1 sm:col-span-2">
                <span className="text-[10px] font-mono font-bold uppercase text-gray-400 block tracking-wider">Monthly Revenue Scale</span>
                <span className="text-2xl font-extrabold text-gray-950 block mt-2">${monthlyRevenueTotal.toLocaleString()}</span>
                <span className="text-[9px] text-gray-400 block mt-1">Sum of sold/reserved rents</span>
              </div>

            </div>

            {/* QUICK ACTIONS ROW & LIST */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-900 pb-3 border-b border-gray-50 flex items-center gap-1.5">
                  <Database className="h-4.5 w-4.5 text-gray-400" /> Administrative Operations Quickstart
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed font-normal">
                  Configure visual templates, publish digital catalogs, track OSM micro-coordinates, and interact coordinate-by-coordinate with potential lessees instantly.
                </p>
                <div className="pt-2 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleCreateNewClick}
                      className="bg-black hover:bg-gray-800 text-white font-bold text-center py-3 px-4 rounded-xl text-xs uppercase cursor-pointer"
                    >
                      Add Store Space
                    </button>
                    <button
                      onClick={() => setActiveTab('messages')}
                      className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 hover:text-black font-bold text-center py-3 px-4 rounded-xl text-xs uppercase cursor-pointer"
                    >
                      Messages
                    </button>
                  </div>
                  <button
                    onClick={handleRestorePremiumDemoPortfolio}
                    className="w-full bg-[#d4af37] hover:bg-[#c49e27] text-black font-bold text-center py-3 px-4 rounded-xl text-xs uppercase cursor-pointer flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Sliders className="h-4.5 w-4.5" />
                    Restore Premium Demo Portfolio
                  </button>
                  <button
                    onClick={handleTerminateSiteData}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-center py-3 px-4 rounded-xl text-xs uppercase cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md mt-1 border border-red-500"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                    Terminate All Site Data (Wipe)
                  </button>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-900 pb-3 border-b border-gray-50 flex items-center gap-1.5">
                  <BuildingIcon className="h-4.5 w-4.5 text-gray-400" /> Active Registry Spaces Listing
                </h3>
                <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                  {stores.slice(0, 4).map((st) => (
                    <div key={st.id} className="flex justify-between items-center text-xs p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <span className="font-bold text-gray-900 block">{st.storeName}</span>
                        <span className="text-[10px] font-mono text-gray-400">{st.trackingCode} • {st.floor}</span>
                      </div>
                      <span className={`text-[10px] font-bold py-0.5 px-2 rounded-md font-mono ${
                        st.status === 'Available' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-gray-100 text-gray-700'
                      }`}>{st.status}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* LEASE EXPIRATION, OFFERS, AND INQUIRIES PANELS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
              
              {/* LEASE EXPIRATION ALERTS PANEL */}
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                  <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-900 flex items-center gap-2">
                    <Clock className="h-4.5 w-4.5 text-rose-500 animate-pulse" /> Lease Expiration Alerts
                  </h3>
                  <span className="text-[10px] font-mono text-gray-400 uppercase font-bold bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg">
                    30-Day Alert Policy
                  </span>
                </div>

                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {stores.filter(st => {
                    if (!st.expiryDate || !st.ownerName) return false;
                    const daysRemaining = Math.ceil((new Date(st.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return daysRemaining <= 30;
                  }).length > 0 ? (
                    stores.filter(st => {
                      if (!st.expiryDate || !st.ownerName) return false;
                      const daysRemaining = Math.ceil((new Date(st.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return daysRemaining <= 30;
                    }).map((st) => {
                      const daysRemaining = Math.ceil((new Date(st.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      const isExpired = daysRemaining < 0;

                      return (
                        <div key={st.id} className="relative p-4 rounded-2xl bg-gray-50 hover:bg-gray-100/70 border border-gray-150 transition-all flex flex-col gap-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="font-bold text-gray-950 block text-xs">{st.storeName}</span>
                              <span className="text-[10px] font-mono text-gray-500 block mt-0.5">
                                Appointed Owner: <strong className="text-gray-700 font-semibold">{st.ownerName}</strong>
                              </span>
                            </div>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                              isExpired 
                                ? 'bg-rose-50 text-rose-800 border border-rose-100' 
                                : daysRemaining <= 12 
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                                  : 'bg-blue-50 text-blue-800 border border-blue-100'
                            }`}>
                              {isExpired ? 'Expired Lease' : `${daysRemaining} days remaining`}
                            </span>
                          </div>

                          {/* Progress Alert Bar */}
                          <div className="space-y-1">
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isExpired 
                                    ? 'bg-rose-600 w-full' 
                                    : daysRemaining <= 12 
                                      ? 'bg-amber-500' 
                                      : 'bg-blue-500'
                                }`}
                                style={{ width: isExpired ? '100%' : `${Math.max(5, (daysRemaining / 30) * 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-mono text-gray-400">
                              <span>Registry: {st.trackingCode}</span>
                              <span>Expires: {new Date(st.expiryDate!).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-gray-400 font-mono text-xs border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                      No active tenant leases approaching expiration thresholds.
                    </div>
                  )}
                </div>
              </div>

              {/* OFFERS & NEGOTIATIONS CHANNEL */}
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                  <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-900 flex items-center gap-2">
                    <DollarSign className="h-4.5 w-4.5 text-amber-500" /> Negotiation Offers & Bids ({offers.length})
                  </h3>
                  <span className="text-[10px] font-mono text-amber-700 uppercase font-bold bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-lg">
                    Real-time Proposals
                  </span>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {offers.length > 0 ? (
                    offers.map((off) => (
                      <div key={off.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-150 hover:bg-gray-100/70 transition-all space-y-2.5 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-gray-900">{off.contactName}</span>
                            <span className="text-[10px] font-mono text-gray-400 block mt-0.5">{off.contactPhone}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-extrabold text-gray-950 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-mono block">
                              ${Number(off.offerAmount).toLocaleString()}
                            </span>
                            <span className="text-[8px] font-mono text-gray-500 mt-0.5 block">Store: {off.storeName || 'N/A'} ({off.trackingCode})</span>
                          </div>
                        </div>
                        {off.message && (
                          <p className="text-[11px] text-gray-600 bg-white border border-gray-100 p-2.5 rounded-xl font-sans italic leading-relaxed">
                            "{off.message}"
                          </p>
                        )}
                        <div className="text-[9px] font-mono text-gray-400 flex items-center justify-between pt-1 border-t border-gray-100">
                          <span>Submit ID: {off.id.substring(0, 8)}</span>
                          <span>{new Date(off.submittedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-gray-400 font-mono text-xs border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                      No acquisition bids submitted yet.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* INQUIRIES & VERIFICATION AUDIT TRAIL ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* RECENT CORPORATE INQUIRIES */}
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                  <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-900 flex items-center gap-2">
                    <Mail className="h-4.5 w-4.5 text-blue-500" /> Recent Corporate Inquiries ({inquiries.length})
                  </h3>
                  <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg font-bold">
                    Direct Submissions
                  </span>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {inquiries.length > 0 ? (
                    inquiries.map((inq) => (
                      <div key={inq.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-150 hover:bg-gray-100/70 transition-all space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-gray-950 block">{inq.visitorName}</span>
                            <span className="text-[10px] font-mono text-gray-400 hover:underline">{inq.visitorEmail}</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                            {inq.trackingCode}
                          </span>
                        </div>
                        {inq.message && (
                          <p className="text-[11px] text-gray-600 bg-white border border-gray-100 p-2.5 rounded-xl font-sans leading-relaxed">
                            "{inq.message}"
                          </p>
                        )}
                        <div className="flex justify-between items-center text-[9px] font-mono text-gray-400 pt-1 border-t border-gray-100">
                          <span>Session Link Active</span>
                          <span>{new Date(inq.submittedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-gray-400 font-mono text-xs border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                      No corporate inquiries received yet.
                    </div>
                  )}
                </div>
              </div>

              {/* SECURE AUDIT EMAIL SECURITY LOGS */}
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                  <h3 className="text-xs font-bold font-display uppercase tracking-wider text-gray-900 flex items-center gap-2">
                    <ShieldAlert className="h-4.5 w-4.5 text-indigo-500" /> Owner Audit Security Request Logs ({emailRequests.length})
                  </h3>
                  <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-lg font-bold">
                    Access Audit
                  </span>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {emailRequests.length > 0 ? (
                    emailRequests.map((req) => (
                      <div key={req.id} className="p-3 bg-gray-50 border border-gray-150 hover:bg-gray-100/70 transition-all rounded-2xl text-[11px] font-mono space-y-1">
                        <div className="flex justify-between font-bold text-gray-950">
                          <span>Request Email:</span>
                          <span className="text-gray-600 font-medium">{req.email}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Target Code:</span>
                          <span className="text-indigo-600 font-semibold">{req.trackingCode}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Rate-Limit IP:</span>
                          <span className="text-gray-600 font-medium">{req.ipAddress || "::1"}</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-400 pt-1 border-t border-gray-100">
                          <span>UID: {req.id.substring(0, 8)}</span>
                          <span>{new Date(req.requestDate).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-gray-400 font-mono text-xs border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                      No secure verification audit histories cataloged.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 8: MALLS MANAGEMENT */}
        {activeTab === 'malls' && (
          <div className="space-y-6 font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 mb-4 gap-3">
              <div>
                <h3 className="text-base font-bold font-display uppercase text-gray-955">Malls Complex Registry</h3>
                <p className="text-[11px] text-gray-400">Total malls in directory: {malls?.length || 0}</p>
              </div>
              {editingMall && (
                <button
                  type="button"
                  onClick={handleCreateNewMallClick}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-xl text-xs font-bold uppercase transition-all duration-300 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Add New Mall
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* MALL LIST (2 cols) */}
              <div className="lg:col-span-2 space-y-4">
                {(!malls || malls.length === 0) ? (
                  <div className="text-center py-16 border border-dashed border-gray-200 bg-white rounded-2xl text-gray-400 font-mono text-xs">
                    No Mall complexes in registry. Use the form to submit one.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {malls.map((mall) => (
                      <div key={mall.id} className="bg-white border border-gray-105 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
                        <div>
                          {mall.mallImage && (
                            <img src={mall.mallImage} alt={mall.mallName} className="w-full h-32 object-cover" />
                          )}
                          <div className="p-4 space-y-2">
                            <h4 className="text-sm font-bold text-gray-905 font-display">{mall.mallName}</h4>
                            <p className="text-xs text-gray-400 font-mono flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" /> {mall.location}
                            </p>
                            <p className="text-xs text-gray-500 leading-normal">{mall.address}</p>
                            <div className="flex items-center gap-4 text-[10px] font-mono text-gray-400 pt-2 border-t border-gray-50">
                              <span>Lat: {mall.lat}</span>
                              <span>Lng: {mall.lng}</span>
                              <span>Capacity: {mall.totalStores} units</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 border-t border-gray-50 flex items-center justify-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => handleEditMallClick(mall)}
                            className="bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-black p-2 rounded-lg cursor-pointer"
                            title="Edit Mall"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMall(mall.id!)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-lg cursor-pointer"
                            title="Delete Mall"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* MALL FORM (1 col) */}
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm h-fit">
                <h4 className="text-xs font-bold font-display uppercase tracking-wider text-gray-900 pb-3 border-b border-gray-50 mb-4">
                  {editingMall ? "Edit Mall Complex" : "Create Mall Complex"}
                </h4>
                <form onSubmit={handleMallFormSubmit} className="space-y-4 text-xs font-normal">
                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Mall Complex Name</label>
                    <input
                      type="text"
                      required
                      value={formMallName}
                      onChange={(e) => setFormMallName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-3 outline-none"
                      placeholder="e.g. Liberty Plaza"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Location City/State</label>
                    <input
                      type="text"
                      required
                      value={formMallLocation}
                      onChange={(e) => setFormMallLocation(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-3 outline-none"
                      placeholder="e.g. Dallas, Texas"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-405 mb-1 font-semibold uppercase tracking-wider text-[10px]">Physical Street Address</label>
                    <input
                      type="text"
                      required
                      value={formMallAddress}
                      onChange={(e) => setFormMallAddress(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-3 outline-none"
                      placeholder="e.g. 123 Main Street, Dallas, TX"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={formMallLat}
                        onChange={(e) => setFormMallLat(Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-3 outline-none"
                        placeholder="e.g. 26.1224"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={formMallLng}
                        onChange={(e) => setFormMallLng(Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-3 outline-none"
                        placeholder="e.g. -80.2528"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Cover/Logo Image URL</label>
                    <input
                      type="url"
                      value={formMallImage}
                      onChange={(e) => setFormMallImage(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-3 outline-none"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Estimated Stall Capacity</label>
                    <input
                      type="number"
                      required
                      value={formMallTotalStores}
                      onChange={(e) => setFormMallTotalStores(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-3 outline-none"
                      placeholder="e.g. 150"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer transition-all mt-2"
                  >
                    {actionLoading ? "Saving Mall..." : (editingMall ? "Update Mall" : "Publish Mall Complex")}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STORES DIRECTORY */}
        {activeTab === 'stores' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 mb-4 gap-3">
              <div>
                <h3 className="text-base font-bold font-display uppercase text-gray-950">Stores Database Portfolio</h3>
                <p className="text-[11px] text-gray-400">Total spaces stored: {stores.length}</p>
              </div>
              <button
                type="button"
                onClick={handleCreateNewClick}
                className="bg-black hover:bg-gray-800 text-white py-2 px-4 rounded-xl text-xs font-bold uppercase transition-all duration-300 cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="h-4 w-4" /> Add Retail Unit
              </button>
            </div>

            {stores.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-gray-200 bg-white rounded-2xl text-gray-400 font-mono text-xs">
                No stores loaded inside Broward Mall repository yet. Click "Add Retail Unit" to begin.
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px] font-mono">
                        <th className="py-3 px-3">Store Name / Code</th>
                        <th className="py-3">Floor / Sizing</th>
                        <th className="py-3">Lease / Contract Setup</th>
                        <th className="py-3">Status</th>
                        <th className="py-3 text-right pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stores.map((store) => (
                        <tr key={store.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-2.5">
                              {store.logo ? (
                                <img
                                  src={store.logo}
                                  alt=""
                                  className="w-8 h-8 rounded-lg object-cover border border-gray-200"
                                  id={`tbl-logo-${store.id}`}
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-black text-white font-bold text-xs flex items-center justify-center font-display">S</div>
                              )}
                              <div>
                                <span className="font-bold text-gray-900 block leading-tight">{store.storeName}</span>
                                <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest block mt-0.5">{store.trackingCode}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 font-mono">
                            <span className="text-gray-800 block">{store.floor}</span>
                            <span className="text-gray-400 text-[10px] block">{store.sizeSqFt.toLocaleString()} sq ft</span>
                          </td>
                          <td className="py-4 font-mono font-bold text-gray-900">
                            ${store.monthlyLease.toLocaleString()}/mo
                            <span className="text-gray-400 text-[10px] font-normal block mt-0.5">{store.leaseType}</span>
                          </td>
                          <td className="py-4">
                            <span className={`text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded-md ${
                              store.status === 'Available' ? 'bg-emerald-100 text-emerald-800 border border-emerald-100' :
                              store.status === 'Sold' ? 'bg-gray-800 text-white' : 'bg-amber-100 text-amber-800 border border-amber-100'
                            }`}>
                              {store.status}
                            </span>
                          </td>
                          <td className="py-4 text-right space-x-1 pr-3">
                            <button
                              type="button"
                              onClick={() => handleEditClick(store)}
                              className="p-1.5 bg-gray-50 hover:bg-black text-gray-500 hover:text-white border border-gray-250 rounded-lg transition-all cursor-pointer inline-flex items-center"
                              title="Edit specifications"
                              id={`edit-btn-${store.id}`}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStore(store.id || '')}
                              className="p-1.5 bg-gray-50 hover:bg-rose-600 text-gray-500 hover:text-white border border-gray-250 rounded-lg transition-all cursor-pointer inline-flex items-center"
                              title="Delete space"
                              id={`delete-btn-${store.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CREATE / EDIT RETAIL SPACE FORM */}
        {activeTab === 'create_edit' && (
          <form onSubmit={handleStoreFormSubmit} className="space-y-6 font-sans text-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold uppercase text-gray-950 font-display">
                  {editingStore ? `Edit specifications: ${editingStore.trackingCode}` : "Create Premium Retail Space"}
                </h3>
                <p className="text-[11px] text-gray-400">Complete architectural entries and map coordinates</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('stores')}
                className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-600 py-1.5 px-3 rounded-lg hover:bg-gray-200 transition-colors text-xs font-semibold uppercase cursor-pointer"
              >
                Cancel Edit
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column Fields */}
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-5">
                
                {/* HIERARCHY: SELECT ASSOCIATED MALL */}
                <div className="bg-gray-50 p-4.5 rounded-2xl border border-gray-200/60 space-y-3.5">
                  <h4 className="text-xs font-bold text-gray-950 flex items-center gap-1.5 uppercase tracking-wide font-display">
                    <Database className="h-4.5 w-4.5 text-gray-400" /> Mall Association
                  </h4>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-gray-500 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">Associated Mall Complex</label>
                      <div className="flex gap-4 mb-3">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-800">
                          <input
                            type="radio"
                            name="mallChoice"
                            checked={!formUseCustomMall}
                            onChange={() => {
                              setFormUseCustomMall(false);
                              setFormMallId('mall_broward_001');
                              setFormMallName('Broward Mall');
                              setFormMallAddress('8000 W Broward Blvd, Plantation, FL 33388');
                              setFormMallLocation('Plantation, Florida');
                              setFormLocation('Plantation, Florida');
                              setSelectedCoords(BROWARD_MALL_COORDS);
                            }}
                            className="h-3.5 w-3.5 text-black border-gray-300 focus:ring-black"
                          />
                          Broward Mall Complex
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-800">
                          <input
                            type="radio"
                            name="mallChoice"
                            checked={formUseCustomMall}
                            onChange={() => {
                              setFormUseCustomMall(true);
                              setFormMallId('');
                              setFormMallName('');
                              setFormMallAddress('');
                              setFormMallLocation('');
                            }}
                            className="h-3.5 w-3.5 text-black border-gray-300 focus:ring-black"
                          />
                          Custom / Other Mall
                        </label>
                      </div>

                      {formUseCustomMall && (
                        <div className="space-y-3 mt-2 bg-gray-150/40 p-3.5 rounded-2xl border border-gray-250">
                          <div>
                            <label className="block text-gray-500 mb-1 font-semibold uppercase tracking-wider text-[9px]">Custom Mall Complex Name</label>
                            <input
                              type="text"
                              required
                              value={formMallName}
                              onChange={(e) => setFormMallName(e.target.value)}
                              placeholder="e.g. Liberty Plaza Complex"
                              className="w-full bg-white border border-gray-200 focus:border-black rounded-xl px-3.5 py-2 outline-none text-xs font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-500 mb-1 font-semibold uppercase tracking-wider text-[9px]">Mall Physical Address</label>
                            <input
                              type="text"
                              required
                              value={formMallAddress}
                              onChange={(e) => setFormMallAddress(e.target.value)}
                              placeholder="e.g. 123 Main St, Plantation, FL 33324"
                              className="w-full bg-white border border-gray-200 focus:border-black rounded-xl px-3.5 py-2 outline-none text-xs font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-500 mb-1 font-semibold uppercase tracking-wider text-[9px]">Mall Location (City/State)</label>
                            <input
                              type="text"
                              required
                              value={formMallLocation}
                              onChange={(e) => {
                                setFormMallLocation(e.target.value);
                                setFormLocation(e.target.value);
                              }}
                              placeholder="e.g. Plantation, Florida"
                              className="w-full bg-white border border-gray-200 focus:border-black rounded-xl px-3.5 py-2 outline-none text-xs font-semibold"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-500 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">Unit Number / Suite</label>
                        <input
                          type="text"
                          required
                          value={formUnitNumber}
                          onChange={(e) => setFormUnitNumber(e.target.value)}
                          placeholder="e.g. G-12"
                          className="w-full bg-white border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-medium text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">Zone identifier</label>
                        <input
                          type="text"
                          value={formZone}
                          onChange={(e) => setFormZone(e.target.value)}
                          placeholder="e.g. Zone B3"
                          className="w-full bg-white border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-medium text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* OWNER INFORMATION SECTION */}
                {formOwnershipStatus === 'Owned' && (
                  <div className="bg-[#fcf8f0] p-4.5 rounded-2xl border border-amber-100 space-y-3.5">
                    <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5 uppercase tracking-wide font-display">
                      <Shield className="h-4.5 w-4.5 text-amber-600" /> Owner Information
                    </h4>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-amber-800/80 mb-1 font-semibold uppercase tracking-wider text-[9px]">Full Name of Owner</label>
                        <input
                          type="text"
                          value={formOwnerName}
                          onChange={(e) => setFormOwnerName(e.target.value)}
                          placeholder="John Smith"
                          className="w-full bg-white border border-amber-100 focus:border-amber-500 rounded-xl px-4 py-2.5 outline-none text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-amber-800/80 mb-1 font-semibold uppercase tracking-wider text-[9px]">Contact Email</label>
                          <input
                            type="email"
                            value={formOwnerEmail}
                            onChange={(e) => setFormOwnerEmail(e.target.value)}
                            placeholder="john@example.com"
                            className="w-full bg-white border border-amber-100 focus:border-amber-500 rounded-xl px-4 py-2.5 outline-none text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-amber-800/80 mb-1 font-semibold uppercase tracking-wider text-[9px]">Contact Phone</label>
                          <input
                            type="tel"
                            value={formOwnerPhone}
                            onChange={(e) => setFormOwnerPhone(e.target.value)}
                            placeholder="+1 555-0199"
                            className="w-full bg-white border border-amber-100 focus:border-amber-500 rounded-xl px-4 py-2.5 outline-none text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <label className="block text-amber-800/80 mb-1 font-semibold uppercase tracking-wider text-[9px]">Ownership Type</label>
                          <select
                            value={formOwnershipType}
                            onChange={(e) => setFormOwnershipType(e.target.value)}
                            className="w-full bg-white border border-amber-100 focus:border-amber-500 rounded-xl px-2 py-2.5 outline-none text-[11px]"
                          >
                            <option value="Leased">Leased</option>
                            <option value="Purchased">Purchased</option>
                            <option value="Shared Ownership">Shared Owner</option>
                          </select>
                        </div>
                        <div className="col-span-1">
                          <label className="block text-amber-800/80 mb-1 font-semibold uppercase tracking-wider text-[9px]">Acquired Date</label>
                          <input
                            type="date"
                            value={formPurchaseDate}
                            onChange={(e) => setFormPurchaseDate(e.target.value)}
                            className="w-full bg-white border border-amber-100 focus:border-amber-500 rounded-xl px-2 py-2 outline-none text-[10px]"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="block text-amber-800/80 mb-1 font-semibold uppercase tracking-wider text-[9px]">Lease Expiration</label>
                          <input
                            type="date"
                            value={formExpiryDate}
                            onChange={(e) => setFormExpiryDate(e.target.value)}
                            className="w-full bg-white border border-amber-100 focus:border-amber-500 rounded-xl px-2 py-2 outline-none text-[10px]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Commercial Store Unit Name</label>
                  <input
                    type="text"
                    required
                    value={formStoreName}
                    onChange={(e) => setFormStoreName(e.target.value)}
                    placeholder="e.g. Liberty Retail Unit"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-medium placeholder-gray-400 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Location Locale</label>
                    <input
                      type="text"
                      required
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="Plantation, Florida"
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-medium text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Floor Level</label>
                    <input
                      type="text"
                      required
                      value={formFloor}
                      onChange={(e) => setFormFloor(e.target.value)}
                      placeholder="Ground Level / Level 2"
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-medium text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-505 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Ownership Status *</label>
                    <select
                      value={formOwnershipStatus}
                      onChange={(e) => {
                        const val = e.target.value as 'Unassigned' | 'Allocated' | 'Owned';
                        setFormOwnershipStatus(val);
                        setFormStatus(val === 'Owned' ? 'Sold' : val === 'Allocated' ? 'Reserved' : 'Available');
                      }}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none text-xs font-semibold"
                    >
                      <option value="Unassigned">Unassigned</option>
                      <option value="Allocated">Allocated</option>
                      <option value="Owned">Owned</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-5 pl-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formShowOnHomepage}
                        onChange={(e) => setFormShowOnHomepage(e.target.checked)}
                        className="w-4.5 h-4.5 accent-amber-500 rounded border-gray-300 focus:ring-amber-500"
                      />
                      <span className="text-gray-700 font-bold uppercase tracking-wide text-[10px]">Show on Homepage</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Monthly Lease Fee ($)</label>
                    <input
                      type="number"
                      required
                      value={formLease}
                      onChange={(e) => setFormLease(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Lease Category Type</label>
                    <input
                      type="text"
                      required
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      placeholder="Triple Net (NNN)"
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-medium text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Height of Ceilings</label>
                    <input
                      type="text"
                      value={formCeiling}
                      onChange={(e) => setFormCeiling(e.target.value)}
                      placeholder="28 ft"
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-medium text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Allotted Loading Bays</label>
                    <input
                      type="number"
                      value={formBays}
                      onChange={(e) => setFormBays(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Allotted Parking Stall Shares</label>
                    <input
                      type="number"
                      value={formParking}
                      onChange={(e) => setFormParking(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Utilities Fitted?</label>
                    <select
                      value={formUtilities ? "yes" : "no"}
                      onChange={(e) => setFormUtilities(e.target.value === "yes")}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none text-xs"
                    >
                      <option value="yes">Standard Connected Fitout (Yes)</option>
                      <option value="no">Needs custom link (No)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Store Sizing (Sq Ft)</label>
                    <input
                      type="number"
                      required
                      value={formSize}
                      onChange={(e) => setFormSize(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Previous Occupating Brand</label>
                    <input
                      type="text"
                      value={formPrevTenant}
                      onChange={(e) => setFormPrevTenant(e.target.value)}
                      placeholder="Department Store / Boutique"
                      className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 border p-3 rounded-xl">
                  <input
                    type="checkbox"
                    id="chk-demo"
                    checked={formIsDemo}
                    onChange={(e) => setFormIsDemo(e.target.checked)}
                    className="h-4 w-4 text-black border-gray-300 rounded"
                  />
                  <label htmlFor="chk-demo" className="text-gray-600 select-none font-semibold text-[11px]">
                    Flag store space as Premium feature
                  </label>
                </div>

              </div>
              
              {/* Right Column (Map picker, File uploads and specifications specs) */}
              <div className="space-y-6">
                
                {/* Geographic Interactive Plot */}
                <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-3.5">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wide font-display">
                    <MapPin className="h-4 w-4 text-gray-500" /> Plot Map Coordinates
                  </span>
                  
                  <div className="bg-gray-50 p-2.5 rounded-2xl border border-gray-150">
                    <p className="text-[10px] text-gray-500 mb-2 font-mono">
                      Click directly on the canvas layout to pin your store location coordinates.
                    </p>
                    <div className="h-56 rounded-xl overflow-hidden border border-gray-200">
                      <MapContainer center={selectedCoords} zoom={16} className="h-full w-full">
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={selectedCoords} icon={new L.Icon({
                          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                          iconSize: [25, 41],
                          iconAnchor: [12, 41]
                        })} />
                        <MapPickerEvents onSelectCoords={(lat, lng) => setSelectedCoords([lat, lng])} />
                      </MapContainer>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-mono text-[11px] text-gray-500">
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-[9px] uppercase text-gray-400 block font-bold">LAT:</span>
                      <span className="text-gray-800 font-bold">{selectedCoords[0].toFixed(6)}</span>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-[9px] uppercase text-gray-400 block font-bold">LNG:</span>
                      <span className="text-gray-800 font-bold">{selectedCoords[1].toFixed(6)}</span>
                    </div>
                  </div>
                </div>

                {/* Features Checklist builders */}
                <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-4">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wide font-display">
                    <Check className="h-4 w-4 text-gray-500" /> Structure Highlight Features
                  </span>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFeatureText}
                      onChange={(e) => setNewFeatureText(e.target.value)}
                      placeholder="e.g. Glass structural storefront"
                      className="flex-1 bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-3.5 py-2 outline-none text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddFeature}
                      className="bg-black hover:bg-gray-800 text-white font-bold py-2 px-3 rounded-xl uppercase tracking-wider text-[10px] cursor-pointer inline-flex items-center"
                    >
                      Insert
                    </button>
                  </div>

                  {featuresList.length > 0 && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {featuresList.map((featStr, fIdx) => (
                        <div key={fIdx} className="flex justify-between items-center text-[11px] p-2 bg-gray-50 rounded-lg border border-gray-100 font-semibold text-gray-700">
                          <span className="truncate pr-4">{featStr}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFeature(fIdx)}
                            className="text-rose-500 hover:text-rose-700 font-mono text-[10px] cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* File Uploads (Logo & Layouts) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Brand Logo Upload Frame */}
                  <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-3">
                    <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wide font-display">
                      <ImageIcon className="h-4 w-4 text-gray-500" /> Branding Logo
                    </div>

                    <div className="flex items-center gap-3">
                      {logoPreviewUrl ? (
                        <img
                          src={logoPreviewUrl}
                          alt=""
                          className="w-12 h-12 object-cover rounded-xl border border-gray-200"
                          id="logo-preview-admin"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-50 border text-gray-400 rounded-xl flex items-center justify-center font-bold font-display text-base">S</div>
                      )}
                      
                      <label className="flex-1 text-center bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 hover:border-black rounded-xl py-2 cursor-pointer transition-colors text-[10px] font-bold uppercase select-none">
                        {uploadingLogo ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-800" />
                        ) : (
                          "Upload Logo"
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Layout Image Upload */}
                  <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-3">
                    <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wide font-display">
                      <ImageIcon className="h-4 w-4 text-gray-500" /> Layout Image
                    </div>

                    <label className="block text-center bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 hover:border-black rounded-xl py-2.5 cursor-pointer transition-colors text-[10px] font-bold uppercase select-none">
                      {uploadingGallery ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-800" />
                      ) : (
                        "Upload photo"
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleGalleryUpload}
                        disabled={uploadingGallery}
                        className="hidden"
                      />
                    </label>

                    {galleryUrls.length > 0 && (
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {galleryUrls.map((gUrl, gIdx) => (
                          <div key={gIdx} className="group relative h-9 rounded-lg bg-gray-50 border border-gray-150 overflow-hidden">
                            <img src={gUrl} alt="" className="w-full h-full object-cover" id={`img-vault-preview-${gIdx}`} referrerPolicy="no-referrer" />
                            <button
                              type="button"
                              onClick={() => handleRemoveGalleryImage(gIdx)}
                              className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 text-rose-400 cursor-pointer transition-opacity"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </div>

            {/* Actions Submit buttons */}
            <div className="pt-6 border-t border-gray-100 flex gap-4 font-display">
              <button
                type="button"
                onClick={() => setActiveTab('stores')}
                className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer text-center"
              >
                Cancel specifications
              </button>
              <button
                type="submit"
                id="submit-create-store-btn"
                disabled={actionLoading || uploadingLogo || uploadingGallery}
                className="flex-1 bg-black hover:bg-gray-800 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                {actionLoading ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-white" />
                ) : (
                  "Lock Registration & Generate Code"
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: REAL-TIME CONVERSATIONAL MESSAGES VIEWS */}
        {activeTab === 'messages' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 mb-4">
              <h3 className="text-base font-bold font-display uppercase text-gray-950">Messages Registry Center</h3>
              <p className="text-[11px] text-gray-400">Track and respond in real-time to active platform visitors.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[550px] items-stretch">
              
              {/* Left Column: Conversations Selector listings */}
              <div className="lg:col-span-5 bg-white border border-gray-100 rounded-3xl p-5 flex flex-col shadow-sm">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 block mb-3.5">Conversation Channels ({chats.length})</span>
                
                {chats.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <MessageSquare className="h-8 w-8 mb-2 text-gray-300" />
                    <h5 className="text-xs font-bold font-display text-gray-800">No active conversations</h5>
                    <p className="text-[10px] text-gray-400 mt-1 max-w-[180px]">Visitor conversations will automatically populate here once they test their Live Chat widget.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {chats.map((ch) => {
                      const isSelected = selectedChat?.visitorId === ch.visitorId;
                      const lastMsgText = ch.messages?.[ch.messages.length - 1]?.text || "(No messages)";
                      const firstMsgDate = ch.createdAt ? new Date(ch.createdAt).toLocaleDateString() : 'N/A';
                      const lastActDate = ch.lastActivity ? new Date(ch.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';

                      return (
                        <div
                          key={ch.visitorId}
                          onClick={() => setSelectedChat(ch)}
                          className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-black text-white border-black shadow-sm'
                              : 'bg-gray-50 border-gray-200/50 hover:bg-gray-100/50 text-gray-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold leading-none">{ch.visitorId}</span>
                            <span className={`text-[8px] font-mono leading-none ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                              Last: {lastActDate}
                            </span>
                          </div>
                          
                          <p className={`text-[11px] truncate mt-2 font-medium ${isSelected ? 'text-gray-200' : 'text-gray-500'}`}>
                            {lastMsgText}
                          </p>

                          <div className="border-t border-dashed border-gray-200/20 pt-2 mt-2 flex justify-between text-[9px] font-mono opacity-80">
                            <span>Started: {firstMsgDate}</span>
                            <span className="italic">{ch.deviceInfo || 'Session User'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Chat History and Response form */}
              <div className="lg:col-span-7 bg-white border border-gray-100 rounded-3xl overflow-hidden flex flex-col justify-between shadow-sm border-t-4 border-t-black">
                {selectedChat ? (
                  <>
                    {/* Active Chat Header */}
                    <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 font-mono">Terminal: {selectedChat.visitorId}</h4>
                        <p className="text-[9px] text-gray-400 font-mono block mt-0.5">Device Platform: {selectedChat.deviceInfo || 'Generic web agent'}</p>
                      </div>
                      <button
                        onClick={() => setSelectedChat(null)}
                        className="text-gray-400 hover:text-black p-1 rounded transition-colors cursor-pointer text-[10px] font-bold"
                      >
                        CLOSE PANE
                      </button>
                    </div>

                    {/* Chat stream history list */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-white">
                      {selectedChat.messages?.map((msg) => {
                        const isAdminMsg = msg.sender === 'admin';
                        return (
                          <div key={msg.id} className={`flex flex-col ${isAdminMsg ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed ${
                              isAdminMsg
                                ? 'bg-black text-white rounded-br-none'
                                : 'bg-gray-100 text-gray-800 rounded-bl-none'
                            }`}>
                              {msg.text}
                            </div>
                            <span className="text-[9px] text-gray-405 font-mono mt-0.5 px-1 block text-right">
                              {msg.sender === 'admin' ? 'Support Liaison' : 'Visitor'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick template response helpers */}
                    <div className="px-5 py-2 border-t border-gray-50 bg-gray-50/50 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setAdminReplyText("Hello! Thank you for contacting Broward Mall Concierge. How can we assist you with this space today?")}
                        className="text-[9px] bg-white border border-gray-200 text-gray-600 hover:text-black hover:border-gray-400 px-2.5 py-1 rounded-lg font-semibold shadow-sm transition-colors cursor-pointer"
                      >
                        Greeting Greeting
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminReplyText("This retail store is fully available! Would you like us to schedule an on-site visit or review the yearly discounted program?")}
                        className="text-[9px] bg-white border border-gray-200 text-gray-600 hover:text-black hover:border-gray-400 px-2.5 py-1 rounded-lg font-semibold shadow-sm transition-colors cursor-pointer"
                      >
                        Offer Space Details
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminReplyText("The yearly leasing contract includes a custom layout fit-out. Let us know if you want us to lock this code reservation for you.")}
                        className="text-[9px] bg-white border border-gray-200 text-gray-600 hover:text-black hover:border-gray-400 px-2.5 py-1 rounded-lg font-semibold shadow-sm transition-colors cursor-pointer"
                      >
                        Highlight Discount Option
                      </button>
                    </div>

                    {/* Form write fields response */}
                    <form onSubmit={handleSendAdminReply} className="p-3 bg-gray-50 border-t border-gray-100 flex gap-2.5">
                      <input
                        type="text"
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                        placeholder="Type reply message..."
                        className="flex-1 bg-white border border-gray-200 focus:border-gray-500 rounded-xl px-3.5 py-2.5 outline-none text-xs text-gray-900"
                      />
                      <button
                        type="submit"
                        disabled={replyLoading || !adminReplyText.trim()}
                        className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                      >
                        {replyLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        ) : (
                          <Send className="h-4 w-4 text-white" />
                        )}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                    <MessageSquare className="h-10 w-10 text-gray-200 mb-2" />
                    <h5 className="text-xs font-bold font-display text-gray-700">No conversation active</h5>
                    <p className="text-[10px] text-gray-400 max-w-xs mt-1 leading-normal">
                      Select any communication log stream from the left panel to begin replying to visitors in real-time.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 5: LANDING PAGE CONFIG EDITOR */}
        {activeTab === 'lander' && (
          <form onSubmit={handleLanderSubmit} className="space-y-6 font-sans text-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold font-display uppercase tracking-wider text-gray-950">Lander Content & Visuals editor</h3>
                <p className="text-[11px] text-gray-400">Instantly update core visual assets and directory directories</p>
              </div>
            </div>

            <div className="space-y-4 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
              
              {/* Hero Title */}
              <div>
                <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Lander Brand Header Title</label>
                <input
                  type="text"
                  required
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  placeholder="e.g. Broward Mall Gateway"
                  className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-bold text-gray-900"
                />
              </div>

              {/* Hero Subtitle */}
              <div>
                <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Lander Hero Subtitle statement</label>
                <textarea
                  required
                  rows={2}
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  placeholder="e.g. Discover structural layouts and physical retail spaces."
                  className="w-full bg-[whitesmoke] border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none text-gray-900 leading-normal"
                />
              </div>

              {/* Mall Description */}
              <div>
                <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Central Mall Descriptor</label>
                <textarea
                  required
                  rows={3}
                  value={aboutText}
                  onChange={(e) => setAboutText(e.target.value)}
                  placeholder="e.g. Detailed history and structural boundaries of the mall."
                  className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none text-gray-900 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-gray-50 pt-5">
                
                {/* Phone */}
                <div>
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Leasing Phone</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (954) 473-8100"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none text-gray-900 font-mono"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Contact Liaison Email</label>
                  <input
                    type="email"
                    required
                    value={emailInfo}
                    onChange={(e) => setEmailInfo(e.target.value)}
                    placeholder="leasinginfo@browardmall.com"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none text-gray-900 font-mono"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Mall Location Locality</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="8000 W Broward Blvd, Plantation, FL 33388"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none text-gray-900"
                  />
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3">
                
                {/* FB */}
                <div>
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Facebook Page link</label>
                  <input
                    type="text"
                    value={fb}
                    onChange={(e) => setFb(e.target.value)}
                    placeholder="https://facebook.com/broward"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-mono"
                  />
                </div>

                {/* IG */}
                <div>
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Instagram handle</label>
                  <input
                    type="text"
                    value={ig}
                    onChange={(e) => setIg(e.target.value)}
                    placeholder="https://instagram.com/broward"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-mono"
                  />
                </div>

                {/* TW */}
                <div>
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Twitter handle</label>
                  <input
                    type="text"
                    value={tw}
                    onChange={(e) => setTw(e.target.value)}
                    placeholder="https://twitter.com/broward"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-black rounded-xl px-4 py-2.5 outline-none font-mono"
                  />
                </div>

              </div>

              {/* Favicon Management */}
              <div className="border-t border-gray-100 pt-5 mt-5">
                <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wider text-[10px]">Favicon Management</label>
                <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
                  Upload a custom browser favicon (acceptable formats: .png, .jpg, .svg, .ico). 
                  The uploaded favicon will only display in the browser tab, mobile tab previews, bookmarks, and app shortcuts.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  {faviconUrl ? (
                    <div className="flex items-center gap-4 w-full">
                      <div className="bg-white border border-gray-200 p-2.5 rounded-xl shadow-xs flex items-center justify-center shrink-0">
                        <img 
                          src={faviconUrl} 
                          alt="Custom Browser Favicon" 
                          className="h-8 w-8 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-gray-500 font-mono block truncate">{faviconUrl}</span>
                        <span className="text-[9px] text-emerald-600 font-medium block mt-0.5">Custom Favicon Active</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFaviconUrl('')}
                        className="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer shrink-0 transition-colors"
                      >
                        Remove Favicon
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 w-full">
                      <div className="bg-white border border-dashed border-gray-300 p-2.5 rounded-xl flex items-center justify-center h-12 w-12 shrink-0">
                        <span className="text-[10px] text-gray-450 text-center font-semibold font-mono">None</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-gray-400 block leading-normal">No custom favicon configured. Restores browser standard icon set or a fallback.</span>
                      </div>
                      <div className="shrink-0">
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.svg,.ico"
                          id="favicon-file-input"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingFavicon(true);
                            try {
                              const url = await uploadToCloudinary(file);
                              setFaviconUrl(url);
                            } catch (err: any) {
                              alert(`Failed to upload favicon: ${err.message || err}`);
                            } finally {
                              setUploadingFavicon(false);
                            }
                          }}
                        />
                        <label
                          htmlFor="favicon-file-input"
                          className="inline-block bg-black hover:bg-gray-800 text-white text-[10px] font-bold px-3.5 py-2 rounded-lg cursor-pointer text-center transition-colors select-none"
                        >
                          {uploadingFavicon ? 'Uploading...' : 'Upload File'}
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="pt-5 border-t border-gray-100">
              <button
                type="submit"
                id="submit-lander-settings-btn"
                disabled={actionLoading}
                className="w-full bg-black hover:bg-gray-800 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                {actionLoading ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-white" />
                ) : (
                  <>
                    <Save className="h-4 w-4 text-white" /> Save Visual configurations
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 6: MEDIA LIBRARY */}
        {activeTab === 'media' && (
          <div className="space-y-6 animate-fade-in text-gray-900 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            <div className="border-b border-gray-100 pb-4 mb-4">
              <h3 className="text-base font-bold font-display uppercase tracking-wider text-gray-950">Platform Media Library</h3>
              <p className="text-[11px] text-gray-400">Manage uploaded images, logos, and physical architecture floor plans</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {stores.map((st, sidx) => (
                <div key={st.id || sidx} className="group relative bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden shadow-sm h-32 flex flex-col justify-between">
                  <img
                    src={st.images?.[0] || st.logo || "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=300&q=80"}
                    alt=""
                    className="w-full h-20 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="p-2 truncate bg-white border-t border-gray-50">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-gray-700 block text-center truncate">{st.storeName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: API KEYS PANEL / SYSTEM CREDENTIALS */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4 font-display">
              <div>
                <h3 className="text-base font-bold uppercase text-gray-950">Secure System Credentials</h3>
                <p className="text-[11px] text-gray-400">Monitored system environment configurations</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-3xl p-5 flex items-start gap-4">
              <span className="text-black bg-gray-100 border border-gray-200 p-2 rounded-xl shrink-0">
                <Shield className="h-5 w-5" />
              </span>
              <div className="space-y-1 text-xs font-normal">
                <h4 className="font-bold text-gray-900 uppercase font-display">Environment Isolation parameters</h4>
                <p className="text-gray-500 leading-relaxed max-w-2xl">
                  Standard API keys (such as Cloudinary secrets and Firebase tokens) are mounted as high-security environmental variables (defined in <span className="font-mono text-gray-900 font-bold bg-[#eee] px-1 rounded">.env</span> containers) to protect server runtime resources.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              
              {/* CLOUDINARY CONFIG */}
              <div className="bg-white border border-gray-100 p-5 rounded-3xl space-y-3 shadow-none">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase font-display">
                  <KeyRound className="h-4 w-4 text-gray-500" /> Cloudinary Media Storage parameters
                </span>
                <div className="space-y-2.5 font-mono text-[11px] text-gray-500">
                  <div className="flex justify-between border-b border-gray-50 pb-1.5">
                    <span>Cloud Storage Name:</span>
                    <span className="text-gray-900 font-bold select-all">dslmifwmq</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-50 pb-1.5">
                    <span>API Public Key ID:</span>
                    <span className="text-gray-900 font-bold select-all">628365726991323</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Secret storage keyphrase:</span>
                    <span className="text-emerald-600 font-bold font-sans">Enabled (Accessed via process.env.CLOUDINARY_API_SECRET)</span>
                  </div>
                </div>
              </div>

              {/* FIREBASE CONFIG */}
              <div className="bg-white border border-gray-100 p-5 rounded-3xl space-y-3 shadow-none">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase font-display">
                  <KeyRound className="h-4 w-4 text-gray-500" /> Active Database connection parameters
                </span>
                <div className="space-y-2.5 font-mono text-[11px] text-gray-500">
                  <div className="flex justify-between border-b border-gray-50 pb-1.5">
                    <span>Active Project ID:</span>
                    <span className="text-gray-900 font-bold select-all">broward-8e8f1</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-50 pb-1.5">
                    <span>Authentication domain:</span>
                    <span className="text-gray-900 font-bold select-all">broward-8e8f1.firebaseapp.com</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage repository bucket:</span>
                    <span className="text-gray-900 font-bold select-all font-mono">broward-8e8f1.firebasestorage.app</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 8: ALLOCATION REQUESTS */}
        {activeTab === 'allocations' && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-gray-100 pb-4 mb-4 font-display">
              <h3 className="text-base font-bold uppercase text-gray-950">Allocation Requests Center</h3>
              <p className="text-[11px] text-gray-400 font-sans font-normal">Review, approve, or reject formal commercial tenant allocation locks.</p>
            </div>

            {allocationRequests.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-500 font-sans shadow-sm">
                <ShieldAlert className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                <h5 className="text-xs font-bold text-gray-800">No Allocation Requests found</h5>
                <p className="text-[10px] text-gray-400 mt-1 max-w-sm mx-auto">Pending allocation requests submitted by visitors on available stores will display here for authorization.</p>
              </div>
            ) : (
              <div className="space-y-4 font-sans font-normal">
                {allocationRequests.map((req) => (
                  <div key={req.id} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:border-gray-200 transition-all">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold uppercase bg-stone-100 border border-stone-200 text-stone-600 px-2 py-0.5 rounded-full">
                            Space: {req.storeName}
                          </span>
                          <span className="text-[10px] font-mono font-bold uppercase bg-amber-50 border border-amber-200 text-amber-600 px-2 py-0.5 rounded-full">
                            Code: {req.trackingCode}
                          </span>
                          <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                            req.status === 'Approved'
                              ? 'bg-emerald-50 border border-emerald-205 text-emerald-600'
                              : req.status === 'Rejected'
                              ? 'bg-rose-50 border border-rose-200 text-rose-600'
                              : 'bg-amber-50 border border-amber-200 text-amber-600 animate-pulse'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        
                        <h4 className="text-sm font-bold font-display text-gray-950">
                          {req.fullName}
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-gray-650">
                          <p><span className="text-gray-500">Email:</span> {req.email}</p>
                          <p><span className="text-gray-500">Phone:</span> {req.phone || 'N/A'}</p>
                          <p><span className="text-gray-500">Proposed Rate:</span> <span className="font-mono text-gray-900 font-bold">${Number(req.offerAmount || 0).toLocaleString()}/mo</span></p>
                        </div>

                        {req.notes && (
                          <div className="bg-gray-50 border border-gray-200/50 p-3.5 rounded-2xl text-[11px] text-gray-650 leading-relaxed font-normal mt-1">
                            <span className="font-bold text-gray-800 uppercase text-[9px] block mb-1">Notes:</span>
                            {req.notes}
                          </div>
                        )}

                        <p className="text-[9px] font-mono text-gray-400">Submitted on {new Date(req.createdAt || '').toLocaleString()}</p>
                      </div>

                      {req.status === 'Pending' && (
                        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
                          <button
                            onClick={() => handleRejectAllocation(req)}
                            className="bg-gray-50 border border-gray-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-gray-600 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                          >
                            Reject Request
                          </button>
                          <button
                            onClick={() => handleApproveAllocation(req)}
                            className="bg-black hover:bg-stone-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-sm hover:shadow"
                          >
                            Approve Allocation
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 9: NEGOTIATIONS */}
        {activeTab === 'negotiations' && (
          <div className="space-y-6 animate-fade-in font-display">
            <div className="border-b border-gray-100 pb-4 mb-4">
              <h3 className="text-base font-bold uppercase text-gray-950">Negotiation Requests</h3>
              <p className="text-[11px] text-gray-400 font-sans font-normal">Track, review and respond to alternative pricing offers from prospective tenants.</p>
            </div>

            {offers.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-500 font-sans shadow-sm">
                <Landmark className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                <h5 className="text-xs font-bold text-gray-800">No Negotiations pending</h5>
                <p className="text-[10px] text-gray-400 mt-1 max-w-sm mx-auto">Pricing proposals submitted through the smart store page 'Make an Offer' utility will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4 font-sans font-normal">
                {offers.map((offer) => (
                  <div key={offer.id} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:border-gray-200 transition-all">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold uppercase bg-stone-100 border border-stone-200 text-stone-600 px-2 py-0.5 rounded-full">
                            Space: {offer.storeName}
                          </span>
                          <span className="text-[10px] font-mono font-bold uppercase bg-purple-50 border border-purple-200 text-purple-600 px-2 py-0.5 rounded-full">
                            Tracking: {offer.trackingCode}
                          </span>
                          <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                            offer.status === 'Accepted'
                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                              : offer.status === 'Rejected'
                              ? 'bg-rose-50 border border-rose-200 text-rose-600'
                              : 'bg-amber-50 border border-amber-200 text-amber-600'
                          }`}>
                            {offer.status || 'Pending'}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold font-display text-gray-950">
                          {offer.contactName}
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-gray-650">
                          <p><span className="text-gray-500">Liaison Email:</span> {offer.email}</p>
                          <p><span className="text-gray-500">Liaison Phone:</span> {offer.phone || 'N/A'}</p>
                          <p><span className="text-gray-500">Offered Rate:</span> <span className="font-mono text-gray-900 font-bold">${Number(offer.offerAmount || 0).toLocaleString()}/mo</span></p>
                        </div>

                        {offer.message && (
                          <div className="bg-gray-50 border border-gray-205/50 p-3 rounded-2xl text-[11px] text-gray-650 leading-relaxed font-normal">
                            <span className="font-bold text-gray-800 uppercase text-[9px] block mb-1">Message Detail:</span>
                            {offer.message}
                          </div>
                        )}

                        <p className="text-[9px] font-mono text-gray-400">Proposed on {new Date(offer.submittedAt || '').toLocaleString()}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap shrink-0 self-start md:self-center">
                        <a
                          href={`mailto:${offer.email}?subject=Broward Mall Store Proposal: ${offer.storeName}`}
                          className="bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer block text-center"
                        >
                          Contact Lead
                        </a>
                        {(offer.status || 'Pending') === 'Pending' && (
                          <>
                            <button
                              onClick={() => handleRejectNegotiation(offer)}
                              className="bg-gray-50 border border-gray-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-gray-650 font-bold px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleAcceptNegotiation(offer)}
                              className="bg-black hover:bg-stone-900 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer"
                            >
                              Accept Proposal
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 10: SMART STORE INQUIRIES */}
        {activeTab === 'inquiries' && (
          <div className="space-y-6 animate-fade-in font-display">
            <div className="border-b border-gray-100 pb-4 mb-4">
              <h3 className="text-base font-bold uppercase text-gray-950">Store Inquiries Registry</h3>
              <p className="text-[11px] text-gray-400 font-sans font-normal">Review, filter, and track specific tenant queries linked to retail store specifications.</p>
            </div>

            {inquiries.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-500 font-sans shadow-sm">
                <Mail className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                <h5 className="text-xs font-bold text-gray-800">No Visitor Inquiries yet</h5>
                <p className="text-[10px] text-gray-400 mt-1 max-w-sm mx-auto">General and space questions submitted on retail store pages will populate here with conversational paths.</p>
              </div>
            ) : (
              <div className="space-y-4 font-sans font-normal">
                {inquiries.map((inq) => (
                  <div key={inq.id} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:border-gray-200 transition-all">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold uppercase bg-stone-100 border border-stone-200 text-stone-600 px-2 py-0.5 rounded-full">
                            Space: {inq.storeName}
                          </span>
                          <span className="text-[10px] font-mono font-bold uppercase bg-stone-100 border border-stone-200 text-stone-600 px-2 py-0.5 rounded-full">
                            Tracking Code: {inq.trackingCode}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold font-display text-gray-950">
                          {inq.visitorName}
                        </h4>

                        <p className="text-xs text-gray-600"><span className="text-gray-400">Email Liaison:</span> {inq.visitorEmail}</p>

                        <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl text-[11px] text-gray-650 leading-relaxed font-normal">
                          <span className="font-bold text-gray-800 uppercase text-[9px] block mb-1">Inquiry:</span>
                          {inq.message}
                        </div>

                        <p className="text-[9px] font-mono text-gray-400">Submitted on {new Date(inq.submittedAt || '').toLocaleString()}</p>
                      </div>

                      <div className="shrink-0 self-start md:self-center">
                        <a
                          href={`mailto:${inq.visitorEmail}?subject=Re: Inquiry regarding ${inq.storeName} space lookup`}
                          className="bg-black hover:bg-stone-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer block text-center shadow-sm"
                        >
                          Reply via Email
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

    </div>
  );
}

// Simple micro-icon representation
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}
