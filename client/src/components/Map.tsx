import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGameStore } from '@/lib/store';
import { TERRITORY_COLORS } from '@/lib/game';

interface MilitaryMovement {
  fromCity: any;
  toCity: any;
  amount: number;
  marker: L.Marker;
  startTime: number;
  duration: number;
}

export function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const polygonsRef = useRef<L.Layer[]>([]);
  const militaryMovementsRef = useRef<MilitaryMovement[]>([]);
  const animationFrameRef = useRef<number>();
  const { cities, setSelectedCity } = useGameStore();
  const [ws, setWs] = useState<WebSocket | null>(null);

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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
        fillOpacity: 0.4,
        weight: 2
      }).addTo(mapRef.current!);
      polygonsRef.current.push(polygon);

      // Create custom HTML element for city info
      const cityInfo = document.createElement('div');
      cityInfo.className = 'bg-white/90 p-2 rounded shadow-lg border border-gray-200 cursor-pointer';
      cityInfo.innerHTML = `
        <div class="font-bold text-lg">${city.name}</div>
        <div class="text-sm">
          <div>👥 Население: ${city.population} / ${city.maxPopulation}</div>
          <div>⚔️ Военные: ${city.military || 0}</div>
          ${Object.entries(city.resources)
            .map(([resource, amount]) => `<div>${getResourceIcon(resource)} ${resource}: +${amount}</div>`)
            .join('')}
        </div>
      `;

      // Add city label as a custom divIcon
      const cityMarker = L.divIcon({
        className: 'custom-div-icon',
        html: cityInfo,
        iconSize: [200, 80],
        iconAnchor: [100, 40]
      });

      const marker = L.marker([city.latitude, city.longitude], {
        icon: cityMarker
      })
        .addTo(mapRef.current!)
        .on('click', () => setSelectedCity(city));

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      polygonsRef.current.forEach(polygon => polygon.remove());
    };
  }, [cities, setSelectedCity]);

  // Setup WebSocket for military movements
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const newWs = new WebSocket(`${protocol}//${window.location.host}/ws`);

    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'MILITARY_TRANSFER_START') {
        const { fromCity, toCity, amount, duration } = data;

        // Create military unit marker
        const militaryIcon = L.divIcon({
          className: 'military-icon',
          html: `<div class="bg-blue-500 text-white px-2 py-1 rounded">⚔️ ${amount}</div>`,
          iconSize: [40, 24]
        });

        const marker = L.marker([fromCity.latitude, fromCity.longitude], {
          icon: militaryIcon
        }).addTo(mapRef.current!);

        militaryMovementsRef.current.push({
          fromCity,
          toCity,
          amount,
          marker,
          startTime: Date.now(),
          duration
        });

        // Start animation if not already running
        if (!animationFrameRef.current) {
          animate();
        }
      }
    };

    setWs(newWs);

    return () => {
      newWs.close();
    };
  }, []);

  const animate = () => {
    if (!mapRef.current) return;

    const currentTime = Date.now();
    militaryMovementsRef.current = militaryMovementsRef.current.filter(movement => {
      const progress = (currentTime - movement.startTime) / movement.duration;

      if (progress >= 1) {
        movement.marker.remove();
        return false;
      }

      const lat = movement.fromCity.latitude + (movement.toCity.latitude - movement.fromCity.latitude) * progress;
      const lng = movement.fromCity.longitude + (movement.toCity.longitude - movement.fromCity.longitude) * progress;
      movement.marker.setLatLng([lat, lng]);

      return true;
    });

    if (militaryMovementsRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  };

  return <div id="map" className="w-full h-screen" />;
}

function getResourceIcon(resource: string): string {
  switch (resource) {
    case 'gold': return '💰';
    case 'wood': return '🌲';
    case 'food': return '🌾';
    case 'oil': return '🛢️';
    default: return '📦';
  }
}