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
}

export const useGameStore = create<GameStore>((set) => ({
  cities: [],
  setCities: (cities) => set({ cities }),
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
  setGameState: (state) => set({ gameState: state })
}));
