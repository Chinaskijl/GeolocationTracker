/**
 * Сервис для работы с данными OpenStreetMap
 */
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './storage';

// Определение директории проекта в ESM-модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOUNDARIES_DIR = path.join(__dirname, '..', 'data', 'city-boundaries');

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
    console.log(`Trying to load boundaries for ${cityName} from cache...`);
    // Пытаемся загрузить из кэша
    const boundariesFromCache = await loadCityBoundariesFromFile(cityName);
    if (boundariesFromCache && boundariesFromCache.length > 0) {
      console.log(`Loaded boundaries for ${cityName} from cache (${boundariesFromCache.length} points)`);
      return boundariesFromCache;
    }

    // Специальные запросы для крупных городов
    let query = '';
    
    // Выбираем подходящий запрос в зависимости от города
    if (cityName === 'Москва') {
      // Для Москвы ищем с admin_level=4
      query = `
        [out:json];
        area["name"="${cityName}"]->.searchArea;
        (
          relation(area.searchArea)["boundary"="administrative"]["admin_level"="4"];
        );
        out geom;
      `;
    } else if (cityName === 'Санкт-Петербург') {
      // Для Санкт-Петербурга ищем с admin_level=4
      query = `
        [out:json];
        area["name"="${cityName}"]->.searchArea;
        (
          relation(area.searchArea)["boundary"="administrative"]["admin_level"="4"];
        );
        out geom;
      `;
    } else if (cityName === 'Екатеринбург') {
      // Для Екатеринбурга ищем по place=city
      query = `
        [out:json];
        area["name"="${cityName}"]->.searchArea;
        (
          relation(area.searchArea)["place"="city"];
          way(area.searchArea)["place"="city"];
        );
        out geom;
      `;
    } else {
      // Для остальных городов используем стандартный запрос
      query = `
        [out:json];
        area["name"="${cityName}"]->.searchArea;
        (
          relation(area.searchArea)["boundary"="administrative"]["admin_level"~"8|9"];
          relation(area.searchArea)["place"="city"];
        );
        out geom;
      `;
    }

    // URL для Overpass API
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    console.log(`Fetching boundaries for ${cityName} using specialized query...`);

    // Отправляем запрос
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.statusText}`);
    }

    // Преобразуем ответ в JSON
    const data = await response.json() as OverpassResponse;

    if (!data.elements || data.elements.length === 0) {
      console.warn(`No boundary data found for ${cityName}, trying alternative query...`);
      
      // Пробуем альтернативный запрос, если первый не дал результатов
      const alternativeQuery = `
        [out:json];
        area["name"="${cityName}"]->.searchArea;
        (
          relation(area.searchArea)["boundary"="administrative"];
          relation(area.searchArea)["place"="city"];
          way(area.searchArea)["place"="city"];
        );
        out geom;
      `;
      
      const alternativeUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(alternativeQuery)}`;
      const alternativeResponse = await fetch(alternativeUrl);
      
      if (!alternativeResponse.ok) {
        return []; // Если и альтернативный запрос не удался, возвращаем пустой массив
      }
      
      const alternativeData = await alternativeResponse.json() as OverpassResponse;
      
      if (!alternativeData.elements || alternativeData.elements.length === 0) {
        console.warn(`No boundary data found with alternative query for ${cityName}`);
        return [];
      }
      
      // Обрабатываем данные из альтернативного запроса
      const boundaries = extractBoundaryCoordinates(alternativeData);
      
      // Сохраняем границы в файл для кеширования
      if (boundaries.length > 0) {
        console.log(`Saving boundaries from alternative query for ${cityName} (${boundaries.length} points)`);
        await saveCityBoundariesToFile(cityName, boundaries);
      }
      
      return boundaries;
    }

    // Обрабатываем данные для получения координат границ
    const boundaries = extractBoundaryCoordinates(data);

    // Сохраняем границы в файл для кеширования
    if (boundaries.length > 0) {
      console.log(`Saving boundaries for ${cityName} (${boundaries.length} points)`);
      await saveCityBoundariesToFile(cityName, boundaries);
    }

    return boundaries;
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
    let allPoints: Array<{ lat: number; lon: number }> = [];

    for (const member of outerMembers) {
      if (member.geometry) {
        // Собираем все точки из всех внешних частей
        allPoints = allPoints.concat(member.geometry);
      }
    }

    // Для крупных городов применяем более умное упрощение границ
    if (allPoints.length > 200) {
      console.log(`City boundary has too many points (${allPoints.length}), simplifying...`);

      // Для сохранения формы города берем точки через равные интервалы,
      // но обязательно сохраняем ключевые точки (начало, конец, углы)
      const maxPoints = 300; // Увеличиваем максимальное количество точек для лучшей детализации
      const simplificationFactor = Math.ceil(allPoints.length / maxPoints);

      // Всегда сохраняем первую и последнюю точки
      const firstPoint = allPoints[0];
      const lastPoint = allPoints[allPoints.length - 1];

      // Фильтруем точки
      allPoints = allPoints.filter((point, idx) => {
        // Всегда сохраняем первую и последнюю точки
        if (idx === 0 || idx === allPoints.length - 1) return true;

        // Сохраняем точки через равные интервалы
        if (idx % simplificationFactor === 0) return true;

        // Дополнительно проверяем на "угол" (резкое изменение направления)
        if (idx > 1 && idx < allPoints.length - 1) {
          const prev = allPoints[idx - 1];
          const current = point;
          const next = allPoints[idx + 1];

          // Вычисляем вектора между точками
          const dx1 = current.lon - prev.lon;
          const dy1 = current.lat - prev.lat;
          const dx2 = next.lon - current.lon;
          const dy2 = next.lat - current.lat;

          // Находим скалярное произведение нормализованных векторов
          const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
          const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (len1 > 0 && len2 > 0) {
            const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
            // Если угол достаточно острый (dot < 0.7 соответствует углу > 45 градусов)
            if (dot < 0.7) return true;
          }
        }

        return false;
      });

      console.log(`Simplified to ${allPoints.length} points using improved algorithm`);
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
 * Сохраняет границы города в JSON-файл
 * @param cityName Название города
 * @param boundaries Границы города
 */
async function saveCityBoundariesToFile(cityName: string, boundaries: number[][]): Promise<void> {
  try {
    // Создаем директорию, если она не существует
    await fs.mkdir(BOUNDARIES_DIR, { recursive: true });

    // Путь к файлу
    const filePath = path.join(BOUNDARIES_DIR, `${cityName}.json`);

    // Сохраняем данные
    await fs.writeFile(filePath, JSON.stringify(boundaries, null, 2), 'utf8');
    console.log(`Boundaries for ${cityName} saved to ${filePath}`);
  } catch (error) {
    console.error(`Error saving boundaries for ${cityName}:`, error);
  }
}

/**
 * Загружает границы города из JSON-файла
 * @param cityName Название города
 * @returns Границы города или null, если файл не найден
 */
async function loadCityBoundariesFromFile(cityName: string): Promise<number[][] | null> {
  try {
    // Путь к файлу
    const filePath = path.join(BOUNDARIES_DIR, `${cityName}.json`);

    // Проверяем, существует ли файл
    try {
      await fs.access(filePath);
    } catch {
      return null; // Файл не найден
    }

    // Читаем данные
    const data = await fs.readFile(filePath, 'utf8');
    const boundaries = JSON.parse(data) as number[][];
    console.log(`Boundaries for ${cityName} loaded from ${filePath} (${boundaries.length} points)`);
    return boundaries;
  } catch (error) {
    console.error(`Error loading boundaries for ${cityName}:`, error);
    return null;
  }
}

/**
 * Загружает данные о границах городов из файлов
 * @returns Promise с массивом городов с загруженными границами
 */
export async function loadAllCityBoundaries(): Promise<any[]> {
  try {
    console.log('Loading all city boundaries...');
    // Получаем текущие данные о городах
    const cities = await storage.getCities();

    // Загружаем границы для каждого города
    for (const city of cities) {
      try {
        console.log(`Loading boundaries for city: ${city.name}`);
        // Пытаемся загрузить границы из кэша
        const boundaries = await loadCityBoundariesFromFile(city.name);

        if (boundaries && boundaries.length > 0) {
          console.log(`Loaded boundaries for ${city.name} with ${boundaries.length} points`);
          // Устанавливаем границы города
          city.boundaries = boundaries;
        } else {
          console.log(`No cached boundaries for ${city.name}, using simple boundary`);
          // Если не удалось загрузить границы, создаем простую границу
          city.boundaries = createSimpleBoundary(city.latitude, city.longitude);
        }
      } catch (error) {
        console.warn(`Failed to load boundaries for ${city.name}:`, error);
        // В случае ошибки используем простую границу
        city.boundaries = createSimpleBoundary(city.latitude, city.longitude);
      }
    }

    // Сохраняем обновленные данные о городах
    await storage.updateCitiesData(cities);
    console.log('City boundaries loaded successfully');

    return cities;
  } catch (error) {
    console.error('Error loading city boundaries:', error);
    throw error;
  }
}

/**
 * Обновляет данные о границах городов
 */
export async function updateAllCityBoundaries(): Promise<any[]> {
  try {
    console.log('Starting update of all city boundaries...');
    // Получаем текущие данные о городах
    const cities = await storage.getCities();

    // Обновляем границы для каждого города
    for (const city of cities) {
      try {
        console.log(`Processing city: ${city.name}`);
        // Пытаемся получить реальные границы из OSM или из кэша
        const boundaries = await fetchCityBoundaries(city.name);

        if (boundaries.length > 0) {
          console.log(`Got boundaries for ${city.name} with ${boundaries.length} points`);
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

    return cities;
  } catch (error) {
    console.error('Error updating city boundaries:', error);
    throw error;
  }
}