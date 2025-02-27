
/**
 * Сервис для работы с данными OpenStreetMap и локальными JSON файлами городов
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
 * Проверяет существование файла границ города
 * @param cityName Название города
 * @returns true если файл существует, false в противном случае
 */
async function cityBoundaryFileExists(cityName: string): Promise<boolean> {
  try {
    const filePath = path.join(__dirname, '../data/city-boundaries', `${cityName}.json`);
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Получает границы города из локального JSON файла
 * @param cityName Название города
 * @returns Координаты границ города в формате многоугольника
 */
async function getBoundariesFromFile(cityName: string): Promise<number[][]> {
  try {
    const filePath = path.join(__dirname, '../data/city-boundaries', `${cityName}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading boundaries file for ${cityName}:`, error);
    return [];
  }
}

/**
 * Сохраняет границы города в локальный JSON файл
 * @param cityName Название города
 * @param boundaries Координаты границ города
 */
async function saveBoundariesToFile(cityName: string, boundaries: number[][]): Promise<void> {
  try {
    // Создаем директорию, если она не существует
    const dirPath = path.join(__dirname, '../data/city-boundaries');
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
      // Игнорируем ошибку, если директория уже существует
    }
    
    const filePath = path.join(dirPath, `${cityName}.json`);
    await fs.writeFile(filePath, JSON.stringify(boundaries, null, 2));
    console.log(`Saved boundaries for ${cityName} to file`);
  } catch (error) {
    console.error(`Error saving boundaries for ${cityName}:`, error);
  }
}

/**
 * Получает границы города из локального файла или из Overpass API
 * @param cityName Название города
 * @returns Координаты границ города в формате многоугольника
 */
export async function fetchCityBoundaries(cityName: string): Promise<number[][]> {
  try {
    // Сначала проверяем, есть ли файл с границами
    const fileExists = await cityBoundaryFileExists(cityName);
    
    if (fileExists) {
      console.log(`Loading boundaries for ${cityName} from file...`);
      const boundaries = await getBoundariesFromFile(cityName);
      if (boundaries.length > 0) {
        console.log(`Loaded boundaries for ${cityName} from file with ${boundaries.length} points`);
        return boundaries;
      }
    }
    
    // Если файла нет или он пустой, пробуем получить границы из API
    console.log(`No local data for ${cityName}, fetching from API...`);
    
    // Формируем запрос для получения границ города с геометрией
    const query = `
      [out:json];
      area["name"="${cityName}"]->.searchArea;
      (
        relation(area.searchArea)["boundary"="administrative"]["admin_level"~"8|9|6"];
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
    const boundaries = extractBoundaryCoordinates(data);
    
    // Сохраняем границы в файл для будущего использования
    if (boundaries.length > 0) {
      await saveBoundariesToFile(cityName, boundaries);
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
/**
 * Упрощает полигон, удаляя лишние точки для снижения размера данных
 * @param polygon Исходный полигон
 * @param tolerance Допустимое отклонение (больше значение - сильнее упрощение)
 * @returns Упрощенный полигон
 */
function simplifyPolygon(polygon: number[][], tolerance: number = 0.0001): number[][] {
  // Проверка на минимальное количество точек
  if (polygon.length <= 5) return polygon;
  
  // Алгоритм Рамера-Дугласа-Пекера для упрощения полигона
  function findPerpendicularDistance(point: number[], lineStart: number[], lineEnd: number[]): number {
    const [x, y] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;
    
    const area = Math.abs(0.5 * ((x1 * y2) - (x2 * y1) + (x2 * y) - (x * y2) + (x * y1) - (x1 * y)));
    const bottom = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    return area / bottom * 2;
  }
  
  function rdpRecursive(points: number[][], tolerance: number): number[][] {
    if (points.length <= 2) return points;
    
    let maxDistance = 0;
    let index = 0;
    
    for (let i = 1; i < points.length - 1; i++) {
      const distance = findPerpendicularDistance(points[i], points[0], points[points.length - 1]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    
    let result: number[][] = [];
    
    if (maxDistance > tolerance) {
      const part1 = rdpRecursive(points.slice(0, index + 1), tolerance);
      const part2 = rdpRecursive(points.slice(index), tolerance);
      
      // Объединяем части, избегая дублирования точек
      result = [...part1.slice(0, part1.length - 1), ...part2];
    } else {
      result = [points[0], points[points.length - 1]];
    }
    
    return result;
  }
  
  // Здесь мы гарантируем, что первая и последняя точки не изменяются
  const simplified = rdpRecursive(polygon, tolerance);
  
  // Убедимся, что полигон замкнут (первая и последняя точки совпадают)
  if (simplified[0][0] !== simplified[simplified.length - 1][0] || 
      simplified[0][1] !== simplified[simplified.length - 1][1]) {
    simplified.push([simplified[0][0], simplified[0][1]]);
  }
  
  return simplified;
}

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
      let polygon = allPoints.map(point => [point.lat, point.lon]);
      
      // Убедимся, что полигон замкнут
      if (polygon[0][0] !== polygon[polygon.length - 1][0] || 
          polygon[0][1] !== polygon[polygon.length - 1][1]) {
        polygon.push([polygon[0][0], polygon[0][1]]);
      }
      
      // Применяем упрощение если точек больше определенного количества
      // Адаптивное упрощение в зависимости от размера
      if (polygon.length > 1000) {
        console.log(`Упрощение большого полигона из ${polygon.length} точек`);
        polygon = simplifyPolygon(polygon, 0.0005); // Сильное упрощение для очень больших городов
        console.log(`После упрощения: ${polygon.length} точек`);
      } else if (polygon.length > 500) {
        console.log(`Упрощение среднего полигона из ${polygon.length} точек`);
        polygon = simplifyPolygon(polygon, 0.0003); // Среднее упрощение
        console.log(`После упрощения: ${polygon.length} точек`);
      } else if (polygon.length > 200) {
        console.log(`Упрощение малого полигона из ${polygon.length} точек`);
        polygon = simplifyPolygon(polygon, 0.0001); // Легкое упрощение
        console.log(`После упрощения: ${polygon.length} точек`);
      }
      
      return polygon;
    }
  }
  
  // Если не удалось собрать координаты из геометрии, попробуем другой подход
  // Для крупных городов можно использовать более грубый подход с прямоугольником
  if (boundaryRelation.tags && boundaryRelation.tags.name) {
    const cityName = boundaryRelation.tags.name;
    console.log(`Не удалось получить геометрию для ${cityName}, используем альтернативный подход`);
    
    // Найдем центральную точку города из данных
    const centerNode = data.elements.find(el => 
      el.type === 'node' && el.lat && el.lon && 
      el.tags && (el.tags.place === 'city' || el.tags.name === cityName)
    );
    
    if (centerNode && centerNode.lat && centerNode.lon) {
      // Создадим более крупный прямоугольник для известных больших городов
      const delta = (cityName === 'Москва' || cityName === 'Санкт-Петербург' || 
                     cityName === 'Екатеринбург') ? 0.15 : 0.05;
      
      return [
        [centerNode.lat - delta, centerNode.lon - delta],
        [centerNode.lat + delta, centerNode.lon - delta],
        [centerNode.lat + delta, centerNode.lon + delta],
        [centerNode.lat - delta, centerNode.lon + delta],
        [centerNode.lat - delta, centerNode.lon - delta] // замыкаем полигон
      ];
    }
  }
  
  // Если все подходы не сработали, возвращаем пустой массив
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
 * Обновляет данные о границах городов
 */
export async function updateAllCityBoundaries(): Promise<void> {
  try {
    console.log('Starting update of all city boundaries...');
    // Получаем текущие данные о городах
    const cities = await storage.getCities();
    let hasChanges = false;
    
    // Список крупных городов, которые могут требовать особой обработки
    const largeCities = ['Москва', 'Санкт-Петербург', 'Екатеринбург', 'Новосибирск', 'Казань'];
    
    // Обновляем границы для каждого города
    for (const city of cities) {
      try {
        // Принудительно обновляем границы крупных городов
        const isLargeCity = largeCities.includes(city.name);
        
        // Обычные города пропускаем, если у них уже есть границы
        if (!isLargeCity && city.boundaries && city.boundaries.length > 10) {
          console.log(`City ${city.name} already has boundaries with ${city.boundaries.length} points`);
          continue;
        }
        
        console.log(`Processing city: ${city.name}`);
        // Пытаемся получить реальные границы из OSM
        const boundaries = await fetchCityBoundaries(city.name);
        
        if (boundaries.length > 0) {
          console.log(`Got real boundaries for ${city.name} with ${boundaries.length} points`);
          // Обновляем границы города
          city.boundaries = boundaries;
          hasChanges = true;
        } else {
          console.log(`Using simple boundary for ${city.name}`);
          // Если не удалось получить границы, создаем простую границу
          city.boundaries = createSimpleBoundary(city.latitude, city.longitude);
          hasChanges = true;
        }
      } catch (error) {
        console.warn(`Failed to update boundaries for ${city.name}:`, error);
        // В случае ошибки используем простую границу
        city.boundaries = createSimpleBoundary(city.latitude, city.longitude);
        hasChanges = true;
      }
    }
    
    // Сохраняем обновленные данные о городах только если есть изменения
    if (hasChanges) {
      await storage.updateCitiesData(cities);
      console.log('City boundaries updated successfully');
    } else {
      console.log('No boundary updates needed');
    }
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
