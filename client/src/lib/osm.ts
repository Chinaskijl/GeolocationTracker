
/**
 * Модуль для работы с OpenStreetMap и обработки географических данных
 */

import type { City } from "../../shared/schema";

/**
 * Получает границы города из данных OpenStreetMap
 * @param cityName - Название города для поиска
 * @param latitude - Широта центра города
 * @param longitude - Долгота центра города
 * @returns Promise с массивом координат границы города
 */
export async function fetchCityBoundaries(cityName: string, latitude: number, longitude: number): Promise<[number, number][]> {
  try {
    // Формируем запрос к Overpass API для получения границ города
    const query = `
      [out:json];
      (
        relation["place"="city"]["name"="${cityName}"];
        relation["boundary"="administrative"]["name"="${cityName}"];
      );
      out body;
      >;
      out skel qt;
    `;
    
    const response = await fetch(`https://overpass-api.de/api/interpreter`, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const data = await response.json();
    
    if (data.elements && data.elements.length > 0) {
      // Ищем релейшен с границей города
      const cityBoundary = data.elements.find((element: any) => 
        element.type === 'relation' && element.tags && 
        element.tags.boundary === 'administrative'
      );

      if (cityBoundary && cityBoundary.members) {
        // Ищем внешнюю границу (outer way)
        const outerWay = cityBoundary.members.find((member: any) => 
          member.role === 'outer' && member.geometry
        );

        if (outerWay && outerWay.geometry) {
          // Преобразуем геометрию в массив координат [lat, lon]
          return outerWay.geometry.map((node: any) => [node.lat, node.lon]);
        }
      }
    }

    // Если не удалось получить границы из API, возвращаем примерные границы
    console.warn(`Не удалось получить границы для города ${cityName}, используем приблизительные границы`);
    return generateApproximateBoundaries(latitude, longitude);
  } catch (error) {
    console.error('Ошибка при получении границ города:', error);
    return generateApproximateBoundaries(latitude, longitude);
  }
}

/**
 * Генерирует приблизительные границы города в виде неправильного многоугольника
 * @param centerLat - Широта центра города
 * @param centerLng - Долгота центра города
 * @returns Массив координат границ города
 */
function generateApproximateBoundaries(centerLat: number, centerLng: number): [number, number][] {
  const boundaries: [number, number][] = [];
  const numPoints = 8 + Math.floor(Math.random() * 5); // 8-12 точек для нерегулярной формы
  const baseRadius = 0.1 + Math.random() * 0.1; // Базовый радиус 0.1-0.2 градуса
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    // Варьируем радиус для создания неровной формы
    const radius = baseRadius * (0.7 + Math.random() * 0.6); 
    const lat = centerLat + Math.sin(angle) * radius;
    const lng = centerLng + Math.cos(angle) * radius;
    boundaries.push([lat, lng]);
  }
  
  // Добавляем первую точку в конец, чтобы замкнуть полигон
  boundaries.push(boundaries[0]);
  
  return boundaries;
}

/**
 * Создает соединения между близлежащими городами
 * @param cities - Массив городов
 * @returns Массив соединений между городами
 */
export function createCityConnections(cities: City[]): { city1: City, city2: City }[] {
  const connections: { city1: City, city2: City }[] = [];
  
  // Функция для расчета расстояния между городами
  const calculateDistance = (city1: City, city2: City): number => {
    const lat1 = city1.latitude;
    const lon1 = city1.longitude;
    const lat2 = city2.latitude;
    const lon2 = city2.longitude;
    
    // Используем упрощенную формулу расстояния на сфере
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = 6371 * c; // Радиус Земли в км
    
    return distance;
  };
  
  // Для каждого города находим ближайших соседей
  for (let i = 0; i < cities.length; i++) {
    const city1 = cities[i];
    const distances: { city: City, distance: number }[] = [];
    
    // Вычисляем расстояние до всех других городов
    for (let j = 0; j < cities.length; j++) {
      if (i !== j) {
        const city2 = cities[j];
        const distance = calculateDistance(city1, city2);
        distances.push({ city: city2, distance });
      }
    }
    
    // Сортируем по расстоянию и берем 2-3 ближайших города
    distances.sort((a, b) => a.distance - b.distance);
    const numConnections = Math.min(2 + Math.floor(Math.random() * 2), distances.length);
    
    for (let k = 0; k < numConnections; k++) {
      const city2 = distances[k].city;
      
      // Проверяем, не добавлено ли уже это соединение
      const alreadyConnected = connections.some(conn => 
        (conn.city1.id === city1.id && conn.city2.id === city2.id) || 
        (conn.city1.id === city2.id && conn.city2.id === city1.id)
      );
      
      if (!alreadyConnected) {
        connections.push({ city1, city2 });
      }
    }
  }
  
  return connections;
}

/**
 * Получает иконку для типа ресурса
 * @param resource - Тип ресурса
 * @returns Эмодзи или строковое представление ресурса
 */
export function getResourceIcon(resource: string): string {
  switch (resource) {
    case 'gold': return '💰';
    case 'food': return '🌾';
    case 'wood': return '🌲';
    case 'oil': return '🛢️';
    case 'metal': return '⛏️';
    case 'steel': return '🔩';
    case 'weapons': return '⚔️';
    default: return resource;
  }
}
