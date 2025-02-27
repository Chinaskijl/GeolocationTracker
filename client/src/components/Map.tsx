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
}

interface City {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  boundaries: [number, number][];
  owner?: number;
  population: number;
  maxPopulation: number;
  military?: number;
  resources: Record<string, number>;
}


export function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const polygonsRef = useRef<L.Layer[]>([]);
  const militaryMovementsRef = useRef<MilitaryMovement[]>([]);
  const animationFrameRef = useRef<number>();
  const { cities, setSelectedCity, armyTransfers } = useGameStore();
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

    // Функция для создания маршрутов между городами
    const createConnectionsBetweenCities = (citiesList: any[]) => {
      if (!mapRef.current || !citiesList || citiesList.length < 2) return;

      // Создаем соединения между соседними городами
      for (let i = 0; i < citiesList.length; i++) {
        for (let j = i + 1; j < citiesList.length; j++) {
          const city1 = citiesList[i];
          const city2 = citiesList[j];

          // Получаем центроиды для соединения
          const point1 = getCityCentroid(city1.boundaries);
          const point2 = getCityCentroid(city2.boundaries);

          // Вычисляем расстояние между городами
          const distance = mapRef.current.distance(
            [point1[0], point1[1]],
            [point2[0], point2[1]]
          );

          // Соединяем только города в пределах определенного расстояния (соседи)
          // Подбираем расстояние в зависимости от масштаба карты
          const maxConnectionDistance = 500000; // 500 км
          if (distance <= maxConnectionDistance) {
            const routeColor = getConnectionColor(city1, city2);

            // Создаем соединение между городами
            const connection = L.polyline([point1, point2], {
              color: routeColor,
              weight: 2,
              opacity: 0.6,
              dashArray: '5, 10'
            }).addTo(mapRef.current);

            // Добавляем метку расстояния
            const middlePoint = [
              (point1[0] + point2[0]) / 2,
              (point1[1] + point2[1]) / 2
            ];

            const distanceLabel = L.divIcon({
              className: 'distance-label',
              html: `<div>${Math.round(distance / 1000)} км</div>`,
              iconSize: [60, 20],
              iconAnchor: [30, 10]
            });

            const marker = L.marker([middlePoint[0], middlePoint[1]], {
              icon: distanceLabel,
              interactive: false
            }).addTo(mapRef.current);

            polygonsRef.current.push(connection);
            markersRef.current.push(marker);
          }
        }
      }
    };

    // Функция для определения цвета соединения между городами
    const getConnectionColor = (city1: any, city2: any) => {
      // Если города принадлежат одному владельцу - используем его цвет
      if (city1.owner !== 'neutral' && city1.owner === city2.owner) {
        return TERRITORY_COLORS[city1.owner as keyof typeof TERRITORY_COLORS];
      }
      // Иначе используем нейтральный цвет
      return '#888888';
    };

    createConnectionsBetweenCities(cities);


    // Show connections between cities for army transfers if they exist
    armyTransfers.forEach(transfer => {
      const fromCity = cities.find(city => city.id === transfer.fromCityId);
      const toCity = cities.find(city => city.id === transfer.toCityId);

      if (fromCity && toCity) {
        // Используем центроиды городов для более точного соединения
        const fromPoint = getCityCentroid(fromCity.boundaries);
        const toPoint = getCityCentroid(toCity.boundaries);

        const routeLine = L.polyline([fromPoint, toPoint], {
          color: '#ff4500',
          weight: 3,
          opacity: 0.7,
          dashArray: '10, 10'
        }).addTo(mapRef.current!);

        // Add arrow decoration to the line
        const arrowDecorator = L.polylineDecorator(routeLine, {
          patterns: [
            {
              offset: '70%',
              repeat: 0,
              symbol: L.Symbol.arrowHead({
                pixelSize: 15,
                pathOptions: {
                  fillOpacity: 0.9,
                  weight: 0,
                  color: '#ff4500'
                }
              })
            }
          ]
        }).addTo(mapRef.current!);
      }
    });


    return () => {
      markersRef.current.forEach(marker => marker.remove());
      polygonsRef.current.forEach(polygon => polygon.remove());
    };
  }, [cities, setSelectedCity, armyTransfers]);

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

export function getResourceIcon(resourceName: string): string {
  const icons: Record<string, string> = {
    gold: '💰',
    wood: '🌲',
    food: '🌾',
    oil: '🛢️',
    metal: '⛏️',
    steel: '🔩',
    weapons: '⚔️'
  };
  return icons[resourceName] || '❓';
};

/**
 * Функция определяет, являются ли два города соседними
 * @param city1 - первый город
 * @param city2 - второй город
 * @returns true если города соседние, иначе false
 */
const areCitiesNeighboring = (city1: City, city2: City): boolean => {
  // Вычисляем центр масс обоих городов
  const centerCity1 = getCityCentroid(city1.boundaries);
  const centerCity2 = getCityCentroid(city2.boundaries);

  // Рассчитываем расстояние между центрами городов
  const distance = calculateDistance(centerCity1, centerCity2);

  // Считаем города соседними, если расстояние меньше определенного порога
  // (адаптируем порог в зависимости от масштаба карты)
  return distance < 3.5; // порог в градусах
};

/**
 * Рассчитывает расстояние между двумя точками на карте
 * @param point1 - первая точка [lat, lng]
 * @param point2 - вторая точка [lat, lng]
 * @returns расстояние в градусах
 */
const calculateDistance = (point1: [number, number], point2: [number, number]): number => {
  const [lat1, lng1] = point1;
  const [lat2, lng2] = point2;

  // Простая формула расстояния по Евклиду
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
};

/**
 * Вычисляет центроид (центр масс) полигона
 * @param points - массив точек полигона [[lat1, lng1], [lat2, lng2], ...]
 * @returns точка центроида [lat, lng]
 */
const getCityCentroid = (points: [number, number][]): [number, number] => {
  let sumLat = 0;
  let sumLng = 0;

  for (const [lat, lng] of points) {
    sumLat += lat;
    sumLng += lng;
  }

  return [sumLat / points.length, sumLng / points.length];
};