import type { Building } from '@shared/schema';

export const BUILDINGS: Building[] = [
  {
    id: 'sawmill',
    name: 'Sawmill',
    cost: { wood: 700 },
    resourceProduction: {
      type: 'wood',
      amount: 10
    }
  },
  {
    id: 'barracks',
    name: 'Barracks',
    cost: { wood: 700 },
    military: {
      production: 50 // per minute
    }
  },
  {
    id: 'house',
    name: 'House',
    cost: { wood: 300, gold: 200 },
    population: {
      housing: 1000
    }
  }
];

export const TERRITORY_COLORS = {
  player: '#3b82f6', // blue
  neutral: '#6b7280', // gray
  enemy: '#ef4444', // red
  ally: '#22c55e', // green
};
