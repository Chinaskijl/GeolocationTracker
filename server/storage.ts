import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Region, GameState } from "../shared/schema";

// Получаем __dirname в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к файлам хранилища
const REGIONS_FILE = path.join(__dirname, "../data/regions.json");
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

    // Обновляем границы городов при инициализации
    const { updateAllRegionBoundaries } = await import('./osmService');
    await updateAllRegionBoundaries();

    console.log("Database initialization completed successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Функция для инициализации данных игры
async function initializeGameData() {
  await ensureDataDir();

  // Проверяем наличие областей
  let existingRegions: Region[] = [];
  try {
    const regionsData = await fs.readFile(REGIONS_FILE, 'utf8');
    existingRegions = JSON.parse(regionsData);
    console.log(`Загружены существующие области: ${existingRegions.length}`);
  } catch (error) {
    // Файл не существует или другая ошибка при чтении
    console.log("Regions file not found, will create initial regions");
  }

  // Создаем начальные области в любом случае, так как они пропали
  console.log("Creating initial regions...");
  await createInitialRegions();

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

// Функция для создания начальных областей
async function createInitialRegions() {
  // Крупные города
  const initialRegions: Region[] = [
    {
      id: 1,
      name: "Московская область",
      latitude: 55.7558,
      longitude: 37.6173,
      population: 0,
      maxPopulation: 150000,
      resources: { food: 10, gold: 8 },
      boundaries: [[55.8, 37.5], [55.9, 37.7], [55.7, 37.8], [55.6, 37.6], [55.8, 37.5]],
      owner: "neutral",
      buildings: [],
      military: 0
    },
    {
      id: 2,
      name: "Ленинградская область",
      latitude: 59.9343,
      longitude: 30.3351,
      population: 0, // Население нейтральных городов равно 0
      maxPopulation: 100000,
      resources: { food: 8, oil: 3 },
      boundaries: [[60.0, 30.2], [60.1, 30.4], [59.9, 30.5], [59.8, 30.3], [60.0, 30.2]],
      owner: "neutral",
      buildings: [],
      military: 0
    },
    {
      id: 3,
      name: "Новосибирская область",
      latitude: 55.0084,
      longitude: 82.9357,
      population: 0, // Население нейтральных городов равно 0
      maxPopulation: 80000,
      resources: { gold: 7, wood: 5 },
      boundaries: [[55.1, 82.8], [55.2, 83.0], [55.0, 83.1], [54.9, 82.9], [55.1, 82.8]],
      owner: "neutral",
      buildings: [],
      military: 0
    },
    {
      id: 4,
      name: "Свердловская область",
      latitude: 56.8389,
      longitude: 60.6057,
      population: 0,
      maxPopulation: 70000,
      resources: { oil: 6, gold: 4 },
      boundaries: generateBoundaries(56.8389, 60.6057),
      owner: "neutral",
      buildings: [],
      military: 0
    },
    {
      id: 5,
      name: "Республика Татарстан",
      latitude: 55.7887,
      longitude: 49.1221,
      population: 0,
      maxPopulation: 65000,
      resources: { wood: 8, food: 5 },
      boundaries: generateBoundaries(55.7887, 49.1221),
      owner: "neutral",
      buildings: [],
      military: 0
    },
    // Маленькие города
    {
      id: 6,
      name: "Владимирская область",
      latitude: 56.1290,
      longitude: 40.4056,
      population: 0,
      maxPopulation: 2000,
      resources: { wood: 4, food: 2 },
      boundaries: generateBoundaries(56.1290, 40.4056),
      owner: "neutral",
      buildings: [],
      military: 0
    },
    {
      id: 7,
      name: "Владимирская область",
      latitude: 56.4279,
      longitude: 40.4493,
      population: 0,
      maxPopulation: 1500,
      resources: { food: 3, gold: 1 },
      boundaries: generateBoundaries(56.4279, 40.4493),
      owner: "neutral",
      buildings: [],
      military: 0
    }
  ];

  await saveRegions(initialRegions);
}

// Сохранение областей в файл
async function saveRegions(regionsData: Region[]) {
  try {
    await fs.writeFile(REGIONS_FILE, JSON.stringify(regionsData, null, 2));
  } catch (error) {
    console.error("Error saving regions:", error);
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
  private regions: Region[] = [];
  private armyTransfers: any[] = []; // Массив для отслеживания передвижений армий
  private regionsLoaded = false;

  // Загрузка областей из файла
  private async loadRegions() {
    if (this.regionsLoaded) return;

    try {
      const regionsData = await fs.readFile(REGIONS_FILE, 'utf8');
      this.regions = JSON.parse(regionsData);
      this.regionsLoaded = true;
    } catch (error) {
      console.error("Error loading regions:", error);
      this.regions = [];
    }
  }

  async getRegions() {
    await this.loadRegions();
    return [...this.regions]; // Возвращаем копию массива областей
  }

  async updateRegion(id: number, data: any) {
    await this.loadRegions();

    const regionIndex = this.regions.findIndex(region => region.id === id);
    if (regionIndex === -1) {
      throw new Error(`Region with id ${id} not found`);
    }

    // Обновляем область
    const updatedRegion = { ...this.regions[regionIndex], ...data };
    this.regions[regionIndex] = updatedRegion;

    // Сохраняем обновленные области
    await saveRegions(this.regions);

    return updatedRegion;
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

  // Для обратной совместимости добавим алиасы методов
  async getCities() {
    return this.getRegions();
  }

  async updateCitiesData(regions: Region[]) {
    return this.updateRegionsData(regions);
  }

  async updateCity(regionId: number, updates: Partial<Region>) {
    return this.updateRegion(regionId, updates);
  }

  async updateRegionsData(regions: Region[]) {
    try {
      await fs.writeFile(REGIONS_FILE, JSON.stringify(regions, null, 2));
      return true;
    } catch (error) {
      console.error("Error writing regions:", error);
      return false;
    }
  }
}

export const storage = new Storage();

function generateBoundaries(latitude: number, longitude: number): number[][] {
  const offset = 0.1;
  return [
    [latitude - offset, longitude - offset],
    [latitude + offset, longitude - offset],
    [latitude + offset, longitude + offset],
    [latitude - offset, longitude + offset],
    [latitude - offset, longitude - offset]
  ];
}