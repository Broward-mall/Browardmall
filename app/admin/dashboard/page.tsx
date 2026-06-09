'use client';

import React, { useEffect } from 'react';
import { useApp } from '@/src/context/AppContext';
import Navbar from '@/src/components/Navbar';
import Footer from '@/src/components/Footer';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import AdminPanel with SSR disabled to prevent Leaflet window imports from crashing static compilation
const AdminPanel = dynamic(() => import('@/src/components/AdminPanel'), { ssr: false });

export default function AdminDashboardPage() {
  const { stores, malls, landingSettings, loading, isAdminLoggedIn, logoutAdmin, refreshDb } = useApp();
  const router = useRouter();

  const handleNavigate = (route: string) => {
    if (route === '') {
      router.push('/');
    } else {
      router.push(`/${route}`);
    }
  };

  useEffect(() => {
    if (!loading && !isAdminLoggedIn) {
      router.push('/admin/login');
    }
  }, [isAdminLoggedIn, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC]">
        <Loader2 className="h-10 w-10 text-[#2563EB] animate-spin mb-4" />
        <span className="font-display font-medium text-xs tracking-wider text-[#475569] uppercase font-sans">Verifying security tunnel...</span>
      </div>
    );
  }

  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 text-[#475569] animate-spin mb-3" />
        <span className="font-display font-medium text-xs tracking-wider text-[#475569] uppercase font-sans">Redirecting to login portal...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] selection:bg-[#2563EB]/15 selection:text-[#0F172A]">
      <Navbar
        currentRoute="admin"
        onNavigate={handleNavigate}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={logoutAdmin}
      />
      
      <main className="flex-1">
        <AdminPanel
          currentRoute="admin"
          isAdminLoggedIn={isAdminLoggedIn}
          onNavigate={handleNavigate}
          stores={stores}
          malls={malls}
          onRefresh={refreshDb}
          landingSettings={landingSettings}
          onUpdateSettings={() => {}}
        />
      </main>

      <Footer
        settings={landingSettings}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
