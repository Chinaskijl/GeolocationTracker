import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocket, WebSocketServer } from "ws";
import type { GameState } from "@shared/schema";
import { BUILDINGS, POPULATION_FOOD_CONSUMPTION } from "../client/src/lib/game";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'  // Explicit WebSocket path
  });

  // WebSocket error handling
  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  // Start resource production interval
  setInterval(async () => {
    try {
      const cities = await storage.getCities();
      const gameState = await storage.getGameState();
      console.log('Current game state:', gameState);

      let totalFoodConsumption = 0;
      let totalPopulationGrowth = 0;
      let totalMilitaryGrowth = 0;
      let totalPopulationUsed = 0;

      const newResources = { ...gameState.resources };

      // Calculate production from all buildings in all player cities
      for (const city of cities) {
        if (city.owner === 'player') {
          console.log(`Processing city ${city.name}:`, city);

          let cityPopulationGrowth = 0;
          let cityMilitaryGrowth = 0;
          let cityPopulationUsed = 0;

          city.buildings.forEach(buildingId => {
            const building = BUILDINGS.find(b => b.id === buildingId);
            if (!building) return;

            console.log(`Processing building ${building.name} in ${city.name}`);

            // Resource production
            if (building.resourceProduction) {
              const { type, amount } = building.resourceProduction;
              newResources[type] += amount;
              console.log(`Resource production: +${amount} ${type}`);
            }

            // Population growth from houses
            if (building.population?.growth) {
              cityPopulationGrowth += building.population.growth;
              console.log(`Population growth: +${building.population.growth}`);
            }

            // Military production and population use from barracks
            if (building.military) {
              cityMilitaryGrowth += building.military.production;
              cityPopulationUsed += building.military.populationUse;
              console.log(`Military production: +${building.military.production}, Population used: -${building.military.populationUse}`);
            }
          });

          // Update city population
          const newPopulation = Math.min(
            city.maxPopulation,
            Math.max(0, city.population + cityPopulationGrowth - cityPopulationUsed)
          );

          totalPopulationGrowth += cityPopulationGrowth;
          totalMilitaryGrowth += cityMilitaryGrowth;
          totalPopulationUsed += cityPopulationUsed;

          // Update city
          await storage.updateCity(city.id, {
            population: newPopulation,
            military: (city.military || 0) + cityMilitaryGrowth
          });
        }
      }

      // Calculate food consumption
      totalFoodConsumption = gameState.population * POPULATION_FOOD_CONSUMPTION;
      console.log(`Total food consumption: -${totalFoodConsumption}`);

      // Update game state with new resources
      const newGameState = {
        ...gameState,
        resources: {
          ...newResources,
          food: Math.max(0, newResources.food - totalFoodConsumption)
        },
        population: Math.max(0, gameState.population + totalPopulationGrowth - totalPopulationUsed),
        military: gameState.military + totalMilitaryGrowth
      };

      console.log('Updated game state:', newGameState);
      await storage.setGameState(newGameState);

      // Broadcast updates to all clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ 
            type: 'GAME_UPDATE',
            gameState: newGameState
          }));

          // Send updated cities
          client.send(JSON.stringify({
            type: 'CITIES_UPDATE',
            cities: cities.filter(city => city.owner === 'player')
          }));
        }
      });
    } catch (error) {
      console.error('Error in resource production interval:', error);
    }
  }, 1000); // Update every second

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

      // Check building limit
      const existingBuildingCount = city.buildings.filter(b => b === buildingId).length;
      if (existingBuildingCount >= building.maxCount) {
        return res.status(400).json({ message: 'Building limit reached' });
      }

      // Get current game state
      const gameState = await storage.getGameState();

      // Check if player can afford the building
      const canAfford = Object.entries(building.cost).every(
        ([resource, amount]) => 
          gameState.resources[resource as keyof typeof gameState.resources] >= amount
      );

      if (!canAfford) {
        return res.status(400).json({ message: 'Insufficient resources' });
      }

      // Deduct resources
      const newResources = { ...gameState.resources };
      Object.entries(building.cost).forEach(([resource, amount]) => {
        newResources[resource as keyof typeof newResources] -= amount;
      });

      // Update game state
      await storage.setGameState({
        ...gameState,
        resources: newResources
      });

      // Add building to city
      const updatedCity = await storage.updateCity(Number(id), {
        buildings: [...city.buildings, buildingId]
      });

      // Broadcast updates to all clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ 
            type: 'GAME_UPDATE',
            gameState: {
              ...gameState,
              resources: newResources
            }
          }));
          client.send(JSON.stringify({ 
            type: 'CITY_UPDATE',
            city: updatedCity
          }));
        }
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

      // Broadcast update to all clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'CITY_UPDATE', city }));
        }
      });

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

  app.post("/api/cities/:id/transfer-military", async (req, res) => {
    try {
      const { fromCityId, toCityId, amount } = req.body;
      const cities = await storage.getCities();

      const fromCity = cities.find(c => c.id === Number(fromCityId));
      const toCity = cities.find(c => c.id === Number(toCityId));

      if (!fromCity || !toCity) {
        return res.status(404).json({ message: 'City not found' });
      }

      if (fromCity.military < amount) {
        return res.status(400).json({ message: 'Insufficient military units' });
      }

      // Calculate travel time based on distance
      const distance = calculateDistance(fromCity, toCity);
      const travelTime = Math.ceil(distance * 1000); // 1 second per coordinate unit

      setTimeout(async () => {
        // Transfer military units after delay
        await storage.updateCity(fromCity.id, {
          military: fromCity.military - amount
        });

        await storage.updateCity(toCity.id, {
          military: (toCity.military || 0) + amount
        });

        // Broadcast updates
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
              type: 'MILITARY_TRANSFER_COMPLETE',
              fromCityId,
              toCityId,
              amount
            }));
          }
        });
      }, travelTime);

      // Start military movement animation
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ 
            type: 'MILITARY_TRANSFER_START',
            fromCity,
            toCity,
            amount,
            duration: travelTime
          }));
        }
      });

      res.json({ message: 'Military transfer started', travelTime });
    } catch (error) {
      console.error('Error transferring military:', error);
      res.status(500).json({ message: 'Failed to transfer military units' });
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