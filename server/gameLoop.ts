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

          // Проверяем наличие еды для роста населения
          const noFood = gameState.resources.food <= 0;

          // Обработка всех зданий
          city.buildings.forEach(buildingId => {
            const building = BUILDINGS.find(b => b.id === buildingId);
            if (!building) return;

            console.log(`Processing building ${building.name} in ${city.name}`);

            // Производство ресурсов
            if (building.resourceProduction) {
              const { type, amount } = building.resourceProduction;
              
              // Проверяем потребление ресурсов
              let canProduce = true;
              if (building.resourceConsumption) {
                if (building.resourceConsumption.type && building.resourceConsumption.amount) {
                  // Простое потребление одного типа ресурсов
                  const consumptionType = building.resourceConsumption.type;
                  const consumptionAmount = building.resourceConsumption.amount * deltaTime;
                  
                  if (newResources[consumptionType] < consumptionAmount) {
                    canProduce = false;
                    console.log(`Not enough ${consumptionType} for production in ${building.id}`);
                  } else {
                    newResources[consumptionType] -= consumptionAmount;
                    console.log(`Resource consumption: -${consumptionAmount} ${consumptionType}`);
                  }
                } else {
                  // Сложное потребление нескольких типов ресурсов
                  for (const [resType, resAmount] of Object.entries(building.resourceConsumption)) {
                    if (resType !== 'type' && resType !== 'amount') {
                      const consumptionAmount = (resAmount as number) * deltaTime;
                      if (newResources[resType] < consumptionAmount) {
                        canProduce = false;
                        console.log(`Not enough ${resType} for production in ${building.id}`);
                        break;
                      }
                    }
                  }
                  
                  if (canProduce) {
                    // Вычитаем потребленные ресурсы
                    for (const [resType, resAmount] of Object.entries(building.resourceConsumption)) {
                      if (resType !== 'type' && resType !== 'amount') {
                        const consumptionAmount = (resAmount as number) * deltaTime;
                        newResources[resType] -= consumptionAmount;
                        console.log(`Resource consumption: -${consumptionAmount} ${resType}`);
                      }
                    }
                  }
                }
              }
              
              // Производим ресурсы только если есть необходимые ресурсы для потребления
              if (canProduce) {
                const production = amount * deltaTime;
                newResources[type] += production;
                console.log(`Resource production: +${production} ${type}`);
              }
            }

            // Рост населения - только если есть еда
            if (building.population?.growth && !noFood) {
              cityPopulationGrowth += building.population.growth * deltaTime;
              console.log(`Population growth: +${building.population.growth * deltaTime}`);
            } else if (building.population?.growth && noFood) {
              console.log(`Жилой дом в городе ${city.name} не даёт прирост населения из-за нехватки еды`);
            }

            // Производство военных
            if (building.military) {
              // Проверяем, есть ли достаточно населения и оружия для производства военных
              if (city.population >= building.military.populationUse && newResources.weapons >= building.military.production * deltaTime) {
                cityMilitaryGrowth += building.military.production * deltaTime;
                cityPopulationUsed += building.military.populationUse;
                newResources.weapons -= building.military.production * deltaTime;
                console.log(`Military production: +${building.military.production * deltaTime}, Population used: -${building.military.populationUse}, Weapons used: -${building.military.production * deltaTime}`);
              } else if (city.population < building.military.populationUse) {
                console.log(`Недостаточно населения для производства военных в ${city.name}`);
              } else {
                console.log(`Недостаточно оружия для производства военных в ${city.name}`);
              }
            }
          });

          // Обновление населения города, учитывая наличие еды
          let newPopulation;
          if (gameState.resources.food <= 0) {
            // Если еды нет, то население уменьшается
            newPopulation = Math.max(0, city.population - deltaTime * 5); // Быстрее вымирают, -5 населения в секунду
            console.log(`City ${city.name} is losing population due to food shortage: -${deltaTime * 5}`);
          } else {
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
        // Недостаточно еды, уменьшаем население значительно сильнее
        populationChange -= deltaTime * 5; // -5 населения в секунду
        console.log(`Not enough food! Population decreasing rapidly: -${deltaTime * 5}`);
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
      const armyTransfers = await storage.getArmyTransfers();

      this.broadcast({ 
        type: 'GAME_UPDATE',
        gameState: gameState
      });

      this.broadcast({
        type: 'CITIES_UPDATE',
        cities: cities // Отправляем все города для полного обновления
      });

      // Отправляем информацию о передвижениях армий
      if (armyTransfers.length > 0) {
        this.broadcast({
          type: 'ARMY_TRANSFERS_UPDATE',
          transfers: armyTransfers
        });
      }
    } catch (error) {
      console.error('Error broadcasting game state:', error);
    }
  }
}

export const gameLoop = new GameLoop();