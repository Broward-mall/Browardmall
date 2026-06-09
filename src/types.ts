/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StoreDescription {
  features: string[];
}

export interface Mall {
  id?: string;
  mallName: string;
  location: string;
  address: string;
  lat: number;
  lng: number;
  mallImage?: string;
  totalStores?: number;
  createdAt?: string;
}

export interface Store {
  id?: string;
  storeName: string;
  location: string;
  mallId: string;
  mallName: string;
  mallAddress?: string;
  trackingCode: string;
  sizeSqFt: number;
  floor: string;
  unitNumber: string;
  status: 'Available' | 'Sold' | 'Leased' | 'Reserved' | 'Under Negotiation' | 'Coming Soon' | string;
  utilities: boolean;
  parkingSpaces: number;
  ceilingHeight: string;
  loadingBays: number;
  previousTenant: string;
  monthlyLease: number;
  leaseType: string;
  description: StoreDescription;
  images: string[];
  logo: string;
  lat?: number;
  lng?: number;
  zone?: string;

  // New features
  showOnLandingPage?: boolean;
  showOnHomepage?: boolean;
  featuredTag?: 'Featured' | 'Premium' | 'Hot Deal' | 'Recently Added' | '';
  videos?: string[];
  images360?: string[];

  // Owner details
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  purchaseDate?: string;
  expiryDate?: string;
  ownershipType?: 'Purchased' | 'Leased' | 'Shared Ownership' | string;
  ownershipStatus?: 'Unassigned' | 'Allocated' | 'Owned';

  isDemo?: boolean;
  isYearlyPayment?: boolean;
  yearlyPaymentAmount?: number;
  yearlyExpirationDate?: string;
  createdAt?: string;
}

export interface LandingPageSettings {
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  socialFb?: string;
  socialIg?: string;
  socialTw?: string;
  faviconUrl?: string;
}

export interface MockReview {
  id: string;
  authorName: string;
  role: string;
  comment: string;
  rating: number;
}
