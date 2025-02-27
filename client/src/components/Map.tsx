import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGameStore } from '../lib/store';
import { City } from '../../../shared/schema';

// Определение цветов для территорий разных владельцев
const ownerColors: Record<string, string> = {
  player: '#3388ff', // Синий для игрока
  neutral: '#999999', // Серый для нейтральных 
  ai: '#ff3333',     // Красный для ИИ
};

// Создание стилей для границ городов
const createBoundaryStyle = (owner: string) => {
  return {
    color: ownerColors[owner] || '#999999',
    weight: 3,
    opacity: 0.7,
    fillColor: ownerColors[owner] || '#999999',
    fillOpacity: 0.2,
    dashArray: '5, 5',
  };
};

const Map: React.FC = () => {
  const { cities, selectedCity, setSelectedCity, gameState, armyTransfers } = useGameStore();
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const transferLinesRef = useRef<L.Polyline[]>([]);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Инициализация карты
  useEffect(() => {
    console.log('Initializing map');
    if (typeof window !== 'undefined' && !mapRef.current) {
      // Центр карты - Россия
      const map = L.map('map', {
        center: [60, 100],
        zoom: 3,
        minZoom: 2,
        maxZoom: 10,
      });

      // Добавление слоя карты
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      mapRef.current = map;
      setMapInitialized(true);
    }

    return () => {
      console.log('Cleaning up map');
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Обновление маркеров городов на карте
  useEffect(() => {
    if (!mapRef.current || !mapInitialized || !cities || !cities.length) {
      return;
    }

    // Очистка старых маркеров
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Добавление новых маркеров городов
    cities.forEach(city => {
      const marker = L.marker([city.latitude, city.longitude], {
        icon: L.divIcon({
          className: `city-marker ${city.owner} ${selectedCity?.id === city.id ? 'selected' : ''}`,
          html: `<div class="city-icon ${city.owner}"></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        })
      }).addTo(mapRef.current!);

      // Добавление всплывающей подсказки
      marker.bindTooltip(`
        <div class="city-tooltip">
          <h3>${city.name}</h3>
          <p>Население: ${city.population}/${city.maxPopulation}</p>
          <p>Ресурсы: ${Object.entries(city.resources)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')}</p>
          <p>Владелец: ${city.owner}</p>
        </div>
      `, { permanent: false, direction: 'top' });

      // Обработчик клика
      marker.on('click', () => {
        setSelectedCity(city);
      });

      markersRef.current.push(marker);
    });
  }, [cities, selectedCity, mapInitialized, setSelectedCity]);

  // Рисование границ городов
  useEffect(() => {
    if (!mapRef.current || !mapInitialized || !cities || !cities.length) {
      return;
    }

    // Очистка старых полигонов
    polygonsRef.current.forEach(polygon => polygon.remove());
    polygonsRef.current = [];

    // Добавление полигонов для границ
    cities.forEach(city => {
      if (!city.boundaries || city.boundaries.length < 3) {
        return; // Пропускаем города без корректных границ
      }

      // Создаем полигон из координат границ
      const polygon = L.polygon(city.boundaries, createBoundaryStyle(city.owner))
        .addTo(mapRef.current!);

      // Добавляем всплывающую подсказку
      polygon.bindTooltip(city.name);

      // Обработчик клика по территории
      polygon.on('click', () => {
        setSelectedCity(city);
      });

      polygonsRef.current.push(polygon);
    });

    // Соединяем границы соседних городов линиями
    if (cities.length > 1) {
      for (let i = 0; i < cities.length; i++) {
        for (let j = i + 1; j < cities.length; j++) {
          const city1 = cities[i];
          const city2 = cities[j];

          // Создаем линию между центрами городов
          const line = L.polyline(
            [[city1.latitude, city1.longitude], [city2.latitude, city2.longitude]],
            {
              color: '#555555',
              weight: 1,
              opacity: 0.5,
              dashArray: '3, 5'
            }
          ).addTo(mapRef.current!);

          polygonsRef.current.push(line as unknown as L.Polygon);
        }
      }
    }
  }, [cities, mapInitialized, setSelectedCity]);

  // Рисование линий передвижения армий
  useEffect(() => {
    if (!mapRef.current || !mapInitialized || !armyTransfers || !cities) {
      return;
    }

    // Очистка старых линий передвижения
    transferLinesRef.current.forEach(line => line.remove());
    transferLinesRef.current = [];

    // Добавление новых линий передвижения
    armyTransfers?.forEach(transfer => {
      const fromCity = cities.find(c => c.id === transfer.fromCityId);
      const toCity = cities.find(c => c.id === transfer.toCityId);

      if (!fromCity || !toCity) return;

      const line = L.polyline(
        [[fromCity.latitude, fromCity.longitude], [toCity.latitude, toCity.longitude]],
        {
          color: '#ff0000',
          weight: 3,
          opacity: 0.7,
        }
      ).addTo(mapRef.current!);

      // Добавление стрелки на конце линии
      const arrowHead = L.polyline(
        calculateArrowHead(
          [fromCity.latitude, fromCity.longitude], 
          [toCity.latitude, toCity.longitude]
        ),
        {
          color: '#ff0000',
          weight: 3,
          opacity: 0.7,
        }
      ).addTo(mapRef.current!);

      // Добавление информации о передвижении
      line.bindTooltip(`${transfer.amount} войск`, { permanent: true });

      transferLinesRef.current.push(line);
      transferLinesRef.current.push(arrowHead);
    });
  }, [armyTransfers, cities, mapInitialized]);

  // Функция для расчета координат стрелки
  const calculateArrowHead = (
    from: [number, number],
    to: [number, number]
  ): [number, number][] => {
    const angle = Math.atan2(to[0] - from[0], to[1] - from[1]);
    const length = 0.1; // Длина стрелки
    const angle1 = angle + Math.PI / 6;
    const angle2 = angle - Math.PI / 6;

    return [
      to,
      [
        to[0] - length * Math.sin(angle1),
        to[1] - length * Math.cos(angle1),
      ],
      to,
      [
        to[0] - length * Math.sin(angle2),
        to[1] - length * Math.cos(angle2),
      ],
    ];
  };

  return (
    <div id="map" className="map-container"></div>
  );
};

export default Map;