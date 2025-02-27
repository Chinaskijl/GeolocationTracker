import { Server } from "http";
import express, { Express } from "express";
import WebSocket from "ws";
import { gameLoop } from "./gameLoop";
import { getGameState, getCities, updateGameState, getCityById, updateCity } from "./storage";
import { aiPlayer } from "./aiPlayer";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const server = new Server(app);

  // Set up WebSocket server
  const wss = new WebSocket.Server({ server });

  // WebSocket connection handler
  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");

    // Send initial game state
    const gameState = getGameState();
    ws.send(JSON.stringify({ type: "gameState", data: gameState }));

    const cities = getCities();
    ws.send(JSON.stringify({ type: "cities", data: cities }));

    // Handle messages from clients
    ws.on("message", (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        console.log("Received message:", parsedMessage);

        if (parsedMessage.type === "action") {
          // Handle game actions
          const { action, cityId, data } = parsedMessage;

          if (action === "build" && cityId) {
            const city = getCityById(cityId);
            if (city && city.owner === "player") {
              const gameState = getGameState();
              const buildingType = data.buildingType;

              // Check if player has enough resources
              let cost = 0;
              switch(buildingType) {
                case "house":
                  cost = 100;
                  if (gameState.resources.wood >= cost) {
                    gameState.resources.wood -= cost;
                    city.buildings.push(buildingType);
                    updateCity(city);
                    updateGameState(gameState);
                  }
                  break;
                case "farm":
                  cost = 150;
                  if (gameState.resources.wood >= cost) {
                    gameState.resources.wood -= cost;
                    city.buildings.push(buildingType);
                    updateCity(city);
                    updateGameState(gameState);
                  }
                  break;
                case "sawmill":
                  cost = 200;
                  if (gameState.resources.wood >= cost) {
                    gameState.resources.wood -= cost;
                    city.buildings.push(buildingType);
                    updateCity(city);
                    updateGameState(gameState);
                  }
                  break;
                case "mine":
                  cost = 300;
                  if (gameState.resources.wood >= cost) {
                    gameState.resources.wood -= cost;
                    city.buildings.push(buildingType);
                    updateCity(city);
                    updateGameState(gameState);
                  }
                  break;
                case "barracks":
                  cost = 400;
                  if (gameState.resources.wood >= cost && gameState.resources.gold >= 200) {
                    gameState.resources.wood -= cost;
                    gameState.resources.gold -= 200;
                    city.buildings.push(buildingType);
                    updateCity(city);
                    updateGameState(gameState);
                  }
                  break;
              }
            }
          }

          if (action === "attack" && cityId) {
            const targetCity = getCityById(cityId);
            const playerCity = getCities().find(c => c.owner === "player");

            if (targetCity && playerCity && targetCity.owner === "enemy") {
              // Simple combat logic
              if (playerCity.military > targetCity.military) {
                targetCity.owner = "player";
                targetCity.military = Math.floor(playerCity.military / 2);
                playerCity.military = Math.floor(playerCity.military / 2);
                updateCity(targetCity);
                updateCity(playerCity);
              } else {
                playerCity.military = Math.floor(playerCity.military / 2);
                updateCity(playerCity);
              }
            }
          }
        }

      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    });

    // Handle client disconnection
    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });

    // Start game loop for this client
    const gameLoopInterval = setInterval(() => {
      try {
        // Update game state via game loop
        gameLoop();
        aiPlayer();

        // Send updated state to client
        const updatedGameState = getGameState();
        ws.send(JSON.stringify({ type: "gameState", data: updatedGameState }));

        const updatedCities = getCities();
        ws.send(JSON.stringify({ type: "cities", data: updatedCities }));
      } catch (error) {
        console.error("Error in game loop:", error);
      }
    }, 1000);

    // Clear interval when client disconnects
    ws.on("close", () => {
      clearInterval(gameLoopInterval);
    });
  });

  // REST API routes
  app.get("/api/game-state", (req, res) => {
    res.json(getGameState());
  });

  app.get("/api/cities", (req, res) => {
    res.json(getCities());
  });

  return server;
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