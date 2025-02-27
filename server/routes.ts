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

      // Добавление здания в город
      const updatedCity = await storage.updateCity(Number(id), {
        buildings: [...city.buildings, buildingId]
      });

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
  
  app.post("/api/cities/:id/update-military", async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      
      const city = await storage.getCities().then(cities => 
        cities.find(c => c.id === Number(id))
      );
      
      if (!city) {
        return res.status(404).json({ message: 'City not found' });
      }
      
      const newMilitary = Math.max(0, (city.military || 0) + amount);
      const updatedCity = await storage.updateCity(Number(id), {
        military: newMilitary
      });
      
      res.json(updatedCity);
    } catch (error) {
      console.error('Error updating military:', error);
      res.status(500).json({ message: 'Failed to update military' });
    }
  });
  
  app.post("/api/cities/:id/attack", async (req, res) => {
    try {
      const { id } = req.params;
      const { fromCityId, armySize } = req.body;
      
      const cities = await storage.getCities();
      const targetCity = cities.find(c => c.id === Number(id));
      const fromCity = cities.find(c => c.id === Number(fromCityId));
      
      if (!targetCity || !fromCity) {
        return res.status(404).json({ message: 'City not found' });
      }
      
      // Расчет результатов атаки
      const defenseStrength = targetCity.military || 0;
      const attackSuccess = armySize > defenseStrength;
      
      let survivingAttackers = Math.max(0, armySize - defenseStrength);
      let newOwner = targetCity.owner;
      
      if (attackSuccess) {
        // Атака успешна, город захвачен
        newOwner = fromCity.owner;
        
        // Обновляем целевой город
        await storage.updateCity(Number(id), {
          owner: newOwner,
          military: survivingAttackers
        });
        
        res.json({ success: true, captured: true });
      } else {
        // Атака отбита
        const remainingDefenders = defenseStrength - armySize;
        await storage.updateCity(Number(id), {
          military: remainingDefenders
        });
        
        res.json({ success: true, captured: false });
      }
    } catch (error) {
      console.error('Error attacking city:', error);
      res.status(500).json({ message: 'Failed to attack city' });
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