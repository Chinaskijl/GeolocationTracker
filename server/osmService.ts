
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
 * Получает границы области из Overpass API
 * @param regionName Название области
 * @returns Координаты границ области в формате многоугольника
 */
export async function fetchRegionBoundaries(regionName: string): Promise<number[][]> {
  try {
    // Формируем запрос для получения границ области с геометрией
    const query = `
      [out:json];
      area["name:ru"="${regionName}"]->.searchArea;
      (
        relation(area.searchArea)["boundary"="administrative"]["admin_level"="4"];
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
    
    // Здесь создаем один замкнутый полигон из всех внешних частей
    let allPoints: Array<{lat: number; lon: number}> = [];
    
    for (const member of outerMembers) {
      if (member.geometry) {
        // Собираем все точки из всех внешних частей
        allPoints = allPoints.concat(member.geometry);
      }
    }
    
    // Если есть точки, формируем полигон
    if (allPoints.length > 3) {
      // Преобразуем геометрию в формат [lat, lon]
      const polygon = allPoints.map(point => [point.lat, point.lon]);
      
      // Убедимся, что полигон замкнут
      if (polygon[0][0] !== polygon[polygon.length - 1][0] || 
          polygon[0][1] !== polygon[polygon.length - 1][1]) {
        polygon.push([polygon[0][0], polygon[0][1]]);
      }
      
      return polygon;
    }
  }
  
  // Если не удалось собрать координаты из геометрии, возвращаем пустой массив
  return [];
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
 * Обновляет данные о границах областей
 */
export async function updateAllRegionBoundaries(): Promise<void> {
  try {
    console.log('Starting update of all region boundaries...');
    // Получаем текущие данные об областях
    const regions = await storage.getRegions();
    let boundaryRegions = false;
    
    // Обновляем границы для каждой области
    for (const region of regions) {
      try {
        // Пропускаем области, у которых уже есть границы
        if (region.boundaries && region.boundaries.length > 10) {
          console.log(`Region ${region.name} already has boundaries with ${region.boundaries.length} points`);
          boundaryRegions = true;
          continue;
        }
        
        console.log(`Processing region: ${region.name}`);
        // Пытаемся получить реальные границы из OSM
        const boundaries = await fetchRegionBoundaries(region.name);
        
        if (boundaries.length > 0) {
          console.log(`Got real boundaries for ${region.name} with ${boundaries.length} points`);
          // Обновляем границы области
          region.boundaries = boundaries;
          boundaryRegions = true;
        } else {
          console.log(`Using simple boundary for ${region.name}`);
          // Если не удалось получить границы, создаем простую границу
          region.boundaries = createSimpleBoundary(region.latitude, region.longitude);
        }
      } catch (error) {
        console.warn(`Failed to update boundaries for ${region.name}:`, error);
        // В случае ошибки используем простую границу
        region.boundaries = createSimpleBoundary(region.latitude, region.longitude);
      }
    }
    
    // Сохраняем обновленные данные об областях только если есть изменения
    if (!boundaryRegions) {
      await storage.updateRegionsData(regions);
      console.log('Region boundaries updated successfully');
    } else {
      console.log('No boundary updates needed');
    }
  } catch (error) {
    console.error('Error updating region boundaries:', error);
  }
}

/**
 * Обновляет границы для конкретной области
 * @param regionId ID области
 * @returns Обновленные данные об области
 */
export async function updateRegionBoundary(regionId: number): Promise<any> {
  try {
    // Получаем данные об области
    const regions = await storage.getRegions();
    const region = regions.find(r => r.id === regionId);
    
    if (!region) {
      throw new Error(`Region with ID ${regionId} not found`);
    }
    
    try {
      console.log(`Updating boundary for region: ${region.name}`);
      // Пытаемся получить реальные границы из OSM
      const boundaries = await fetchRegionBoundaries(region.name);
      
      if (boundaries.length > 0) {
        console.log(`Got real boundaries for ${region.name}`);
        region.boundaries = boundaries;
      } else {
        console.log(`Using simple boundary for ${region.name}`);
        region.boundaries = createSimpleBoundary(region.latitude, region.longitude);
      }
    } catch (error) {
      console.warn(`Failed to update boundaries for ${region.name}:`, error);
      region.boundaries = createSimpleBoundary(region.latitude, region.longitude);
    }
    
    // Обновляем данные об области
    await storage.updateRegion(regionId, { boundaries: region.boundaries });
    
    return region;
  } catch (error) {
    console.error(`Error updating boundary for region ${regionId}:`, error);
    throw error;
  }
}
