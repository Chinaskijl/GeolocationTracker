
import { City, GameState, ArmyTransfer, CityRoute } from "../shared/schema";
import fs from 'fs/promises';
import path from 'path';
import { PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cities } from "../shared/schema";
import { cities as citiesTable } from '../shared/schema';
import { eq } from "drizzle-orm";

// Функция для генерации случайных границ города
function generateBoundaries(latitude: number, longitude: number, size: number = 0.3): [number, number][] {
  // Создаем более сложные и интересные границы, напоминающие реальные регионы
  const points = Math.floor(Math.random() * 4) + 5; // От 5 до 8 точек для границы
  const boundaries: [number, number][] = [];
  
  // Создаем иррегулярную форму с случайными отклонениями
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    // Варьируем размер для каждой точки, чтобы создать более естественную форму
    const currentSize = size * (0.7 + Math.random() * 0.6);
    const lat = latitude + currentSize * Math.sin(angle);
    const lng = longitude + currentSize * Math.cos(angle);
    boundaries.push([lat, lng]);
  }
  
  // Замыкаем многоугольник
  boundaries.push([boundaries[0][0], boundaries[0][1]]);
  
  return boundaries;
}

// Функция для расчета расстояния между городами
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

class Storage {
  private citiesPath = path.join(process.cwd(), 'data', 'cities.json');
  private gameStatePath = path.join(process.cwd(), 'data', 'game-state.json');
  private db: PostgresJsDatabase | null = null;
  
  // Хранение данных в памяти для случаев, когда БД недоступна
  private cities: City[] = [];
  private gameState: GameState = {
    resources: {
      gold: 0,
      wood: 0,
      food: 0,
      oil: 0,
      metal: 0,
      steel: 0,
      weapons: 0
    },
    population: 0,
    military: 0
  };
  private armyTransfers: ArmyTransfer[] = [];
  private cityRoutes: CityRoute[] = [];

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Убедимся, что папка data существует
      await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
      
      // Инициализируем файлы, если они не существуют
      try {
        await fs.access(this.citiesPath);
      } catch (e) {
        await this.createInitialData();
      }

      try {
        await fs.access(this.gameStatePath);
      } catch (e) {
        await this.saveGameState(this.gameState);
      }

      // Загружаем данные из файлов
      await this.loadCities();
      await this.loadGameState();

      // Обновляем маршруты и смежные города
      await this.setupCityRoutesAndAdjacency();
    } catch (error) {
      console.error('Error initializing storage:', error);
    }
  }

  private async setupCityRoutesAndAdjacency() {
    // Создаем связи между городами на основе расстояния
    const maxDistanceForAdjacency = 400; // км - максимальное расстояние для смежных городов
    
    // Очищаем существующие связи
    this.cities.forEach(city => {
      city.adjacentCities = [];
    });
    
    // Создаем маршруты и определяем смежные города
    for (let i = 0; i < this.cities.length; i++) {
      for (let j = i + 1; j < this.cities.length; j++) {
        const city1 = this.cities[i];
        const city2 = this.cities[j];
        
        const distance = calculateDistance(
          city1.latitude, city1.longitude,
          city2.latitude, city2.longitude
        );
        
        // Если города достаточно близко, считаем их смежными
        if (distance <= maxDistanceForAdjacency) {
          // Добавляем в список смежных городов, если их там еще нет
          if (!city1.adjacentCities.includes(city2.id)) {
            city1.adjacentCities.push(city2.id);
          }
          if (!city2.adjacentCities.includes(city1.id)) {
            city2.adjacentCities.push(city1.id);
          }
          
          // Создаем или обновляем маршрут между городами
          const travelTime = this.calculateTravelTime(distance);
          
          const existingRouteIndex = this.cityRoutes.findIndex(
            route => (route.fromCityId === city1.id && route.toCityId === city2.id) ||
                    (route.fromCityId === city2.id && route.toCityId === city1.id)
          );
          
          if (existingRouteIndex === -1) {
            this.cityRoutes.push({
              id: this.cityRoutes.length + 1,
              fromCityId: city1.id,
              toCityId: city2.id,
              distance,
              travelTime
            });
          } else {
            this.cityRoutes[existingRouteIndex].distance = distance;
            this.cityRoutes[existingRouteIndex].travelTime = travelTime;
          }
        }
      }
    }
    
    // Сохраняем обновленные города
    await this.saveCities();
  }

  private calculateTravelTime(distance: number): number {
    // Скорость перемещения: 100 км/ч для простоты расчетов
    const speed = 100; // км/ч
    // Время в миллисекундах для анимации
    // Минимум 5 секунд, максимум 30 секунд для игрового баланса
    return Math.min(Math.max(Math.round(distance / speed * 3600 * 1000), 5000), 30000);
  }

  async loadCities(): Promise<City[]> {
    try {
      const data = await fs.readFile(this.citiesPath, 'utf8');
      this.cities = JSON.parse(data);
      return this.cities;
    } catch (error) {
      console.error('Error loading cities:', error);
      return [];
    }
  }

  async saveCities(): Promise<void> {
    try {
      await fs.writeFile(this.citiesPath, JSON.stringify(this.cities, null, 2));
    } catch (error) {
      console.error('Error saving cities:', error);
    }
  }

  async loadGameState(): Promise<GameState> {
    try {
      const data = await fs.readFile(this.gameStatePath, 'utf8');
      this.gameState = JSON.parse(data);
      return this.gameState;
    } catch (error) {
      console.error('Error loading game state:', error);
      return this.gameState;
    }
  }

  async saveGameState(state: GameState): Promise<void> {
    try {
      this.gameState = state;
      await fs.writeFile(this.gameStatePath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Error saving game state:', error);
    }
  }

  async getCities(): Promise<City[]> {
    return this.cities;
  }

  async getCity(id: number): Promise<City | undefined> {
    return this.cities.find(city => city.id === id);
  }

  async updateCity(id: number, updates: Partial<City>): Promise<City> {
    const index = this.cities.findIndex(city => city.id === id);
    if (index === -1) {
      throw new Error(`City with id ${id} not found`);
    }

    // Обновляем город
    this.cities[index] = { ...this.cities[index], ...updates };
    
    // Сохраняем изменения
    await this.saveCities();
    
    return this.cities[index];
  }

  async getGameState(): Promise<GameState> {
    return this.gameState;
  }

  async setGameState(state: GameState): Promise<void> {
    await this.saveGameState(state);
  }

  // Методы для управления передвижением армий
  async getArmyTransfers() {
    return this.armyTransfers;
  }

  async addArmyTransfer(transfer: any) {
    this.armyTransfers.push(transfer);
    return transfer;
  }

  async removeArmyTransfer(id: number) {
    this.armyTransfers = this.armyTransfers.filter(t => t.id !== id);
    return true;
  }

  // Новые методы для работы с маршрутами
  async getCityRoutes(): Promise<CityRoute[]> {
    return this.cityRoutes;
  }

  async getCityRoute(fromCityId: number, toCityId: number): Promise<CityRoute | undefined> {
    return this.cityRoutes.find(
      route => (route.fromCityId === fromCityId && route.toCityId === toCityId) ||
              (route.fromCityId === toCityId && route.toCityId === fromCityId)
    );
  }

  async createArmyTransfer(transfer: Omit<ArmyTransfer, 'id'>): Promise<number> {
    const id = Date.now();
    this.armyTransfers.push({ ...transfer, id });
    return id;
  }

  // Функция для определения, граничат ли два города
  areCitiesAdjacent(city1: City, city2: City): boolean {
    return city1.adjacentCities.includes(city2.id) || city2.adjacentCities.includes(city1.id);
  }

  // Создание начальных данных
  private async createInitialData() {
    await this.createInitialCities();
    
    // Создаем начальное состояние игры
    console.log("Creating initial game state...");
    await this.saveGameState({
      resources: {
        gold: 500,
        wood: 500,
        food: 500,
        oil: 500,
        metal: 0,
        steel: 0,
        weapons: 0
      },
      population: 0,
      military: 0
    });
  }

  // Функция для создания начальных городов
  private async createInitialCities() {
    // Крупные города
    const initialCities: City[] = [
      {
        id: 1,
        name: "Москва",
        latitude: 55.7558,
        longitude: 37.6173,
        population: 0,
        maxPopulation: 150000,
        resources: { food: 10, gold: 8 },
        boundaries: [
          [55.8, 37.5],
          [55.9, 37.7],
          [55.7, 37.8],
          [55.6, 37.6],
          [55.8, 37.5]
        ],
        owner: "player",
        buildings: [],
        military: 0,
        adjacentCities: [6, 7, 8]
      },
      {
        id: 2,
        name: "Санкт-Петербург",
        latitude: 59.9343,
        longitude: 30.3351,
        population: 0,
        maxPopulation: 100000,
        resources: { food: 8, oil: 3 },
        boundaries: [
          [60.0, 30.2],
          [60.1, 30.4],
          [59.9, 30.5],
          [59.8, 30.3],
          [60.0, 30.2]
        ],
        owner: "neutral",
        buildings: [],
        military: 0,
        adjacentCities: [8]
      },
      {
        id: 3,
        name: "Новосибирск",
        latitude: 55.0084,
        longitude: 82.9357,
        population: 0,
        maxPopulation: 80000,
        resources: { gold: 7, wood: 5 },
        boundaries: [
          [55.1, 82.8],
          [55.2, 83.0],
          [55.0, 83.1],
          [54.9, 82.9],
          [55.1, 82.8]
        ],
        owner: "neutral",
        buildings: [],
        military: 0,
        adjacentCities: [4]
      },
      {
        id: 4,
        name: "Екатеринбург",
        latitude: 56.8389,
        longitude: 60.6057,
        population: 0,
        maxPopulation: 70000,
        resources: { oil: 6, gold: 4 },
        boundaries: generateBoundaries(56.8389, 60.6057, 0.2),
        owner: "neutral",
        buildings: [],
        military: 0,
        adjacentCities: [3, 5]
      },
      {
        id: 5,
        name: "Казань",
        latitude: 55.7887,
        longitude: 49.1221,
        population: 0,
        maxPopulation: 65000,
        resources: { wood: 8, food: 5 },
        boundaries: generateBoundaries(55.7887, 49.1221, 0.2),
        owner: "neutral",
        buildings: [],
        military: 0,
        adjacentCities: [4, 9]
      },
      // Маленькие города
      {
        id: 6,
        name: "Владимир",
        latitude: 56.1290,
        longitude: 40.4056,
        population: 0,
        maxPopulation: 2000,
        resources: { wood: 4, food: 2 },
        boundaries: generateBoundaries(56.1290, 40.4056, 0.1),
        owner: "neutral",
        buildings: [],
        military: 0,
        adjacentCities: [1, 7, 9]
      },
      {
        id: 7,
        name: "Суздаль",
        latitude: 56.4279,
        longitude: 40.4493,
        population: 0,
        maxPopulation: 1500,
        resources: { food: 3, gold: 1 },
        boundaries: generateBoundaries(56.4279, 40.4493, 0.1),
        owner: "neutral",
        buildings: [],
        military: 0,
        adjacentCities: [1, 6, 8]
      },
      {
        id: 8,
        name: "Ярославль",
        latitude: 57.6222,
        longitude: 39.8966,
        population: 0,
        maxPopulation: 30000,
        resources: { food: 5, wood: 6 },
        boundaries: generateBoundaries(57.6222, 39.8966, 0.15),
        owner: "neutral",
        buildings: [],
        military: 0,
        adjacentCities: [1, 2, 7]
      },
      {
        id: 9,
        name: "Нижний Новгород",
        latitude: 56.3240,
        longitude: 44.0000,
        population: 0,
        maxPopulation: 40000,
        resources: { gold: 5, oil: 4 },
        boundaries: generateBoundaries(56.3240, 44.0000, 0.15),
        owner: "neutral",
        buildings: [],
        military: 0,
        adjacentCities: [5, 6]
      }
    ];

    this.cities = initialCities;
    await this.saveCities();
  }
}

export const storage = new Storage();
