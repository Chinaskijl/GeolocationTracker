import { getCities, updateCity } from "./storage";
import { BUILDINGS } from "../client/src/lib/game";

export function aiPlayer() {
  const cities = getCities();

  // Basic AI for enemy cities
  for (const city of cities) {
    if (city.owner === "enemy") {
      // Slowly increase military strength
      if (Math.random() < 0.1) {
        city.military += 5;
        updateCity(city);
      }
    }
  }
}