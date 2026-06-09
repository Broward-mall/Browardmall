'use client';

import React, { use } from 'react';
import { useApp } from '@/src/context/AppContext';
import StoreDetail from '@/src/components/StoreDetail';
import Navbar from '@/src/components/Navbar';
import Footer from '@/src/components/Footer';
import LiveChat from '@/src/components/LiveChat';
import { useRouter } from 'next/navigation';
import { Landmark, Loader2 } from 'lucide-react';

export default function StoreDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { stores, landingSettings, loading, isAdminLoggedIn, logoutAdmin, refreshDb } = useApp();
  const router = useRouter();

  const handleNavigate = (route: string) => {
    if (route === '') {
      router.push('/');
    } else {
      router.push(`/${route}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC]">
        <Loader2 className="h-10 w-10 text-[#2563EB] animate-spin mb-4" />
        <span className="font-display font-medium text-xs tracking-wider text-[#475569] uppercase">Retrieving asset data...</span>
      </div>
    );
  }

  const cleanCode = (code || '').trim().toUpperCase();
  const matchedStore = stores.find((s) => (s.trackingCode || '').trim().toUpperCase() === cleanCode);

  if (!matchedStore) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
        <Navbar
          currentRoute={`store/${code}`}
          onNavigate={handleNavigate}
          isAdminLoggedIn={isAdminLoggedIn}
          onAdminLogout={logoutAdmin}
        />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center text-[#DC2626] mb-4 shadow-sm">
            <Landmark className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-display font-black tracking-tight mb-2 text-[#0F172A]">Asset Key Not Found</h1>
          <p className="text-xs text-[#475569] max-w-sm leading-relaxed mb-6">
            The tracking code <span className="font-mono font-bold text-red-600 bg-red-50/50 px-1 py-0.5 rounded border border-red-200">{cleanCode}</span> was not resolved as an active commercial registry unit.
          </p>
          <button
            type="button"
            onClick={() => handleNavigate('')}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 px-6 rounded-xl text-xs uppercase font-bold tracking-wider transition-all cursor-pointer shadow-md shadow-blue-500/10"
          >
            Back to Directory Map
          </button>
        </main>
        <Footer settings={landingSettings} onNavigate={handleNavigate} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] selection:bg-[#2563EB]/15 selection:text-[#0F172A]">
      <Navbar
        currentRoute={`store/${code}`}
        onNavigate={handleNavigate}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={logoutAdmin}
      />
      <main className="flex-1">
        <StoreDetail
          store={matchedStore}
          onNavigate={handleNavigate}
          onRefresh={refreshDb}
        />
      </main>
      <LiveChat />
      <Footer settings={landingSettings} onNavigate={handleNavigate} />
    </div>
  );
}
