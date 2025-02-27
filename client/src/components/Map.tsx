import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-polylinedecorator';
import { useGameStore } from '@/lib/store';
import { TERRITORY_COLORS } from '@/lib/game';
import { fetchCityBoundaries, createCityConnections } from '../lib/osm';


interface MilitaryMovement {
  fromCity: any;
  toCity: any;
  amount: number;
  marker: L.Marker;
  startTime: number;
  duration: number;
  pathLine?: L.Polyline;
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

    // Clear existing markers and polygons
    markersRef.current.forEach(marker => marker.remove());
    polygonsRef.current.forEach(polygon => polygon.remove());
    markersRef.current = [];
    polygonsRef.current = [];

    // Создаем линии соединения между городами
    const cityConnections = createCityConnections(cities);

    // Создаем границы городов с более естественными формами
    cities.forEach(async (city) => {
      // Создаем цвет территории
      const color = TERRITORY_COLORS[city.owner as keyof typeof TERRITORY_COLORS] || '#cccccc';

      // Используем более сложные формы вместо простых квадратов
      // Добавляем случайные отклонения для более естественных границ
      const createNaturalBoundary = (baseCoords: [number, number][]) => {
        // Клонируем базовые координаты, чтобы не изменять оригинал
        const enhancedCoords = [...baseCoords];

        // Добавляем промежуточные точки для создания более сложной формы
        const result: [number, number][] = [];

        for (let i = 0; i < enhancedCoords.length - 1; i++) {
          const [lat1, lng1] = enhancedCoords[i];
          const [lat2, lng2] = enhancedCoords[i + 1];

          // Добавляем исходную точку
          result.push([lat1, lng1]);

          // Добавляем промежуточные точки с небольшим случайным отклонением
          const segments = 3; // Количество промежуточных сегментов
          for (let j = 1; j < segments; j++) {
            const ratio = j / segments;
            const baseLat = lat1 + (lat2 - lat1) * ratio;
            const baseLng = lng1 + (lng2 - lng1) * ratio;

            // Добавляем случайное отклонение (±0.02 градуса)
            const randomLat = baseLat + (Math.random() - 0.5) * 0.04;
            const randomLng = baseLng + (Math.random() - 0.5) * 0.04;

            result.push([randomLat, randomLng]);
          }
        }

        // Добавляем последнюю точку, чтобы замкнуть многоугольник
        result.push(enhancedCoords[enhancedCoords.length - 1]);
        return result;
      };

      // Создаем более естественные границы для каждого города
      const naturalBoundaries = createNaturalBoundary(city.boundaries);

      // Создаем полигон с более естественными границами
      const polygon = L.polygon(naturalBoundaries, {
        color,
        fillColor: color,
        fillOpacity: 0.3,
        weight: 2,
        className: 'territory-tooltip',
        smoothFactor: 1.5 // Сглаживаем линии для более плавного вида
      }).addTo(mapRef.current!);

      // Добавляем стилизованный контур границы
      const borderStyle = {
        color: color,
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 7', // Пунктирная линия для границы
        smoothFactor: 1.5
      };

      const border = L.polyline(naturalBoundaries, borderStyle).addTo(mapRef.current!);
      polygonsRef.current.push(border);
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

    // Рисуем соединения между городами
    cityConnections.forEach(connection => {
      const { city1, city2 } = connection;
      const color = '#555555'; // Цвет для соединений

      // Создаем изогнутую линию между городами
      const latlngs = [
        [city1.latitude, city1.longitude],
        [
          (city1.latitude + city2.latitude) / 2 + (Math.random() - 0.5) * 0.5,
          (city1.longitude + city2.longitude) / 2 + (Math.random() - 0.5) * 0.5
        ],
        [city2.latitude, city2.longitude]
      ];

      const connectionLine = L.polyline(latlngs, {
        color: color,
        weight: 2,
        opacity: 0.6,
        smoothFactor: 1.5,
        dashArray: '10, 10', // Пунктирная линия
      }).addTo(mapRef.current!);

      polygonsRef.current.push(connectionLine);
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

        // Create military unit marker with custom icon
        const militaryIcon = L.divIcon({
          className: 'military-marker',
          html: `<div style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: #ff4500; border-radius: 50%; border: 2px solid white; color: white; font-weight: bold;">${amount}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([fromCity.latitude, fromCity.longitude], { icon: militaryIcon }).addTo(mapRef.current!);

        const pathLine = L.polyline([
          [fromCity.latitude, fromCity.longitude],
          [toCity.latitude, toCity.longitude]
        ], {
          color: 'blue',
          weight: 3
        }).addTo(mapRef.current!);

        militaryMovementsRef.current.push({
          fromCity,
          toCity,
          amount,
          marker,
          startTime: Date.now(),
          duration,
          pathLine
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
        if (movement.pathLine) movement.pathLine.remove();
        return false;
      }

      const lat = movement.fromCity.latitude + (movement.toCity.latitude - movement.fromCity.latitude) * progress;
      const lng = movement.fromCity.longitude + (movement.toCity.longitude - movement.fromCity.longitude) * progress;
      movement.marker.setLatLng([lat, lng]);
      if (movement.pathLine) {
        movement.pathLine.setLatLngs([
          [movement.fromCity.latitude, movement.fromCity.longitude],
          [lat, lng]
        ]);
      }

      return true;
    });

    if (militaryMovementsRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
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

// Placeholder implementation.  Replace with actual connection logic.
const createTerritoryConnections = (cities: any[]): any[] => {
  return []; //Return an empty array for now.
};