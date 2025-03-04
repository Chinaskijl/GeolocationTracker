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
      let totalInfluenceProduction = 0;

      const newResources = { ...gameState.resources };
      
      // Инициализируем influence, если его нет
      if (!newResources.influence) {
        newResources.influence = 0;
      }

      // Обработка всех городов
      for (const city of cities) {
        if (city.owner === 'player') {
          console.log(`Processing city ${city.name}:`, city);

          let cityPopulationGrowth = 0;
          let cityMilitaryGrowth = 0;
          let cityPopulationUsed = 0;
          let cityAvailableWorkers = city.population; // Доступные работники
          let cityTotalWorkers = 0; // Общее количество требуемых работников
          let citySatisfactionBonus = 0; // Бонус к удовлетворенности от зданий
          let cityInfluenceProduction = 0; // Производство влияния городом
          
          // Флаг протеста (производство замедляется)
          const isProtesting = city.protestTimer !== null && city.protestTimer !== undefined && city.protestTimer > 0;
          
          // Множитель производства (замедление при протестах)
          const productionMultiplier = isProtesting ? 0.5 : 1.0;
          
          // Проверяем наличие еды для роста населения
          const noFood = gameState.resources.food <= 0;

          // Обработка всех зданий
          city.buildings.forEach(buildingId => {
            const building = BUILDINGS.find(b => b.id === buildingId);
            if (!building) return;

            console.log(`Processing building ${building.name} in ${city.name}`);

            // Расчет требуемых работников
            if (building.workers) {
              cityTotalWorkers += building.workers;
            }
            
            // Добавляем бонус к удовлетворенности, если есть
            if (building.satisfactionBonus) {
              citySatisfactionBonus += building.satisfactionBonus;
            }
            
            // Производство ресурсов
            if (building.resourceProduction) {
              const { type, amount } = building.resourceProduction;
              
              // Проверяем потребление ресурсов и наличие работников
              let canProduce = true;
              
              // Проверка на достаточное количество работников
              if (building.workers && cityAvailableWorkers < building.workers) {
                canProduce = false;
                console.log(`Not enough workers for ${building.id} in ${city.name}: needs ${building.workers}, available ${cityAvailableWorkers}`);
              } else if (building.workers) {
                // Если работники есть, уменьшаем доступное количество
                cityAvailableWorkers -= building.workers;
              }
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
              
              // Производим ресурсы только если есть необходимые ресурсы и работники
              if (canProduce) {
                // Применяем множитель производства (замедление при протестах)
                const production = amount * deltaTime * productionMultiplier;
                newResources[type] += production;
                
                // Учитываем производство влияния отдельно
                if (type === 'influence') {
                  cityInfluenceProduction += production;
                }
                
                console.log(`Resource production: +${production} ${type}${isProtesting ? ' (reduced due to protests)' : ''}`);
              }
            }

            // Рост населения - только если есть еда
            if (building.population?.growth && !noFood) {
              const populationGrowth = building.population.growth * deltaTime;
              cityPopulationGrowth += populationGrowth;
              console.log(`Population growth: +${populationGrowth} in ${city.name}`);
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
                console.log(`Military production: +${building.military.production * deltaTime} in ${city.name}, Population used: -${building.military.populationUse}, Weapons used: -${building.military.production * deltaTime}`);
              } else if (city.population < building.military.populationUse) {
                console.log(`Недостаточно населения для производства военных в ${city.name}`);
              } else {
                console.log(`Недостаточно оружия для производства военных в ${city.name}`);
              }
            }
          });

          // Рассчитываем новый уровень удовлетворенности
          let newSatisfaction = city.satisfaction || 50; // По умолчанию 50% если не задано
          
          // Базовое падение удовлетворенности из-за нехватки работников
          if (cityTotalWorkers > 0) {
            const workerSatisfactionImpact = (cityAvailableWorkers < 0) ? 
              -5 : // Сильное падение если вообще не хватает работников
              Math.min(0, -5 * (1 - cityAvailableWorkers / cityTotalWorkers)); // Постепенное падение
            
            newSatisfaction += workerSatisfactionImpact * deltaTime;
          }
          
          // Добавляем бонус от культурных зданий
          newSatisfaction += citySatisfactionBonus * deltaTime * 0.1; // Умножаем на маленький коэффициент
          
          // Влияние налоговой ставки на удовлетворенность
          const taxRate = city.taxRate !== undefined ? city.taxRate : 5; // По умолчанию 5
          
          // Ниже 5 - повышение удовлетворенности, выше 5 - понижение
          const taxSatisfactionImpact = (5 - taxRate) * 0.5; // Коэффициент влияния налогов
          newSatisfaction += taxSatisfactionImpact * deltaTime;
          
          // Расчет дохода от налогов
          if (city.population > 0) {
            // При налоговой ставке 0 город потребляет золото
            if (taxRate === 0) {
              const goldConsumption = Math.min(newResources.gold, city.population * 0.5 * deltaTime);
              newResources.gold -= goldConsumption;
              console.log(`City ${city.name} consumes gold due to zero taxes: -${goldConsumption.toFixed(2)}`);
            } else {
              // Иначе производит золото в зависимости от ставки
              // Новая формула: 1 человек платит 1 золото в секунду при коэффициенте 1 (taxRate = 5)
              const taxCoefficient = taxRate / 5; // Ставка 5 = коэффициент 1
              const goldProduction = city.population * 1 * taxCoefficient * deltaTime;
              newResources.gold += goldProduction;
              console.log(`Tax income from ${city.name}: +${goldProduction.toFixed(2)} gold (tax rate: ${taxRate}, coefficient: ${taxCoefficient.toFixed(2)})`);
            }
          }
          
          // Ограничиваем удовлетворенность в диапазоне 0-100%
          newSatisfaction = Math.max(0, Math.min(100, newSatisfaction));
          
          // Проверяем на начало протестов (если удовлетворенность < 30% и протесты еще не начались)
          let newProtestTimer = city.protestTimer;
          
          if (newSatisfaction <= 0 && !isProtesting) {
            // Если удовлетворенность упала до нуля - начинаем протесты с малым таймером (60 секунд)
            newProtestTimer = 60;
            // Гарантируем, что не будет отрицательной удовлетворенности
            newSatisfaction = 0;
            console.log(`⚠️ CRITICAL! Satisfaction hit 0% in ${city.name}! 60 seconds until loss of control.`);
          } else if (newSatisfaction < 30 && !isProtesting) {
            // Начинаем протесты с таймером 5 минут (300 секунд)
            newProtestTimer = 300;
            console.log(`⚠️ Protests started in ${city.name}! Satisfaction: ${newSatisfaction.toFixed(1)}%. 5 minutes to resolve.`);
          } else if (isProtesting) {
            // Если протесты уже идут, уменьшаем таймер
            newProtestTimer -= deltaTime;
            
            // Если удовлетворенность поднялась выше 30%, останавливаем протесты
            if (newSatisfaction >= 30) {
              newProtestTimer = null;
              console.log(`✅ Protests resolved in ${city.name}. Satisfaction recovered to ${newSatisfaction.toFixed(1)}%.`);
            } 
            // Если время вышло, город становится нейтральным
            else if (newProtestTimer <= 0) {
              console.log(`🚨 Time's up! ${city.name} is now neutral due to unresolved protests!`);
              await storage.updateCity(city.id, {
                owner: 'neutral',
                satisfaction: 50, // Устанавливаем удовлетворенность только когда область переходит в нейтральный статус
                protestTimer: null
              });
              continue; // Пропускаем дальнейшую обработку города
            } else {
              console.log(`⏳ Protests ongoing in ${city.name}. ${Math.floor(newProtestTimer)} seconds remaining to resolve.`);
            }
          }
          
          // Базовое производство влияния в зависимости от удовлетворенности
          if (city.owner === 'player') {
            if (newSatisfaction > 90) {
              cityInfluenceProduction += 3 * deltaTime;
            } else if (newSatisfaction > 70) {
              cityInfluenceProduction += 1 * deltaTime;
            }
          }
          
          totalInfluenceProduction += cityInfluenceProduction;
          
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
            military: Math.floor((city.military || 0) + cityMilitaryGrowth),
            satisfaction: newSatisfaction,
            protestTimer: newProtestTimer
          });
        }
      }

      // Потребление еды
      totalFoodConsumption = Math.max(0, gameState.population * POPULATION_FOOD_CONSUMPTION * deltaTime);
      console.log(`Total food consumption: -${totalFoodConsumption.toFixed(2)}`);

      // Проверяем нехватку еды и уменьшаем население при необходимости
      let populationChange = totalPopulationGrowth - totalPopulationUsed;
      if (gameState.population > 0 && newResources.food <= totalFoodConsumption) {
        // Недостаточно еды, уменьшаем население значительно сильнее
        populationChange -= deltaTime * 5; // -5 населения в секунду
        console.log(`Not enough food! Population decreasing rapidly: -${deltaTime * 5}`);
      }

      // Добавляем влияние к ресурсам
      newResources.influence = (newResources.influence || 0) + totalInfluenceProduction;
      
      // Обновление состояния игры
      const newGameState = {
        ...gameState,
        resources: {
          ...newResources,
          food: totalFoodConsumption > 0 ? Math.max(0, newResources.food - totalFoodConsumption) : newResources.food
        },
        population: Math.floor(Math.max(0, gameState.population + populationChange)),
        military: Math.floor(Math.max(0, gameState.military + totalMilitaryGrowth))
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

      // Расчет прироста ресурсов
      const resourcesIncome = {
        gold: 0,
        food: 0,
        wood: 0,
        oil: 0,
        metal: 0,
        steel: 0,
        weapons: 0,
        influence: 0
      };

      // Добавляем налоговые поступления
      for (const city of cities) {
        if (city.owner === 'player') {
          // Извлекаем значение налоговой ставки, убеждаясь, что используем правильное числовое значение
          let taxRate = 5; // Значение по умолчанию
          
          if (city.taxRate !== undefined) {
            if (Array.isArray(city.taxRate)) {
              taxRate = city.taxRate[0];
            } else {
              taxRate = city.taxRate;
            }
          }
          
          if (taxRate === 0) {
            // При ставке 0 золото потребляется
            const goldConsumption = city.population * 0.5;
            resourcesIncome.gold -= goldConsumption;
          } else {
            // При положительной ставке золото производится
            const taxCoefficient = taxRate / 5;
            const goldProduction = city.population * 1 * taxCoefficient;
            resourcesIncome.gold += goldProduction;
          }
        }
      }

      // Вычитаем потребление еды
      resourcesIncome.food -= gameState.population * POPULATION_FOOD_CONSUMPTION;

      this.broadcast({ 
        type: 'GAME_UPDATE',
        gameState: gameState,
        resourcesIncome: resourcesIncome
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