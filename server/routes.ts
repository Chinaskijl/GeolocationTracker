import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocket, WebSocketServer } from "ws";
import { gameLoop } from "./gameLoop";
import { BUILDINGS } from "../client/src/lib/game";
import { market } from "./market";

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

  app.post("/api/cities/:id/build", async (req, res) => {
    try {
      const { id } = req.params;
      const { buildingId } = req.body;

      const city = await storage.getCities().then(cities => 
        cities.find(c => c.id === Number(id))
      );

      if (!city) {
        return res.status(404).json({ message: 'City not found' });
      }

      const building = BUILDINGS.find(b => b.id === buildingId);
      if (!building) {
        return res.status(404).json({ message: 'Building not found' });
      }

      // Проверка лимита зданий
      const existingBuildingCount = city.buildings.filter(b => b === buildingId).length;
      if (existingBuildingCount >= building.maxCount) {
        return res.status(400).json({ message: 'Building limit reached' });
      }

      // Получение текущего состояния игры
      const gameState = await storage.getGameState();

      // Проверка ресурсов
      const canAfford = Object.entries(building.cost).every(
        ([resource, amount]) => 
          gameState.resources[resource as keyof typeof gameState.resources] >= amount
      );

      if (!canAfford) {
        return res.status(400).json({ message: 'Insufficient resources' });
      }

      // Списание ресурсов
      const newResources = { ...gameState.resources };
      Object.entries(building.cost).forEach(([resource, amount]) => {
        newResources[resource as keyof typeof newResources] -= amount;
      });

      // Обновление состояния игры
      await storage.setGameState({
        ...gameState,
        resources: newResources
      });

      // Обновление города
      const updatedCity = await storage.updateCity(Number(id), {
        buildings: [...city.buildings, buildingId]
      });

      // Немедленная отправка обновленных данных через WebSocket
      gameLoop.broadcastGameState();

      res.json(updatedCity);
    } catch (error) {
      console.error('Error building:', error);
      res.status(500).json({ message: 'Failed to build' });
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

  app.post("/api/cities/:id/capture", async (req, res) => {
    try {
      const { id } = req.params;
      const { owner } = req.body;

      const city = await storage.updateCity(Number(id), { owner });

      res.json(city);
    } catch (error) {
      console.error('Error capturing city:', error);
      res.status(500).json({ message: 'Failed to capture city' });
    }
  });

  // Новый эндпоинт для отправки армии между городами
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

  // Покупка лота
  app.post("/api/market/buy", async (req, res) => {
    try {
      const { listingId } = req.body;
      
      const result = await market.buyListing(Number(listingId), 'player');
      
      if (result) {
        // Обновляем игровое состояние у всех клиентов
        gameLoop.broadcastGameState();
        res.json({ success: true });
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