'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Crosshair, Plus, Minus, Compass } from '@phosphor-icons/react';

interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  language?: 'EN' | 'ID';
  cityHint?: string;
  focusRevision?: number;
}

export function MapPicker({
  latitude,
  longitude,
  onChange,
  language = 'EN',
  cityHint,
  focusRevision = 0,
}: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Default coordinates to Central Jakarta / Monas if unset
  const defaultLat = -6.2088;
  const defaultLng = 106.8456;

  const currentLat = typeof latitude === 'number' && !isNaN(latitude) ? latitude : defaultLat;
  const currentLng = typeof longitude === 'number' && !isNaN(longitude) ? longitude : defaultLng;

  const [locating, setLocating] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(15);
  const previousFocusRevision = useRef(focusRevision);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Dynamic Leaflet loader for interactive OpenStreetMap rendering
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      // Keep script cached
    };
  }, []);

  // Initialize or update Leaflet map once loaded
  useEffect(() => {
    if (!leafletLoaded || !containerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (!mapInstanceRef.current) {
      const map = L.map(containerRef.current, {
        center: [currentLat, currentLng],
        zoom: focusRevision>0?17:zoomLevel,
        zoomControl: false,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Custom pulse pin icon
      const customIcon = L.divIcon({
        className: 'map-custom-marker-icon',
        html: `<div class="map-picker-pin"><svg width="32" height="32" viewBox="0 0 256 256" fill="#c48922"><path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,120a32,32,0,1,1,32-32A32,32,0,0,1,128,136Z"/></svg><div class="map-picker-pin-pulse"></div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = L.marker([currentLat, currentLng], {
        draggable: true,
        icon: customIcon,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange({
          lat: Number(pos.lat.toFixed(6)),
          lng: Number(pos.lng.toFixed(6)),
        });
      });

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        onChange({
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
        });
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      previousFocusRevision.current=focusRevision;
    } else {
      const map = mapInstanceRef.current;
      const marker = markerRef.current;
      if (marker) {
        marker.setLatLng([currentLat, currentLng]);
      }
      const selectedPlace = focusRevision !== previousFocusRevision.current;
      if(selectedPlace) map.flyTo([currentLat,currentLng],17,{animate:true,duration:0.8});
      else map.setView([currentLat, currentLng], map.getZoom(), { animate: true });
      previousFocusRevision.current=focusRevision;
    }
  }, [leafletLoaded, currentLat, currentLng, onChange, focusRevision]);

  // Handle zooming
  const handleZoom = (direction: 'in' | 'out') => {
    if (mapInstanceRef.current) {
      if (direction === 'in') {
        mapInstanceRef.current.zoomIn();
      } else {
        mapInstanceRef.current.zoomOut();
      }
      setZoomLevel(mapInstanceRef.current.getZoom());
    } else {
      setZoomLevel(prev => (direction === 'in' ? Math.min(prev + 1, 18) : Math.max(prev - 1, 8)));
    }
  };

  // Browser Geolocation
  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert(language === 'ID' ? 'Fitur GPS tidak didukung browser ini.' : 'Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        onChange({ lat, lng });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
        }
      },
      () => {
        setLocating(false);
        alert(
          language === 'ID'
            ? 'Gagal mendapatkan lokasi GPS. Pastikan izin lokasi diaktifkan.'
            : 'Unable to retrieve location. Please check browser location permissions.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [language, onChange]);

  return (
    <div className="map-picker-wrapper">
      <div className="map-picker-topbar">
        <div className="map-picker-heading">
          <MapPin size={17} weight="fill" className="map-pin-icon" />
          <span>
            {language === 'ID'
              ? 'Tentukan Titik Alamat pada Peta (Wajib untuk Kurir Instan)'
              : 'Pinpoint Exact Address on Map (Required for Instant Couriers)'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="map-picker-locate-btn"
          title={language === 'ID' ? 'Gunakan lokasi saya saat ini' : 'Use current location'}
        >
          <Crosshair size={14} weight="bold" />
          <span>{locating ? (language === 'ID' ? 'Mencari...' : 'Locating...') : (language === 'ID' ? 'Lokasi Saya' : 'My Location')}</span>
        </button>
      </div>

      <div className="map-picker-stage">
        {/* Leaflet dynamic container */}
        <div ref={containerRef} className="map-picker-leaflet-container" />

        {/* Fallback interactive surface if Leaflet is loading */}
        {!leafletLoaded && (
          <div
            className="map-picker-fallback-grid"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width;
              const y = (e.clientY - rect.top) / rect.height;
              // Approximate coordinate shift from center
              const latDelta = (0.5 - y) * 0.05;
              const lngDelta = (x - 0.5) * 0.05;
              onChange({
                lat: Number((currentLat + latDelta).toFixed(6)),
                lng: Number((currentLng + lngDelta).toFixed(6)),
              });
            }}
          >
            <div className="map-fallback-marker">
              <MapPin size={34} weight="fill" color="#c48922" />
            </div>
            <div className="map-fallback-note">
              <Compass size={16} />
              <span>{language === 'ID' ? 'Klik untuk menggeser pin lokasi' : 'Click to place location pin'}</span>
            </div>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="map-picker-controls" role="group" aria-label="Map zoom controls">
          <button type="button" onClick={() => handleZoom('in')} aria-label="Zoom in">
            <Plus size={15} weight="bold" />
          </button>
          <button type="button" onClick={() => handleZoom('out')} aria-label="Zoom out">
            <Minus size={15} weight="bold" />
          </button>
        </div>
      </div>

      <div className="map-picker-footer">
        <div className="map-picker-coords">
          <span className="coords-label">{language === 'ID' ? 'Koordinat Pin:' : 'Pin Coordinates:'}</span>
          <code className="coords-val">{currentLat.toFixed(5)}, {currentLng.toFixed(5)}</code>
        </div>
        {cityHint && (
          <div className="map-picker-hint">
            <span>{cityHint}</span>
          </div>
        )}
      </div>
    </div>
  );
}
