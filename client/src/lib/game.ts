
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
    description: "Добывает золото из месторождений.",
    cost: { wood: 25, gold: 10 },
    resourceProduction: { type: "gold", amount: 5 },
    maxCount: 20,
    icon: "⛏️"
  },
  {
    id: "oil_rig",
    name: "Нефтяная вышка",
    description: "Добывает нефть из месторождений.",
    cost: { wood: 30, gold: 25, metal: 10 },
    resourceProduction: { type: "oil", amount: 3 },
    maxCount: 10,
    icon: "🛢️"
  },
  {
    id: "barracks",
    name: "Казармы",
    description: "Обучает военных.",
    cost: { wood: 20, gold: 15, food: 10 },
    military: { production: 1, populationUse: 1 },
    maxCount: 5,
    icon: "🛡️"
  },
  {
    id: "metal_factory",
    name: "Металлургический завод",
    description: "Производит металл из руды.",
    cost: { wood: 30, gold: 20, oil: 5 },
    resourceProduction: { type: "metal", amount: 2 },
    resourceConsumption: { type: "oil", amount: 1 },
    maxCount: 5,
    icon: "🏭"
  },
  {
    id: "steel_factory",
    name: "Сталелитейный завод",
    description: "Перерабатывает металл в сталь для тяжелой промышленности.",
    cost: { gold: 150, wood: 100, metal: 50 },
    resourceProduction: { type: "steel", amount: 1 },
    resourceConsumption: { type: "metal", amount: 2 },
    maxCount: 3,
    icon: "⚙️"
  },
  {
    id: "weapons_factory",
    name: "Оружейный завод",
    description: "Производит оружие для армии.",
    cost: { gold: 200, wood: 50, steel: 100 },
    resourceProduction: { type: "weapons", amount: 1 },
    resourceConsumption: { type: "steel", amount: 2 },
    maxCount: 2,
    icon: "🔫"
  },
  {
    id: "embassy",
    name: "Посольство",
    description: "Развивает дипломатические отношения и увеличивает влияние.",
    cost: { gold: 300, wood: 100 },
    resourceProduction: { type: "influence", amount: 1 },
    maxCount: 1,
    icon: "🏛️"
  },
  {
    id: "cultural_center",
    name: "Культурный центр",
    description: "Распространяет культурное влияние на окружающие регионы.",
    cost: { gold: 200, wood: 150 },
    resourceProduction: { type: "influence", amount: 0.5 },
    population: { growth: 0.5 },
    maxCount: 2,
    icon: "🎭"
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
