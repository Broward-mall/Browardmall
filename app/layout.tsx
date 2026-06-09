import type { Metadata } from 'next';
import './globals.css';
import React from 'react';
import { AppProvider } from '@/src/context/AppContext';

export const metadata: Metadata = {
  title: 'Broward Mall Commercial Directory',
  description: 'Digital mall space directory and catalog tracking platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-[#0F172A] antialiased">
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
