import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocket, WebSocketServer } from "ws";
import { gameLoop } from "./gameLoop";
import { BUILDINGS } from "../client/src/lib/game";
import { market } from "./market";
import { Router } from 'express';
import { loadAllCityBoundaries } from './osmService';

export const router = Router();

// Инициализация границ городов при старте сервера
(async () => {
  try {
    console.log('Initializing city boundaries on server startup...');
    await loadAllCityBoundaries();
    console.log('City boundaries initialization completed');
  } catch (error) {
    console.error('Failed to initialize city boundaries:', error);
  }
})();

// Получение состояния игры
router.get('/api/gameState', async (req, res) => {
  try {
    const gameState = await storage.getGameState();
    res.json(gameState);
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({ message: 'Error getting game state' });
  }
});

// Получение городов
router.get('/api/cities', async (req, res) => {
  try {
    const cities = await storage.getCities();
    res.json(cities);
  } catch (error) {
    console.error('Error getting cities:', error);
    res.status(500).json({ message: 'Error getting cities' });
  }
});

// Захват города
router.post('/api/cities/:cityId/capture', async (req, res) => {
  try {
    const cityId = parseInt(req.params.cityId, 10);

    // Получаем текущее состояние игры и городов
    const gameState = await storage.getGameState();
    const cities = await storage.getCities();

    // Проверяем, есть ли уже город-столица
    const hasCapital = cities.some(city => city.owner === 'player');

    const city = cities.find(c => c.id === cityId);
    if (!city) {
      return res.status(404).json({ message: 'City not found' });
    }

    // Проверяем, что город не захвачен
    if (city.owner !== 'neutral') {
      return res.status(400).json({ message: 'City already captured' });
    }

    // Если это первый город (столица), то просто захватываем его
    if (!hasCapital) {
      // Обновляем город
      city.owner = 'player';
      await storage.updateCity(cityId, { owner: 'player' });

      // Обновляем состояние игры (широковещательная рассылка)
      gameLoop.broadcastGameState();

      return res.json({ success: true });
    }

    // Если это не первый город, проверяем наличие достаточного количества военных
    if (gameState.military < city.maxPopulation / 4) {
      return res.status(400).json({ 
        message: 'Not enough military to capture city',
        required: Math.ceil(city.maxPopulation / 4)
      });
    }

    // Вычитаем военных
    const militaryUsed = Math.ceil(city.maxPopulation / 4);
    gameState.military -= militaryUsed;

    // Обновляем город
    city.owner = 'player';

    // Сохраняем изменения
    await storage.updateCity(cityId, { owner: 'player' });
    await storage.updateGameState({ military: gameState.military });

    // Обновляем состояние игры (широковещательная рассылка)
    gameLoop.broadcastGameState();

    res.json({ success: true });
  } catch (error) {
    console.error('Error capturing city:', error);
    res.status(500).json({ message: 'Error capturing city' });
  }
});

// Строительство здания
router.post('/api/cities/:cityId/build', async (req, res) => {
  try {
    const { buildingId } = req.body;
    const cityId = parseInt(req.params.cityId, 10);

    // Получаем данные о здании из конфигурации игры
    const building = gameLoop.getBuildingInfo(buildingId);
    if (!building) {
      return res.status(404).json({ message: 'Building not found' });
    }

    // Получаем текущее состояние игры и город
    const gameState = await storage.getGameState();
    const city = await storage.getCity(cityId);

    if (!city) {
      return res.status(404).json({ message: 'City not found' });
    }

    // Проверяем, что город принадлежит игроку
    if (city.owner !== 'player') {
      return res.status(400).json({ message: 'Cannot build in neutral city' });
    }

    // Проверяем, есть ли уже такое здание
    if (city.buildings.includes(buildingId)) {
      return res.status(400).json({ message: 'Building already exists in city' });
    }

    // Проверяем ресурсы
    for (const [resource, amount] of Object.entries(building.cost)) {
      if ((gameState.resources as any)[resource] < amount) {
        return res.status(400).json({ 
          message: `Not enough ${resource}`, 
          required: amount, 
          available: (gameState.resources as any)[resource]
        });
      }
    }

    // Вычитаем ресурсы
    for (const [resource, amount] of Object.entries(building.cost)) {
      (gameState.resources as any)[resource] -= amount;
    }

    // Добавляем здание в город
    city.buildings.push(buildingId);

    // Сохраняем изменения
    await storage.updateGameState({ resources: gameState.resources });
    await storage.updateCity(cityId, { buildings: city.buildings });

    // Обновляем состояние игры (широковещательная рассылка)
    gameLoop.broadcastGameState();

    res.json({ success: true });
  } catch (error) {
    console.error('Error building:', error);
    res.status(500).json({ message: 'Error building' });
  }
});

// Перемещение военных между городами
router.post('/api/cities/:cityId/transferMilitary', async (req, res) => {
  try {
    const { targetCityId } = req.body;
    const sourceId = parseInt(req.params.cityId, 10);
    const targetId = parseInt(targetCityId, 10);

    // Получаем города
    const sourceCity = await storage.getCity(sourceId);
    const targetCity = await storage.getCity(targetId);

    if (!sourceCity || !targetCity) {
      return res.status(404).json({ message: 'City not found' });
    }

    // Проверяем, что оба города принадлежат игроку
    if (sourceCity.owner !== 'player' || targetCity.owner !== 'player') {
      return res.status(400).json({ message: 'Both cities must be player owned' });
    }

    // Проверяем, что в исходном городе есть военные
    if (!sourceCity.military) {
      return res.status(400).json({ message: 'No military in source city' });
    }

    // Перемещаем всех военных
    const militaryToTransfer = sourceCity.military;
    sourceCity.military = 0;
    targetCity.military = (targetCity.military || 0) + militaryToTransfer;

    // Сохраняем изменения
    await storage.updateCity(sourceId, { military: sourceCity.military });
    await storage.updateCity(targetId, { military: targetCity.military });

    // Обновляем состояние игры (широковещательная рассылка)
    gameLoop.broadcastGameState();

    res.json({ success: true });
  } catch (error) {
    console.error('Error transferring military:', error);
    res.status(500).json({ message: 'Error transferring military' });
  }
});

// Получение списка товаров на рынке
router.get('/api/market/listings', async (req, res) => {
  try {
    const listings = await market.getListings();
    res.json(listings);
  } catch (error) {
    console.error('Error getting market listings:', error);
    res.status(500).json({ message: 'Error getting market listings' });
  }
});

// Покупка товара на рынке
router.post('/api/market/purchase', async (req, res) => {
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
    console.error('Error purchasing listing:', error);
    res.status(500).json({ message: 'Error purchasing listing' });
  }
});

// Создание товара на рынке
router.post('/api/market/create', async (req, res) => {
  try {
    const { offer, price } = req.body;

    // Получаем текущее состояние игры
    const gameState = await storage.getGameState();

    // Проверяем, есть ли у игрока достаточно ресурсов
    for (const [resource, amount] of Object.entries(offer)) {
      if ((gameState.resources as any)[resource] < amount) {
        return res.status(400).json({ 
          message: `Not enough ${resource}`, 
          required: amount, 
          available: (gameState.resources as any)[resource]
        });
      }
    }

    // Вычитаем ресурсы
    for (const [resource, amount] of Object.entries(offer)) {
      (gameState.resources as any)[resource] -= amount;
    }

    // Создаем товар на рынке
    await market.createListing(offer, price);

    // Сохраняем изменения
    await storage.updateGameState({ resources: gameState.resources });

    // Обновляем состояние игры у всех клиентов
    gameLoop.broadcastGameState();

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ message: 'Error creating listing' });
  }
});


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

  app.use(router);

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