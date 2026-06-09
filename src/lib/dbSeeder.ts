/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Store, Mall, LandingPageSettings } from '../types';

export const DEFAULT_LANDING_SETTINGS: LandingPageSettings = {
  heroTitle: "Broward Mall",
  heroSubtitle: "Discover, invest, and manage premium retail spaces inside a modern digital mall marketplace.",
  aboutText: "Broward Mall is South Florida's premier retail center, featuring an curated selection of local and global consumer brands, bespoke dining, lifestyle anchors, and state-of-the-art technological facilities, engineered for scaling fast-growing modern businesses.",
  contactPhone: "+1 (954) 473-8100",
  contactEmail: "lease@browardmarketplace.com",
  contactAddress: "8000 W Broward Blvd, Plantation, FL 33388",
  socialFb: "https://facebook.com/browardmall",
  socialIg: "https://instagram.com/browardmall",
  socialTw: "https://twitter.com/browardmall"
};

export const SEED_MALLS: Mall[] = [
  {
    id: "mall_broward_001",
    mallName: "Broward Mall Complex",
    location: "Plantation, Florida",
    address: "8000 W Broward Blvd, Plantation, FL 33388",
    lat: 26.1224,
    lng: -80.2528,
    mallImage: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80",
    totalStores: 150
  },
  {
    id: "mall_liberty_002",
    mallName: "Liberty Plaza Mall",
    location: "Dallas, Texas",
    address: "123 Main Street, Dallas, TX",
    lat: 32.7767,
    lng: -96.7970,
    mallImage: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
    totalStores: 120
  }
];

export const SEED_STORES: Store[] = [
  {
    storeName: "Luxury Retail Unit",
    location: "Plantation, Florida",
    mallId: "mall_broward_001",
    mallName: "Broward Mall Complex",
    trackingCode: "LP-84592",
    sizeSqFt: 48500,
    floor: "Ground Floor",
    unitNumber: "G-01",
    status: "Available",
    showOnHomepage: true,
    utilities: true,
    parkingSpaces: 320,
    ceilingHeight: "28 ft",
    loadingBays: 4,
    previousTenant: "Department Store",
    monthlyLease: 42000,
    leaseType: "Triple Net (NNN)",
    zone: "G1",
    description: {
      features: [
        "Large glass storefront facing anchor atrium",
        "Polished white tile floors with marble lining",
        "Escalator opening prepared for dual-level expanses",
        "Dimmable high-output LED lighting systems",
        "Direct loading dock access with roller doors"
      ]
    },
    images: [
      "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1567401893930-79072f53b492?auto=format&fit=crop&w=1200&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=400&q=80",
    isDemo: true
  },
  {
    storeName: "Fashion Boutique Space",
    location: "Plantation, Florida",
    mallId: "mall_broward_001",
    mallName: "Broward Mall Complex",
    trackingCode: "FB-22345",
    sizeSqFt: 12000,
    floor: "Level 2",
    unitNumber: "F-02",
    status: "Available",
    showOnHomepage: true,
    utilities: true,
    parkingSpaces: 80,
    ceilingHeight: "16 ft",
    loadingBays: 1,
    previousTenant: "Designer Apparel",
    monthlyLease: 15000,
    leaseType: "Modified Gross",
    zone: "F2",
    description: {
      features: [
        "Custom-grade natural oak runway floors",
        "Pendant ambient accent spotlights",
        "Velvet-upholstered fitting rooms with soft-backlights",
        "Integrated stock room storage with digital lock keys",
        "Full-height structural glass front entrance panel"
      ]
    },
    images: [
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=1200&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1537832816519-689ad163238b?auto=format&fit=crop&w=400&q=80",
    isDemo: true
  },
  {
    storeName: "Electronics Mega Store",
    location: "Plantation, Florida",
    mallId: "mall_broward_001",
    mallName: "Broward Mall Complex",
    trackingCode: "EM-44589",
    sizeSqFt: 28500,
    floor: "Level 1",
    unitNumber: "F-01",
    status: "Sold",
    showOnHomepage: true,
    utilities: true,
    parkingSpaces: 150,
    ceilingHeight: "22 ft",
    loadingBays: 2,
    previousTenant: "Tech Hub & Repair",
    monthlyLease: 28000,
    leaseType: "Double Net (NN)",
    zone: "F1",
    ownerName: "Benjamin George",
    ownerEmail: "owner@example.com",
    ownerPhone: "+234 803 123 4567",
    purchaseDate: "2026-06-07",
    expiryDate: "2027-06-07",
    ownershipType: "Purchased",
    description: {
      features: [
        "Dedicated server rack utility room with HVAC cooling",
        "High-density integrated underfloor power raceways",
        "Brushed aluminum product exhibition islands",
        "Anti-theft high frequency RF sensors pre-installed",
        "Fibre-optic Gigabit internet connections ready"
      ]
    },
    images: [
      "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=400&q=80",
    isDemo: true
  },
  {
    storeName: "Food Court Space",
    location: "Plantation, Florida",
    mallId: "mall_broward_001",
    mallName: "Broward Mall Complex",
    trackingCode: "FC-90871",
    sizeSqFt: 4500,
    floor: "Ground Floor",
    unitNumber: "G-05",
    status: "Available",
    showOnHomepage: true,
    utilities: true,
    parkingSpaces: 45,
    ceilingHeight: "18 ft",
    loadingBays: 1,
    previousTenant: "Italian Bistro",
    monthlyLease: 8500,
    leaseType: "Triple Net (NNN)",
    zone: "G5",
    description: {
      features: [
        "Heavy-duty dynamic commercial grease trap integrated",
        "High-capacity direct roof exhaust flue hood connection",
        "Three-phase industrial electricity supply line",
        "Sub-zero walking cold room compressor zone",
        "Polished concrete customer order area"
      ]
    },
    images: [
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80"
    ],
    logo: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80",
    isDemo: true
  }
];

export async function seedDatabaseIfNeeded() {
  try {
    // Seed malls if empty
    const mallsSnapshot = await getDocs(collection(db, 'malls'));
    if (mallsSnapshot.empty) {
      console.log("No malls detected! Autoseeding premium mall listings...");
      const batch = writeBatch(db);
      SEED_MALLS.forEach((mall) => {
        const docRef = doc(db, 'malls', mall.id!);
        batch.set(docRef, {
          ...mall,
          createdAt: new Date().toISOString()
        });
      });
      await batch.commit();
      console.log("Malls seeding complete.");
    }

    const storesSnapshot = await getDocs(collection(db, 'stores'));
    
    // Seed stores if empty
    if (storesSnapshot.empty) {
      console.log("No stores detected! Autoseeding premium mall data into Firestore...");
      const batch = writeBatch(db);
      
      SEED_STORES.forEach((store) => {
        const docRef = doc(collection(db, 'stores'));
        const associatedMall = SEED_MALLS.find((m) => m.id === store.mallId);
        batch.set(docRef, {
          ...store,
          id: docRef.id,
          lat: associatedMall ? associatedMall.lat : 26.1224,
          lng: associatedMall ? associatedMall.lng : -80.2528,
          createdAt: new Date().toISOString()
        });
      });
      
      await batch.commit();
      console.log("Seeding stores collection complete.");
    }

    // Seed landing settings if empty
    const settingsSnapshot = await getDocs(collection(db, 'settings'));
    if (settingsSnapshot.empty) {
      console.log("No custom settings found! Autoseeding defaults...");
      const batch = writeBatch(db);
      const settingsRef = doc(db, 'settings', 'landing');
      batch.set(settingsRef, DEFAULT_LANDING_SETTINGS);
      await batch.commit();
      console.log("Seeding landing page parameters complete.");
    }
  } catch (error) {
    console.warn("Firestore database seeding fallback is active:", error);
  }
}
