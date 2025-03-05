import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocket, WebSocketServer } from "ws";
import { gameLoop } from "./gameLoop";
import { BUILDINGS } from "../client/src/lib/game";
import { market } from "./market";
import { updateAllCityBoundaries, updateCityBoundary, updateAllRegionBoundaries } from "./osmService";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });

  // Обработка WebSocket соединений
  wss.on('connection', (ws) => {
    console.log('Client connected');
    gameLoop.addClient(ws);

    ws.on('error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      gameLoop.removeClient(ws);
    });
  });

  // Запуск игрового цикла
  gameLoop.start();

  // Построить здание в городе
  app.post('/api/cities/:id/build', async (req, res) => {
    const { id } = req.params;
    const { buildingId } = req.body;

    try {
      console.log(`Building ${buildingId} in city ${id}`);

      // Преобразуем id в число правильно
      const cityId = parseInt(id, 10);
      if (isNaN(cityId)) {
        return res.status(400).json({ message: 'Некорректный ID города' });
      }

      const cities = await storage.getCities();
      const city = cities.find(c => c.id === cityId);
      if (!city) {
        return res.status(404).json({ message: 'Город не найден' });
      }

      if (city.owner !== 'player') {
        return res.status(403).json({ message: 'Вы не можете строить в этом городе' });
      }

      // Проверяем, можно ли строить это здание
      const building = BUILDINGS.find(b => b.id === buildingId);
      if (!building) {
        return res.status(400).json({ message: 'Здание не найдено' });
      }

      console.log('Found building definition:', building);

      // Проверяем, доступно ли это здание для строительства
      if (city.availableBuildings && !city.availableBuildings.includes(buildingId)) {
        return res.status(400).json({ message: `Здание ${buildingId} недоступно в этом городе` });
      }

      // Проверяем лимит зданий
      const buildingCount = city.buildings.filter(b => b === buildingId).length;
      if (buildingCount >= (city.buildingLimits?.[buildingId] || 0)) {
        return res.status(400).json({ message: `Достигнут лимит для ${building.name}` });
      }

      // Проверяем ресурсы игрока
      const gameState = await storage.getGameState();
      if (!gameState || !gameState.resources) {
        return res.status(500).json({ message: 'Ошибка получения состояния игры' });
      }

      console.log('Current game state:', gameState);
      console.log('Building cost:', building.cost);

      // Убедимся, что building.cost существует и является объектом
      if (!building.cost || typeof building.cost !== 'object') {
        return res.status(400).json({ message: 'Некорректные данные о стоимости здания' });
      }

      for (const [resource, amount] of Object.entries(building.cost)) {
        if (gameState.resources[resource] === undefined || gameState.resources[resource] < amount) {
          return res.status(400).json({ message: `Недостаточно ресурса ${resource}` });
        }
      }

      // Вычитаем ресурсы
      const newResources = { ...gameState.resources };
      for (const [resource, amount] of Object.entries(building.cost)) {
        newResources[resource] -= amount;
      }

      try {
        // Сначала добавляем здание в город
        const updatedCity = await storage.updateCity(cityId, {
          buildings: [...city.buildings, buildingId]
        });

        if (!updatedCity) {
          return res.status(500).json({ message: 'Не удалось обновить город' });
        }

        // Затем обновляем состояние игры
        await storage.setGameState({ ...gameState, resources: newResources });

        console.log('Building successful:', updatedCity);

        // Отправляем обновленное состояние игры всем клиентам
        gameLoop.broadcastGameState();

        // Отправляем ответ клиенту
        res.json({ 
          success: true, 
          city: updatedCity,
          gameState: { ...gameState, resources: newResources }
        });
      } catch (updateError) {
        console.error('Error updating city or game state:', updateError);
        return res.status(500).json({ message: 'Ошибка при обновлении данных', details: updateError.message });
      }
    } catch (error) {
      console.error('Error building structure:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера', details: error.message });
    }
  });

  // Изменить налоговую ставку города
  app.post('/api/cities/:id/tax', async (req, res) => {
    const { id } = req.params;
    const { taxRate } = req.body;

    try {
      const cities = await storage.getCities();
      const city = cities.find(c => c.id === parseInt(id));
      if (!city) {
        return res.status(404).json({ message: 'Город не найден' });
      }

      if (city.owner !== 'player') {
        return res.status(403).json({ message: 'Вы не контролируете этот город' });
      }

      // Проверяем корректность налоговой ставки
      if (taxRate < 0 || taxRate > 10) {
        return res.status(400).json({ message: 'Налоговая ставка должна быть от 0 до 10' });
      }

      // Обновляем налоговую ставку города (убедимся, что сохраняем числовое значение)
      await storage.updateCity(city.id, { taxRate: Number(taxRate) });

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  });

  app.get("/api/cities", async (_req, res) => {
    try {
      const cities = await storage.getCities();
      res.json(cities);
    } catch (error) {
      console.error('Error fetching cities:', error);
      res.status(500).json({ message: 'Failed to fetch cities' });
    }
  });

  app.patch("/api/cities/:id/capture", async (req, res) => {
    try {
      const { id } = req.params;
      const cityId = parseInt(id);
      const { isCapital, captureMethod = 'military' } = req.body; // Флаг указывающий, что это выбор столицы

      // Получаем данные города и состояние игры
      const cities = await storage.getCities();
      const city = cities.find(c => c.id === cityId);
      const gameState = await storage.getGameState();

      if (!city) {
        return res.status(404).json({ error: 'City not found' });
      }

      if (isCapital) {
        // Это первый выбор столицы - захватываем без военных
        const capturedCity = await storage.updateCity(cityId, { 
          owner: 'player',
          population: 0 // Устанавливаем начальное население в 0
        });

        console.log("Capital city captured successfully");

        res.json({ 
          success: true,
          city: capturedCity,
          gameState,
          message: 'Столица выбрана успешно!'
        });
      } else {
        // Обычный захват города
        // Проверяем, есть ли у нас достаточно военных для захвата
        const requiredMilitary = Math.ceil(city.maxPopulation / 4);

        if (gameState.military < requiredMilitary) {
          return res.status(400).json({ 
            error: 'Not enough military units',
            required: requiredMilitary
          });
        }

        // Захватываем город
        const capturedCity = await storage.updateCity(cityId, { 
          owner: 'player',
          population: 0, // Устанавливаем начальное население в 0
          satisfaction: 50 // Устанавливаем начальное значение удовлетворенности
        });

        // Уменьшаем количество военных
        gameState.military -= requiredMilitary;
        await storage.setGameState(gameState);

        res.json({ 
          success: true,
          city: capturedCity,
          gameState
        });
      }
    } catch (error) {
      console.error('Error capturing city:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });


  app.post("/api/military/transfer", async (req, res) => {
    try {
      const { fromCityId, toCityId, amount } = req.body;

      // Получаем города
      const cities = await storage.getCities();
      const fromCity = cities.find(c => c.id === Number(fromCityId));
      const toCity = cities.find(c => c.id === Number(toCityId));

      if (!fromCity || !toCity) {
        return res.status(404).json({ message: 'City not found' });
      }

      // Проверяем наличие необходимого количества военных
      if (!fromCity.military || fromCity.military < amount) {
        return res.status(400).json({ message: 'Insufficient military units' });
      }

      // Уменьшаем количество военных в исходном городе
      await storage.updateCity(Number(fromCityId), {
        military: fromCity.military - amount
      });

      // Рассчитываем время перемещения
      const travelTime = calculateTravelTime(fromCity, toCity);

      // Создаем передвижение армии
      const armyTransfer = {
        id: Date.now(),
        fromCity: fromCity,
        toCity: toCity,
        amount: amount,
        startTime: Date.now(),
        arrivalTime: Date.now() + travelTime,
        owner: fromCity.owner
      };

      // Сохраняем информацию о перемещении армии в хранилище
      await storage.addArmyTransfer(armyTransfer);

      // Уведомляем всех клиентов о начале перемещения армии
      const militaryTransferData = {
        type: 'MILITARY_TRANSFER_START',
        id: armyTransfer.id,
        fromCity: { 
          id: fromCity.id, 
          name: fromCity.name, 
          latitude: fromCity.latitude, 
          longitude: fromCity.longitude 
        },
        toCity: { 
          id: toCity.id, 
          name: toCity.name, 
          latitude: toCity.latitude, 
          longitude: toCity.longitude 
        },
        amount,
        duration: travelTime,
        startTime: Date.now()
      };

      // Отправляем через WebSocket
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(militaryTransferData));
        }
      }

      // Запускаем таймер для обработки прибытия армии
      setTimeout(async () => {
        try {
          // Получаем актуальное состояние целевого города
          const updatedCities = await storage.getCities();
          const currentToCity = updatedCities.find(c => c.id === Number(toCityId));

          if (!currentToCity) return;

          // Обновляем целевой город
          if (currentToCity.owner === fromCity.owner) {
            // Если город принадлежит тому же игроку, просто добавляем военных
            await storage.updateCity(Number(toCityId), {
              military: (currentToCity.military || 0) + amount
            });
          } else {
            // Если город не принадлежит игроку, происходит атака
            const defenseStrength = currentToCity.military || 0;

            if (amount > defenseStrength) {
              // Атака успешна, захватываем город
              await storage.updateCity(Number(toCityId), {
                owner: fromCity.owner,
                military: amount - defenseStrength,
                // Если захватываем нейтральный город, сбрасываем его население
                population: currentToCity.owner === 'neutral' ? 0 : currentToCity.population
              });
            } else {
              // Атака отбита, уменьшаем количество защитников
              await storage.updateCity(Number(toCityId), {
                military: defenseStrength - amount
              });
            }
          }

          // Удаляем перемещение из хранилища
          await storage.removeArmyTransfer(armyTransfer.id);

          // Уведомляем клиентов о завершении перемещения
          const transferCompleteData = {
            type: 'MILITARY_TRANSFER_COMPLETE',
            id: armyTransfer.id,
            toCity: toCityId,
            result: currentToCity.owner === fromCity.owner ? 'reinforced' : (amount > defenseStrength ? 'captured' : 'failed')
          };

          for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(transferCompleteData));
            }
          }

          // Обновляем игровое состояние у всех клиентов
          gameLoop.broadcastGameState();

        } catch (error) {
          console.error('Error processing military arrival:', error);
        }
      }, travelTime);

      res.json({ success: true, travelTime });

    } catch (error) {
      console.error('Error transferring military:', error);
      res.status(500).json({ message: 'Failed to transfer military' });
    }
  });

  app.get("/api/game-state", async (_req, res) => {
    try {
      const state = await storage.getGameState();
      res.json(state);
    } catch (error) {
      console.error('Error fetching game state:', error);
      res.status(500).json({ message: 'Failed to fetch game state' });
    }
  });

  app.post("/api/game-state", async (req, res) => {
    try {
      await storage.setGameState(req.body);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating game state:', error);
      res.status(500).json({ message: 'Failed to update game state' });
    }
  });

  // API эндпоинты для рыночной системы

  // Получение списка лотов
  app.get("/api/market/listings", (_req, res) => {
    try {
      const listings = market.getListings();
      res.json(listings);
    } catch (error) {
      console.error('Ошибка при получении списка лотов:', error);
      res.status(500).json({ message: 'Failed to get listings' });
    }
  });

  // Получение истории цен
  app.get("/api/market/prices/:resourceType", (req, res) => {
    try {
      const { resourceType } = req.params;
      const days = req.query.days ? Number(req.query.days) : undefined;

      const prices = market.getPriceHistory(resourceType as any, days);
      res.json(prices);
    } catch (error) {
      console.error('Ошибка при получении истории цен:', error);
      res.status(500).json({ message: 'Failed to get price history' });
    }
  });

  // Получение истории транзакций
  app.get("/api/market/transactions", (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const transactions = market.getTransactions();

      // Если указан лимит, возвращаем только последние N транзакций
      const result = limit ? transactions.slice(-limit) : transactions;
      res.json(result);
    } catch (error) {
      console.error('Ошибка при получении истории транзакций:', error);
      res.status(500).json({ message: 'Failed to get transactions' });
    }
  });

  // Создание нового лота
  app.post("/api/market/create-listing", async (req, res) => {
    try {
      const { resourceType, amount, pricePerUnit, type } = req.body;

      const result = await market.createPlayerListing({
        resourceType,
        amount: Number(amount),
        pricePerUnit: Number(pricePerUnit),
        type
      });

      if (result) {
        // Обновляем игровое состояние у всех клиентов
        gameLoop.broadcastGameState();
        res.json({ success: true });
      } else {
        res.status(400).json({ message: 'Failed to create listing' });
      }
    } catch (error) {
      console.error('Ошибка при создании лота:', error);
      res.status(500).json({ message: 'Failed to create listing' });
    }
  });

  // Покупка или продажа лота
  app.post("/api/market/purchase", async (req, res) => {
    try {
      const { listingId } = req.body;

      const result = await market.buyListing(Number(listingId), 'player');

      if (result) {
        // Обновляем игровое состояние у всех клиентов
        gameLoop.broadcastGameState();

        // Обеспечиваем обновление состояния игры у клиента, который совершил покупку
        const gameState = await storage.getGameState();

        res.json({ success: true, gameState });
      } else {
        res.status(400).json({ message: 'Failed to buy listing' });
      }
    } catch (error) {
      console.error('Ошибка при покупке лота:', error);
      res.status(500).json({ message: 'Failed to buy listing' });
    }
  });

  // Отмена лота
  app.post("/api/market/cancel", async (req, res) => {
    try {
      const { listingId } = req.body;

      const result = await market.cancelListing(Number(listingId));

      if (result) {
        // Обновляем игровое состояние у всех клиентов
        gameLoop.broadcastGameState();
        res.json({ success: true });
      } else {
        res.status(400).json({ message: 'Failed to cancel listing' });
      }
    } catch (error) {
      console.error('Ошибка при отмене лота:', error);
      res.status(500).json({ message: 'Failed to cancel listing' });
    }
  });

  // Обработка покупки лота (новый эндпоинт)
  app.post("/api/market/purchase-listing", async (req, res) => {
    try {
      const { listingId } = req.body;

      const result = await market.purchaseListing(listingId);

      if (result) {
        // Получаем обновленное состояние игры
        const gameState = await storage.getGameState();

        // Обновляем игровое состояние у всех клиентов
        gameLoop.broadcastGameState();

        res.json({ success: true, gameState });
      } else {
        res.status(400).json({ message: 'Failed to purchase listing' });
      }
    } catch (error) {
      console.error('Ошибка при покупке/продаже лота:', error);
      res.status(500).json({ message: 'Failed to purchase listing' });
    }
  });

  // Получение истории транзакций
  app.get("/api/market/transactions", (_req, res) => {
    try {
      const transactions = market.getTransactions();
      res.json(transactions);
    } catch (error) {
      console.error('Ошибка при получении истории транзакций:', error);
      res.status(500).json({ message: 'Failed to get transactions' });
    }
  });

  // Получение истории цен
  app.get("/api/market/price-history/:resource", (req, res) => {
    try {
      const { resource } = req.params;
      const { days } = req.query;

      const priceHistory = market.getPriceHistory(
        resource as any, 
        days ? Number(days) : undefined
      );

      res.json(priceHistory);
    } catch (error) {
      console.error('Ошибка при получении истории цен:', error);
      res.status(500).json({ message: 'Failed to get price history' });
    }
  });

  // Эндпоинт для обновления границ всех областей
  app.post("/api/regions/update-boundaries", async (_req, res) => {
    try {
      await updateAllRegionBoundaries();
      const regions = await storage.getRegions();
      res.json(regions);
    } catch (error) {
      console.error('Ошибка при обновлении границ областей:', error);
      res.status(500).json({ message: 'Failed to update region boundaries' });
    }
  });

  // Эндпоинт для исправления пересечений границ
  app.post("/api/regions/fix-intersections", async (_req, res) => {
    try {
      // Импортируем необходимые функции
      const { fixBoundaryIntersections } = await import('./osmService');

      // Получаем текущие регионы
      const regions = await storage.getRegions();

      // Исправляем пересечения границ
      const fixedRegions = fixBoundaryIntersections(regions);

      // Сохраняем обновленные данные
      await storage.updateRegionsData(fixedRegions);

      res.json(fixedRegions);
    } catch (error) {
      console.error('Ошибка при исправлении пересечений границ:', error);
      res.status(500).json({ message: 'Failed to fix boundary intersections' });
    }
  });

  // Сохраним старый эндпоинт для обратной совместимости
  app.post("/api/cities/update-boundaries", async (_req, res) => {
    try {
      await updateAllRegionBoundaries();
      const regions = await storage.getRegions();
      res.json(regions);
    } catch (error) {
      console.error('Ошибка при обновлении границ областей:', error);
      res.status(500).json({ message: 'Failed to update region boundaries' });
    }
  });

  // Построить здание в области
  app.post('/api/build/:cityId', async (req, res) => {
    const { cityId } = req.params;
    const { buildingId } = req.body;

    try {
      const cities = await storage.getCities();
      const city = cities.find(c => c.id === parseInt(cityId));

      if (!city) {
        return res.status(404).json({ error: `City with ID ${cityId} not found` });
      }

      // Проверяем, доступно ли это здание для строительства
      if (city.availableBuildings && !city.availableBuildings.includes(buildingId)) {
        return res.status(400).json({ error: `Building ${buildingId} is not available in this city` });
      }

      // Проверяем, не превышен ли лимит данного типа зданий
      if (city.buildingLimits) {
        const currentCount = city.buildings.filter(b => b === buildingId).length;
        const limit = city.buildingLimits[buildingId] || 0;

        if (currentCount >= limit) {
          return res.status(400).json({ 
            error: `Cannot build more than ${limit} ${buildingId} buildings in this city` 
          });
        }
      }

      // Добавляем здание к городу
      const updatedCity = await storage.updateCity(parseInt(cityId), {
        buildings: [...city.buildings, buildingId]
      });

      res.json(updatedCity);
    } catch (error) {
      console.error('Error building:', error);
      res.status(500).json({ error: 'An error occurred during building' });
    }
  });

  // Захват нейтральной территории
  app.post('/api/capture-region', async (req, res) => {
    try {
      const { regionId, militaryAmount, captureMethod } = req.body;

      console.log(`Attempting to capture city ${regionId} using method: ${captureMethod}`);

      // Проверяем наличие всех необходимых данных
      if (!regionId) {
        return res.status(400).json({ success: false, message: 'Не указан ID региона' });
      }

      // Получаем данные о регионе
      const regions = await storage.getRegions();
      const region = regions.find(r => r.id === Number(regionId));

      if (!region) {
        return res.status(404).json({ success: false, message: 'Регион не найден' });
      }

      // Проверяем, что регион нейтральный
      if (region.owner !== 'neutral') {
        return res.status(400).json({ success: false, message: 'Можно захватить только нейтральную территорию' });
      }

      // Получаем текущее состояние игры
      const gameState = await storage.getGameState();

      // Определяем метод захвата
      if (captureMethod === 'influence') {
        // Мирный захват через влияние
        const requiredInfluence = Math.ceil(region.maxPopulation / 2); // Требуется больше влияния, чем военных

        console.log(`Required influence: ${requiredInfluence}, Available: ${gameState.resources.influence}`);

        // Проверяем, достаточно ли влияния
        if (gameState.resources.influence === undefined || gameState.resources.influence < requiredInfluence) {
          return res.status(400).json({ 
            success: false, 
            message: 'Недостаточно влияния для мирного захвата', 
            required: requiredInfluence,
            available: gameState.resources.influence || 0
          });
        }

        // Уменьшаем количество влияния
        gameState.resources.influence -= requiredInfluence;
        await storage.setGameState(gameState);

        try {
          // Захватываем территорию с лучшими начальными условиями
          const updatedRegion = await storage.updateRegion(Number(regionId), { 
            owner: 'player',
            military: 0, // Без военных
            satisfaction: 75 // Более высокая начальная удовлетворенность
          });
          
          console.log('Region captured through influence:', updatedRegion);
          return res.json({ success: true, region: updatedRegion, gameState });
        } catch (updateError) {
          console.error('Error updating region:', updateError);
          return res.status(500).json({ success: false, message: 'Ошибка при обновлении региона', error: updateError.message });
        }
      } else {
        // Военный захват
        // Проверяем, что указано количество военных
        if (militaryAmount === undefined) {
          return res.status(400).json({ 
            success: false, 
            message: 'Не указано количество военных для захвата' 
          });
        }

        // Проверяем, что у игрока достаточно военных
        if (gameState.military < militaryAmount) {
          return res.status(400).json({ 
            success: false, 
            message: 'Недостаточно военных для захвата',
            required: militaryAmount
          });
        }

        // Захватываем территорию и сохраняем текущую удовлетворенность
        const updatedRegion = await storage.updateRegion(regionId, { 
          owner: 'player',
          military: militaryAmount,
          satisfaction: 50 // Стандартная удовлетворенность при военном захвате
        });

        // Уменьшаем количество военных
        gameState.military -= militaryAmount;
        await storage.setGameState(gameState);

        return res.json({ success: true, region: updatedRegion, gameState });
      }
    } catch (error) {
      console.error('Error capturing region:', error);
      res.status(500).json({ success: false, message: 'Ошибка захвата региона' });
    }
  });


  return httpServer;
}

function calculateDistance(city1: any, city2: any): number {
  const R = 6371; // Earth's radius in km
  const lat1 = city1.latitude * Math.PI / 180;
  const lat2 = city2.latitude * Math.PI / 180;
  const dLat = (city2.latitude - city1.latitude) * Math.PI / 180;
  const dLon = (city2.longitude - city1.longitude) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon/2) * Math.sin(dLon/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Рассчитываем время перемещения на основе расстояния
// Скорость армии: 100 км/ч для простоты расчетов
function calculateTravelTime(city1: any, city2: any): number {
  const distance = calculateDistance(city1, city2);
  const speed = 100; // км/ч
  // Время в миллисекундах для анимации
  // Минимум 5 секунд, максимум 30 секунд для игрового баланса
  return Math.min(Math.max(Math.round(distance / speed * 3600 * 1000), 5000), 30000);
}