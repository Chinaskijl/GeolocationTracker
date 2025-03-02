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

    console.log(`Fetching boundaries for ${regionName}...`);

    // Отправляем запрос
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.statusText}`);
    }

    // Преобразуем ответ в JSON
    const data = await response.json() as OverpassResponse;

    if (!data.elements || data.elements.length === 0) {
      console.warn(`No boundary data found for ${regionName}`);
      return [];
    }

    // Обрабатываем данные для получения координат границ
    return extractBoundaryCoordinates(data);
  } catch (error) {
    console.error(`Error fetching boundaries for ${regionName}:`, error);
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
    let allPoints: Array<{ lat: number; lon: number }> = [];

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
 * Создает простую границу для области с уникальной формой для каждого региона
 * @param latitude Широта центра области
 * @param longitude Долгота центра области
 * @param regionId Идентификатор региона для создания уникальной формы
 * @returns Координаты границы области в формате многоугольника
 */
function createSimpleBoundary(latitude: number, longitude: number, regionId: number = 1): number[][] {
  // Создаем неправильный многоугольник для более естественной формы
  // Используем regionId как сид для генерации уникальной формы
  const baseDelta = 0.05; // базовый размер области (уменьшили для меньших наложений)
  const points = 12; // количество точек в многоугольнике
  const result: number[][] = [];

  // Создаем уникальный коэффициент формы на основе regionId
  const shapeOffset = (regionId % 5) * 0.2;
  const radiusVariation = (regionId % 3) * 0.15;

  for (let i = 0; i < points; i++) {
    // Вычисляем угол для текущей точки
    const angle = (i / points) * 2 * Math.PI;

    // Радиус с вариацией на основе угла и regionId
    const radiusFactor = 1.0 + Math.sin(angle * (2 + (regionId % 3))) * radiusVariation;
    const radius = baseDelta * radiusFactor;

    // Вычисляем координаты
    const lat = latitude + Math.sin(angle + shapeOffset) * radius;
    const lng = longitude + Math.cos(angle + shapeOffset) * radius;

    result.push([lat, lng]);
  }

  // Замыкаем полигон
  result.push([...result[0]]);

  return result;
}

/**
 * Обновляет данные о границах областей
 */
export async function updateAllRegionBoundaries(): Promise<void> {
  try {
    console.log('Starting update of all region boundaries...');
    // Получаем текущие данные об областях
    const regions = await storage.getRegions();
    let boundariesUpdated = false;

    // Обновляем границы для каждой области, но не меняем исходные данные
    const regionsWithBoundaries = await Promise.all(regions.map(async (region) => {
      try {
        console.log(`Processing region: ${region.name}`);
        // Пытаемся получить реальные границы из OSM
        const boundaries = await fetchRegionBoundaries(region.name);

        if (boundaries.length > 0) {
          console.log(`Got real boundaries for ${region.name} with ${boundaries.length} points`);
          // Создаем копию области с обновленными границами
          return { ...region, boundaries };
        } else {
          console.log(`Using simple boundary for ${region.name}`);
          // Если не удалось получить границы, создаем простую границу
          return { ...region, boundaries: createSimpleBoundary(region.latitude, region.longitude, region.id) };
        }
      } catch (error) {
        console.warn(`Failed to update boundaries for ${region.name}:`, error);
        // В случае ошибки используем простую границу
        return { ...region, boundaries: createSimpleBoundary(region.latitude, region.longitude, region.id) };
      }
    }));

    // Обновляем данные об областях только в памяти для текущей сессии
    // Не сохраняем границы в файл - они будут загружаться при каждом запуске
    if (regionsWithBoundaries.length > 0) {
      // Обновляем данные о границах и сохраняем их в файл
      await storage.updateRegionsData(regionsWithBoundaries);
      console.log('Region boundaries updated and saved successfully');
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
        region.boundaries = createSimpleBoundary(region.latitude, region.longitude, region.id);
      }
    } catch (error) {
      console.warn(`Failed to update boundaries for ${region.name}:`, error);
      region.boundaries = createSimpleBoundary(region.latitude, region.longitude, region.id);
    }

    // Обновляем данные об области
    await storage.updateRegion(regionId, { boundaries: region.boundaries });

    return region;
  } catch (error) {
    console.error(`Error updating boundary for region ${regionId}:`, error);
    throw error;
  }
}