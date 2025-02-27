
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGameStore } from '../lib/store';
import { City } from '../../../shared/schema';

// Определение цветов для территорий разных владельцев
const territoryColors = {
  player: '#4CAF50', // Зеленый для игрока
  neutral: '#9E9E9E', // Серый для нейтральных территорий
  enemy: '#F44336', // Красный для вражеских территорий
};

// Функция для создания маркера города с буквенной иконкой
function createCityMarker(city: City, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 40 : 30; // Увеличиваем размер для выбранного города
  
  // Определяем цвет маркера в зависимости от владельца
  let backgroundColor;
  switch (city.owner) {
    case 'player':
      backgroundColor = '#4CAF50'; // Зеленый для игрока
      break;
    case 'neutral':
      backgroundColor = '#9E9E9E'; // Серый для нейтральных
      break;
    default:
      backgroundColor = '#F44336'; // Красный для врагов
  }
  
  return L.divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${backgroundColor};
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        font-weight: bold;
        border: 2px solid white;
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
      ">
        ${city.name.charAt(0)}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

const Map: React.FC = () => {
  const { cities, selectedCity, setSelectedCity, gameState, armyTransfers } = useGameStore();
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const routesRef = useRef<L.Polyline[]>([]);
  const armyMarkersRef = useRef<L.CircleMarker[]>([]);

  useEffect(() => {
    if (!mapRef.current) {
      // Инициализация карты
      const map = L.map('map').setView([55.75, 37.61], 6);
      mapRef.current = map;

      // Добавление слоя OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Обновление маркеров городов при изменении данных о городах
  useEffect(() => {
    if (!mapRef.current || !cities.length) return;

    // Очистка существующих маркеров
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Создание новых маркеров для городов
    cities.forEach((city) => {
      const isSelected = city.id === selectedCity?.id;
      const marker = L.marker([city.latitude, city.longitude], {
        icon: createCityMarker(city, isSelected),
        zIndexOffset: isSelected ? 1000 : 0
      }).addTo(mapRef.current!);

      marker.on('click', () => {
        setSelectedCity(city.id);
      });

      // Добавление всплывающей подсказки
      marker.bindTooltip(city.name, {
        permanent: false,
        direction: 'top',
        opacity: 0.8
      });

      markersRef.current.push(marker);
    });
  }, [cities, selectedCity, setSelectedCity]);

  // Отображение территорий городов
  useEffect(() => {
    if (!mapRef.current || !cities.length) return;

    // Очистка существующих полигонов
    polygonsRef.current.forEach(polygon => polygon.remove());
    polygonsRef.current = [];

    // Создание полигонов для территорий городов
    cities.forEach((city) => {
      const color = territoryColors[city.owner as keyof typeof territoryColors];
      
      if (city.boundaries && city.boundaries.length > 2) {
        const polygon = L.polygon(city.boundaries, {
          color: color,
          weight: 2,
          opacity: 0.7,
          fillColor: color,
          fillOpacity: 0.2
        }).addTo(mapRef.current!);

        polygon.on('click', () => {
          setSelectedCity(city.id);
        });

        polygonsRef.current.push(polygon);
      }
    });
  }, [cities, selectedCity, setSelectedCity]);

  // Отображение маршрутов между соседними городами
  useEffect(() => {
    if (!mapRef.current || !cities.length) return;

    // Очистка существующих маршрутов
    routesRef.current.forEach(route => route.remove());
    routesRef.current = [];

    // Создание маршрутов между соседними городами
    const processedPairs = new Set<string>();

    cities.forEach(city => {
      if (city.adjacentCities && city.adjacentCities.length) {
        city.adjacentCities.forEach(adjacentCityId => {
          const adjacentCity = cities.find(c => c.id === adjacentCityId);
          if (!adjacentCity) return;

          // Создаем уникальный идентификатор для пары городов (всегда в порядке возрастания ID)
          const pairId = [city.id, adjacentCityId].sort().join('-');

          // Если эта пара уже обработана, пропускаем
          if (processedPairs.has(pairId)) return;
          processedPairs.add(pairId);

          // Создаем маршрут между городами
          const route = L.polyline([
            [city.latitude, city.longitude],
            [adjacentCity.latitude, adjacentCity.longitude]
          ], {
            color: '#666',
            weight: 2,
            opacity: 0.6,
            dashArray: '5, 10'
          }).addTo(mapRef.current!);

          routesRef.current.push(route);
        });
      }
    });
  }, [cities]);

  // Отображение движущихся армий
  useEffect(() => {
    if (!mapRef.current || !cities.length || !armyTransfers) return;

    // Очистка существующих маркеров армий
    armyMarkersRef.current.forEach(marker => marker.remove());
    armyMarkersRef.current = [];

    // Создание маркеров для движущихся армий
    armyTransfers.forEach(transfer => {
      const fromCity = cities.find(city => city.id === transfer.fromCityId);
      const toCity = cities.find(city => city.id === transfer.toCityId);

      if (!fromCity || !toCity) return;

      // Расчет текущей позиции армии на основе прогресса перемещения
      const progress = (Date.now() - transfer.startTime) / transfer.duration;

      if (progress < 1) {
        const currentLat = fromCity.latitude + (toCity.latitude - fromCity.latitude) * progress;
        const currentLng = fromCity.longitude + (toCity.longitude - fromCity.longitude) * progress;

        // Создание маркера армии
        const armyMarker = L.circleMarker([currentLat, currentLng], {
          radius: 8,
          color: '#333',
          fillColor: '#FFC107',
          fillOpacity: 0.8,
          weight: 1
        }).addTo(mapRef.current!);

        // Добавление всплывающей подсказки
        armyMarker.bindTooltip(`Армия: ${transfer.size}`, {
          permanent: false,
          direction: 'top',
          opacity: 0.8
        });

        armyMarkersRef.current.push(armyMarker);
      }
    });

    // Обновление позиций каждые 100мс
    const intervalId = setInterval(() => {
      armyMarkersRef.current.forEach(marker => marker.remove());
      armyMarkersRef.current = [];

      armyTransfers.forEach(transfer => {
        const fromCity = cities.find(city => city.id === transfer.fromCityId);
        const toCity = cities.find(city => city.id === transfer.toCityId);

        if (!fromCity || !toCity) return;

        const progress = (Date.now() - transfer.startTime) / transfer.duration;

        if (progress < 1) {
          const currentLat = fromCity.latitude + (toCity.latitude - fromCity.latitude) * progress;
          const currentLng = fromCity.longitude + (toCity.longitude - fromCity.longitude) * progress;

          const armyMarker = L.circleMarker([currentLat, currentLng], {
            radius: 8,
            color: '#333',
            fillColor: '#FFC107',
            fillOpacity: 0.8,
            weight: 1
          }).addTo(mapRef.current!);

          armyMarker.bindTooltip(`Армия: ${transfer.size}`, {
            permanent: false,
            direction: 'top',
            opacity: 0.8
          });

          armyMarkersRef.current.push(armyMarker);
        }
      });
    }, 100);

    return () => {
      clearInterval(intervalId);
      armyMarkersRef.current.forEach(marker => marker.remove());
      armyMarkersRef.current = [];
    };
  }, [cities, armyTransfers]);

  return (
    <div id="map" className="map-container"></div>
  );
};

export default Map;
