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

    // Обновляем границы областей при каждой инициализации сервера
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
  } catch (error) {
    console.log("Regions file not found, creating default regions");
    existingRegions = [
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

    await fs.writeFile(REGIONS_FILE, JSON.stringify(existingRegions, null, 2));
  }

  // Проверяем наличие файла с состоянием игры
  try {
    await fs.access(GAME_STATE_FILE);
  } catch (error) {
    console.log("Game state file not found, creating default state");

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
  }
}

class Storage {
  private cities: Region[] = [];
  private gameState: any = null;
  private armyTransfers: any[] = [];

  // Получение списка областей
  async getRegions(): Promise<Region[]> {
    try {
      if (this.cities.length === 0) {
        const data = await fs.readFile(REGIONS_FILE, 'utf8');
        this.cities = JSON.parse(data);
      }
      return this.cities;
    } catch (error) {
      console.error('Error reading regions:', error);
      return [];
    }
  }

  // Обновление области
  async updateRegion(id: number, updates: Partial<Region>): Promise<Region | null> {
    try {
      const regions = await this.getRegions();
      const index = regions.findIndex(city => city.id === id);

      if (index === -1) {
        return null;
      }

      const updatedRegion = { ...regions[index], ...updates };
      regions[index] = updatedRegion;

      await fs.writeFile(REGIONS_FILE, JSON.stringify(regions, null, 2));
      this.cities = regions;

      return updatedRegion;
    } catch (error) {
      console.error('Error updating region:', error);
      return null;
    }
  }

  // Обновление всех областей
  async updateRegionsData(regions: Region[]): Promise<boolean> {
    try {
      await fs.writeFile(REGIONS_FILE, JSON.stringify(regions, null, 2));
      this.cities = regions;
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
      if (!this.gameState) {
        const data = await fs.readFile(GAME_STATE_FILE, 'utf8');
        this.gameState = JSON.parse(data);
      }
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
}

export const storage = new Storage();