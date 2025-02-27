// In-memory storage for game state
let gameState = {
  resources: {
    gold: 100,
    wood: 500,
    food: 200,
    oil: 500
  },
  population: 100,
  military: 50
};

// In-memory storage for cities
let cities = [
  {
    id: 1,
    name: "Москва",
    latitude: 55.7558,
    longitude: 37.6173,
    population: 100,
    maxPopulation: 150000,
    resources: {},
    boundaries: [
      [55.8, 37.5],
      [55.9, 37.7],
      [55.7, 37.8],
      [55.6, 37.6],
      [55.8, 37.5]
    ],
    owner: "player",
    buildings: ["sawmill", "sawmill", "sawmill", "barracks", "barracks", "house", "house", "mine"],
    military: 50
  },
  {
    id: 9,
    name: "Киев",
    latitude: 50.4501,
    longitude: 30.5234,
    population: 8000,
    maxPopulation: 120000,
    resources: {
      wood: 5,
      food: 5,
      gold: 5,
      oil: 5
    },
    boundaries: [
      [50.5, 30.4],
      [50.6, 30.6],
      [50.4, 30.7],
      [50.3, 30.5],
      [50.5, 30.4]
    ],
    owner: "enemy",
    buildings: ["sawmill", "farm", "mine", "house", "barracks"],
    military: 100
  },
  {
    id: 10,
    name: "Минск",
    latitude: 53.9045,
    longitude: 27.5615,
    population: 5000,
    maxPopulation: 90000,
    resources: {
      wood: 8,
      food: 7
    },
    boundaries: [
      [54, 27.45],
      [54.1, 27.65],
      [53.9, 27.75],
      [53.8, 27.55],
      [54, 27.45]
    ],
    owner: "enemy",
    buildings: ["sawmill", "farm", "barracks"],
    military: 50
  }
];

// Game state getters and setters
export function getGameState() {
  return gameState;
}

export function updateGameState(newState: any) {
  gameState = { ...gameState, ...newState };
  return gameState;
}

// Cities getters and setters
export function getCities() {
  return cities;
}

export function getCityById(id: number) {
  return cities.find(city => city.id === id);
}

export function updateCity(updatedCity: any) {
  const index = cities.findIndex(city => city.id === updatedCity.id);
  if (index !== -1) {
    cities[index] = { ...cities[index], ...updatedCity };
  }
  return cities[index];
}