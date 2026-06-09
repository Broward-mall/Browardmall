/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Store } from '../types';

// Import Leaflet CSS in main code
import 'leaflet/dist/leaflet.css';

// Precision layout coordinates for Broward Mall (Plantation, FL)
const BROWARD_MALL_COORDS: [number, number] = [26.1224, -80.2526];

// Custom luxury Gold & Dark SVG pin for standard stores
const createStoreIcon = (storeName: string, isHighlighted: boolean = false) => {
  const size = isHighlighted ? 'w-10 h-10' : 'w-8 h-8';
  const color = isHighlighted ? 'bg-amber-500 border-yellow-200 text-black' : 'bg-neutral-900 border-[#d4af37] text-[#d4af37]';
  
  return L.divIcon({
    className: 'custom-store-pin',
    html: `
      <div class="relative flex items-center justify-center ${size} rounded-full ${color} border-2 shadow-2xl transition-all duration-300 transform hover:scale-110">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <span class="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/90 text-white border border-[#d4af37]/30 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity duration-200 font-sans shadow-md">
          ${storeName}
        </span>
      </div>
    `,
    iconSize: isHighlighted ? [40, 40] : [32, 32],
    iconAnchor: isHighlighted ? [20, 20] : [16, 16],
    popupAnchor: [0, -16],
  });
};

// Custom central Mall marker icon
const mallIcon = L.divIcon({
  className: 'custom-mall-pin',
  html: `
    <div class="flex items-center justify-center w-12 h-12 rounded-full bg-black border-2 border-[#d4af37] text-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.4)] animate-pulse">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -24],
});

// Map controller to reset view dynamically
function MapController({ center, zoom, force }: { center: [number, number]; zoom: number; force: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1 });
    // Invalidate size to ensure it renders correctly after container transforms
    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  }, [center, zoom, map, force]);

  return null;
}

interface MapComponentProps {
  stores: Store[];
  selectedStore?: Store;
  onSelectStore?: (store: Store) => void;
  heightClass?: string;
  mallCoords?: [number, number];
  mallName?: string;
  mallAddress?: string;
}

export default function MapComponent({
  stores,
  selectedStore,
  onSelectStore,
  heightClass = "h-[450px]",
  mallCoords,
  mallName,
  mallAddress
}: MapComponentProps) {
  const activeStore = selectedStore || (stores && stores.length > 0 ? stores[0] : undefined);

  const finalMallName = mallName || activeStore?.mallName || "Broward Mall";
  const finalMallAddress = mallAddress || activeStore?.mallAddress || "8000 W Broward Blvd, Plantation, FL 33388";

  const defaultCoords = mallCoords || (activeStore && activeStore.lat && activeStore.lng ? [activeStore.lat, activeStore.lng] as [number, number] : BROWARD_MALL_COORDS);
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCoords);
  const [zoomLevel, setZoomLevel] = useState<number>(16);
  const [viewTrigger, setViewTrigger] = useState<number>(0);

  // Update map center when active mall coordinates change
  useEffect(() => {
    if (mallCoords) {
      setMapCenter(mallCoords);
      setZoomLevel(16);
      setViewTrigger(prev => prev + 1);
    } else if (activeStore && activeStore.lat && activeStore.lng) {
      setMapCenter([activeStore.lat, activeStore.lng]);
      setZoomLevel(16);
      setViewTrigger(prev => prev + 1);
    }
  }, [mallCoords, activeStore?.lat, activeStore?.lng]);

  // When a store is selected, center and zoom in on that store
  useEffect(() => {
    if (selectedStore && selectedStore.lat && selectedStore.lng) {
      setMapCenter([selectedStore.lat, selectedStore.lng]);
      setZoomLevel(19);
      setViewTrigger(prev => prev + 1);
    }
  }, [selectedStore]);

  const handleResetToMall = () => {
    setMapCenter(defaultCoords);
    setZoomLevel(16);
    setViewTrigger(prev => prev + 1);
  };

  return (
    <div id="mall-map-container" className="relative w-full rounded-2xl overflow-hidden border border-[#d4af37]/20 shadow-[0_4px_30px_rgba(0,0,0,0.4)] bg-[#111]">
      <MapContainer
        center={mapCenter}
        zoom={zoomLevel}
        className={`w-full ${heightClass} z-10`}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        {/* OpenStreetMap Luxury style tiles from CartoDB Voyager Dark */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
        />

        <MapController center={mapCenter} zoom={zoomLevel} force={viewTrigger} />

        {/* Mall Base Pin */}
        <Marker position={defaultCoords} icon={mallIcon}>
          <Popup>
            <div className="p-2 text-neutral-900 font-sans">
              <h4 className="font-semibold text-sm border-b border-gray-100 pb-1 mb-1 font-display">🏬 {finalMallName}</h4>
              <p className="text-xs text-neutral-600">{finalMallAddress}</p>
            </div>
          </Popup>
        </Marker>

        {/* Dynamic Store Pins */}
        {stores.map((store) => {
          if (!store.lat || !store.lng) return null;
          const isHighlighted = selectedStore?.id === store.id || selectedStore?.trackingCode === store.trackingCode;

          return (
            <Marker
              key={store.id || store.trackingCode}
              position={[store.lat, store.lng]}
              icon={createStoreIcon(store.storeName, isHighlighted)}
            >
              <Popup>
                <div className="p-2 text-neutral-900 font-sans min-w-[180px]">
                  <div className="flex items-center gap-1.5 mb-1.5 border-b border-neutral-100 pb-1.5">
                    {store.logo ? (
                      <img
                        src={store.logo}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover border border-amber-500/30"
                        id={`map-popup-logo-${store.id || store.trackingCode}`}
                      />
                    ) : (
                      <span className="w-5 h-5 bg-neutral-900 text-[#d4af37] text-[10px] font-bold flex items-center justify-center rounded-full">S</span>
                    )}
                    <h4 className="font-bold text-xs truncate max-w-[140px]">{store.storeName}</h4>
                  </div>
                  <p className="text-[11px] text-neutral-600 mb-1">
                    <span className="font-medium">Floor:</span> {store.floor}
                  </p>
                  <p className="text-[11px] text-neutral-600 mb-1">
                    <span className="font-medium">Size:</span> {store.sizeSqFt.toLocaleString()} sq ft
                  </p>
                  <p className="text-[11px] text-neutral-600 mb-2">
                    <span className="font-medium">Status:</span>{' '}
                    <span className={`px-1 rounded text-[10px] font-semibold text-white ${
                      store.status === 'Available' ? 'bg-emerald-600' :
                      store.status === 'Sold' ? 'bg-rose-600' : 'bg-amber-600'
                    }`}>
                      {store.status}
                    </span>
                  </p>
                  {onSelectStore && (
                    <button
                      type="button"
                      id={`map-select-btn-${store.id || store.trackingCode}`}
                      onClick={() => onSelectStore(store)}
                      className="w-full bg-[#111] hover:bg-[#d4af37] hover:text-black text-white py-1 px-2 rounded text-[11px] font-medium transition-all duration-300 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>View Specifications</span>
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating map controllers */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
        <button
          type="button"
          id="btn-view-stores-in-mall"
          onClick={handleResetToMall}
          className="flex items-center gap-1.5 bg-black/90 hover:bg-[#d4af37] text-white hover:text-black border border-[#d4af37]/30 hover:border-[#d4af37] py-2 px-3.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 shadow-lg cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          View Stores in Mall
        </button>
      </div>

      <div className="absolute top-4 left-4 z-20 bg-black/80 backdrop-blur-md border border-white/10 p-2.5 rounded-lg max-w-[200px]">
        <h5 className="text-[#d4af37] text-[10px] font-display uppercase tracking-widest font-semibold mb-1">Mall Directory</h5>
        <p className="text-[11px] text-gray-300 leading-tight">Click on any gold store pin to view dynamic layout options, sizing specifications & details.</p>
      </div>
    </div>
  );
}
