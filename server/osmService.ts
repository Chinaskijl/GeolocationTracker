
/**
 * Сервис для работы с данными OpenStreetMap
 */
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { storage } from './storage';

// Интерфейс для данных от Overpass API
interface OverpassResponse {
  version: number;
  generator: string;
  elements: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    nodes?: number[];
    members?: Array<{
      type: string;
      ref: number;
      role: string;
      geometry?: Array<{ lat: number; lon: number }>;
    }>;
    tags?: Record<string, string>;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
}

/**
 * Получает границы города из Overpass API
 * @param cityName Название города
 * @returns Координаты границ города в формате многоугольника
 */
export async function fetchCityBoundaries(cityName: string): Promise<number[][]> {
  try {
    // Формируем запрос для получения границ города с геометрией
    const query = `
      [out:json];
      area["name"="${cityName}"]->.searchArea;
      (
        relation(area.searchArea)["boundary"="administrative"]["admin_level"~"8|9"];
        relation(area.searchArea)["place"="city"];
      );
      out geom;
    `;
    
    // URL для Overpass API
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    console.log(`Fetching boundaries for ${cityName}...`);
    
    // Отправляем запрос
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.statusText}`);
    }
    
    // Преобразуем ответ в JSON
    const data = await response.json() as OverpassResponse;
    
    if (!data.elements || data.elements.length === 0) {
      console.warn(`No boundary data found for ${cityName}`);
      return [];
    }
    
    // Обрабатываем данные для получения координат границ
    return extractBoundaryCoordinates(data);
  } catch (error) {
    console.error(`Error fetching boundaries for ${cityName}:`, error);
    return []; // Возвращаем пустой массив в случае ошибки
  }
}

/**
 * Извлекает координаты границ из ответа Overpass API
 * @param data Данные от Overpass API
 * @returns Массив координат, образующих многоугольник
 */
function extractBoundaryCoordinates(data: OverpassResponse): number[][] {
  // Находим отношение с административной границей или городом
  const boundaryRelation = data.elements.find(el => 
    el.type === 'relation' && 
    el.tags && 
    ((el.tags.boundary === 'administrative' && el.tags.admin_level) ||
     (el.tags.place === 'city'))
  );
  
  if (!boundaryRelation || !boundaryRelation.members) {
    return [];
  }
  
  const coordinates: number[][] = [];
  
  // Прямая геометрия из ответа Overpass с флагом geom
  if (boundaryRelation.members.some(m => m.geometry)) {
    // Собираем все внешние пути (outer)
    const outerMembers = boundaryRelation.members.filter(m => m.role === 'outer' && m.geometry);
    
    for (const member of outerMembers) {
      if (member.geometry) {
        // Преобразуем геометрию в формат [lat, lon]
        const ring = member.geometry.map(point => [point.lat, point.lon]);
        
        // Добавляем только если есть достаточно точек для формирования полигона
        if (ring.length > 3) {
          // Убедимся, что полигон замкнут
          if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
            ring.push([ring[0][0], ring[0][1]]);
          }
          
          // Добавляем координаты в результат
          coordinates.push(...ring);
        }
      }
    }
  }
  
  // Если не удалось собрать координаты из геометрии, возвращаем пустой массив
  return coordinates.length > 0 ? coordinates : [];
}

/**
 * Создает простую границу вокруг точки
 * @param latitude Широта
 * @param longitude Долгота
 * @returns Массив координат, образующих многоугольник
 */
export function createSimpleBoundary(latitude: number, longitude: number): number[][] {
  const delta = 0.05; // размер области
  return [
    [latitude - delta, longitude - delta],
    [latitude + delta, longitude - delta],
    [latitude + delta, longitude + delta],
    [latitude - delta, longitude + delta],
    [latitude - delta, longitude - delta], // замыкаем полигон
  ];
}

/**
 * Обновляет данные о границах городов
 */
export async function updateAllCityBoundaries(): Promise<void> {
  try {
    console.log('Starting update of all city boundaries...');
    // Получаем текущие данные о городах
    const cities = await storage.getCities();
    
    // Обновляем границы для каждого города
    for (const city of cities) {
      try {
        console.log(`Processing city: ${city.name}`);
        // Пытаемся получить реальные границы из OSM
        const boundaries = await fetchCityBoundaries(city.name);
        
        if (boundaries.length > 0) {
          console.log(`Got real boundaries for ${city.name} with ${boundaries.length} points`);
          // Обновляем границы города
          city.boundaries = boundaries;
        } else {
          console.log(`Using simple boundary for ${city.name}`);
          // Если не удалось получить границы, создаем простую границу
          city.boundaries = createSimpleBoundary(city.latitude, city.longitude);
        }
      } catch (error) {
        console.warn(`Failed to update boundaries for ${city.name}:`, error);
        // В случае ошибки используем простую границу
        city.boundaries = createSimpleBoundary(city.latitude, city.longitude);
      }
    }
    
    // Сохраняем обновленные данные о городах
    await storage.updateCitiesData(cities);
    console.log('City boundaries updated successfully');
  } catch (error) {
    console.error('Error updating city boundaries:', error);
  }
}

/**
 * Обновляет границы для конкретного города
 * @param cityId ID города
 * @returns Обновленные данные о городе
 */
export async function updateCityBoundary(cityId: number): Promise<any> {
  try {
    // Получаем данные о городе
    const cities = await storage.getCities();
    const city = cities.find(c => c.id === cityId);
    
    if (!city) {
      throw new Error(`City with ID ${cityId} not found`);
    }
    
    try {
      console.log(`Updating boundary for city: ${city.name}`);
      // Пытаемся получить реальные границы из OSM
      const boundaries = await fetchCityBoundaries(city.name);
      
      if (boundaries.length > 0) {
        console.log(`Got real boundaries for ${city.name}`);
        city.boundaries = boundaries;
      } else {
        console.log(`Using simple boundary for ${city.name}`);
        city.boundaries = createSimpleBoundary(city.latitude, city.longitude);
      }
    } catch (error) {
      console.warn(`Failed to update boundaries for ${city.name}:`, error);
      city.boundaries = createSimpleBoundary(city.latitude, city.longitude);
    }
    
    // Обновляем данные о городе
    await storage.updateCity(cityId, { boundaries: city.boundaries });
    
    return city;
  } catch (error) {
    console.error(`Error updating boundary for city ${cityId}:`, error);
    throw error;
  }
}
