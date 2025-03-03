import type { Building } from '@shared/schema';

export const BUILDINGS = [
  {
    id: "house",
    name: "Жилой дом",
    description: "Обеспечивает жильем население.",
    cost: { wood: 10, gold: 5 },
    population: { housing: 10, growth: 3 },
    maxCount: 100,
    icon: "🏠"
  },
  {
    id: "farm",
    name: "Ферма",
    description: "Производит пищу для населения.",
    cost: { wood: 15, gold: 5 },
    resourceProduction: { type: "food", amount: 10 },
    maxCount: 50,
    icon: "🌾"
  },
  {
    id: "market",
    name: "Рынок",
    description: "Увеличивает доход золота.",
    cost: { wood: 20, gold: 15 },
    resourceProduction: { type: "gold", amount: 3 },
    maxCount: 20,
    icon: "🏪"
  },
  {
    id: "logging_camp",
    name: "Лесопилка",
    description: "Производит древесину из лесных ресурсов.",
    cost: { gold: 15 },
    resourceProduction: { type: "wood", amount: 3 },
    maxCount: 30,
    icon: "🪓"
  },
  {
    id: "gold_mine",
    name: "Золотой рудник",
    description: "Добывает золото. Производит +5 золота в секунду.",
    cost: { wood: 25, gold: 10 },
    resourceProduction: { type: "gold", amount: 5 },
    maxCount: 20,
    icon: "⛏️"
  },
  {
    id: "oil_rig",
    name: "Нефтяная вышка",
    description: "Добывает нефть. Производит +3 нефти в секунду.",
    cost: { wood: 30, gold: 25, metal: 10 },
    resourceProduction: { type: "oil", amount: 3 },
    maxCount: 10,
    icon: "🛢️"
  },
  {
    id: "barracks",
    name: "Казармы",
    description: "Обучает военных. Производит +1 военного в секунду, потребляет 1 человека.",
    cost: { wood: 20, gold: 15, food: 10 },
    military: { production: 1, populationUse: 1 },
    maxCount: 5,
    icon: "🛡️"
  },
  {
    id: "metal_factory",
    name: "Металлургический завод",
    description: "Производит металл. Производит +2 металла в секунду, потребляет 1 нефть.",
    cost: { wood: 30, gold: 20, oil: 5 },
    resourceProduction: { type: "metal", amount: 2 },
    resourceConsumption: { type: "oil", amount: 1 },
    maxCount: 5,
    icon: "🏭"
  },
  {
    id: "steel_factory",
    name: "Сталелитейный завод",
    description: "Производит сталь из металла. Производит +1 стали в секунду, потребляет 2 металла.",
    cost: { wood: 40, gold: 30, metal: 15 },
    resourceProduction: { type: "steel", amount: 1 },
    resourceConsumption: { type: "metal", amount: 2 },
    maxCount: 3,
    icon: "⚙️"
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