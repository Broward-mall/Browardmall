/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { seedDatabaseIfNeeded, DEFAULT_LANDING_SETTINGS } from './lib/dbSeeder';
import { Store, LandingPageSettings, Mall } from './types';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './components/LandingPage';
import StoreDetail from './components/StoreDetail';
import AdminPanel from './components/AdminPanel';
import LiveChat from './components/LiveChat';
import { Loader2, Landmark } from 'lucide-react';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(''); // hash path
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [malls, setMalls] = useState<Mall[]>([]);
  const [landingSettings, setLandingSettings] = useState<LandingPageSettings>(DEFAULT_LANDING_SETTINGS);

  // Hash Router setup
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      setCurrentRoute(hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // trigger initially

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Navigate Helper updating browser location hash
  const handleNavigate = (route: string) => {
    window.location.hash = `/${route}`;
    setCurrentRoute(route);
  };

  // Auth monitoring session listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdminLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  // Core DB Synchronization + Seeding process
  const synchronizeDatabase = async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      // 1. Run autoseeder to guarantee working premium demo stores
      await seedDatabaseIfNeeded();

      // 2. Query stores collection ordered by creation timestamp
      const storesQuery = query(collection(db, 'stores'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(storesQuery);
      const fetchedStores: Store[] = [];
      querySnapshot.forEach((doc) => {
        fetchedStores.push({ id: doc.id, ...doc.data() } as Store);
      });

      // Load local-only stores too if any are registered under limited connectivity
      const localStoresStr = localStorage.getItem('local_stores');
      if (localStoresStr) {
        try {
          const localStores = JSON.parse(localStoresStr) as Store[];
          localStores.forEach(ls => {
            if (!fetchedStores.some(fs => fs.id === ls.id)) {
              fetchedStores.push(ls);
            }
          });
        } catch (_) {}
      }

      // Sort all stores descending by creation timestamp
      fetchedStores.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });

      setStores(fetchedStores);

      // 3. Query malls collection
      const mallsSnapshot = await getDocs(collection(db, 'malls'));
      const fetchedMalls: Mall[] = [];
      mallsSnapshot.forEach((doc) => {
        fetchedMalls.push({ id: doc.id, ...doc.data() } as Mall);
      });
      setMalls(fetchedMalls);

      // 4. Fetch lander configuration parameters
      const settingsDocRef = doc(db, 'settings', 'landing');
      const settingsSnap = await getDoc(settingsDocRef);
      if (settingsSnap.exists()) {
        setLandingSettings(settingsSnap.data() as LandingPageSettings);
      } else {
        setLandingSettings(DEFAULT_LANDING_SETTINGS);
      }

    } catch (error) {
      console.warn("Real-time database sync in offline/restricted sandbox mode:", error);
      // Fallback to default mock data locally so application remains 100% functional
      const { SEED_STORES, SEED_MALLS } = await import('./lib/dbSeeder');
      let combinedFallback: Store[] = [...SEED_STORES.map((s, idx) => ({ ...s, id: `mock-${idx}` }))];
      
      const localStoresStr = localStorage.getItem('local_stores');
      if (localStoresStr) {
        try {
          const localStores = JSON.parse(localStoresStr) as Store[];
          localStores.forEach(ls => {
            if (!combinedFallback.some(fs => fs.id === ls.id)) {
              combinedFallback.push(ls);
            }
          });
        } catch (_) {}
      }

      // Sort
      combinedFallback.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });

      setStores(combinedFallback);
      setMalls(SEED_MALLS);
      setLandingSettings(DEFAULT_LANDING_SETTINGS);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    synchronizeDatabase(false);
  }, []);

  // Real-time live synchronization listeners
  useEffect(() => {
    const storesCollection = collection(db, 'stores');
    const unsubscribeStores = onSnapshot(storesCollection, (snapshot) => {
      const liveStores: Store[] = [];
      snapshot.forEach((doc) => {
        liveStores.push({ id: doc.id, ...doc.data() } as Store);
      });

      // Merge local storage stores
      const localStoresStr = localStorage.getItem('local_stores');
      if (localStoresStr) {
        try {
          const localStores = JSON.parse(localStoresStr) as Store[];
          localStores.forEach(ls => {
            if (!liveStores.some(fs => fs.id === ls.id)) {
              liveStores.push(ls);
            }
          });
        } catch (_) {}
      }

      // Sort manually
      liveStores.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA; // descending
      });

      setStores(liveStores.length > 0 ? liveStores : stores);
    }, (error) => {
      console.warn("Real-time onSnapshot sync restricted locally:", error.message);
    });

    const mallsCollection = collection(db, 'malls');
    const unsubscribeMalls = onSnapshot(mallsCollection, (snapshot) => {
      const liveMalls: Mall[] = [];
      snapshot.forEach((doc) => {
        liveMalls.push({ id: doc.id, ...doc.data() } as Mall);
      });
      if (liveMalls.length > 0) {
        setMalls(liveMalls);
      }
    }, (error) => {
      console.warn("Real-time onSnapshot malls restricted:", error.message);
    });

    const settingsDoc = doc(db, 'settings', 'landing');
    const unsubscribeSettings = onSnapshot(settingsDoc, (snapshot) => {
      if (snapshot.exists()) {
        setLandingSettings(snapshot.data() as LandingPageSettings);
      }
    }, (error) => {
      console.warn("Real-time onSnapshot settings restricted:", error.message);
    });

    return () => {
      unsubscribeStores();
      unsubscribeMalls();
      unsubscribeSettings();
    };
  }, []);

  // Dynamic browser favicon manager
  useEffect(() => {
    const faviconUrl = landingSettings?.faviconUrl;
    
    // Find all existing favicon links
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    
    if (faviconUrl) {
      // Remove existing to avoid dual representation headers
      existingLinks.forEach(el => el.remove());
      
      // Create main Rel icon link
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = faviconUrl.endsWith('.png') ? 'image/png' : faviconUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/x-icon';
      link.href = faviconUrl;
      document.head.appendChild(link);
      
      // Create shortcut icon link for older bookmarks and alternative clients
      const shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      shortcutLink.href = faviconUrl;
      document.head.appendChild(shortcutLink);
    } else {
      // Restore standard defaults
      existingLinks.forEach(el => el.remove());
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = '/favicon.ico';
      document.head.appendChild(link);
    }
  }, [landingSettings?.faviconUrl]);

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
      handleNavigate('');
    } catch (e) {
      console.error(e);
    }
  };

  // --- ROUTE RESOLVER ---

  const renderActiveView = () => {
    // 1. Store specs tracker link: e.g. "store/LP-84592"
    if (currentRoute.startsWith('store/')) {
      const code = currentRoute.substring(6).toUpperCase();
      const matchedStore = stores.find(s => s.trackingCode.toUpperCase() === code);
      
      if (!matchedStore) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 bg-[#0a0a0c]">
            <div className="w-16 h-16 rounded-full bg-rose-950/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 animate-pulse">
              <Landmark className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-2">Registry Record Missing</h2>
            <p className="text-xs text-gray-500 max-w-sm leading-relaxed mb-6">
              The tracking code string <span className="font-mono font-bold text-[#d4af37]">{code}</span> is not logged inside Broward Mall index registry.
            </p>
            <button
              onClick={() => handleNavigate('')}
              className="bg-[#d4af37] text-black font-display font-bold text-xs uppercase tracking-widest py-3 px-6 rounded-xl hover:bg-amber-400 transition-colors cursor-pointer"
            >
              Return to Land Directory
            </button>
          </div>
        );
      }

      return (
        <StoreDetail
          store={matchedStore}
          onNavigate={handleNavigate}
          onRefresh={synchronizeDatabase}
        />
      );
    }

    // 2. Admin dashboard paths
    if (currentRoute === 'admin' || currentRoute === 'admin/login') {
      return (
        <AdminPanel
          currentRoute={currentRoute}
          isAdminLoggedIn={isAdminLoggedIn}
          onNavigate={handleNavigate}
          stores={stores}
          malls={malls}
          onRefresh={synchronizeDatabase}
          landingSettings={landingSettings}
          onUpdateSettings={(newSets) => setLandingSettings(newSets)}
        />
      );
    }

    // Default: Main directory landing page
    return (
      <LandingPage
        settings={landingSettings}
        stores={stores}
        malls={malls}
        onNavigate={handleNavigate}
      />
    );
  };

  // Spinner loader on initialization
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0c] text-white">
        <Loader2 className="h-10 w-10 text-[#d4af37] animate-spin mb-4" />
        <span className="font-display font-bold text-xs tracking-wider text-amber-500/90 uppercase">Synchronizing mall database...</span>
      </div>
    );
  }

  return (
    <div id="broward-mall-root" className="min-h-screen flex flex-col bg-[#0a0a0c] text-white selection:bg-[#d4af37]/35 selection:text-white">
      <Navbar
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={handleAdminLogout}
      />
      
      <main className="flex-1">
        {renderActiveView()}
      </main>

      {currentRoute !== 'admin' && currentRoute !== 'admin/login' && (
        <LiveChat />
      )}

      <Footer
        settings={landingSettings}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
