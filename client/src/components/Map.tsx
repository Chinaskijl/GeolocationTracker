
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGameStore } from '../lib/store';
import { City } from '../../../shared/schema';

// Определение цветов для территорий разных владельцев
const OWNER_COLORS = {
  player: '#4CAF50',  // зеленый для игрока
  ai: '#FF5722',      // оранжевый для ИИ
  neutral: '#9E9E9E'  // серый для нейтральных
};

// Настройка иконок маркеров для городов
const setupIcons = () => {
  // Настройка дефолтной иконки
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });

  // Создаем кастомные иконки для разных владельцев
  return {
    player: new L.Icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      shadowSize: [41, 41],
      className: 'player-icon'
    }),
    ai: new L.Icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      shadowSize: [41, 41],
      className: 'ai-icon'
    }),
    neutral: new L.Icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      shadowSize: [41, 41],
      className: 'neutral-icon'
    })
  };
};

export const Map: React.FC = () => {
  const { cities, selectedCity, setSelectedCity, gameState, armyTransfers } = useGameStore();
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const linesRef = useRef<L.Polyline[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Инициализация карты при монтировании компонента
  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map('map', {
        center: [55.7558, 37.6173], // Москва как начальная точка
        zoom: 5,
        zoomControl: true,
        attributionControl: true
      });

      // Добавляем тайлы OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      mapRef.current = map;
      setupIcons(); // Настраиваем иконки
      setMapLoaded(true);
    }

    // Очистка при размонтировании
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Обновление маркеров городов и границ при изменении данных
  useEffect(() => {
    if (!mapRef.current || !cities || !mapLoaded) return;

    const map = mapRef.current;
    const icons = setupIcons();

    // Очищаем предыдущие маркеры и полигоны
    markersRef.current.forEach(marker => marker.remove());
    polygonsRef.current.forEach(polygon => polygon.remove());
    linesRef.current.forEach(line => line.remove());
    
    markersRef.current = [];
    polygonsRef.current = [];
    linesRef.current = [];

    // Создаем новые маркеры для городов и полигоны для границ
    const newMarkers: L.Marker[] = [];
    const newPolygons: L.Polygon[] = [];
    const newLines: L.Polyline[] = [];
    const cityConnections: [number, number][][] = [];

    // Добавляем границы городов
    cities.forEach(city => {
      // Создаем полигон для границы города
      if (city.boundaries && city.boundaries.length > 0) {
        const color = OWNER_COLORS[city.owner as keyof typeof OWNER_COLORS] || OWNER_COLORS.neutral;
        
        const polygon = L.polygon(city.boundaries, {
          color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2,
          dashArray: city.owner === 'player' ? '' : '5, 5',
        }).addTo(map);

        polygon.bindTooltip(`${city.name} (${city.owner})`);
        
        // Обработчик клика по границе
        polygon.on('click', () => {
          setSelectedCity(city);
        });

        newPolygons.push(polygon);
      }

      // Создаем маркер для города
      const marker = L.marker(
        [city.latitude, city.longitude], 
        { 
          icon: icons[city.owner as keyof typeof icons] || icons.neutral,
          title: city.name
        }
      ).addTo(map);
      
      // Добавляем всплывающую подсказку
      marker.bindPopup(`
        <div>
          <h3>${city.name}</h3>
          <p>Население: ${city.population} / ${city.maxPopulation}</p>
          <p>Владелец: ${city.owner}</p>
          <p>Ресурсы: ${Object.entries(city.resources)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')}</p>
        </div>
      `);
      
      // Обработчик клика по маркеру
      marker.on('click', () => {
        setSelectedCity(city);
      });
      
      newMarkers.push(marker);
      
      // Запоминаем центр города для построения соединений
      cityConnections.push([city.latitude, city.longitude]);
    });

    // Добавляем соединительные линии между городами для построения связанных границ
    for (let i = 0; i < cityConnections.length; i++) {
      for (let j = i + 1; j < cityConnections.length; j++) {
        const cityA = cities[i];
        const cityB = cities[j];
        
        // Проверяем, что города принадлежат одному владельцу
        if (cityA.owner === cityB.owner) {
          const color = OWNER_COLORS[cityA.owner as keyof typeof OWNER_COLORS] || OWNER_COLORS.neutral;
          const line = L.polyline([
            [cityA.latitude, cityA.longitude],
            [cityB.latitude, cityB.longitude]
          ], {
            color,
            weight: 1.5,
            dashArray: '3, 5',
            opacity: 0.6
          }).addTo(map);
          
          newLines.push(line);
        }
      }
    }

    // Отображаем перемещения армий, если они есть
    if (armyTransfers && armyTransfers.length > 0) {
      armyTransfers.forEach(transfer => {
        const fromCity = cities.find(c => c.id === transfer.fromCityId);
        const toCity = cities.find(c => c.id === transfer.toCityId);
        
        if (fromCity && toCity) {
          const line = L.polyline([
            [fromCity.latitude, fromCity.longitude],
            [toCity.latitude, toCity.longitude]
          ], {
            color: '#f44336',
            weight: 3,
            dashArray: '10, 10',
            opacity: 0.8
          }).addTo(map);
          
          // Добавляем стрелку анимацией
          const arrowIcon = L.divIcon({
            html: '➤',
            className: 'army-transfer-arrow',
            iconSize: [20, 20]
          });
          
          const midPoint = [
            (fromCity.latitude + toCity.latitude) / 2,
            (fromCity.longitude + toCity.longitude) / 2
          ];
          
          const marker = L.marker(midPoint as [number, number], { icon: arrowIcon }).addTo(map);
          marker.bindTooltip(`Перемещение армии: ${transfer.amount}`);
          
          newMarkers.push(marker);
          newLines.push(line);
        }
      });
    }

    // Сохраняем новые маркеры и полигоны
    markersRef.current = newMarkers;
    polygonsRef.current = newPolygons;
    linesRef.current = newLines;

    // Если город выбран, центрируем на нем карту
    if (selectedCity) {
      map.setView([selectedCity.latitude, selectedCity.longitude], 7);
    }

  }, [cities, selectedCity, armyTransfers, mapLoaded, setSelectedCity]);

  // Эффект для центрирования карты на выбранном городе
  useEffect(() => {
    if (mapRef.current && selectedCity) {
      mapRef.current.setView([selectedCity.latitude, selectedCity.longitude], 7);
    }
  }, [selectedCity]);

  return <div id="map" className="map-container" />;
};
