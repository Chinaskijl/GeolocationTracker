
/**
 * Модуль для работы с OpenStreetMap и Overpass API
 * Позволяет получать реальные границы городов и других объектов
 */

/**
 * Запрашивает границы города из Overpass API
 * @param cityName - Название города
 * @param country - Код страны (опционально)
 * @returns Promise с координатами границы города
 */
export async function fetchCityBoundaries(cityName: string, country: string = 'ru'): Promise<[number, number][]> {
  try {
    // Формируем запрос к Overpass API для получения границы города
    const query = `
      [out:json];
      area["ISO3166-1"="${country}"][admin_level=2];
      node["place"="city"]["name"="${cityName}"](area);
      out body;
      rel(around:100)["boundary"="administrative"]["admin_level"="8"];
      out geom;
    `;

    // Кодируем запрос для URL
    const encodedQuery = encodeURIComponent(query);
    const apiUrl = `https://overpass-api.de/api/interpreter?data=${encodedQuery}`;

    // Выполняем запрос
    const response = await fetch(apiUrl);
    const data = await response.json();

    // Обрабатываем ответ
    if (data.elements && data.elements.length > 0) {
      // Ищем релейшен с границей города
      const cityBoundary = data.elements.find((element: any) => 
        element.type === 'relation' && element.tags && 
        element.tags.boundary === 'administrative'
      );

      if (cityBoundary && cityBoundary.members) {
        // Ищем внешнюю границу (outer way)
        const outerWay = cityBoundary.members.find((member: any) => 
          member.role === 'outer' && member.geometry
        );

        if (outerWay && outerWay.geometry) {
          // Преобразуем геометрию в массив координат [lat, lon]
          return outerWay.geometry.map((node: any) => [node.lat, node.lon]);
        }
      }
    }

    // Если не удалось получить границы из API, возвращаем примерные границы
    console.warn(`Не удалось получить границы для города ${cityName}, используем приблизительные`);
    return generateApproximateBoundary(cityName);
  } catch (error) {
    console.error(`Ошибка при получении границ города ${cityName}:`, error);
    return generateApproximateBoundary(cityName);
  }
}

/**
 * Генерирует примерную границу города в виде более сложной фигуры (не прямоугольник)
 * @param cityName - Название города для поиска в предустановленной конфигурации
 * @returns Массив координат границы города
 */
function generateApproximateBoundary(cityName: string): [number, number][] {
  // Получаем базовые координаты города из предустановленных данных
  const cityData = getCityBaseCoordinates(cityName);
  
  if (!cityData) {
    console.error(`Нет базовых координат для города ${cityName}`);
    return [[0, 0]]; // Возвращаем пустую границу
  }
  
  const { lat, lon, radius } = cityData;
  
  // Генерируем более естественную форму границы с неравномерным радиусом
  const numPoints = 15; // Больше точек для более детальной границы
  const coordinates: [number, number][] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    
    // Добавляем случайность к радиусу для создания неровной границы
    const variationFactor = 0.7 + Math.random() * 0.6; // от 70% до 130% базового радиуса
    const pointRadius = radius * variationFactor;
    
    // Рассчитываем координаты
    const pointLat = lat + Math.sin(angle) * pointRadius;
    const pointLon = lon + Math.cos(angle) * pointRadius / Math.cos(lat * Math.PI / 180);
    
    coordinates.push([pointLat, pointLon]);
  }
  
  // Замыкаем полигон
  coordinates.push(coordinates[0]);
  
  return coordinates;
}

/**
 * Хранит базовые координаты городов для генерации приблизительных границ
 * @param cityName - Название города
 * @returns Базовые координаты и радиус для города
 */
function getCityBaseCoordinates(cityName: string): { lat: number; lon: number; radius: number } | null {
  const cities: Record<string, { lat: number; lon: number; radius: number }> = {
    'Москва': { lat: 55.7558, lon: 37.6173, radius: 0.15 },
    'Санкт-Петербург': { lat: 59.9343, lon: 30.3351, radius: 0.12 },
    'Новосибирск': { lat: 55.0084, lon: 82.9357, radius: 0.08 },
    'Екатеринбург': { lat: 56.8389, lon: 60.6057, radius: 0.07 },
    'Казань': { lat: 55.7887, lon: 49.1221, radius: 0.06 },
    'Владимир': { lat: 56.1290, lon: 40.4056, radius: 0.03 },
    'Суздаль': { lat: 56.4279, lon: 40.4493, radius: 0.02 },
    'Нижний Новгород': { lat: 56.3269, lon: 44.0059, radius: 0.05 },
    'Ростов-на-Дону': { lat: 47.2357, lon: 39.7015, radius: 0.04 },
    'Красноярск': { lat: 56.0153, lon: 92.8932, radius: 0.04 }
  };

  return cities[cityName] || null;
}

/**
 * Создает соединения между соседними городами
 * @param cities - Массив городов
 * @returns Массив пар ID городов, которые должны быть соединены
 */
export function createCityConnections(cities: any[]): [number, number][] {
  const connections: [number, number][] = [];
  
  // Создаем матрицу расстояний между городами
  const distanceMatrix: { from: number; to: number; distance: number }[] = [];
  
  // Рассчитываем расстояния между всеми парами городов
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const distance = calculateDistance(
        cities[i].latitude, cities[i].longitude,
        cities[j].latitude, cities[j].longitude
      );
      
      distanceMatrix.push({
        from: cities[i].id,
        to: cities[j].id,
        distance
      });
    }
  }
  
  // Сортируем по возрастанию расстояния
  distanceMatrix.sort((a, b) => a.distance - b.distance);
  
  // Алгоритм для создания соединений между ближайшими городами
  // Убеждаемся, что каждый город имеет хотя бы 2 соединения
  const cityConnections: Record<number, number[]> = {};
  cities.forEach(city => {
    cityConnections[city.id] = [];
  });
  
  // Добавляем соединения, начиная с наименьших расстояний
  for (const conn of distanceMatrix) {
    // Если у обоих городов уже достаточно соединений (например, 3), пропускаем
    if (cityConnections[conn.from].length >= 3 && cityConnections[conn.to].length >= 3) {
      continue;
    }
    
    // Добавляем соединение
    connections.push([conn.from, conn.to]);
    cityConnections[conn.from].push(conn.to);
    cityConnections[conn.to].push(conn.from);
  }
  
  return connections;
}

/**
 * Рассчитывает расстояние между двумя точками по формуле гаверсинуса
 * @returns Расстояние в километрах
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
