import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { cities } from "../shared/schema";
import type { City, GameState } from "../shared/schema";

// Получаем __dirname в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к файлам хранилища
const CITIES_FILE = path.join(__dirname, "../data/cities.json");
const GAME_STATE_FILE = path.join(__dirname, "../data/game-state.json");

// Создаем директорию для данных, если ее нет
async function ensureDataDir() {
  const dataDir = path.join(__dirname, "../data");
  try {
    await fs.mkdir(dataDir, { recursive: true });
    console.log(`Создана директория для данных: ${dataDir}`);
  } catch (err) {
    console.error("Error creating data directory:", err);
  }
}

// Инициализация базы данных
export async function initDb() {
  try {
    await ensureDataDir();

    // Проверка и создание начальных данных
    await initializeGameData();
    console.log("Database initialization completed successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Функция для инициализации данных игры
async function initializeGameData() {
  await ensureDataDir();

  // Проверяем наличие городов
  let existingCities: City[] = [];
  try {
    const citiesData = await fs.readFile(CITIES_FILE, 'utf8');
    existingCities = JSON.parse(citiesData);
    console.log(`Загружены существующие города: ${existingCities.length}`);
  } catch (error) {
    // Файл не существует или другая ошибка при чтении
    console.log("Cities file not found, will create initial cities");
  }

  // Создаем начальные города в любом случае, так как они пропали
  console.log("Creating initial cities...");
  await createInitialCities();

  // Создаем начальное состояние игры
  console.log("Creating initial game state...");
  await saveGameState({
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
async function createInitialCities() {
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
      boundaries: [[55.8, 37.5], [55.9, 37.7], [55.7, 37.8], [55.6, 37.6], [55.8, 37.5]],
      owner: "neutral",
      buildings: [],
      military: 0,
      adjacentCities: []
    },
    {
      id: 2,
      name: "Санкт-Петербург",
      latitude: 59.9343,
      longitude: 30.3351,
      population: 0, // Население нейтральных городов равно 0
      maxPopulation: 100000,
      resources: { food: 8, oil: 3 },
      boundaries: [[60.0, 30.2], [60.1, 30.4], [59.9, 30.5], [59.8, 30.3], [60.0, 30.2]],
      owner: "neutral",
      buildings: [],
      military: 0,
      adjacentCities: []
    },
    {
      id: 3,
      name: "Новосибирск",
      latitude: 55.0084,
      longitude: 82.9357,
      population: 0, // Население нейтральных городов равно 0
      maxPopulation: 80000,
      resources: { gold: 7, wood: 5 },
      boundaries: [[55.1, 82.8], [55.2, 83.0], [55.0, 83.1], [54.9, 82.9], [55.1, 82.8]],
      owner: "neutral",
      buildings: [],
      military: 0,
      adjacentCities: []
    },
    {
      id: 4,
      name: "Екатеринбург",
      latitude: 56.8389,
      longitude: 60.6057,
      population: 0,
      maxPopulation: 70000,
      resources: { oil: 6, gold: 4 },
      boundaries: generateBoundaries(56.8389, 60.6057),
      owner: "neutral",
      buildings: [],
      military: 0,
      adjacentCities: []
    },
    {
      id: 5,
      name: "Казань",
      latitude: 55.7887,
      longitude: 49.1221,
      population: 0,
      maxPopulation: 65000,
      resources: { wood: 8, food: 5 },
      boundaries: generateBoundaries(55.7887, 49.1221),
      owner: "neutral",
      buildings: [],
      military: 0,
      adjacentCities: []
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
      boundaries: generateBoundaries(56.1290, 40.4056),
      owner: "neutral",
      buildings: [],
      military: 0,
      adjacentCities: []
    },
    {
      id: 7,
      name: "Суздаль",
      latitude: 56.4279,
      longitude: 40.4493,
      population: 0,
      maxPopulation: 1500,
      resources: { food: 3, gold: 1 },
      boundaries: generateBoundaries(56.4279, 40.4493),
      owner: "neutral",
      buildings: [],
      military: 0,
      adjacentCities: []
    },
    {
      id: 8,
      name: "Ярославль",
      latitude: 57.6222,
      longitude: 39.8966,
      population: 0,
      maxPopulation: 30000,
      resources: { food: 5, wood: 6 },
      boundaries: generateBoundaries(57.6222, 39.8966),
      owner: "neutral",
      buildings: [],
      military: 0,
      adjacentCities: []
    },
    {
      id: 9,
      name: "Нижний Новгород",
      latitude: 56.3240,
      longitude: 44.0000,
      population: 0,
      maxPopulation: 40000,
      resources: { gold: 5, oil: 4 },
      boundaries: generateBoundaries(56.3240, 44.0000),
      owner: "neutral",
      buildings: [],
      military: 0,
      adjacentCities: []
    }
  ];

  await saveCities(initialCities);
}

// Сохранение городов в файл
async function saveCities(citiesData: City[]) {
  try {
    await fs.writeFile(CITIES_FILE, JSON.stringify(citiesData, null, 2));
  } catch (error) {
    console.error("Error saving cities:", error);
    throw error;
  }
}

// Сохранение состояния игры в файл
async function saveGameState(gameState: GameState) {
  try {
    await fs.writeFile(GAME_STATE_FILE, JSON.stringify(gameState, null, 2));
  } catch (error) {
    console.error("Error saving game state:", error);
    throw error;
  }
}

// Хранилище для данных игры
class Storage {
  private gameState: GameState | null = null;
  private cities: City[] = [];
  private armyTransfers: any[] = []; // Массив для отслеживания передвижений армий
  private citiesLoaded = false;

  // Загрузка городов из файла
  private async loadCities() {
    if (this.citiesLoaded) return;

    try {
      const citiesData = await fs.readFile(CITIES_FILE, 'utf8');
      this.cities = JSON.parse(citiesData);
      this.citiesLoaded = true;
    } catch (error) {
      console.error("Error loading cities:", error);
      this.cities = [];
    }
  }

  async getCities() {
    await this.loadCities();
    return [...this.cities]; // Возвращаем копию массива городов
  }

  async updateCity(id: number, data: any) {
    await this.loadCities();

    const cityIndex = this.cities.findIndex(city => city.id === id);
    if (cityIndex === -1) {
      throw new Error(`City with id ${id} not found`);
    }

    // Обновляем город
    const updatedCity = { ...this.cities[cityIndex], ...data };
    this.cities[cityIndex] = updatedCity;

    // Сохраняем обновленные города
    await saveCities(this.cities);

    return updatedCity;
  }

  async getGameState() {
    if (this.gameState) return this.gameState;

    try {
      const gameStateData = await fs.readFile(GAME_STATE_FILE, 'utf8');
      this.gameState = JSON.parse(gameStateData);
    } catch (error) {
      console.error("Error reading game state:", error);
      this.gameState = {
        resources: {
          gold: 500,
          wood: 200,
          food: 300,
          oil: 100,
          metal: 0,
          steel: 0,
          weapons: 0
        },
        population: 100,
        military: 0
      };
    }

    return this.gameState;
  }

  async setGameState(state: GameState) {
    this.gameState = state;
    await saveGameState(state);
    return this.gameState;
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

  // Функция для определения, граничат ли два города
  areCitiesAdjacent(city1: City, city2: City): boolean {
    const distance = calculateDistance(city1.latitude, city1.longitude, city2.latitude, city2.longitude);
    //  Простая проверка на основе расстояния.  Можно сделать более сложную логику, используя границы городов.
    return distance < 0.5;
  }
}

export const storage = new Storage();

function generateBoundaries(latitude: number, longitude: number): number[][] {
  const offset = 0.1 + Math.random() * 0.1; // Add some randomness to boundary size
  return [
    [latitude - offset, longitude - offset],
    [latitude + offset, longitude - offset],
    [latitude + offset, longitude + offset],
    [latitude - offset, longitude + offset],
    [latitude - offset, longitude - offset]
  ];
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);  // deg2rad below
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}