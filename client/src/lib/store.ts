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
  resourcesIncome: {
    gold: number;
    food: number;
    wood: number;
    oil: number;
    metal: number;
    steel: number;
    weapons: number;
    influence: number;
  };
}

// Делаем BUILDINGS доступными глобально для использования в компонентах
declare global {
  interface Window {
    BUILDINGS?: any[];
  }
}

export const useGameStore = create<GameStore>((set) => ({
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
  resourcesIncome: {
    gold: 0,
    food: 0,
    wood: 0,
    oil: 0,
    metal: 0,
    steel: 0,
    weapons: 0,
    influence: 0
  }
}));

//Further modifications needed in other parts of the application to fully implement the changes requested by the user.  For example:
//1. Correct handling of protests and city loss in gameLoop.ts (point 1 in user message)
//2. Accurate display of satisfaction and taxes in CityPanel (point 2 & 3)
//3.  Display of gold income from taxes in resource panel (point 4)  This requires changes to how resources are updated and displayed.