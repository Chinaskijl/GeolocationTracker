/**
 * Сервис для работы с данными OpenStreetMap
 */
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { storage } from './storage';
import { randomInt } from './utils'; // Added utility function

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

//Interface for region data (info.json is removed)
interface RegionData {
    id: number;
    name: string;
    population: number;
    military: number;
    buildableBuildings: string[];
    resources: { [resource: string]: number };
    boundaries: number[][];
    latitude: number;
    longitude: number;
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
export async function updateAllRegionBoundaries(): Promise<boolean> {
  try {
    console.log('Starting update of all region boundaries...');
    // Получаем текущие данные об областях
    const regions = await storage.getRegions();

    // Обновляем границы для каждой области, но только в памяти
    for (const region of regions) {
      if (!region.boundaries || region.boundaries.length === 0) {
        await updateRegionBoundary(region);
      }
    }

    // Обновляем только в памяти, не сохраняя в файл
    storage.updateInMemoryRegionsData(regions);

    console.log("Updated all region boundaries (in memory only)");
    return true;
  } catch (error) {
    console.error("Error updating region boundaries:", error);
    return false;
  }
}

/**
 * Обновляет границы для конкретной области
 * @param regionId ID области
 * @returns Обновленные данные об области
 */
export async function updateRegionBoundary(region: RegionData): Promise<void> {
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
}


// Added functions to manage game data and randomize data

async function resetGameData() {
    const regions: RegionData[] = [];
    const numRegions = 5; //Example number of regions - adjust as needed
    const buildableBuildings = ["farm", "barracks", "mine"];

    for (let i = 0; i < numRegions; i++) {
        const maxPop = i < 2 ? 10000 : 5000; //larger regions have higher max population

        regions.push({
            id: i + 1,
            name: `Region ${i + 1}`,
            population: randomInt(maxPop / 2, maxPop),
            military: randomInt(maxPop / 10, maxPop / 5),
            buildableBuildings: buildableBuildings.map((building) => `${building}_${i}`), //unique names
            resources: {
                wood: randomInt(100, 500),
                stone: randomInt(50, 250),
                gold: randomInt(20, 100)
            },
            boundaries: createSimpleBoundary(randomInt(40,60)/10 ,randomInt(40,60)/10, i + 1),
            latitude: randomInt(40,60)/10,
            longitude: randomInt(40,60)/10
        });
    }
    await storage.saveRegions(regions);
}


//Helper function for generating random integers within a range.
function randomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}