'use client';

import React from 'react';
import { useApp } from '@/src/context/AppContext';
import Navbar from '@/src/components/Navbar';
import Footer from '@/src/components/Footer';
import LandingPage from '@/src/components/LandingPage';
import LiveChat from '@/src/components/LiveChat';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { stores, malls, landingSettings, loading, isAdminLoggedIn, logoutAdmin } = useApp();
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC] text-[#0F172A]">
        <Loader2 className="h-10 w-10 text-[#2563EB] animate-spin mb-4" />
        <span className="font-display font-medium text-xs tracking-wider text-[#475569] uppercase">Synchronizing mall database...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] selection:bg-[#2563EB]/15 selection:text-[#0F172A]">
      <Navbar
        currentRoute=""
        onNavigate={handleNavigate}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={logoutAdmin}
      />
      
      <main className="flex-1">
        <LandingPage
          settings={landingSettings}
          stores={stores}
          malls={malls}
          onNavigate={handleNavigate}
        />
      </main>

      <LiveChat />

      <Footer
        settings={landingSettings}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
