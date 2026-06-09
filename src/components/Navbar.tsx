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
    <nav className="sticky top-0 z-50 bg-[#0c0c0f]/90 backdrop-blur-md border-b border-neutral-900 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-sans">
        <div className="flex items-center justify-between h-20">
          
          {/* Branding */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('')}>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-black border border-neutral-800 shadow-lg">
              <Landmark className="h-5 w-5 text-[#d4af37]" />
            </div>
            <div>
              <span className="text-base font-display font-extrabold tracking-tight text-white block">
                BROWARD MALL
              </span>
              <span className="text-[10px] text-[#d4af37] uppercase tracking-widest block font-mono font-bold">
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
                className="w-full bg-[#121216] border border-neutral-800 focus:border-[#d4af37] rounded-full pl-5 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-all duration-300 font-mono focus:ring-1 focus:ring-[#d4af37] shadow-inner"
              />
              <button
                type="submit"
                className="absolute right-1 top-1 text-neutral-400 hover:text-[#d4af37] bg-transparent rounded-full p-1.5 transition-colors duration-200 cursor-pointer"
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
                currentRoute === '' ? 'text-[#d4af37] font-extrabold pb-0.5 border-b-2 border-[#d4af37]' : 'text-neutral-400 hover:text-white'
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
                    currentRoute.startsWith('admin') ? 'text-[#d4af37] font-extrabold pb-0.5 border-b-2 border-[#d4af37]' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5 text-[#d4af37]" />
                  Console
                </button>
                <button
                  type="button"
                  onClick={onAdminLogout}
                  className="bg-neutral-900 hover:bg-[#d4af37] text-neutral-300 hover:text-black border border-neutral-800 font-bold text-[11px] uppercase tracking-wider py-1.5 px-3.5 rounded-lg transition-all cursor-pointer"
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
              className="text-neutral-400 hover:text-white p-2 rounded-lg cursor-pointer animate-fade-in"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0c0c0f] border-b border-neutral-900 px-4 pt-2 pb-6 space-y-4 shadow-xl">
          <form onSubmit={handleQuickSearchSubmit} className="relative w-full">
            <input
              type="text"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value)}
              placeholder="Search Store Code (e.g. LP-84592)..."
              className="w-full bg-[#121216] border border-neutral-800 focus:border-[#d4af37] rounded-xl pl-4 pr-10 py-3 text-xs text-white placeholder-neutral-500 outline-none font-mono"
            />
            <button
              type="submit"
              className="absolute right-2 top-2 text-neutral-400 hover:text-white p-1.5 cursor-pointer"
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
              className="text-left text-xs uppercase tracking-wider font-bold text-neutral-300 hover:text-white py-2 border-b border-neutral-900 cursor-pointer"
            >
              Directories Portfolio
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
