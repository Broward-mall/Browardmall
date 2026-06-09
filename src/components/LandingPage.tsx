/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Loader2, Tag, Maximize, CircleDollarSign, Star, ArrowRight, Copy, Check } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Store, LandingPageSettings, MockReview, Mall } from '../types';
import MapComponent from './MapComponent';

interface LandingPageProps {
  settings: LandingPageSettings;
  stores: Store[];
  malls: Mall[];
  onNavigate: (route: string) => void;
}

const MOCK_REVIEWS: MockReview[] = [
  {
    id: "r1",
    authorName: "Sarah Jenkins",
    role: "VP of Retail, Eleganza",
    comment: "The visual map rendering and instant tracking transparency made selecting our secondary flagship location at Broward Mall completely frictionless.",
    rating: 5
  },
  {
    id: "r2",
    authorName: "Marcus Vance",
    role: "Managing Partner, Prime Foods",
    comment: "Securing dual kitchen allocations from Broward's food court catalog went through in hours. Checking operational features by code is a game changer.",
    rating: 5
  },
  {
    id: "r3",
    authorName: "Aaliyah Thorne",
    role: "Independent Franchise Developer",
    comment: "Stunning digital architecture. The interactive OSM floorplan lets us visualize foot traffic anchor points and ceiling scales BEFORE signing leases.",
    rating: 5
  }
];

export default function LandingPage({ settings, stores, malls, onNavigate }: LandingPageProps) {
  const [trackingCode, setTrackingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Find Broward Mall explicitly to keep the Landing Page focused on Broward Mall
  const selectedMall = malls.find(m => m.id === 'mall_broward_001' || m.mallName.toLowerCase().includes('broward')) || malls?.[0];
  const selectedMallId = selectedMall?.id || 'mall_broward_001';

  const [selectedFloor, setSelectedFloor] = useState<string>('All');

  // Filter stores belonging to Broward Mall (supporting either mallId or pre-seeded named stores)
  const storesInSelectedMall = stores.filter(s => {
    const isMallMatch = 
      s.mallId === selectedMallId || 
      (!s.mallId && (!s.mallName || s.mallName.toLowerCase().includes('broward')));
    
    // Do not show on landing page catalog unless showOnHomepage is true
    const fitsLanding = s.showOnHomepage === true;
    return isMallMatch && fitsLanding;
  });

  // Derive distinct list of Floors
  const floorsList = Array.from(new Set(storesInSelectedMall.map(s => s.floor || 'Ground Floor')));

  // Filter dynamic catalog matching selected floor level
  const filteredStoresList = selectedFloor === 'All'
    ? storesInSelectedMall
    : storesInSelectedMall.filter(s => (s.floor || 'Ground Floor') === selectedFloor);

  const finalDemoStores = filteredStoresList;

  const handleTrackingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = trackingCode.trim().toUpperCase();
    if (!cleanCode) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      // Query Firestore matching exact tracking code
      const q = query(collection(db, "stores"), where("trackingCode", "==", cleanCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setErrorMsg("The specified tracking code was not found. Please verify and try again.");
      } else {
        // Redirect to store page
        onNavigate(`store/${cleanCode}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred while validating the tracking code. Please try again.");
      try {
        handleFirestoreError(err, OperationType.GET, "stores");
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  return (
    <div className="relative bg-[#0a0a0c] text-neutral-100 overflow-hidden pb-16 font-sans min-h-screen">
      
      {/* Decorative dark vector radial gradient background */}
      <div className="absolute top-0 left-0 right-0 h-[600px] bg-gradient-to-b from-[#121216] via-[#0a0a0c] to-transparent pointer-events-none border-b border-neutral-900"></div>
 
      {/* Hero Header Section */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900/60 border border-neutral-850 mb-6 backdrop-blur-md animate-fade-in animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">Active Asset Registrars</span>
        </div>
        
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-white mb-6 leading-[1.1] bg-clip-text bg-gradient-to-r from-white via-[#fafafa] to-neutral-200">
          {settings.heroTitle || "Broward Mall"}
        </h1>
        
        <p className="text-sm sm:text-base md:text-lg text-neutral-400 font-normal max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
          {settings.heroSubtitle || "Discover, invest, and manage premium retail spaces inside a modern digital mall marketplace."}
        </p>
 
        {/* Core Feature: Centered Tracking Code Lookup */}
        <div className="max-w-md mx-auto mb-12">
          <div className="bg-[#121216] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37] mb-4 text-center font-display">
              Enter Your Store Tracking Code
            </h3>
            
            <form onSubmit={handleTrackingSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="e.g. LP-84592"
                  id="tracking-code-input"
                  required
                  disabled={loading}
                  className="w-full bg-[#18181e] border border-neutral-800 focus:border-[#d4af37] rounded-xl px-4 py-3.5 text-center text-lg sm:text-xl font-bold font-mono tracking-widest uppercase outline-none text-white focus:ring-1 focus:ring-[#d4af37] transition-all placeholder:text-neutral-500 placeholder:normal-case placeholder:font-sans placeholder:tracking-normal"
                />
                
                {loading && (
                  <div className="absolute right-4 top-4 text-[#d4af37]">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
              </div>
 
              {errorMsg && (
                <div className="p-3 text-xs bg-rose-950/20 border border-rose-900/30 rounded-lg text-rose-400 text-center font-medium animate-fade-in">
                  {errorMsg}
                </div>
              )}
 
              <button
                type="submit"
                disabled={loading}
                id="view-store-submit-btn"
                className="w-full bg-[#d4af37] hover:bg-[#c49e27] text-black py-3.5 px-6 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-300 shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {loading ? "Verifying Record..." : "Access Store Terminal"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </section>
  
      {/* Interactive Interior Explorer & Floor Filter */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24 z-10 relative">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-full mb-3 shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></span>
            <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-400 font-bold">Interactive Deck Level Explorer</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2 leading-tight">
            Broward Mall Asset Visualizer Map
          </h2>
          <p className="text-xs text-neutral-400 max-w-2xl mx-auto font-sans mb-6">
            Pans and focuses automatically on physical store geolocations inside Broward Mall. Toggle individual floor levels to isolate specific commercial suites.
          </p>

          {/* Interactive Floor Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            <button
              onClick={() => setSelectedFloor('All')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-300 ${
                selectedFloor === 'All'
                  ? 'bg-[#d4af37] text-black font-bold'
                  : 'bg-neutral-900 text-neutral-400 border border-neutral-850 hover:text-white'
              }`}
            >
              All Levels ({storesInSelectedMall.length})
            </button>
            {floorsList.map((fl) => {
              const countInFloor = storesInSelectedMall.filter(s => (s.floor || 'Ground Floor') === fl).length;
              return (
                <button
                  key={fl}
                  onClick={() => setSelectedFloor(fl)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-300 ${
                    selectedFloor === fl
                      ? 'bg-[#d4af37] text-black font-bold'
                      : 'bg-neutral-900 text-neutral-400 border border-neutral-850 hover:text-white'
                  }`}
                >
                  {fl} ({countInFloor})
                </button>
              );
            })}
          </div>
        </div>

        <div className="border border-neutral-800 rounded-2xl overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.4)] bg-[#121216] p-2">
          <MapComponent
            stores={filteredStoresList}
            mallCoords={selectedMall ? [selectedMall.lat, selectedMall.lng] : undefined}
            mallName={selectedMall?.mallName || "Broward Mall"}
            mallAddress={selectedMall?.address || "8000 W Broward Blvd, Plantation, FL 33388"}
            onSelectStore={(store) => onNavigate(`store/${store.trackingCode}`)}
          />
        </div>
      </section>
 
      {/* Sample Demo Stores Catalog */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
        <div className="flex flex-col sm:flex-row items-end justify-between border-b border-neutral-900 pb-5 mb-10 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">
              Featured Retail Portfolios
            </h2>
            <p className="text-xs text-neutral-400 mt-1.5 font-sans">
              Discover and acquire high-yielding commercial physical stores ready for rapid leasing activations.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-300 border border-neutral-800 py-1.5 px-3 rounded-lg bg-[#121216] shadow-md font-semibold">
            Registry Index Count: {stores.length}
          </span>
        </div>
 
        {finalDemoStores.length === 0 ? (
          <div className="text-center py-16 border border-neutral-850 bg-[#121216] rounded-2xl shadow-lg">
            <Loader2 className="h-6 w-6 text-[#d4af37] animate-spin mx-auto mb-3" />
            <p className="text-xs text-[#d4af37] font-mono">Initializing store registers...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {finalDemoStores.map((store) => (
              <div
                key={store.id || store.trackingCode}
                className="group relative bg-[#121216] border border-neutral-850 hover:border-[#d4af37]/45 rounded-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1 flex flex-col shadow-[0_4px_25px_rgba(0,0,0,0.3)]"
              >
                {/* Images gallery preview */}
                <div className="relative h-48 overflow-hidden bg-neutral-950 border-b border-neutral-900">
                  <img
                    src={store.images?.[0] || "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=600&q=80"}
                    alt={store.storeName}
                    className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-500"
                    id={`demo-store-img-${store.id}`}
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Status Tag */}
                  <div className="absolute top-3 right-3 z-10">
                    <span className={`text-[9px] uppercase tracking-wider font-bold font-mono px-2 py-1 rounded-md text-white shadow-md ${
                      store.status === 'Available' ? 'bg-emerald-600' :
                      store.status === 'Sold' ? 'bg-neutral-800 border border-neutral-700' : 'bg-amber-600'
                    }`}>
                      {store.status}
                    </span>
                  </div>
 
                  {/* Floor Level Tag */}
                  <div className="absolute bottom-3 left-3 z-10 flex gap-1.5">
                    <span className="text-[9px] uppercase tracking-wider font-semibold font-mono bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-md text-neutral-200 border border-neutral-800 shadow-lg">
                      {store.floor}
                    </span>
                  </div>
                </div>
 
                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {store.logo ? (
                        <img
                          src={store.logo}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover border border-neutral-800 shadow-sm"
                          id={`demo-store-logo-${store.id}`}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-neutral-900 text-amber-500 text-[9px] font-bold flex items-center justify-center border border-neutral-800">S</div>
                      )}
                      <span className="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase font-display">
                        {store.leaseType}
                      </span>
                    </div>
 
                    <h3 className="text-xs font-bold font-display text-white mb-2 tracking-tight group-hover:text-[#d4af37] transition-colors line-clamp-1">
                      {store.storeName}
                    </h3>
                    
                    <div className="space-y-1.5 pt-1.5 border-t border-neutral-900 text-[11px] text-neutral-300 font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-400 font-medium">Tracking Code:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#d4af37] tracking-wider bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-850">{store.trackingCode}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCode(store.trackingCode);
                            }}
                            className="text-neutral-400 hover:text-white p-0.5 rounded cursor-pointer"
                            title="Copy Code"
                          >
                            {copiedCode === store.trackingCode ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400 font-medium">Sizing:</span>
                        <span className="text-neutral-200 font-semibold">{store.sizeSqFt.toLocaleString()} sq ft</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400 font-medium">Lease Scale:</span>
                        <span className="text-white font-extrabold">${store.monthlyLease.toLocaleString()}/mo</span>
                      </div>
                    </div>
                  </div>
 
                  <div className="mt-5 pt-3 border-t border-neutral-900 flex gap-2">
                    <button
                      type="button"
                      id={`btn-track-demo-${store.id}`}
                      onClick={() => onNavigate(`store/${store.trackingCode}`)}
                      className="w-full bg-[#18181e] hover:bg-[#d4af37] text-neutral-200 hover:text-black border border-neutral-800 hover:border-[#d4af37] py-2 rounded-lg font-display font-bold text-xs tracking-wide uppercase transition-all duration-300 cursor-pointer flex items-center justify-center gap-1"
                    >
                      Inspect space
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
 
      {/* Trust & Reviews Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 relative">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2 leading-tight">
            Investors Trust Rating
          </h2>
          <div className="flex items-center justify-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4.5 w-4.5 text-[#d4af37] fill-[#d4af37]" />
            ))}
            <span className="text-xs font-bold text-white ml-2">4.9 / 5 Average Rating</span>
          </div>
          <p className="text-xs text-neutral-400 max-w-xl mx-auto font-sans">
            Hear from industry-leading corporate executives and fast-growing premium brand operators why Broward Mall is the benchmark for modern physical leasing.
          </p>
        </div>
 
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MOCK_REVIEWS.map((review) => (
            <div
              key={review.id}
              className="bg-[#121216] border border-neutral-850 rounded-2xl p-6 shadow-xl"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(review.rating)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 text-[#d4af37] fill-[#d4af37]" />
                ))}
              </div>
              <p className="text-xs text-neutral-300 italic leading-relaxed mb-5">
                "{review.comment}"
              </p>
              <div className="border-t border-neutral-900 pt-4">
                <h4 className="text-xs font-bold font-display text-white">{review.authorName}</h4>
                <p className="text-[10px] text-neutral-500 font-mono mt-0.5">{review.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
 
    </div>
  );
}
