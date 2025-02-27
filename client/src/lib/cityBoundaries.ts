
/**
 * Сервис для получения и обработки границ городов из OpenStreetMap через Overpass API
 */

// Функция для выполнения запроса к Overpass API
export async function fetchCityBoundaries(cityName: string): Promise<GeoJSON.FeatureCollection> {
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
      throw new Error(`Ошибка получения данных: ${response.statusText}`);
    }
    
    // Преобразуем ответ в JSON
    const data = await response.json();
    
    // Преобразуем данные Overpass в формат GeoJSON
    return convertOverpassToGeoJSON(data);
  } catch (error) {
    console.error('Ошибка при получении границ города:', error);
    throw error;
  }
}

// Функция для преобразования данных Overpass в формат GeoJSON
function convertOverpassToGeoJSON(overpassData: any): GeoJSON.FeatureCollection {
  // Создаем пустую GeoJSON коллекцию
  const geoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: []
  };
  
  // Проверяем наличие данных
  if (!overpassData.elements || overpassData.elements.length === 0) {
    return geoJSON;
  }
  
  // Ищем отношения (relation) с ролью "boundary"
  const boundaries = overpassData.elements.filter((el: any) => 
    el.type === 'relation' && 
    el.tags && 
    (el.tags.boundary === 'administrative' || el.tags.type === 'boundary')
  );
  
  // Извлекаем и обрабатываем данные о точках и путях
  const nodes: Record<string, [number, number]> = {};
  const ways: Record<string, number[][]> = {};
  
  // Сначала обрабатываем все узлы
  overpassData.elements.forEach((el: any) => {
    if (el.type === 'node' && el.lat && el.lon) {
      nodes[el.id] = [el.lat, el.lon];
    }
  });
  
  // Затем обрабатываем пути
  overpassData.elements.forEach((el: any) => {
    if (el.type === 'way' && el.nodes) {
      ways[el.id] = el.nodes.map((nodeId: number) => nodes[nodeId]).filter(Boolean);
    }
  });
  
  // Создаем GeoJSON объекты для каждой границы
  boundaries.forEach((boundary: any) => {
    if (!boundary.members) return;
    
    const coordinates: number[][][] = [];
    const outerRings: number[][] = [];
    
    // Строим внешние кольца из путей с ролью "outer"
    boundary.members
      .filter((member: any) => member.type === 'way' && member.role === 'outer')
      .forEach((member: any) => {
        if (ways[member.ref]) {
          outerRings.push(...ways[member.ref]);
        }
      });
    
    // Если есть внешние кольца, создаем полигон
    if (outerRings.length > 0) {
      coordinates.push(outerRings);
      
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

// Функция для получения упрощенных границ из имеющихся данных,
// если API недоступен или нет данных для города
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

// Функция для обновления границ в данных о городе
export async function updateCityBoundaries(cities: any[]): Promise<any[]> {
  // Создаем копию массива городов
  const updatedCities = [...cities];
  
  // Обновляем информацию о границах для каждого города
  for (const city of updatedCities) {
    try {
      // Пытаемся получить реальные границы из OSM
      const geoJSON = await fetchCityBoundaries(city.name);
      
      // Если получили данные и есть хотя бы один полигон
      if (geoJSON.features.length > 0 && 
          geoJSON.features[0].geometry.type === 'Polygon') {
        // Берем первый полигон и его внешнее кольцо
        const coordinates = geoJSON.features[0].geometry.coordinates[0];
        city.boundaries = coordinates;
      } else {
        // Если данных нет, создаем простую границу
        city.boundaries = getSimpleBoundary([city.latitude, city.longitude]);
      }
    } catch (error) {
      console.warn(`Не удалось получить границы для города ${city.name}:`, error);
      // В случае ошибки используем простую границу
      city.boundaries = getSimpleBoundary([city.latitude, city.longitude]);
    }
  }
  
  return updatedCities;
}
