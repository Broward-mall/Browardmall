'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth } from '@/src/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { seedDatabaseIfNeeded, DEFAULT_LANDING_SETTINGS } from '@/src/lib/dbSeeder';
import { Store, LandingPageSettings, Mall } from '@/src/types';

interface AppContextType {
  stores: Store[];
  malls: Mall[];
  landingSettings: LandingPageSettings;
  loading: boolean;
  isAdminLoggedIn: boolean;
  refreshDb: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [malls, setMalls] = useState<Mall[]>([]);
  const [landingSettings, setLandingSettings] = useState<LandingPageSettings>(DEFAULT_LANDING_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  // Sync auth session state (cookie based check is done on the backend, firebase auth is kept on the client)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdminLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  const synchronizeDatabase = async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      // 1. Run autoseeder to guarantee working premium demo stores
      await seedDatabaseIfNeeded();

      // 2. Query stores
      const storesQuery = query(collection(db, 'stores'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(storesQuery);
      const fetchedStores: Store[] = [];
      querySnapshot.forEach((doc) => {
        fetchedStores.push({ id: doc.id, ...doc.data() } as Store);
      });

      // Merge local stores
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

      // Sort
      fetchedStores.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });

      setStores(fetchedStores);

      // 3. Query malls
      const mallsSnapshot = await getDocs(collection(db, 'malls'));
      const fetchedMalls: Mall[] = [];
      mallsSnapshot.forEach((doc) => {
        fetchedMalls.push({ id: doc.id, ...doc.data() } as Mall);
      });
      setMalls(fetchedMalls);

      // 4. Fetch lander settings
      const settingsDocRef = doc(db, 'settings', 'landing');
      const settingsSnap = await getDoc(settingsDocRef);
      if (settingsSnap.exists()) {
        setLandingSettings(settingsSnap.data() as LandingPageSettings);
      } else {
        setLandingSettings(DEFAULT_LANDING_SETTINGS);
      }
    } catch (error) {
      console.warn("Real-time database sync fallback:", error);
      const { SEED_STORES, SEED_MALLS } = await import('@/src/lib/dbSeeder');
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

    // Realtime snapshot subscription
    const unsubscribeStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      const liveStores: Store[] = [];
      snapshot.forEach((doc) => {
        liveStores.push({ id: doc.id, ...doc.data() } as Store);
      });

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

      liveStores.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });

      if (liveStores.length > 0) setStores(liveStores);
    }, (err) => console.warn("Stores snapshot error:", err));

    const unsubscribeMalls = onSnapshot(collection(db, 'malls'), (snapshot) => {
      const liveMalls: Mall[] = [];
      snapshot.forEach((doc) => {
        liveMalls.push({ id: doc.id, ...doc.data() } as Mall);
      });
      if (liveMalls.length > 0) setMalls(liveMalls);
    }, (err) => console.warn("Malls snapshot error:", err));

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'landing'), (snapshot) => {
      if (snapshot.exists()) {
        setLandingSettings(snapshot.data() as LandingPageSettings);
      }
    }, (err) => console.warn("Settings snapshot error:", err));

    return () => {
      unsubscribeStores();
      unsubscribeMalls();
      unsubscribeSettings();
    };
  }, []);

  const logoutAdmin = async () => {
    try {
      await signOut(auth);
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        stores,
        malls,
        landingSettings,
        loading,
        isAdminLoggedIn,
        refreshDb: () => synchronizeDatabase(true),
        logoutAdmin
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
