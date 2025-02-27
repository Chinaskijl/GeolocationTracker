import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocket, WebSocketServer } from "ws";
import { gameLoop } from "./gameLoop";
import { BUILDINGS } from "../client/src/lib/game";

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
      
      // Уведомляем всех клиентов о начале перемещения армии
      const militaryTransferData = {
        type: 'MILITARY_TRANSFER_START',
        fromCity,
        toCity,
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
                military: amount - defenseStrength
              });
            } else {
              // Атака отбита, уменьшаем количество защитников
              await storage.updateCity(Number(toCityId), {
                military: defenseStrength - amount
              });
            }
          }
          
          // Уведомляем клиентов о завершении перемещения
          const transferCompleteData = {
            type: 'MILITARY_TRANSFER_COMPLETE',
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