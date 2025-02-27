
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../lib/store';
import { City } from '../../../shared/schema';

// Определение цветов для территорий разных владельцев
const TERRITORY_COLORS = {
  player: '#4CAF50', // Зеленый для игрока
  neutral: '#9E9E9E', // Серый для нейтральных
  enemy: '#F44336'    // Красный для врагов
};

// Иконки для ресурсов
function getResourceIcon(resource: string): string {
  switch (resource) {
    case 'gold': return '💰';
    case 'wood': return '🌲';
    case 'food': return '🌾';
    case 'oil': return '🛢️';
    case 'metal': return '⛏️';
    case 'steel': return '🔨';
    case 'weapons': return '⚔️';
    default: return '📦';
  }
}

const Map: React.FC = () => {
  const { cities, selectedCity, setSelectedCity, gameState, armyTransfers } = useStore();
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const routesRef = useRef<L.Polyline[]>([]);
  const armyMarkersRef = useRef<{[key: number]: L.CircleMarker}>({});
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Инициализация карты
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      // Центрируем карту на России
      mapRef.current = L.map(mapContainerRef.current).setView([55.7558, 37.6173], 5);
      
      // Добавляем OpenStreetMap тайлы
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);
      
      setMapInitialized(true);
    }
    
    // Очистка при размонтировании
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Обновление маркеров городов и территорий при изменении данных
  useEffect(() => {
    if (!mapRef.current || !mapInitialized || cities.length === 0) return;

    // Очищаем существующие маркеры и полигоны
    clearMap();

    // Добавляем маршруты между городами
    drawRoutesBetweenCities();

    // Добавляем маркеры и полигоны для городов
    cities.forEach(city => {
      addCityToMap(city);
    });

  }, [cities, mapInitialized, selectedCity]);

  // Обработка перемещения армий
  useEffect(() => {
    if (!mapRef.current || !mapInitialized) return;

    // Очищаем старые маркеры армий
    Object.values(armyMarkersRef.current).forEach(marker => {
      marker.remove();
    });
    armyMarkersRef.current = {};

    // Добавляем новые маркеры для армий в пути
    armyTransfers.forEach(transfer => {
      const fromCity = cities.find(c => c.id === transfer.fromCityId);
      const toCity = cities.find(c => c.id === transfer.toCityId);
      
      if (!fromCity || !toCity || !mapRef.current) return;

      // Рассчитываем текущую позицию армии на основе времени
      const now = Date.now();
      const progress = Math.min(
        (now - transfer.startTime) / (transfer.arrivalTime - transfer.startTime),
        1
      );

      const lat = fromCity.latitude + (toCity.latitude - fromCity.latitude) * progress;
      const lng = fromCity.longitude + (toCity.longitude - fromCity.longitude) * progress;

      // Создаем или обновляем маркер армии
      if (armyMarkersRef.current[transfer.id]) {
        armyMarkersRef.current[transfer.id].setLatLng([lat, lng]);
      } else {
        // Используем цвет владельца для маркера армии
        const color = TERRITORY_COLORS[fromCity.owner as keyof typeof TERRITORY_COLORS] || '#000000';
        
        const armyMarker = L.circleMarker([lat, lng], {
          radius: 8,
          color: '#000000',
          fillColor: color,
          fillOpacity: 0.8,
          weight: 1
        }).addTo(mapRef.current);
        
        // Добавляем всплывающее окно с информацией
        armyMarker.bindTooltip(`Армия из ${fromCity.name}<br>Войска: ${transfer.amount}<br>Прибытие: ${Math.round((1-progress)*100)}%`);
        
        armyMarkersRef.current[transfer.id] = armyMarker;
      }
    });

    // Обновляем положение армий каждые 100мс
    const interval = setInterval(() => {
      armyTransfers.forEach(transfer => {
        const fromCity = cities.find(c => c.id === transfer.fromCityId);
        const toCity = cities.find(c => c.id === transfer.toCityId);
        
        if (!fromCity || !toCity || !mapRef.current) return;

        const now = Date.now();
        const progress = Math.min(
          (now - transfer.startTime) / (transfer.arrivalTime - transfer.startTime),
          1
        );

        const lat = fromCity.latitude + (toCity.latitude - fromCity.latitude) * progress;
        const lng = fromCity.longitude + (toCity.longitude - fromCity.longitude) * progress;

        if (armyMarkersRef.current[transfer.id]) {
          armyMarkersRef.current[transfer.id].setLatLng([lat, lng]);
          armyMarkersRef.current[transfer.id].setTooltipContent(
            `Армия из ${fromCity.name}<br>Войска: ${transfer.amount}<br>Прибытие: ${Math.round((1-progress)*100)}%`
          );
        }
      });
    }, 100);

    return () => clearInterval(interval);
  }, [armyTransfers, cities, mapInitialized]);
  
  // Очистка карты
  const clearMap = () => {
    // Очищаем маркеры и полигоны
    markersRef.current.forEach(marker => marker.remove());
    polygonsRef.current.forEach(polygon => polygon.remove());
    routesRef.current.forEach(route => route.remove());
    
    markersRef.current = [];
    polygonsRef.current = [];
    routesRef.current = [];
  };

  // Добавление города на карту
  const addCityToMap = (city: City) => {
    if (!mapRef.current) return;
    
    const color = TERRITORY_COLORS[city.owner as keyof typeof TERRITORY_COLORS];

    // Добавляем полигон территории
    const polygon = L.polygon(city.boundaries, {
      color,
      fillColor: color,
      fillOpacity: 0.4,
      weight: 2
    }).addTo(mapRef.current);
    
    // Добавляем интерактивность - подсветка при наведении
    polygon.on('mouseover', () => {
      polygon.setStyle({ fillOpacity: 0.6, weight: 3 });
    });
    
    polygon.on('mouseout', () => {
      polygon.setStyle({ fillOpacity: 0.4, weight: 2 });
    });
    
    // Выбор города при клике на полигон
    polygon.on('click', () => {
      setSelectedCity(city.id);
    });
    
    polygonsRef.current.push(polygon);

    // Создаем HTML-элемент для информации о городе
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

    // Добавляем маркер города с использованием divIcon
    const cityMarker = L.marker([city.latitude, city.longitude], {
      icon: L.divIcon({
        className: 'custom-div-icon',
        html: cityInfo,
        iconSize: [150, city.owner === 'player' ? 120 : 100],
        iconAnchor: [75, 50]
      })
    }).addTo(mapRef.current);

    // Выбор города при клике на маркер
    cityMarker.on('click', () => {
      setSelectedCity(city.id);
    });
    
    // Подсветка выбранного города
    if (selectedCity === city.id) {
      polygon.setStyle({ fillOpacity: 0.7, weight: 4, color: '#FFD700' });
    }

    markersRef.current.push(cityMarker);
  };

  // Рисование маршрутов между городами
  const drawRoutesBetweenCities = () => {
    if (!mapRef.current) return;
    
    // Очищаем старые маршруты
    routesRef.current.forEach(route => route.remove());
    routesRef.current = [];
    
    // Создаем новый объект, чтобы избежать дублирования маршрутов
    const processedRoutes = new Set<string>();
    
    cities.forEach(city => {
      if (city.adjacentCities && city.adjacentCities.length > 0) {
        city.adjacentCities.forEach(adjacentCityId => {
          // Создаем уникальный идентификатор маршрута
          const routeId = [city.id, adjacentCityId].sort().join('-');
          
          // Проверяем, не рисовали ли мы уже этот маршрут
          if (!processedRoutes.has(routeId)) {
            processedRoutes.add(routeId);
            
            const adjacentCity = cities.find(c => c.id === adjacentCityId);
            if (adjacentCity) {
              // Определяем стиль маршрута в зависимости от владельцев городов
              let routeStyle: L.PolylineOptions = {
                color: '#888888', // Серый цвет по умолчанию
                weight: 3,
                opacity: 0.7,
                dashArray: '5, 10' // Пунктирная линия для обычных маршрутов
              };
              
              // Если оба города принадлежат игроку, делаем линию сплошной
              if (city.owner === 'player' && adjacentCity.owner === 'player') {
                routeStyle = {
                  color: '#4CAF50', // Зеленый цвет для маршрутов игрока
                  weight: 4,
                  opacity: 0.8,
                  dashArray: null
                };
              }
              
              // Рисуем маршрут
              const route = L.polyline(
                [[city.latitude, city.longitude], [adjacentCity.latitude, adjacentCity.longitude]],
                routeStyle
              ).addTo(mapRef.current!);
              
              // Добавляем информацию о маршруте
              route.bindTooltip(`Маршрут ${city.name} - ${adjacentCity.name}`);
              
              routesRef.current.push(route);
            }
          }
        });
      }
    });
  };

  return (
    <div className="h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full"></div>
    </div>
  );
};

export default Map;
