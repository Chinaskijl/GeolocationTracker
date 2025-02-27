import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocket, WebSocketServer } from "ws";

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

  return httpServer;
}