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
    let boundaryCities = false;

    // Обновляем границы для каждого города
    for (const city of cities) {
      try {
        // Пропускаем города, у которых уже есть границы
        if (city.boundaries && city.boundaries.length > 10) {
          console.log(`City ${city.name} already has boundaries with ${city.boundaries.length} points`);
          boundaryCities = true;
          continue;
        }

        console.log(`Processing city: ${city.name}`);
        // Пытаемся получить реальные границы из OSM
        const boundaries = await fetchCityBoundaries(city.name);

        if (boundaries.length > 0) {
          console.log(`Got real boundaries for ${city.name} with ${boundaries.length} points`);
          // Обновляем границы города
          city.boundaries = boundaries;
          boundaryCities = true;
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

    // Сохраняем обновленные данные о городах только если есть изменения
    if (!boundaryCities) {
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

/**
 * Загружает данные о границах городов из файлов или создает простые границы
 * @returns Promise с массивом городов с загруженными границами
 */
export async function loadAllCityBoundaries(): Promise<any[]> {
  try {
    console.log('Loading all city boundaries...');
    // Получаем текущие данные о городах
    const cities = await storage.getCities();
    let updatedCities = false;

    // Загружаем границы для каждого города
    for (const city of cities) {
      try {
        // Проверяем, есть ли уже границы
        if (city.boundaries && city.boundaries.length > 0) {
          console.log(`City ${city.name} already has boundaries with ${city.boundaries.length} points`);
          continue;
        }

        console.log(`Loading boundaries for city: ${city.name}`);
        // Создаем простую границу - квадрат вокруг центра города
        city.boundaries = createSimpleBoundary(city.latitude, city.longitude);
        console.log(`Created simple boundary for ${city.name}`);
        updatedCities = true;
      } catch (error) {
        console.warn(`Failed to load boundaries for ${city.name}:`, error);
        // В случае ошибки используем простую границу, если её еще нет
        if (!city.boundaries || city.boundaries.length === 0) {
          city.boundaries = createSimpleBoundary(city.latitude, city.longitude);
          updatedCities = true;
        }
      }
    }

    // Сохраняем обновленные данные о городах только если были изменения
    if (updatedCities) {
      await storage.updateCitiesData(cities);
      console.log('City boundaries updated successfully');
    } else {
      console.log('No boundary updates needed');
    }

    return cities;
  } catch (error) {
    console.error('Error loading city boundaries:', error);
    throw error;
  }
}