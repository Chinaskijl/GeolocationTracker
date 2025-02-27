
/**
 * Утилиты для работы с границами городов
 */

import { apiRequest } from './queryClient';

/**
 * Интерфейс GeoJSON для полигонов
 */
interface GeoJSONPolygon {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, any>;
    geometry: {
      type: "Polygon";
      coordinates: number[][][];
    }
  }>;
}

/**
 * Преобразует массив координат [lat, lon] в GeoJSON полигон
 * @param boundaries Массив координат в формате [lat, lon]
 * @param properties Дополнительные свойства для объекта GeoJSON
 * @returns Объект GeoJSON с полигоном
 */
export function boundariesToGeoJSON(boundaries: number[][], properties: Record<string, any> = {}): GeoJSONPolygon {
  if (!boundaries || boundaries.length < 3) {
    return {
      type: "FeatureCollection",
      features: []
    };
  }
  
  // Для GeoJSON нужно преобразовать [lat, lon] в [lon, lat]
  // и убедиться, что полигон замкнут (первая и последняя точки совпадают)
  const coordinates = boundaries.map(point => [point[1], point[0]]);
  
  // Проверяем, замкнут ли полигон, если нет - замыкаем его
  if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
      coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
    coordinates.push([coordinates[0][0], coordinates[0][1]]);
  }
  
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties,
        geometry: {
          type: "Polygon",
          coordinates: [coordinates]
        }
      }
    ]
  };
}

/**
 * Преобразует ответ от Overpass API в GeoJSON
 * @param data Данные от Overpass API
 * @returns Объект GeoJSON
 */
export function overpassToGeoJSON(data: any): GeoJSONPolygon {
  // Инициализируем пустой GeoJSON
  const geoJSON: GeoJSONPolygon = {
    type: "FeatureCollection",
    features: []
  };
  
  // Находим все отношения с границами
  const boundaries = data.elements.filter((el: any) => 
    el.type === 'relation' && 
    el.tags && 
    (el.tags.boundary === 'administrative' || el.tags.place === 'city')
  );
  
  // Обрабатываем каждую границу
  boundaries.forEach((boundary: any) => {
    // Собираем все узлы
    const nodes: Record<number, [number, number]> = {};
    data.elements.forEach((el: any) => {
      if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
        nodes[el.id] = [el.lon, el.lat]; // GeoJSON использует [lon, lat]
      }
    });
    
    // Собираем пути
    const ways: Record<number, number[][]> = {};
    data.elements.forEach((el: any) => {
      if (el.type === 'way' && el.nodes) {
        ways[el.id] = el.nodes
          .map((nodeId: number) => nodes[nodeId])
          .filter(Boolean);
      }
    });
    
    // Собираем внешние кольца (outer)
    const outerRings: number[][][] = [];
    const coordinates: number[][][] = [];
    
    boundary.members
      .filter((member: any) => member.type === 'way' && member.role === 'outer')
      .forEach((member: any) => {
        if (ways[member.ref]) {
          outerRings.push(ways[member.ref]);
        }
      });
    
    // Если есть внешние кольца, создаем полигон
    if (outerRings.length > 0) {
      coordinates.push(outerRings[0]); // Берем первое кольцо
      
      // Добавляем объект в GeoJSON
      geoJSON.features.push({
        type: 'Feature',
        properties: boundary.tags || {},
        geometry: {
          type: 'Polygon',
          coordinates: coordinates
        }
      });
    }
  });
  
  return geoJSON;
}

/**
 * Функция для получения упрощенных границ из имеющихся данных,
 * если API недоступен или нет данных для города
 * @param cityCoords Координаты города [lat, lon]
 * @returns Массив координат, образующих многоугольник
 */
export function getSimpleBoundary(cityCoords: [number, number]): number[][] {
  // Создаем квадрат вокруг координат города
  const delta = 0.05; // размер области
  return [
    [cityCoords[0] - delta, cityCoords[1] - delta],
    [cityCoords[0] + delta, cityCoords[1] - delta],
    [cityCoords[0] + delta, cityCoords[1] + delta],
    [cityCoords[0] - delta, cityCoords[1] + delta],
    [cityCoords[0] - delta, cityCoords[1] - delta], // замыкаем полигон
  ];
}

/**
 * Обновляет границы всех городов через API
 * @returns Обновленный массив городов
 */
export async function updateAllCityBoundaries(): Promise<any[]> {
  try {
    const updatedCities = await apiRequest('POST', '/api/cities/update-boundaries', {});
    return updatedCities;
  } catch (error) {
    console.error('Ошибка при обновлении границ городов:', error);
    throw error;
  }
}

/**
 * Обновляет границы конкретного города через API
 * @param cityId ID города
 * @returns Обновленные данные о городе
 */
export async function updateCityBoundary(cityId: number): Promise<any> {
  try {
    const updatedCity = await apiRequest('POST', `/api/cities/${cityId}/update-boundary`, {});
    return updatedCity;
  } catch (error) {
    console.error(`Ошибка при обновлении границ города ${cityId}:`, error);
    throw error;
  }
}
