
import { storage } from "./storage";
import { BUILDINGS } from "../client/src/lib/game";

export class AIPlayer {
  private lastDecisionTime: number = 0;
  private decisionInterval: number = 10000; // 10 секунд между решениями
  private resources = {
    gold: 500,
    wood: 500,
    food: 500,
    oil: 500
  };
  private population = 0;
  private military = 0;

  async makeDecisions() {
    const currentTime = Date.now();
    
    // Принимаем решения только раз в интервале
    if (currentTime - this.lastDecisionTime < this.decisionInterval) {
      return;
    }
    
    this.lastDecisionTime = currentTime;
    
    try {
      const cities = await storage.getCities();
      const enemyCities = cities.filter(city => city.owner === 'enemy');
      const neutralCities = cities.filter(city => city.owner === 'neutral');
      const playerCities = cities.filter(city => city.owner === 'player');
      
      // Обновляем внутренние состояния
      this.calculateResources(enemyCities);
      
      console.log("[AI] Current status - Cities:", enemyCities.length, "Resources:", this.resources, "Military:", this.military);
      
      // Принимаем стратегические решения
      for (const city of enemyCities) {
        await this.manageCity(city, playerCities);
      }
      
      // Проверяем возможность захвата нейтральных городов
      if (this.military > 50 && neutralCities.length > 0) {
        await this.considerCapturingCity(neutralCities);
      }
      
      // Проверяем возможность атаки игрока
      if (this.military > 200 && playerCities.length > 0) {
        await this.considerAttackingPlayer(playerCities, enemyCities);
      }
    } catch (error) {
      console.error('[AI] Error making decisions:', error);
    }
  }
  
  private calculateResources(cities: any[]) {
    // Сбрасываем значения
    this.resources = { gold: 0, wood: 0, food: 0, oil: 0 };
    this.population = 0;
    this.military = 0;
    
    // Суммируем ресурсы по всем городам
    for (const city of cities) {
      this.population += city.population || 0;
      this.military += city.military || 0;
      
      // Добавляем базовые ресурсы города
      if (city.resources) {
        for (const [type, amount] of Object.entries(city.resources)) {
          if (type in this.resources) {
            this.resources[type as keyof typeof this.resources] += amount as number;
          }
        }
      }
      
      // Добавляем ресурсы от зданий (умножаем на 10, как и в gameLoop для игрока)
      for (const buildingId of city.buildings) {
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (building?.resourceProduction) {
          const { type, amount } = building.resourceProduction;
          this.resources[type] += amount * 10; // Увеличиваем в 10 раз для баланса
        }
      }
    }
    
    // Применяем ежесекундные производства (имитация gameLoop для ИИ)
    for (const city of cities) {
      // Рост населения
      let populationGrowth = 0;
      let militaryGrowth = 0;
      
      for (const buildingId of city.buildings) {
        const building = BUILDINGS.find(b => b.id === buildingId);
        
        // Рост населения
        if (building?.population?.growth) {
          populationGrowth += building.population.growth;
        }
        
        // Производство военных
        if (building?.military?.production) {
          militaryGrowth += building.military.production;
        }
      }
      
      // Обновляем город с ростом населения и военных
      if (populationGrowth > 0 || militaryGrowth > 0) {
        const newPopulation = Math.min(
          city.maxPopulation,
          Math.max(0, (city.population || 0) + populationGrowth)
        );
        
        storage.updateCity(city.id, {
          population: Math.floor(newPopulation),
          military: Math.floor((city.military || 0) + militaryGrowth)
        });
      }
    }
  }
  
  private async manageCity(city: any, playerCities: any[]) {
    console.log(`[AI] Managing city ${city.name}`);
    
    // Проверяем наши приоритеты строительства
    const hasFarm = city.buildings.includes('farm');
    const hasSawmill = city.buildings.includes('sawmill');
    const hasMine = city.buildings.includes('mine');
    const hasBarracks = city.buildings.some((b: string) => b === 'barracks');
    const hasHouse = city.buildings.some((b: string) => b === 'house');
    
    // Сначала обеспечиваем базовые потребности
    if (!hasFarm && this.canAfford('farm')) {
      await this.buildInCity(city.id, 'farm');
      return;
    }
    
    if (!hasSawmill && this.canAfford('sawmill')) {
      await this.buildInCity(city.id, 'sawmill');
      return;
    }
    
    if (!hasHouse && this.canAfford('house')) {
      await this.buildInCity(city.id, 'house');
      return;
    }
    
    // Если у игрока есть города, строим военные здания
    if (playerCities.length > 0 && !hasBarracks && this.canAfford('barracks')) {
      await this.buildInCity(city.id, 'barracks');
      return;
    }
    
    // Строим дополнительные здания по мере необходимости
    const farmCount = city.buildings.filter((b: string) => b === 'farm').length;
    const sawmillCount = city.buildings.filter((b: string) => b === 'sawmill').length;
    const barracksCount = city.buildings.filter((b: string) => b === 'barracks').length;
    const houseCount = city.buildings.filter((b: string) => b === 'house').length;
    
    // Определяем приоритеты в зависимости от ситуации
    if (this.resources.food < 100 && farmCount < 3 && this.canAfford('farm')) {
      await this.buildInCity(city.id, 'farm');
    } else if (this.resources.wood < 100 && sawmillCount < 3 && this.canAfford('sawmill')) {
      await this.buildInCity(city.id, 'sawmill');
    } else if (playerCities.length > 0 && barracksCount < 2 && this.canAfford('barracks')) {
      await this.buildInCity(city.id, 'barracks');
    } else if (city.population < city.maxPopulation * 0.5 && houseCount < 3 && this.canAfford('house')) {
      await this.buildInCity(city.id, 'house');
    } else if (!hasMine && this.canAfford('mine')) {
      await this.buildInCity(city.id, 'mine');
    }
  }
  
  private async considerCapturingCity(neutralCities: any[]) {
    if (neutralCities.length === 0) return;
    
    // Выбираем случайный нейтральный город
    const randomIndex = Math.floor(Math.random() * neutralCities.length);
    const targetCity = neutralCities[randomIndex];
    
    // Находим город ИИ с наибольшим количеством военных
    const cities = await storage.getCities();
    const enemyCities = cities.filter(city => city.owner === 'enemy');
    
    if (enemyCities.length === 0) return;
    
    const attackingCity = enemyCities.reduce((strongest, city) => 
      (city.military || 0) > (strongest.military || 0) ? city : strongest
    , enemyCities[0]);
    
    const requiredForces = Math.ceil(targetCity.maxPopulation / 4);
    
    if (attackingCity && (attackingCity.military || 0) >= requiredForces) {
      console.log(`[AI] Attempting to capture ${targetCity.name} from ${attackingCity.name}`);
      try {
        // Уменьшаем военных в атакующем городе
        await storage.updateCity(attackingCity.id, {
          military: Math.max(0, (attackingCity.military || 0) - requiredForces)
        });
        
        // Захватываем нейтральный город и добавляем часть военных
        await storage.updateCity(targetCity.id, { 
          owner: 'enemy',
          military: Math.floor(requiredForces * 0.7)
        });
        
        console.log(`[AI] Successfully captured ${targetCity.name}`);
      } catch (error) {
        console.error(`[AI] Failed to capture city:`, error);
      }
    }
  }
  
  private async considerAttackingPlayer(playerCities: any[], enemyCities: any[]) {
    if (enemyCities.length === 0 || playerCities.length === 0) return;
    
    // Находим город с наибольшим количеством военных
    const attackingCity = enemyCities.reduce((strongest, city) => 
      (city.military || 0) > (strongest.military || 0) ? city : strongest
    , enemyCities[0]);
    
    // Находим самый слабый город игрока
    const targetCity = playerCities.reduce((weakest, city) => 
      (city.military || 0) < (weakest.military || 0) ? city : weakest
    , playerCities[0]);
    
    if (!targetCity || !attackingCity) return;
    
    const armySize = attackingCity.military || 0;
    const defenseStrength = targetCity.military || 0;
    
    // Если у нас достаточно военных, атакуем
    if (armySize > defenseStrength * 1.2) { // Атакуем только если у нас преимущество минимум 20%
      const attackStrength = Math.floor(armySize * 0.8); // Используем 80% сил города
      
      console.log(`[AI] Attacking player's city ${targetCity.name} from ${attackingCity.name} with ${attackStrength} military`);
      
      try {
        // Уменьшаем военных в атакующем городе
        await storage.updateCity(attackingCity.id, {
          military: Math.max(0, armySize - attackStrength)
        });
        
        // Определяем результат атаки
        if (attackStrength > defenseStrength) {
          // Захватываем город
          const survivingAttackers = attackStrength - defenseStrength;
          await storage.updateCity(targetCity.id, { 
            owner: "enemy",
            military: survivingAttackers
          });
          console.log(`[AI] Captured player's city ${targetCity.name}`);
        } else {
          // Атака отбита
          await storage.updateCity(targetCity.id, { 
            military: defenseStrength - attackStrength
          });
          console.log(`[AI] Attack on ${targetCity.name} was repelled`);
        }
      } catch (error) {
        console.error(`[AI] Failed to attack player:`, error);
      }
    }
  }
  
  private canAfford(buildingId: string): boolean {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) return false;
    
    return Object.entries(building.cost).every(
      ([resource, amount]) => this.resources[resource as keyof typeof this.resources] >= amount
    );
  }
  
  private async buildInCity(cityId: number, buildingId: string) {
    try {
      console.log(`[AI] Building ${buildingId} in city ${cityId}`);
      
      const city = await storage.getCities().then(cities => 
        cities.find(c => c.id === cityId)
      );
      
      if (!city) {
        console.error(`[AI] City ${cityId} not found`);
        return;
      }
      
      const building = BUILDINGS.find(b => b.id === buildingId);
      if (!building) {
        console.error(`[AI] Building ${buildingId} not found`);
        return;
      }
      
      // Списывание ресурсов
      Object.entries(building.cost).forEach(([resource, amount]) => {
        this.resources[resource as keyof typeof this.resources] -= amount;
      });
      
      // Добавление здания в город
      await storage.updateCity(cityId, {
        buildings: [...city.buildings, buildingId]
      });
      
      console.log(`[AI] Successfully built ${buildingId} in city ${cityId}`);
    } catch (error) {
      console.error(`[AI] Failed to build:`, error);
    }
  }
}

export const aiPlayer = new AIPlayer();
