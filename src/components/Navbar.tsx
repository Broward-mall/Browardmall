/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Search, Menu, X, Landmark } from 'lucide-react';

interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  isAdminLoggedIn: boolean;
  onAdminLogout: () => void;
}

export default function Navbar({
  currentRoute,
  onNavigate,
  isAdminLoggedIn,
  onAdminLogout
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickCode, setQuickCode] = useState('');

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickCode.trim()) {
      onNavigate(`store/${quickCode.trim().toUpperCase()}`);
      setQuickCode('');
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#E2E8F0] shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-sans">
        <div className="flex items-center justify-between h-20">
          
          {/* Branding */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('')}>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 border border-blue-600 shadow-md shadow-blue-500/10">
              <Landmark className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-base font-display font-extrabold tracking-tight text-[#0F172A] block">
                BROWARD MALL
              </span>
              <span className="text-[10px] text-[#2563EB] uppercase tracking-widest block font-mono font-bold">
                Asset Exchange
              </span>
            </div>
          </div>

          {/* Center search bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-sm mx-8">
            <form onSubmit={handleQuickSearchSubmit} className="relative w-full">
              <input
                type="text"
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value)}
                placeholder="Track Store Code (e.g. LP-84592)..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-full pl-5 pr-10 py-2.5 text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all duration-300 font-mono focus:ring-1 focus:ring-[#2563EB] shadow-inner"
              />
              <button
                type="submit"
                className="absolute right-1 top-1 text-[#475569] hover:text-[#2563EB] bg-transparent rounded-full p-1.5 transition-colors duration-200 cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* Menu Actions (Desktop) */}
          <div className="hidden md:flex items-center gap-6">
            <button
              type="button"
              onClick={() => onNavigate('')}
              className={`text-xs uppercase tracking-wider font-bold transition-all cursor-pointer ${
                currentRoute === '' ? 'text-[#2563EB] font-extrabold pb-0.5 border-b-2 border-[#2563EB]' : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              Directories
            </button>
            
            {/* ONLY show dashboard actions if the admin is logged in. No public admin links exist otherwise. */}
            {isAdminLoggedIn && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className={`text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentRoute.startsWith('admin') ? 'text-[#2563EB] font-extrabold pb-0.5 border-b-2 border-[#2563EB]' : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5 text-[#2563EB]" />
                  Console
                </button>
                <button
                  type="button"
                  onClick={onAdminLogout}
                  className="bg-[#F8FAFC] hover:bg-[#2563EB] text-[#475569] hover:text-white border border-[#E2E8F0] font-bold text-[11px] uppercase tracking-wider py-1.5 px-3.5 rounded-lg transition-all cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>

          {/* Mobile responsive toggle */}
          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-[#475569] hover:text-[#0F172A] p-2 rounded-lg cursor-pointer animate-fade-in"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#E2E8F0] px-4 pt-2 pb-6 space-y-4 shadow-xl">
          <form onSubmit={handleQuickSearchSubmit} className="relative w-full">
            <input
              type="text"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value)}
              placeholder="Search Store Code (e.g. LP-84592)..."
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] rounded-xl pl-4 pr-10 py-3 text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none font-mono"
            />
            <button
              type="submit"
              className="absolute right-2 top-2 text-[#475569] hover:text-[#0F172A] p-1.5 cursor-pointer"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>

          <div className="flex flex-col gap-3 font-sans">
            <button
              type="button"
              onClick={() => {
                onNavigate('');
                setMobileMenuOpen(false);
              }}
              className="text-left text-xs uppercase tracking-wider font-bold text-[#475569] hover:text-[#0F172A] py-2 border-b border-[#E2E8F0] cursor-pointer"
            >
              Directories Portfolio
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
