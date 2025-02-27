import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { cities } from "../shared/schema";
import * as schema from "../shared/schema";
import path from "path";

// Соединение с базой данных
const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// Инициализация базы данных
export async function initDb() {
  try {
    // Запуск миграций
    await migrate(db, { migrationsFolder: path.join(__dirname, "../drizzle") });
    console.log("Migrations completed successfully");

    // Проверка и создание начальных данных
    await initializeGameData();
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Функция для инициализации данных игры
async function initializeGameData() {
  // Проверяем наличие городов
  const existingCities = await db.select().from(cities);

  if (existingCities.length === 0) {
    // Создаем начальные города
    console.log("Creating initial cities...");
    await createInitialCities();
  }

  // Проверяем наличие состояния игры
  const gameState = await getGameState();
  if (!gameState) {
    // Создаем начальное состояние игры
    console.log("Creating initial game state...");
    await setGameState({
      resources: {
        gold: 500,
        wood: 200,
        food: 300,
        oil: 100
      },
      population: 100,
      military: 0
    });
  }
}

// Функция для создания начальных городов
async function createInitialCities() {
  // Крупные города
  await db.insert(cities).values([
    {
      name: "Москва",
      latitude: 55.7558,
      longitude: 37.6173,
      population: 0,
      maxPopulation: 150000,
      resources: {},
      boundaries: [[55.8, 37.5], [55.9, 37.7], [55.7, 37.8], [55.6, 37.6], [55.8, 37.5]],
      owner: "player",
      buildings: []
    },
    {
      name: "Санкт-Петербург",
      latitude: 59.9343,
      longitude: 30.3351,
      population: 0, // Население нейтральных городов равно 0
      maxPopulation: 100000,
      resources: { food: 8, oil: 3 },
      boundaries: [[60.0, 30.2], [60.1, 30.4], [59.9, 30.5], [59.8, 30.3], [60.0, 30.2]],
      owner: "neutral",
      buildings: []
    },
    {
      name: "Новосибирск",
      latitude: 55.0084,
      longitude: 82.9357,
      population: 0, // Население нейтральных городов равно 0
      maxPopulation: 80000,
      resources: { gold: 7, wood: 5 },
      boundaries: [[55.1, 82.8], [55.2, 83.0], [55.0, 83.1], [54.9, 82.9], [55.1, 82.8]],
      owner: "neutral",
      buildings: []
    }
  ]);
}

// Хранилище для данных игры
class Storage {
  private gameState: any = null;
  private armyTransfers: any[] = []; // Массив для отслеживания передвижений армий

  async getCities() {
    return db.select().from(cities);
  }

  async updateCity(id: number, data: any) {
    const result = await db.update(cities)
      .set(data)
      .where(schema.cities.id.eq(id))
      .returning();

    return result[0];
  }

  async getGameState() {
    if (this.gameState) return this.gameState;

    // Если состояние не в памяти, получаем из базы данных или создаем новое
    const filePath = path.join(__dirname, "../game-state.json");
    try {
      this.gameState = {
        resources: {
          gold: 500,
          wood: 200,
          food: 300,
          oil: 100
        },
        population: 100,
        military: 0
      };
      return this.gameState;
    } catch (error) {
      console.error("Error reading game state:", error);
      this.gameState = {
        resources: {
          gold: 500,
          wood: 200,
          food: 300,
          oil: 100
        },
        population: 100,
        military: 0
      };
      return this.gameState;
    }
  }

  async setGameState(state: any) {
    this.gameState = state;
    return this.gameState;
  }

  // Методы для управления передвижением армий
  async getArmyTransfers() {
    return this.armyTransfers;
  }

  async addArmyTransfer(transfer: any) {
    this.armyTransfers.push(transfer);
    return transfer;
  }

  async removeArmyTransfer(id: number) {
    this.armyTransfers = this.armyTransfers.filter(t => t.id !== id);
    return true;
  }
}

export const storage = new Storage();

// Исправление заполнения городов для генерации
async function initializeGame() {
  // Очищаем и заполняем базу данных
  await db.delete(cities);

  // Генерируем крупные города
  await db.insert(cities).values([
    {
      name: "Москва",
      latitude: 55.7558,
      longitude: 37.6173,
      population: 20000,
      maxPopulation: 150000,
      resources: {},
      boundaries: generateBoundaries(55.7558, 37.6173),
      owner: "player",
      buildings: []
    },
    {
      name: "Санкт-Петербург",
      latitude: 59.9343,
      longitude: 30.3351,
      population: 0, // Нейтральный город, население = 0
      maxPopulation: 100000,
      resources: { food: 8, oil: 3 },
      boundaries: generateBoundaries(59.9343, 30.3351),
      owner: "neutral",
      buildings: []
    },
  ]);
}


function generateBoundaries(latitude: number, longitude: number): number[][] {
  const offset = 0.1;
  return [
    [latitude - offset, longitude - offset],
    [latitude + offset, longitude - offset],
    [latitude + offset, longitude + offset],
    [latitude - offset, longitude + offset],
    [latitude - offset, longitude - offset]
  ];
}