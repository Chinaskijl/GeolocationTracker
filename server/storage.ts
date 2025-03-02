import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { BUILDINGS } from '../client/src/lib/game';
import type { Region } from '../shared/regionTypes';

// Получаем эквивалент __dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Пути к файлам данных
const INFO_FILE = path.join(__dirname, "../data/info.json");
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

    // Всегда сбрасываем данные при перезапуске игры
    console.log("Resetting game data...");
    await resetGameData();

    // Обновляем границы областей при каждой инициализации сервера
    const { updateAllRegionBoundaries } = await import('./osmService');
    await updateAllRegionBoundaries();

    console.log("Database initialization completed successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Функция для генерации случайных доступных зданий и их лимитов
function generateRandomAvailableBuildings() {
  // Список всех возможных зданий
  const allBuildings = [
    'farm', 'logging_camp', 'gold_mine', 'oil_rig', 'metal_mine', 
    'house', 'barracks', 'market', 'research_center'
  ];

  // Выбираем случайное количество зданий (от 4 до 7)
  const buildingCount = Math.floor(Math.random() * 4) + 4;

  // Обязательные здания
  const mandatoryBuildings = ['house', 'farm'];
  const availableBuildings = [...mandatoryBuildings];

  // Копируем и перемешиваем массив остальных зданий
  const optionalBuildings = allBuildings
    .filter(b => !mandatoryBuildings.includes(b))
    .sort(() => Math.random() - 0.5);

  // Добавляем случайные здания до нужного количества
  for (let i = 0; i < buildingCount - mandatoryBuildings.length && i < optionalBuildings.length; i++) {
    availableBuildings.push(optionalBuildings[i]);
  }

  return availableBuildings;
}

// Функция для генерации случайных лимитов зданий
function generateRandomBuildingLimits(availableBuildings: string[]) {
  const limits: Record<string, number> = {};
  
  // Установка лимитов для каждого доступного здания
  availableBuildings.forEach(buildingId => {
    // Генерируем случайный лимит от 1 до 5
    limits[buildingId] = Math.floor(Math.random() * 5) + 1;
  });
  
  return limits;
}

// Функция для генерации случайного населения
function generateRandomPopulation(isLarge: boolean) {
  if (isLarge) {
    // Для больших областей: 5000-10000
    return Math.floor(Math.random() * 5001) + 5000;
  } else {
    // Для малых областей: 1000-5000
    return Math.floor(Math.random() * 4001) + 1000;
  }
}

// Функция для генерации случайного числа военных
function generateRandomMilitary(population: number) {
  // Военные составляют от 5% до 15% от населения
  return Math.floor(population * (Math.random() * 0.1 + 0.05));
}

// Функция для сброса данных игры
async function resetGameData() {
  await ensureDataDir();

  // Создаем начальные параметры для игры
  const initialGameState: GameState = {
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
  };

  // Сохраняем начальное состояние
  await writeDataFile('game-state.json', initialGameState);

  // Проверяем, существуют ли уже регионы в info.json
  const infoData = await readDataFile('info.json');

  if (infoData && Array.isArray(infoData) && infoData.length > 0) {
    // Обновляем данные для всех регионов с рандомными значениями
    const resetRegions = infoData.map(region => {
      // Определяем, является ли область "большой"
      const isLargeRegion = region.id <= 2; // Московская и Ленинградская считаются большими

      // Генерируем случайное население
      const population = generateRandomPopulation(isLargeRegion);

      // Генерируем случайное количество военных
      const military = generateRandomMilitary(population);

      // Обновляем максимальное население в зависимости от текущего
      const maxPopulation = Math.floor(population * (Math.random() * 0.3 + 1.1)); // На 10-40% больше текущего

      const availableBuildings = generateRandomAvailableBuildings();
      const buildingLimits = generateRandomBuildingLimits(availableBuildings);
      
      return {
        ...region,
        population,
        maxPopulation,
        military,
        owner: 'neutral',
        buildings: [],
        availableBuildings,
        buildingLimits
      };
    });

    // Заполняем военными на основе сгенерированного населения для не-нейтральных областей
    resetRegions.forEach(region => {
      if (region.owner === 'neutral') {
        region.population = 0;
        region.military = 0;
      } else {
        region.military = generateRandomMilitary(region.population);
      }
    });

    await writeDataFile('info.json', resetRegions);
  } else {
    // Если данных нет, создаем начальные
    console.log("Creating initial info data...");

    // Базовые параметры для областей
    const regions = [
      {
        id: 1,
        name: "Московская область",
        latitude: 55.7558,
        longitude: 37.6173,
        population: generateRandomPopulation(true),
        maxPopulation: 10000,
        military: 0, // будет заполнено после генерации населения
        resources: { food: 10, gold: 8, wood: 5, oil: 2 },
        availableBuildings: ((availableBuildings) => {
          const buildings = availableBuildings || generateRandomAvailableBuildings();
          const limits = generateRandomBuildingLimits(buildings);
          region.buildingLimits = limits;
          return buildings;
        })(generateRandomAvailableBuildings()),
        owner: "neutral",
        buildings: [],
        buildingLimits: {} // Это будет заполнено в функции выше
      },
      {
        id: 2,
        name: "Ленинградская область",
        latitude: 59.9343,
        longitude: 30.3351,
        population: generateRandomPopulation(true),
        maxPopulation: 10000,
        military: 0,
        resources: { food: 8, oil: 5, wood: 7, gold: 3 },
        availableBuildings: generateRandomAvailableBuildings(),
        owner: "neutral",
        buildings: []
      },
      {
        id: 3,
        name: "Новосибирская область",
        latitude: 55.0084,
        longitude: 82.9357,
        population: generateRandomPopulation(false),
        maxPopulation: 5000,
        military: 0,
        resources: { gold: 7, wood: 5, food: 3, metal: 4 },
        availableBuildings: generateRandomAvailableBuildings(),
        owner: "neutral",
        buildings: []
      },
      {
        id: 4,
        name: "Свердловская область",
        latitude: 56.8389,
        longitude: 60.6057,
        population: generateRandomPopulation(false),
        maxPopulation: 6000,
        military: 0,
        resources: { metal: 12, wood: 6, gold: 4, food: 2 },
        availableBuildings: generateRandomAvailableBuildings(),
        owner: "neutral",
        buildings: []
      },
      {
        id: 5,
        name: "Нижегородская область",
        latitude: 56.2965,
        longitude: 43.9361,
        population: generateRandomPopulation(false),
        maxPopulation: 5000,
        military: 0,
        resources: { wood: 8, food: 5, gold: 3, oil: 2 },
        availableBuildings: generateRandomAvailableBuildings(),
        owner: "neutral",
        buildings: []
      }
    ];

    // Заполняем военными на основе сгенерированного населения для не-нейтральных областей
    regions.forEach(region => {
      if (region.owner === 'neutral') {
        region.population = 0;
        region.military = 0;
      } else {
        region.military = generateRandomMilitary(region.population);
      }
    });

    await writeDataFile('info.json', regions);
  }
}

// Функция для сброса данных игры (старая функция, оставлена для обратной совместимости)
async function resetGameDataOld() {
  await ensureDataDir();

  // Создаем области с начальными параметрами
  const defaultRegions = [
    {
      id: 1,
      name: "Московская область",
      latitude: 55.7558,
      longitude: 37.6173,
      population: 0,
      maxPopulation: 150000,
      resources: { food: 10, gold: 8 },
      boundaries: [],
      owner: "neutral",
      buildings: [],
      military: 0
    },
    {
      id: 2,
      name: "Ленинградская область",
      latitude: 59.9343,
      longitude: 30.3351,
      population: 0,
      maxPopulation: 100000,
      resources: { food: 8, oil: 3 },
      boundaries: [],
      owner: "neutral",
      buildings: [],
      military: 0
    },
    {
      id: 3,
      name: "Новосибирская область",
      latitude: 55.0084,
      longitude: 82.9357,
      population: 0,
      maxPopulation: 80000,
      resources: { gold: 7, wood: 5 },
      boundaries: [],
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
      maxPopulation: 90000,
      resources: { metal: 12, wood: 3 },
      boundaries: [],
      owner: "neutral",
      buildings: [],
      military: 0
    },
    {
      id: 5,
      name: "Нижегородская область",
      latitude: 56.2965,
      longitude: 43.9361,
      population: 0,
      maxPopulation: 85000,
      resources: { wood: 8, food: 5 },
      boundaries: [],
      owner: "neutral",
      buildings: [],
      military: 0
    }
  ];

  // Сохраняем границы из существующего файла, если он есть
  try {
    const regionsData = await fs.readFile(REGIONS_FILE, 'utf8');
    const existingRegions = JSON.parse(regionsData);

    // Копируем только границы из существующих областей
    for (let i = 0; i < defaultRegions.length; i++) {
      const existingRegion = existingRegions.find(r => r.id === defaultRegions[i].id);
      if (existingRegion && existingRegion.boundaries) {
        defaultRegions[i].boundaries = existingRegion.boundaries;
      }
    }
  } catch (error) {
    console.log("Could not read existing regions file");
  }

  // Записываем начальные области
  await fs.writeFile(REGIONS_FILE, JSON.stringify(defaultRegions, null, 2));
  console.log("Reset regions to default state");

  // Создаем начальное состояние игры
  const defaultGameState = {
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
  };

  await fs.writeFile(GAME_STATE_FILE, JSON.stringify(defaultGameState, null, 2));
  console.log("Reset game state to default state");
}

// Функция для инициализации данных игры (для обратной совместимости)
async function initializeGameData() {
  return resetGameData();
}

async function readDataFile(filename: string) {
  const filePath = path.join(__dirname, `../data/${filename}`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    console.error(`Error reading file ${filename}:`, error);
    return null;
  }
}

async function writeDataFile(filename: string, data: any) {
  const filePath = path.join(__dirname, `../data/${filename}`);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing file ${filename}:`, error);
  }
}


class Storage {
  private cities: Region[] = [];
  private gameState: any = null;
  private armyTransfers: any[] = [];
  private citiesLastLoaded: number = 0;
  private gameStateLastLoaded: number = 0;
  private CACHE_TTL = 5000; // Кэш действителен 5 секунд

  // Получение списка областей с оптимизацией кэширования
  async getRegions(): Promise<Region[]> {
    try {
      const now = Date.now();
      
      // Используем кэш, если он не устарел
      if (this.cities.length > 0 && now - this.citiesLastLoaded < this.CACHE_TTL) {
        return this.cities;
      }
      
      const data = await fs.readFile(INFO_FILE, 'utf8');
      this.cities = JSON.parse(data);
      this.citiesLastLoaded = now;
      
      return this.cities;
    } catch (error) {
      console.error('Error reading regions from info.json:', error);
      return [];
    }
  }

  // Обновление области с проверкой лимитов зданий
  async updateRegion(id: number, updates: Partial<Region>): Promise<Region | null> {
    try {
      const regions = await this.getRegions();
      const index = regions.findIndex(city => city.id === id);

      if (index === -1) {
        return null;
      }
      
      const currentRegion = regions[index];
      
      // Если обновляем здания, проверяем лимиты
      if (updates.buildings) {
        const buildingCounts: Record<string, number> = {};
        
        // Считаем количество каждого типа зданий
        updates.buildings.forEach(building => {
          buildingCounts[building] = (buildingCounts[building] || 0) + 1;
        });
        
        // Проверяем, не превышены ли лимиты
        if (currentRegion.buildingLimits) {
          for (const [buildingId, count] of Object.entries(buildingCounts)) {
            const limit = currentRegion.buildingLimits[buildingId] || 999;
            if (count > limit) {
              console.error(`Building limit exceeded for ${buildingId}. Limit: ${limit}, Attempted: ${count}`);
              return null;
            }
          }
        }
      }

      const updatedRegion = { ...currentRegion, ...updates };
      regions[index] = updatedRegion;

      await fs.writeFile(INFO_FILE, JSON.stringify(regions, null, 2));
      this.cities = regions;
      this.citiesLastLoaded = Date.now();

      return updatedRegion;
    } catch (error) {
      console.error('Error updating region:', error);
      return null;
    }
  }

  // Обновление всех областей
  async updateRegionsData(regions: Region[]): Promise<boolean> {
    try {
      await fs.writeFile(INFO_FILE, JSON.stringify(regions, null, 2));
      this.cities = regions;
      this.citiesLastLoaded = Date.now();
      return true;
    } catch (error) {
      console.error('Error updating all regions:', error);
      return false;
    }
  }

  // Для обратной совместимости добавляем методы getCities и updateCity
  async getCities(): Promise<Region[]> {
    return this.getRegions();
  }

  async updateCity(id: number, updates: Partial<Region>): Promise<Region | null> {
    return this.updateRegion(id, updates);
  }

  async getGameState(): Promise<any> {
    try {
      const now = Date.now();
      
      // Используем кэш, если он не устарел
      if (this.gameState && now - this.gameStateLastLoaded < this.CACHE_TTL) {
        return this.gameState;
      }
      
      const data = await fs.readFile(GAME_STATE_FILE, 'utf8');
      this.gameState = JSON.parse(data);
      this.gameStateLastLoaded = now;
      
      return this.gameState;
    } catch (error) {
      console.error('Error reading game state:', error);
      return null;
    }
  }

  async setGameState(state: any): Promise<boolean> {
    try {
      await fs.writeFile(GAME_STATE_FILE, JSON.stringify(state, null, 2));
      this.gameState = state;
      this.gameStateLastLoaded = Date.now();
      return true;
    } catch (error) {
      console.error('Error setting game state:', error);
      return false;
    }
  }

  // Получение текущих перемещений армий
  getArmyTransfers() {
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

  // Метод для обновления данных об областях только в памяти (не сохраняя в файл)
  updateInMemoryRegionsData(regions: Region[]) {
    this.cities = regions;
    this.citiesLastLoaded = Date.now();
    return true;
  }
}

export const storage = new Storage();

interface GameState {
  resources: {
    gold: number;
    wood: number;
    food: number;
    oil: number;
    metal: number;
    steel: number;
    weapons: number;
  };
  population: number;
  military: number;
}