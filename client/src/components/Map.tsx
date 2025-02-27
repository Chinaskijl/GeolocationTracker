import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGameStore } from '../lib/store';
import { City } from '../../../shared/schema';

// Определение цветов для территорий разных владельцев
const TERRITORY_COLORS = {
  'player': '#4CAF50', // Зеленый
  'neutral': '#9E9E9E', // Серый
  'enemy1': '#F44336', // Красный
  'enemy2': '#2196F3', // Синий
  'enemy3': '#FF9800', // Оранжевый
};

// Иконки для маркеров городов
const createCityIcon = (owner: string) => {
  return L.divIcon({
    className: `city-marker city-marker-${owner}`,
    html: `<div style="background-color: ${TERRITORY_COLORS[owner] || '#9E9E9E'}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

const Map: React.FC = () => {
  const { cities, selectedCity, setSelectedCity, gameState } = useGameStore();
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Инициализация карты
  useEffect(() => {
    if (!mapContainerRef.current) return;

    console.log("Initializing map");

    // Проверяем, не инициализирована ли уже карта
    if (!mapRef.current) {
      // Создаем экземпляр карты Leaflet
      mapRef.current = L.map(mapContainerRef.current, {
        center: [55.7558, 37.6173], // Координаты Москвы как центра карты
        zoom: 4,
        zoomControl: true,
        attributionControl: false
      });

      // Добавляем базовый слой карты (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Добавляем контроль масштаба
      L.control.scale().addTo(mapRef.current);
    }

    // Функция очистки при размонтировании компонента
    return () => {
      if (mapRef.current) {
        console.log("Cleaning up map");
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Обновление маркеров и территорий при изменении данных городов
  useEffect(() => {
    if (!mapRef.current || !cities || cities.length === 0) return;

    console.log("Cities updated:", cities);

    // Очищаем существующие маркеры
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Очищаем существующие полигоны территорий
    polygonsRef.current.forEach(polygon => polygon.remove());
    polygonsRef.current = [];

    // Добавляем новые маркеры и территории
    cities.forEach((city: City) => {
      // Добавляем маркер города
      const marker = L.marker([city.latitude, city.longitude], {
        icon: createCityIcon(city.owner),
        title: city.name
      }).addTo(mapRef.current!);

      // Привязываем обработчик клика к маркеру
      marker.on('click', () => {
        setSelectedCity(city);
      });

      markersRef.current.push(marker);

      // Добавляем территорию города, если у него есть границы
      if (city.boundaries && city.boundaries.length > 0) {
        const polygon = L.polygon(city.boundaries, {
          color: TERRITORY_COLORS[city.owner] || '#9E9E9E',
          fillColor: TERRITORY_COLORS[city.owner] || '#9E9E9E',
          fillOpacity: 0.3,
          weight: 2
        }).addTo(mapRef.current!);

        // Привязываем обработчик клика к территории
        polygon.on('click', () => {
          setSelectedCity(city);
        });

        polygonsRef.current.push(polygon);
      }
    });

    // Если есть выбранный город, фокусируемся на нем
    if (selectedCity) {
      mapRef.current.setView([selectedCity.latitude, selectedCity.longitude], 6);
    }
  }, [cities, selectedCity, setSelectedCity]);

  return (
    <div className="map-container">
      <div 
        ref={mapContainerRef} 
        className="map-element" 
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default Map;

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