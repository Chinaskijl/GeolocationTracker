import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGameStore } from '../lib/store';
import { City } from '../../../shared/schema';

// Исправляем пути к иконкам Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Определение цветов для территорий разных владельцев
const ownerColors = {
  neutral: '#808080', // серый для нейтральных городов
  player: '#0000FF', // синий для городов игрока
  ai: '#FF0000',     // красный для городов ИИ
};

// Необходимо исправить иконки по умолчанию
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const Map: React.FC = () => {
  const { cities, selectedCity, setSelectedCity, gameState, armyTransfers } = useGameStore();
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const linesRef = useRef<L.Polyline[]>([]);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Инициализация карты
  useEffect(() => {
    if (!mapRef.current) {
      console.log('Initializing map...');
      // Центр карты на территории России
      const initialPosition = [55.7558, 37.6173]; // Москва
      const initialZoom = 5;

      const map = L.map('map-container', {
        center: initialPosition,
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: true
      });

      // Добавляем тайловый слой
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(map);

      mapRef.current = map;
      console.log('Map initialized');
      setMapInitialized(true);
    }

    // Удаляем карту при размонтировании компонента
    return () => {
      if (mapRef.current) {
        console.log('Cleaning up map...');
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Отрисовка городов на карте
  useEffect(() => {
    if (!mapRef.current || !mapInitialized || !cities || cities.length === 0) {
      console.log('Skipping city rendering, map not ready or no cities', {mapRef: !!mapRef.current, mapInitialized, citiesCount: cities?.length});
      return;
    }

    console.log('Rendering cities on map:', cities.length);

    // Очищаем предыдущие маркеры и полигоны
    markersRef.current.forEach(marker => marker.remove());
    polygonsRef.current.forEach(polygon => polygon.remove());
    linesRef.current.forEach(line => line.remove());

    markersRef.current = [];
    polygonsRef.current = [];
    linesRef.current = [];

    // Добавляем маркеры и полигоны для каждого города
    cities.forEach((city) => {
      // Создаем маркер
      const marker = L.marker([city.latitude, city.longitude])
        .addTo(mapRef.current!);

      marker.bindPopup(`<b>${city.name}</b><br>Население: ${city.population}/${city.maxPopulation}<br>Владелец: ${city.owner}<br>Ресурсы: ${Object.entries(city.resources).map(([key, value]) => `${key}: ${value}`).join(', ')}`);

      marker.on('click', () => {
        setSelectedCity(city);
      });

      markersRef.current.push(marker);

      // Создаем территориальный полигон если есть границы
      if (city.boundaries && city.boundaries.length > 0) {
        const color = ownerColors[city.owner as keyof typeof ownerColors] || ownerColors.neutral;

        const polygon = L.polygon(city.boundaries, {
          color: color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2,
          dashArray: city.owner === 'player' ? '' : '5, 5',
        }).addTo(mapRef.current!);

        polygon.bindTooltip(`${city.name} (${city.owner})`);

        polygon.on('click', () => {
          setSelectedCity(city);
        });

        polygonsRef.current.push(polygon);
      }
    });

    // Добавляем соединительные линии между городами для построения связанных границ
    const cityConnections: [number, number][][] = [];
    cities.forEach(city => cityConnections.push([city.latitude, city.longitude]));
    for (let i = 0; i < cityConnections.length; i++) {
      for (let j = i + 1; j < cityConnections.length; j++) {
        const cityA = cities[i];
        const cityB = cities[j];

        // Проверяем, что города принадлежат одному владельцу
        if (cityA.owner === cityB.owner) {
          const color = ownerColors[cityA.owner as keyof typeof ownerColors] || ownerColors.neutral;
          const line = L.polyline([
            [cityA.latitude, cityA.longitude],
            [cityB.latitude, cityB.longitude]
          ], {
            color,
            weight: 1.5,
            dashArray: '3, 5',
            opacity: 0.6
          }).addTo(mapRef.current!);

          linesRef.current.push(line);
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
          }).addTo(mapRef.current!);

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

          const marker = L.marker(midPoint as [number, number], { icon: arrowIcon }).addTo(mapRef.current!);
          marker.bindTooltip(`Перемещение армии: ${transfer.amount}`);

          markersRef.current.push(marker);
          linesRef.current.push(line);
        }
      });
    }

    // Подсветка выбранного города
    if (selectedCity) {
      const selectedMarker = markersRef.current.find(marker => {
        const city = cities.find(city => city.id === selectedCity.id);
        return city && marker.getLatLng().equals(L.latLng(city.latitude, city.longitude));
      });
      if (selectedMarker) {
        mapRef.current.setView([selectedCity.latitude, selectedCity.longitude], 7);
        selectedMarker.openPopup();
      }
    }
  }, [cities, selectedCity, armyTransfers, mapInitialized, setSelectedCity]);


  return (
    <div id="map-container" className="w-full h-full"></div>
  );
};

export default Map;