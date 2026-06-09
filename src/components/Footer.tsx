/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Landmark, Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';
import { LandingPageSettings } from '../types';

interface FooterProps {
  settings: LandingPageSettings;
  onNavigate: (route: string) => void;
}

export default function Footer({ settings, onNavigate }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-white border-t border-[#E2E8F0] pt-16 pb-8 text-[#475569] font-sans mt-auto">
      {/* Structural visual divider accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#E2E8F0] to-transparent"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('')}>
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 border border-blue-600 shadow-sm shadow-blue-500/10">
                <Landmark className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-base font-display font-extrabold tracking-tight text-[#0F172A] animate-fade-in">
                BROWARD MALL
              </span>
            </div>
            <p className="text-xs text-[#475569] leading-relaxed max-w-sm">
              {settings.aboutText || "Discover, invest, and manage premium retail spaces inside South Florida's modern digital mall marketplace."}
            </p>
            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              {settings.socialFb && (
                <a
                  href={settings.socialFb}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-[#F8FAFC] hover:bg-[#2563EB] border border-[#E2E8F0] flex items-center justify-center transition-all duration-300 text-[#475569] hover:text-white shadow-sm"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              {settings.socialIg && (
                <a
                  href={settings.socialIg}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-[#F8FAFC] hover:bg-[#2563EB] border border-[#E2E8F0] flex items-center justify-center transition-all duration-300 text-[#475569] hover:text-white shadow-sm"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {settings.socialTw && (
                <a
                  href={settings.socialTw}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-[#F8FAFC] hover:bg-[#2563EB] border border-[#E2E8F0] flex items-center justify-center transition-all duration-300 text-[#475569] hover:text-white shadow-sm"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-[#2563EB] text-xs font-bold uppercase tracking-wider font-display">Directory</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button type="button" onClick={() => onNavigate('')} className="hover:text-[#2563EB] text-[#475569] transition-all cursor-pointer">
                  Featured Retail Units
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('')} className="hover:text-[#2563EB] text-[#475569] transition-all cursor-pointer">
                  Interactive Site Map
                </button>
              </li>
              <li>
                <span className="text-[#94A3B8] select-none">
                  Liaison Services (24/7)
                </span>
              </li>
            </ul>
          </div>

          {/* Leasing Contact details */}
          <div className="space-y-4">
            <h4 className="text-[#2563EB] text-xs font-bold uppercase tracking-wider font-display">Leasing Concierge</h4>
            <ul className="space-y-3.5 text-xs text-[#475569]">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                <span>{settings.contactAddress || "8000 W Broward Blvd, Plantation, FL 33388"}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#2563EB] shrink-0" />
                <a 
                  href={`tel:${settings.contactPhone || "+19544738100"}`} 
                  className="hover:text-[#2563EB] transition-colors"
                >
                  {settings.contactPhone || "+1 (954) 473-8100"}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#2563EB] shrink-0" />
                <a 
                  href={`mailto:${settings.contactEmail || "leasing@browardmall.com"}`} 
                  className="hover:text-[#2563EB] transition-colors truncate"
                >
                  {settings.contactEmail || "leasing@browardmall.com"}
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Divider & Copyright */}
        <div className="border-t border-[#E2E8F0] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-[#94A3B8]">
          <p>© {currentYear} BROWARD MALL LEASING SYSTEM. ALL RIGHTS RESERVED.</p>
          <div className="flex gap-5">
            <a href="#/" onClick={(e) => { e.preventDefault(); onNavigate(''); }} className="hover:text-[#2563EB] transition-colors">PRIVACY REGULATION</a>
            <a href="#/" onClick={(e) => { e.preventDefault(); onNavigate(''); }} className="hover:text-[#2563EB] transition-colors">LEASING STANDARDS</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
