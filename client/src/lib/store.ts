import { create } from 'zustand';
import type { City, GameState, Building } from '@shared/schema';

interface GameStore {
  cities: City[];
  setCities: (cities: City[]) => void;
  updateCity: (city: City) => void;
  selectedCity: City | null;
  setSelectedCity: (city: City | null) => void;
  gameState: GameState;
  setGameState: (state: GameState) => void;
  cityRoutes: [];
  getAdjacentCities: (cityId: string) => City[];
}

// Делаем BUILDINGS доступными глобально для использования в компонентах
declare global {
  interface Window {
    BUILDINGS?: any[];
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  cities: [],
  setCities: (cities) => set((state) => {
    // Добавляем только новые города, обновляем существующие
    const updatedCities = [...state.cities];

    cities.forEach(newCity => {
      const existingIndex = updatedCities.findIndex(c => c.id === newCity.id);
      if (existingIndex >= 0) {
        updatedCities[existingIndex] = newCity;
      } else {
        updatedCities.push(newCity);
      }
    });

    return { cities: updatedCities };
  }),
  updateCity: (updatedCity) => set((state) => ({
    cities: state.cities.map(city => 
      city.id === updatedCity.id ? updatedCity : city
    )
  })),
  selectedCity: null,
  setSelectedCity: (city) => set({ selectedCity: city }),
  cityRoutes: [],
  gameState: {
    resources: {
      gold: 500,
      wood: 500,
      food: 500,
      oil: 500
    },
    population: 0,
    military: 0
  },
  setGameState: (state) => set({ gameState: state }),
  getAdjacentCities: (cityId) => {
    const { cities } = get();
    const city = cities.find(c => c.id === cityId);
    if (!city || !city.adjacentCities) return [];

    return cities.filter(c => city.adjacentCities.includes(c.id));
  },
}));