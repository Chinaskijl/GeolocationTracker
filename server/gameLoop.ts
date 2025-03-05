import { WebSocket } from 'ws';
import { storage } from './storage';
import { BUILDINGS } from '../client/src/lib/game';

// Класс для управления игровым циклом
class GameLoop {
  private clients: WebSocket[] = [];
  private interval: NodeJS.Timeout | null = null;
  private tickRate: number = 1000; // Интервал между обновлениями (1 секунда)

  // Добавление нового клиента
  addClient(ws: WebSocket) {
    this.clients.push(ws);
    console.log(`Client added, total clients: ${this.clients.length}`);

    // Отправляем начальное состояние игры новому клиенту
    this.sendGameState(ws);
  }

  // Удаление клиента
  removeClient(ws: WebSocket) {
    this.clients = this.clients.filter(client => client !== ws);
    console.log(`Client removed, total clients: ${this.clients.length}`);
  }

  // Запуск игрового цикла
  start() {
    if (this.interval) {
      console.log('Game loop already running');
      return;
    }

    console.log('Starting game loop...');
    this.interval = setInterval(() => this.tick(), this.tickRate);
  }

  // Остановка игрового цикла
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('Game loop stopped');
    }
  }

  // Игровой тик - основная логика обновления состояния игры
  async tick() {
    try {
      // Получаем текущее состояние игры
      const gameState = await storage.getGameState();
      if (!gameState) {
        console.error('Failed to get game state');
        return;
      }

      // Получаем города
      const cities = await storage.getCities();
      if (!cities) {
        console.error('Failed to get cities');
        return;
      }

      // Обновляем игровое состояние
      await this.updateGameState(gameState, cities);

      // Отправляем обновленное состояние всем клиентам
      this.broadcastGameState();
    } catch (error) {
      console.error('Error in game loop tick:', error);
    }
  }

  // Отправка состояния игры конкретному клиенту
  async sendGameState(ws: WebSocket) {
    try {
      const gameState = await storage.getGameState();
      const cities = await storage.getCities();

      if (gameState && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'GAME_UPDATE',
          gameState
        }));
      }

      if (cities && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'CITIES_UPDATE',
          cities
        }));
      }
    } catch (error) {
      console.error('Error sending game state:', error);
    }
  }

  // Отправка состояния игры всем клиентам
  async broadcastGameState() {
    try {
      const gameState = await storage.getGameState();
      const cities = await storage.getCities();

      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          if (gameState) {
            client.send(JSON.stringify({
              type: 'GAME_UPDATE',
              gameState
            }));
          }

          if (cities) {
            client.send(JSON.stringify({
              type: 'CITIES_UPDATE',
              cities
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error broadcasting game state:', error);
    }
  }

  // Обновление состояния игры
  async updateGameState(gameState: any, cities: any[]) {
    // Рассчитываем доходы ресурсов от всех городов
    const playerCities = cities.filter(city => city.owner === 'player');

    // Если у игрока нет городов, не обновляем ресурсы
    if (playerCities.length === 0) {
      console.log('[AI] Current status - Cities: 0 Resources:', gameState.resources, 'Military:', gameState.military);
      return;
    }

    // Рассчитываем базовые доходы от городов
    const cityResources = {
      gold: 0,
      food: 0,
      wood: 0,
      oil: 0,
      metal: 0,
      steel: 0,
      weapons: 0,
      influence: 0
    };

    let totalPopulation = 0;

    // Проходим по всем городам игрока
    for (const city of playerCities) {
      totalPopulation += city.population || 0;

      // Расчет дохода от налогов
      const taxRate = city.taxRate !== undefined ? city.taxRate : 5; // По умолчанию 5%
      let taxIncome;

      if (taxRate === 0) {
        // Если налоговая ставка 0%, то государство платит за жителей (отрицательный доход)
        taxIncome = -(city.population || 0) * 0.5; // Субсидия населению
      } else {
        // Доход от налогов зависит от ставки
        taxIncome = (city.population || 0) * (taxRate / 5); 
      }

      cityResources.gold += taxIncome;

      // Обновляем удовлетворенность города на основе налоговой ставки и других факторов
      let satisfactionChange = 0; // Начинаем с нуля
      const cityPopulation = city.population || 0;
      
      // Проверяем, есть ли население в городе
      if (cityPopulation > 0) {
        // Базовый прирост добавляем, но только если нет проблем с рабочими
        // Проверка нехватки рабочих
        const totalBuildingsCount = city.buildings?.length || 0;
        const availableWorkers = cityPopulation - totalBuildingsCount;
  
        if (totalBuildingsCount > 0 && availableWorkers < 0) {
          // Если не хватает рабочих, это сильно снижает удовлетворенность
          satisfactionChange -= 5.0;
          console.log(`City ${city.name} lacks workers: ${availableWorkers}, applying -5.0 satisfaction penalty`);
        } else {
          // Базовый прирост только если достаточно рабочих
          satisfactionChange += 0.5;
        }
  
        // Эффект от налоговой ставки
        if (taxRate > 5) {
          satisfactionChange -= (taxRate - 5) * 0.2; // Высокие налоги снижают удовлетворенность
        } else if (taxRate < 5) {
          satisfactionChange += (5 - taxRate) * 0.1; // Низкие налоги немного повышают
        }
  
        // Обновление удовлетворенности
        if (city.satisfaction !== undefined) {
          let newSatisfaction = city.satisfaction + satisfactionChange;
          // Ограничиваем значение от 0 до 100
          newSatisfaction = Math.max(0, Math.min(100, newSatisfaction));
  
          if (Math.abs(newSatisfaction - city.satisfaction) > 0.01) {
            await storage.updateCity(city.id, {
              satisfaction: newSatisfaction
            });
          }
        }
      } else {
        console.log(`City ${city.name} has no population, skipping satisfaction changes`);
      }

      // Базовые ресурсы добавляем только для специально построенных зданий
      // Базовое свойство city.resources используем только для определения возможных ресурсов в регионе
      // НЕ добавляем автоматически ресурсы из city.resources

      // Вместо этого, у нас уже есть логика добавления ресурсов от построенных зданий ниже

      // Добавляем бонусы от построенных зданий
      if (city.buildings) {
        for (const building of city.buildings) {
          // Здесь нужна логика для расчета бонусов от зданий
          // Например, 'farm' дает +5 food, 'logging_camp' дает +5 wood и т.д.

          // Это примерная реализация, нужно дополнить на основе вашей игровой механики
          switch (building) {
            case 'farm':
              cityResources.food += 5 * (city.population || 1) / 100;
              break;
            case 'logging_camp':
              cityResources.wood += 3;
              break;
            case 'gold_mine':
              cityResources.gold += 3;
              break;
            case 'oil_rig':
              cityResources.oil += 3;
              break;
            case 'metal_factory':
              cityResources.metal += 2;
              break;
            case 'steel_factory':
              if (cityResources.metal >= 1) {
                cityResources.metal -= 1;
                cityResources.steel += 1;
              }
              break;
            case 'weapons_factory':
              if (cityResources.steel >= 1) {
                cityResources.steel -= 1;
                cityResources.weapons += 1;
              }
              break;
            case 'theater':
            case 'park':
            case 'temple':
              cityResources.influence += 1;
              break;

            // Добавьте другие типы зданий по мере необходимости
          }
        }
      }

      // Проверяем свойство 'satisfaction' перед использованием
      if (city.satisfaction !== undefined) {
        // Добавляем бонус влияния ТОЛЬКО при высокой удовлетворенности (>70%)
        if (city.satisfaction > 70) {
          // Бонус растет на 0.05 за каждый процент удовлетворенности выше 70%
          const satisfactionBonus = (city.satisfaction - 70) * 0.05;
          cityResources.influence += satisfactionBonus;
        } else {
          // Иначе не добавляем никакого бонуса к влиянию от удовлетворенности
          console.log(`City ${city.name} satisfaction (${city.satisfaction.toFixed(1)}%) is below 70%, no influence bonus`);
        }
      }
    }

    // Рассчитываем расход еды на население
    const foodConsumption = totalPopulation * 0.1; // Например, 0.1 еды на 1 человека
    
    // Сохраняем общее производство еды перед вычетом потребления (для логов)
    const rawFoodProduction = cityResources.food;
    
    // Вычисляем чистое производство
    const netFoodProduction = rawFoodProduction - foodConsumption;
    
    // Устанавливаем значение в cityResources, но если прирост отрицательный,
    // обеспечиваем что мы будем вычитать, а не добавлять отрицательное число
    cityResources.food = netFoodProduction;

    console.log(`Total food consumption: ${-foodConsumption.toFixed(2)}, Raw production: ${rawFoodProduction.toFixed(2)}, Net production: ${netFoodProduction.toFixed(2)}, Available food: ${gameState.resources.food.toFixed(2)}`);

    // Обновляем состояние игры
    const newResources = { ...gameState.resources };
    // Инициализируем influence если его ещё нет
    if (newResources.influence === undefined) {
      newResources.influence = 0;
    }
    
    // Обрабатываем все ресурсы
    for (const [resource, amount] of Object.entries(cityResources)) {
      if (newResources[resource] !== undefined || resource === 'influence') {
        // Правильно обрабатываем положительные и отрицательные значения
        // Если ресурс - еда и ее потребление превышает производство
        if (resource === 'food' && amount < 0) {
          // Вычитаем потребление из текущих запасов
          newResources[resource] = Math.max(0, (newResources[resource] || 0) + Number(amount));
          console.log(`Еда потребляется: ${amount}, новый остаток: ${newResources[resource]}`);
        } else {
          // Для других ресурсов или положительного прироста еды 
          newResources[resource] = (newResources[resource] || 0) + Number(amount);
          
          // Проверяем, что ресурс не стал отрицательным
          if (newResources[resource] < 0) {
            newResources[resource] = 0;
          }
        }
        
        // Округляем до 4 знаков после запятой чтобы избежать проблем с плавающей точкой
        newResources[resource] = Math.round(newResources[resource] * 10000) / 10000;
      }
    }

    // Обновляем население в каждом городе на основе построенных зданий
    for (const city of playerCities) {
      // Базовый рост населения
      let populationGrowth = 0;

      // Рост от домов и других зданий
      if (city.buildings) {
        city.buildings.forEach(buildingId => {
          const building = BUILDINGS.find(b => b.id === buildingId);
          if (building && building.population && building.population.growth) {
            populationGrowth += building.population.growth;
          }
        });
      }

      // Проверяем, достаточно ли еды для роста
      if (newResources.food > 0) {
        // Если у города есть maxPopulation и текущее население меньше максимума
        if (city.maxPopulation && city.population < city.maxPopulation) {
          // Увеличиваем население на величину роста
          const newPopulation = city.population + populationGrowth;
          // Не превышаем максимальное население
          city.population = Math.min(newPopulation, city.maxPopulation);

          await storage.updateCity(city.id, { 
            population: city.population 
          });

          console.log(`City ${city.name} population updated: ${city.population}`);
        }
      }
    }

    // Обновляем общее население
    gameState.population = playerCities.reduce((sum, city) => sum + (city.population || 0), 0);
    
    // Производство военных из оружия
    // Проверяем наличие оружия
    if (newResources.weapons > 0) {
      // Проверяем, что у нас достаточно населения для новых военных
      const availablePopulation = gameState.population - gameState.military;
      if (availablePopulation > 0) {
        // За каждую единицу оружия создаём 1 военного, но не больше чем доступно населения
        const newMilitary = Math.min(1, availablePopulation, newResources.weapons);
        
        // Потребляем оружие
        newResources.weapons -= newMilitary;
        
        // Увеличиваем количество военных
        gameState.military = (gameState.military || 0) + newMilitary;
        
        console.log(`Military produced: ${newMilitary}, Total military: ${gameState.military}`);
      }
    }

    // Сохраняем обновленное состояние
    const updatedGameState = {
      ...gameState,
      resources: newResources
    };

    console.log('Updated game state:', updatedGameState);
    await storage.setGameState(updatedGameState);
  }
}

// Создаем экземпляр игрового цикла и экспортируем его
export const gameLoop = new GameLoop();