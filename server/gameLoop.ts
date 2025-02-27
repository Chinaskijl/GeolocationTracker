import { storage } from "./storage";
import { BUILDINGS, POPULATION_FOOD_CONSUMPTION } from "../client/src/lib/game";
import type { GameState, City } from "@shared/schema";
import type { WebSocket } from "ws";
import { aiPlayer } from "./aiPlayer";

export class GameLoop {
  private tickRate: number = 1; // тиков в секунду
  private tickInterval: number = 1000 / this.tickRate;
  private lastTick: number = Date.now();
  private clients: Set<WebSocket> = new Set();

  addClient(ws: WebSocket) {
    this.clients.add(ws);
  }

  removeClient(ws: WebSocket) {
    this.clients.delete(ws);
  }

  private broadcast(message: any) {
    for (const client of this.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(message));
      }
    }
  }

  async tick() {
    try {
      const currentTime = Date.now();
      const deltaTime = (currentTime - this.lastTick) / 1000; // в секундах
      this.lastTick = currentTime;

      const cities = await storage.getCities();
      const gameState = await storage.getGameState();

      let totalFoodConsumption = 0;
      let totalPopulationGrowth = 0;
      let totalMilitaryGrowth = 0;
      let totalPopulationUsed = 0;

      const newResources = { ...gameState.resources };

      // Обработка всех городов
      for (const city of cities) {
        if (city.owner === 'player') {
          console.log(`Processing city ${city.name}:`, city);

          let cityPopulationGrowth = 0;
          let cityMilitaryGrowth = 0;
          let cityPopulationUsed = 0;

          // Обработка всех зданий
          city.buildings.forEach(buildingId => {
            const building = BUILDINGS.find(b => b.id === buildingId);
            if (!building) return;

            console.log(`Processing building ${building.name} in ${city.name}`);

            // Производство ресурсов
            if (building.resourceProduction) {
              const { type, amount } = building.resourceProduction;
              const production = amount * deltaTime;
              newResources[type] += production;
              console.log(`Resource production: +${production} ${type}`);
            }

            // Рост населения
            if (building.population?.growth) {
              cityPopulationGrowth += building.population.growth * deltaTime;
              console.log(`Population growth: +${building.population.growth * deltaTime}`);
            }

            // Производство военных
            if (building.military) {
              cityMilitaryGrowth += building.military.production * deltaTime;
              cityPopulationUsed += building.military.populationUse;
              console.log(`Military production: +${building.military.production * deltaTime}, Population used: -${building.military.populationUse}`);
            }
          });

          // Обновление населения города
          // Если еды 0, то население уменьшается
          let newPopulation = 0;
          if (newResources.food <= 0) {
            // При нехватке еды население уменьшается
            newPopulation = Math.max(0, city.population - 1 * deltaTime);
          } else {
            // При наличии еды население растет
            newPopulation = Math.min(
              city.maxPopulation,
              Math.max(0, city.population + cityPopulationGrowth - cityPopulationUsed)
            );
          }

          totalPopulationGrowth += cityPopulationGrowth;
          totalMilitaryGrowth += cityMilitaryGrowth;
          totalPopulationUsed += cityPopulationUsed;

          // Обновление города
          await storage.updateCity(city.id, {
            population: Math.floor(newPopulation),
            military: Math.floor((city.military || 0) + cityMilitaryGrowth)
          });
        }
      }

      // Потребление еды
      totalFoodConsumption = gameState.population * POPULATION_FOOD_CONSUMPTION * deltaTime;
      console.log(`Total food consumption: -${totalFoodConsumption}`);

      // Проверяем нехватку еды и уменьшаем население при необходимости
      let populationChange = totalPopulationGrowth - totalPopulationUsed;
      if (newResources.food <= totalFoodConsumption) {
        // Недостаточно еды, уменьшаем население
        populationChange -= deltaTime; // -1 население в секунду
        console.log(`Not enough food! Population decreasing: -${deltaTime}`);
      }

      // Обновление состояния игры
      const newGameState = {
        ...gameState,
        resources: {
          ...newResources,
          food: Math.max(0, newResources.food - totalFoodConsumption)
        },
        population: Math.floor(Math.max(0, gameState.population + populationChange)),
        military: Math.floor(gameState.military + totalMilitaryGrowth)
      };

      console.log('Updated game state:', newGameState);
      await storage.setGameState(newGameState);

      // Обновления будут отправлены через broadcastGameState

    } catch (error) {
      console.error('Error in game loop:', error);
    }
  }

  start() {
    // Используем более частые обновления
    this.tickInterval = 1000; // обновление каждую секунду
    
    // Инициализируем счетчик для регулярной отправки обновлений клиентам
    let updateCounter = 0;
    
    setInterval(() => {
      this.tick();
      
      // Добавляем ход ИИ
      aiPlayer.makeDecisions();
      
      // Всегда отправляем обновления клиентам при каждом тике
      this.broadcastGameState();
    }, this.tickInterval);
  }
  
  // Отдельный метод для отправки текущего состояния игры всем клиентам
  async broadcastGameState() {
    try {
      const gameState = await storage.getGameState();
      const cities = await storage.getCities();
      
      this.broadcast({ 
        type: 'GAME_UPDATE',
        gameState: gameState
      });

      this.broadcast({
        type: 'CITIES_UPDATE',
        cities: cities.filter(city => city.owner === 'player' || city.owner === 'enemy')
      });
    } catch (error) {
      console.error('Error broadcasting game state:', error);
    }
  }
}

export const gameLoop = new GameLoop();