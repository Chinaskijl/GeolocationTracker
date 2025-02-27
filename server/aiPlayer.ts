
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
      
      // Добавляем ресурсы от зданий
      for (const buildingId of city.buildings) {
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (building?.resourceProduction) {
          const { type, amount } = building.resourceProduction;
          this.resources[type] += amount;
        }
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
    // Сортируем города по близости к нашим ресурсам
    const targetCity = neutralCities[0]; // Просто берем первый для простоты
    
    if (targetCity && this.military >= targetCity.maxPopulation / 4) {
      console.log(`[AI] Attempting to capture ${targetCity.name}`);
      try {
        await storage.updateCity(targetCity.id, { owner: 'enemy' });
        this.military -= Math.ceil(targetCity.maxPopulation / 4); // Уменьшаем нашу армию
        console.log(`[AI] Successfully captured ${targetCity.name}`);
      } catch (error) {
        console.error(`[AI] Failed to capture city:`, error);
      }
    }
  }
  
  private async considerAttackingPlayer(playerCities: any[], enemyCities: any[]) {
    // Находим ближайший город игрока
    const targetCity = playerCities[0]; // Упрощенно берем первый город
    
    if (!targetCity) return;
    
    // Если у нас достаточно военных, атакуем
    if (this.military > targetCity.maxPopulation / 3) {
      const attackStrength = Math.floor(this.military * 0.7); // Используем 70% наших сил
      
      console.log(`[AI] Attacking player's city ${targetCity.name} with ${attackStrength} military`);
      
      // Здесь можно реализовать логику атаки
      // Пока просто уменьшаем военную силу противника
      try {
        const updatedCity = { ...targetCity };
        updatedCity.military = Math.max(0, (updatedCity.military || 0) - attackStrength);
        
        if (updatedCity.military <= 0) {
          // Захватываем город
          updatedCity.owner = "enemy";
          console.log(`[AI] Captured player's city ${targetCity.name}`);
        } else {
          console.log(`[AI] Damaged player's forces in ${targetCity.name}`);
        }
        
        await storage.updateCity(targetCity.id, updatedCity);
        
        // Уменьшаем наши силы
        for (const city of enemyCities) {
          if (city.military) {
            const usedForces = Math.min(city.military, attackStrength);
            await storage.updateCity(city.id, { 
              military: city.military - usedForces 
            });
            attackStrength -= usedForces;
            if (attackStrength <= 0) break;
          }
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
