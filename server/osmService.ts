
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
    }>;
    tags?: Record<string, string>;
  }>;
}

/**
 * Получает границы города из Overpass API
 * @param cityName Название города
 * @returns Координаты границ города в формате многоугольника
 */
export async function fetchCityBoundaries(cityName: string): Promise<number[][]> {
  try {
    // Формируем запрос для получения границ города
    const query = `
      [out:json];
      area["name"="${cityName}"][admin_level~"8|9"]->.searchArea;
      (
        relation(area.searchArea)["admin_level"~"8|9"];
      );
      out body;
      >;
      out skel qt;
    `;
    
    // URL для Overpass API
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    // Отправляем запрос
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.statusText}`);
    }
    
    // Преобразуем ответ в JSON
    const data = await response.json() as OverpassResponse;
    
    // Обрабатываем данные для получения координат границ
    return extractBoundaryCoordinates(data);
  } catch (error) {
    console.error(`Error fetching boundaries for ${cityName}:`, error);
    throw error;
  }
}

/**
 * Извлекает координаты границ из ответа Overpass API
 * @param data Данные от Overpass API
 * @returns Массив координат, образующих многоугольник
 */
function extractBoundaryCoordinates(data: OverpassResponse): number[][] {
  // Извлекаем и обрабатываем данные о точках и путях
  const nodes: Record<number, [number, number]> = {};
  const ways: Record<number, number[][]> = {};
  
  // Сначала обрабатываем все узлы
  data.elements.forEach(el => {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodes[el.id] = [el.lat, el.lon];
    }
  });
  
  // Затем обрабатываем пути
  data.elements.forEach(el => {
    if (el.type === 'way' && el.nodes) {
      ways[el.id] = el.nodes
        .map(nodeId => nodes[nodeId])
        .filter(Boolean);
    }
  });
  
  // Ищем отношение с ролью "boundary"
  const boundary = data.elements.find(el => 
    el.type === 'relation' && 
    el.tags && 
    (el.tags.boundary === 'administrative' || el.tags.type === 'boundary')
  );
  
  if (!boundary || !boundary.members) {
    return [];
  }
  
  // Строим внешние кольца из путей с ролью "outer"
  const outerRings: number[][] = [];
  boundary.members
    .filter(member => member.type === 'way' && member.role === 'outer')
    .forEach(member => {
      if (ways[member.ref]) {
        outerRings.push(...ways[member.ref]);
      }
    });
  
  return outerRings;
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
    // Получаем текущие данные о городах
    const cities = await storage.getCities();
    
    // Обновляем границы для каждого города
    for (const city of cities) {
      try {
        // Пытаемся получить реальные границы из OSM
        const boundaries = await fetchCityBoundaries(city.name);
        
        if (boundaries.length > 0) {
          // Обновляем границы города
          city.boundaries = boundaries;
        } else {
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
      // Пытаемся получить реальные границы из OSM
      const boundaries = await fetchCityBoundaries(city.name);
      
      if (boundaries.length > 0) {
        city.boundaries = boundaries;
      } else {
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
