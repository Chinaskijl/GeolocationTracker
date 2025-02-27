import type { Building } from '@shared/schema';

export const BUILDINGS: Building[] = [
  {
    id: 'sawmill',
    name: 'Лесорубка',
    cost: { wood: 250 },
    resourceProduction: {
      type: 'wood',
      amount: 10
    },
    maxCount: 3
  },
  {
    id: 'house',
    name: 'Жилой дом',
    cost: { wood: 250, gold: 200 },
    population: {
      housing: 1000,
      growth: 3 // per second
    },
    maxCount: 5
  },
  {
    id: 'barracks',
    name: 'Бараки',
    cost: { wood: 700 },
    military: {
      production: 10, // per second
      populationUse: 1
    },
    maxCount: 2
  },
  {
    id: 'farm',
    name: 'Ферма',
    cost: { wood: 300, gold: 150 },
    resourceProduction: {
      type: 'food',
      amount: 10
    },
    maxCount: 3
  },
  {
    id: 'mine',
    name: 'Шахта',
    cost: { wood: 400, gold: 100 },
    resourceProduction: {
      type: 'gold',
      amount: 8
    },
    maxCount: 3
  },
  {
    id: 'oilrig',
    name: 'Нефтяная вышка',
    cost: { wood: 500, gold: 500 },
    resourceProduction: {
      type: 'oil',
      amount: 5
    },
    maxCount: 2
  }
];

export const TERRITORY_COLORS = {
  player: '#3b82f6', // blue
  neutral: '#6b7280', // gray
  enemy: '#ef4444', // red
  ally: '#22c55e', // green
};

// Constants for resource consumption
export const POPULATION_FOOD_CONSUMPTION = 0.1; // food per population per second