import { cities, type City, type InsertCity, type GameState } from "@shared/schema";

export interface IStorage {
  getCities(): Promise<City[]>;
  updateCity(id: number, city: Partial<City>): Promise<City>;
  getGameState(): Promise<GameState>;
  setGameState(state: GameState): Promise<void>;
}

export class MemStorage implements IStorage {
  private cities: Map<number, City>;
  private gameState: GameState;

  constructor() {
    this.cities = new Map();
    this.gameState = {
      resources: {
        gold: 500,
        wood: 500,
        food: 500,
        oil: 500
      },
      population: 0,
      military: 0
    };

    // Initialize with Russian cities
    this.cities.set(1, {
      id: 1,
      name: "Москва",
      latitude: 55.7558,
      longitude: 37.6173,
      population: 0,
      maxPopulation: 150000,
      resources: {},
      boundaries: [
        [55.8, 37.5],
        [55.9, 37.7],
        [55.7, 37.8],
        [55.6, 37.6],
        [55.8, 37.5]
      ],
      owner: "neutral",
      buildings: []
    });

    this.cities.set(2, {
      id: 2,
      name: "Санкт-Петербург",
      latitude: 59.9343,
      longitude: 30.3351,
      population: 0,
      maxPopulation: 100000,
      resources: {
        food: 8,
        oil: 3
      },
      boundaries: [
        [60.0, 30.2],
        [60.1, 30.4],
        [59.9, 30.5],
        [59.8, 30.3],
        [60.0, 30.2]
      ],
      owner: "neutral",
      buildings: []
    });

    this.cities.set(3, {
      id: 3,
      name: "Новосибирск",
      latitude: 55.0084,
      longitude: 82.9357,
      population: 0,
      maxPopulation: 80000,
      resources: {
        gold: 7,
        wood: 5
      },
      boundaries: [
        [55.1, 82.8],
        [55.2, 83.0],
        [55.0, 83.1],
        [54.9, 82.9],
        [55.1, 82.8]
      ],
      owner: "neutral",
      buildings: []
    });

    this.cities.set(4, {
      id: 4,
      name: "Екатеринбург",
      latitude: 56.8389,
      longitude: 60.6057,
      population: 0,
      maxPopulation: 70000,
      resources: {
        oil: 6,
        gold: 4
      },
      boundaries: [
        [56.9, 60.5],
        [57.0, 60.7],
        [56.8, 60.8],
        [56.7, 60.6],
        [56.9, 60.5]
      ],
      owner: "neutral",
      buildings: []
    });

    // Добавляем новые города
    this.cities.set(5, {
      id: 5,
      name: "Казань",
      latitude: 55.7887,
      longitude: 49.1221,
      population: 0,
      maxPopulation: 90000,
      resources: {
        food: 10,
        wood: 3
      },
      boundaries: [
        [55.85, 49.0],
        [55.95, 49.2],
        [55.75, 49.3],
        [55.65, 49.1],
        [55.85, 49.0]
      ],
      owner: "neutral",
      buildings: []
    });

    this.cities.set(6, {
      id: 6,
      name: "Красноярск",
      latitude: 56.0184,
      longitude: 92.8672,
      population: 0,
      maxPopulation: 65000,
      resources: {
        wood: 12,
        oil: 2
      },
      boundaries: [
        [56.1, 92.75],
        [56.2, 92.95],
        [56.0, 93.05],
        [55.9, 92.85],
        [56.1, 92.75]
      ],
      owner: "neutral",
      buildings: []
    });

    this.cities.set(7, {
      id: 7,
      name: "Ростов-на-Дону",
      latitude: 47.2357,
      longitude: 39.7015,
      population: 0,
      maxPopulation: 75000,
      resources: {
        food: 11,
        gold: 3
      },
      boundaries: [
        [47.3, 39.6],
        [47.4, 39.8],
        [47.2, 39.9],
        [47.1, 39.7],
        [47.3, 39.6]
      ],
      owner: "neutral",
      buildings: []
    });

    this.cities.set(8, {
      id: 8,
      name: "Владивосток",
      latitude: 43.1332,
      longitude: 131.9113,
      population: 0,
      maxPopulation: 60000,
      resources: {
        oil: 8,
        food: 6
      },
      boundaries: [
        [43.2, 131.8],
        [43.3, 132.0],
        [43.1, 132.1],
        [43.0, 131.9],
        [43.2, 131.8]
      ],
      owner: "neutral",
      buildings: []
    });

    // Создаем вражеский город (столицу ИИ)
    this.cities.set(9, {
      id: 9,
      name: "Киев",
      latitude: 50.4501,
      longitude: 30.5234,
      population: 8000,
      maxPopulation: 120000,
      resources: {
        wood: 5,
        food: 5,
        gold: 5,
        oil: 5
      },
      boundaries: [
        [50.5, 30.4],
        [50.6, 30.6],
        [50.4, 30.7],
        [50.3, 30.5],
        [50.5, 30.4]
      ],
      owner: "enemy",
      buildings: [
        'sawmill', 'farm', 'mine', 'house', 'barracks'
      ],
      military: 100
    });

    this.cities.set(10, {
      id: 10,
      name: "Минск",
      latitude: 53.9045,
      longitude: 27.5615,
      population: 5000,
      maxPopulation: 90000,
      resources: {
        wood: 8,
        food: 7
      },
      boundaries: [
        [54.0, 27.45],
        [54.1, 27.65],
        [53.9, 27.75],
        [53.8, 27.55],
        [54.0, 27.45]
      ],
      owner: "enemy",
      buildings: [
        'sawmill', 'farm', 'barracks'
      ],
      military: 50
    });
  }

  async getCities(): Promise<City[]> {
    return Array.from(this.cities.values());
  }

  async updateCity(id: number, updates: Partial<City>): Promise<City> {
    const city = this.cities.get(id);
    if (!city) throw new Error("City not found");

    const updatedCity = { ...city, ...updates };
    this.cities.set(id, updatedCity);
    return updatedCity;
  }

  async getGameState(): Promise<GameState> {
    return this.gameState;
  }

  async setGameState(state: GameState): Promise<void> {
    this.gameState = state;
  }
}

export const storage = new MemStorage();