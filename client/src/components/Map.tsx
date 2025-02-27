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
  selected: '#2196F3' // Синий для выбранного города
};

// Функция для создания пользовательской иконки маркера
function createCityIcon(city: City, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 40 : 30;
  const backgroundColor = isSelected
    ? territoryColors.selected
    : city.owner === 'player'
    ? territoryColors.player
    : city.owner === 'neutral'
    ? territoryColors.neutral
    : territoryColors.enemy;

  return L.divIcon({
    className: 'custom-city-icon',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${backgroundColor};
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: bold;
        color: white;
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
    cities.forEach(city => {
      const isSelected = selectedCity?.id === city.id;
      const icon = createCityIcon(city, isSelected);

      const marker = L.marker([city.latitude, city.longitude], { icon })
        .addTo(mapRef.current!)
        .on('click', () => {
          setSelectedCity(city.id);
        });

      // Добавляем название города рядом с маркером
      const tooltip = L.tooltip({
        permanent: true,
        direction: 'bottom',
        className: 'city-tooltip'
      }).setContent(city.name);

      marker.bindTooltip(tooltip);

      markersRef.current.push(marker);
    });
  }, [cities, selectedCity, setSelectedCity]);

  // Отображение границ территорий
  useEffect(() => {
    if (!mapRef.current || !cities.length) return;

    // Очистка существующих полигонов
    polygonsRef.current.forEach(polygon => polygon.remove());
    polygonsRef.current = [];

    // Создание новых полигонов для границ территорий
    cities.forEach(city => {
      const isSelected = selectedCity?.id === city.id;
      const color = isSelected
        ? territoryColors.selected
        : city.owner === 'player'
        ? territoryColors.player
        : city.owner === 'neutral'
        ? territoryColors.neutral
        : territoryColors.enemy;

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

          // Создаем линию маршрута
          const route = L.polyline(
            [
              [city.latitude, city.longitude],
              [adjacentCity.latitude, adjacentCity.longitude]
            ],
            {
              color: '#666',
              weight: 2,
              opacity: 0.7,
              dashArray: '5, 5'
            }
          ).addTo(mapRef.current!);

          routesRef.current.push(route);
        });
      }
    });
  }, [cities]);

  // Отображение армий в движении
  useEffect(() => {
    if (!mapRef.current || !armyTransfers.length || !cities.length) return;

    // Очистка существующих маркеров армий
    armyMarkersRef.current.forEach(marker => marker.remove());
    armyMarkersRef.current = [];

    armyTransfers.forEach(transfer => {
      const fromCity = cities.find(c => c.id === transfer.fromCityId);
      const toCity = cities.find(c => c.id === transfer.toCityId);

      if (!fromCity || !toCity) return;

      // Вычисление текущей позиции армии на основе прогресса перемещения
      const progress = (Date.now() - transfer.startTime) / transfer.duration;

      if (progress < 1) {
        const currentLat = fromCity.latitude + (toCity.latitude - fromCity.latitude) * progress;
        const currentLng = fromCity.longitude + (toCity.longitude - fromCity.longitude) * progress;

        // Создание маркера армии
        const armyMarker = L.circleMarker([currentLat, currentLng], {
          radius: 8,
          color: '#333',
          fillColor: territoryColors.player,
          fillOpacity: 0.8,
          weight: 1
        }).addTo(mapRef.current!);

        armyMarker.bindTooltip(`Армия: ${transfer.size}`);

        armyMarkersRef.current.push(armyMarker);
      }
    });

    // Планируем обновление позиций армий
    const updateTimer = setTimeout(() => {
      // Искусственно вызываем обновление армий через изменение ссылки на массив
      if (armyTransfers.length) {
        const forcedUpdate = [...armyTransfers];
        // Здесь можно было бы обновить армии, но в данном случае
        // мы просто вызываем повторный рендер для обновления позиций
      }
    }, 100);

    return () => {
      clearTimeout(updateTimer);
    };
  }, [armyTransfers, cities]);

  return <div id="map" className="map-container" />;
};

export default Map;