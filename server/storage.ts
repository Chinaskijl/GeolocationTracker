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

    // Initialize with Moscow as example
    this.cities.set(1, {
      id: 1,
      name: "Moscow",
      latitude: 55.7558,
      longitude: 37.6173,
      population: 0,
      maxPopulation: 150000,
      resources: {
        wood: 10
      },
      boundaries: [[55.7, 37.6], [55.8, 37.7]], // Simplified
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
