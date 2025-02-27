import { getGameState, updateGameState, getCities, updateCity } from "./storage";

export function gameLoop() {
  const gameState = getGameState();
  const cities = getCities();

  // Resource generation based on buildings
  for (const city of cities) {
    if (city.owner === "player") {
      // Count building types
      const sawmillCount = city.buildings.filter(b => b === "sawmill").length;
      const mineCount = city.buildings.filter(b => b === "mine").length;
      const farmCount = city.buildings.filter(b => b === "farm").length;
      const houseCount = city.buildings.filter(b => b === "house").length;
      const barracksCount = city.buildings.filter(b => b === "barracks").length;

      // Generate resources
      gameState.resources.wood += sawmillCount * 10;
      gameState.resources.gold += mineCount * 8;

      // Food consumption based on population
      const foodConsumption = city.population * 0.2;
      const foodProduction = farmCount * 15;
      const foodNet = foodProduction - foodConsumption;

      if (gameState.resources.food + foodNet < 0) {
        // Not enough food, population decreases
        city.population = Math.max(city.population - 2, 0);
      } else {
        gameState.resources.food = Math.max(0, gameState.resources.food + foodNet);

        // Population growth if there's enough food and housing
        const maxPopulation = 100 + (houseCount * 50);
        if (city.population < maxPopulation && gameState.resources.food > 0) {
          city.population += 4;
          city.population = Math.min(city.population, maxPopulation);
        }
      }

      // Military growth
      if (barracksCount > 0 && city.population > 100) {
        city.military += 2;
        gameState.military = city.military;
      }

      updateCity(city);
    }
  }

  updateGameState(gameState);
}