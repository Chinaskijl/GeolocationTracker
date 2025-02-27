import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-polylinedecorator';
import { useGameStore } from '@/lib/store';
import { TERRITORY_COLORS } from '@/lib/game';

interface MilitaryMovement {
  fromCity: any;
  toCity: any;
  amount: number;
  marker: L.Marker;
  startTime: number;
  duration: number;
  pathLine?: L.Polyline;
  isUsingRoute?: boolean; // Added to track route usage
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

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === 'MILITARY_TRANSFER_START') {
        const { fromCity, toCity, amount, duration, isUsingRoute } = data;

        // Create military unit marker with custom icon
        const militaryIcon = L.divIcon({
          className: 'military-marker',
          html: `<div style="width: 24px; height: 24px; display: flex; align-items: center; 
                  justify-content: center; background: ${isUsingRoute ? '#4a90e2' : '#e74c3c'}; 
                  border-radius: 50%; border: 2px solid white; color: white; 
                  font-weight: bold; box-shadow: 0 0 10px rgba(0,0,0,0.5);">${amount}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([fromCity.latitude, fromCity.longitude], { icon: militaryIcon }).addTo(mapRef.current!);

        const pathLine = L.polyline([
          [fromCity.latitude, fromCity.longitude],
          [toCity.latitude, toCity.longitude]
        ], {
          color: isUsingRoute ? '#4a90e2' : '#e74c3c', // Use route color if available
          weight: 3,
          opacity: 0.7
        }).addTo(mapRef.current!);


        militaryMovementsRef.current.push({
          fromCity,
          toCity,
          amount,
          marker,
          startTime: performance.now(),
          duration,
          isUsingRoute,
          pathLine
        });

        // Start animation if not already running
        if (!animationFrameRef.current) {
          animateMovement();
        }
      } else if (data.type === 'ROUTES_UPDATE') {
        // Обновление информации о маршрутах между городами
        console.log('Received routes update:', data);
      }
    };

    newWs.onmessage = handleMessage;

    // Запрашиваем обновление маршрутов
    if (newWs.readyState === WebSocket.OPEN) {
      newWs.send(JSON.stringify({ type: 'REQUEST_ROUTES_UPDATE' }));
    }

    setWs(newWs);

    return () => {
      newWs.close();
    };
  }, []);

  const animateMovement = () => {
    if (!mapRef.current) return;

    const timestamp = performance.now();
    militaryMovementsRef.current = militaryMovementsRef.current.filter(movement => {
      const elapsed = timestamp - movement.startTime;
      const progress = Math.min(elapsed / movement.duration, 1);

      if (progress < 1) {
        // Интерполируем положение между начальной и конечной точками
        const newLat = movement.fromCity.latitude + (movement.toCity.latitude - movement.fromCity.latitude) * progress;
        const newLng = movement.fromCity.longitude + (movement.toCity.longitude - movement.fromCity.longitude) * progress;
        movement.marker.setLatLng([newLat, newLng]);

        // Добавляем эффект "хвоста" для движущихся войск
        if (progress > 0.05 && !movement.pathLine) {
          // Создаем линию пути с градиентом
          movement.pathLine = L.polyline(
            [
              [movement.fromCity.latitude, movement.fromCity.longitude],
              [newLat, newLng]
            ],
            {
              color: movement.isUsingRoute ? '#4a90e2' : '#e74c3c',
              weight: 3,
              opacity: 0.7,
              dashArray: movement.isUsingRoute ? '' : '5,10'
            }
          ).addTo(mapRef.current!);
        } else if (movement.pathLine) {
          // Обновляем линию до текущей позиции
          movement.pathLine.setLatLngs([
            [movement.fromCity.latitude, movement.fromCity.longitude],
            [newLat, newLng]
          ]);
        }
      } else {
        // Достигли пункта назначения
        movement.marker.remove();
        if (movement.pathLine) {
          // Добавляем эффект исчезновения линии
          const pathLine = movement.pathLine;
          let opacity = 0.7;
          const fadeInterval = setInterval(() => {
            opacity -= 0.1;
            if (opacity <= 0) {
              clearInterval(fadeInterval);
              pathLine.remove();
            } else {
              pathLine.setStyle({ opacity });
            }
          }, 50);
          movement.pathLine = undefined;
        }
        return false;
      }

      return true;
    });

    if (militaryMovementsRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animateMovement);
    }
  };

  return <div id="map" className="w-full h-screen" />;
}

export function getResourceIcon(resource: string): string {
  switch (resource) {
    case 'gold': return '💰';
    case 'wood': return '🌲';
    case 'food': return '🍗';
    case 'oil': return '🛢️';
    case 'metal': return '⛏️';
    case 'steel': return '🔩';
    case 'weapons': return '⚔️';
    default: return '📦';
  }
}