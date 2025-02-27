import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGameStore } from '@/lib/store';
import { TERRITORY_COLORS } from '@/lib/game';

export function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const polygonsRef = useRef<L.Layer[]>([]);
  const { cities, setSelectedCity } = useGameStore();

  // Initialize map once
  useEffect(() => {
    const container = document.getElementById('map');
    if (!container) {
      console.error('Map container not found');
      return;
    }

    console.log('Initializing map');
    mapRef.current = L.map('map', {
      center: [55.7558, 37.6173], // Moscow coordinates
      zoom: 6
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapRef.current);

    return () => {
      console.log('Cleaning up map');
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once

  // Update markers and polygons when cities change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clean up existing markers and polygons
    markersRef.current.forEach(marker => marker.remove());
    polygonsRef.current.forEach(polygon => polygon.remove());
    markersRef.current = [];
    polygonsRef.current = [];

    // Add new markers and polygons
    cities.forEach(city => {
      const color = TERRITORY_COLORS[city.owner as keyof typeof TERRITORY_COLORS];

      // Add territory polygon
      const polygon = L.polygon(city.boundaries, {
        color,
        fillColor: color,
        fillOpacity: 0.2,
        weight: 2
      }).addTo(mapRef.current!);
      polygonsRef.current.push(polygon);

      // Add city marker
      const marker = L.marker([city.latitude, city.longitude])
        .addTo(mapRef.current!)
        .on('click', () => setSelectedCity(city))
        .bindPopup(city.name);
      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      polygonsRef.current.forEach(polygon => polygon.remove());
    };
  }, [cities, setSelectedCity]);

  return <div id="map" className="w-full h-screen" />;
}