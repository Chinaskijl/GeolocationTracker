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
      resources: {
        wood: 10,
        gold: 5
      },
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