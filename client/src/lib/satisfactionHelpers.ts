
import { Region } from '@shared/regionTypes';
import { BUILDINGS } from './game';

interface SatisfactionFactor {
  name: string;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

export function analyzeSatisfactionFactors(city: Region): SatisfactionFactor[] {
  const factors: SatisfactionFactor[] = [];
  
  // Налоговая ставка
  const taxRate = city.taxRate !== undefined ? city.taxRate : 5;
  const taxImpact = (5 - taxRate) * 0.5;
  
  factors.push({
    name: 'Налоги',
    value: taxImpact,
    impact: taxImpact > 0 ? 'positive' : taxImpact < 0 ? 'negative' : 'neutral',
    description: taxRate < 5 
      ? `Низкая налоговая ставка (${taxRate}%) повышает удовлетворенность` 
      : taxRate > 5 
        ? `Высокая налоговая ставка (${taxRate}%) снижает удовлетворенность` 
        : 'Стандартная налоговая ставка (5%)'
  });

  // Культурные здания
  let culturalBonus = 0;
  const culturalBuildings = city.buildings.filter(bid => {
    const building = BUILDINGS.find(b => b.id === bid);
    return building && building.satisfactionBonus;
  });
  
  if (culturalBuildings.length > 0) {
    culturalBuildings.forEach(bid => {
      const building = BUILDINGS.find(b => b.id === bid);
      if (building && building.satisfactionBonus) {
        culturalBonus += building.satisfactionBonus * 0.1; // Коэффициент из gameLoop.ts
      }
    });
    
    factors.push({
      name: 'Культурные здания',
      value: culturalBonus,
      impact: 'positive',
      description: `${culturalBuildings.length} культурных зданий повышают удовлетворенность`
    });
  }

  // Нехватка рабочих
  const totalWorkers = city.buildings.reduce((sum, bid) => {
    const building = BUILDINGS.find(b => b.id === bid);
    return sum + (building?.workers || 0);
  }, 0);

  const availableWorkers = city.population;
  let workerSatisfactionImpact = 0;

  if (totalWorkers > 0) {
    if (availableWorkers < totalWorkers) {
      workerSatisfactionImpact = availableWorkers < 0 
        ? -5 
        : Math.min(0, -5 * (1 - availableWorkers / totalWorkers));
      
      factors.push({
        name: 'Нехватка рабочих',
        value: workerSatisfactionImpact,
        impact: 'negative',
        description: `Не хватает ${Math.max(0, totalWorkers - availableWorkers)} рабочих для зданий`
      });
    } else {
      factors.push({
        name: 'Рабочие',
        value: 0,
        impact: 'neutral',
        description: 'Достаточно населения для всех зданий'
      });
    }
  }

  // Если идут протесты
  if (city.protestTimer) {
    factors.push({
      name: 'Протесты',
      value: 0,
      impact: 'negative',
      description: `Идут протесты! Осталось ${Math.floor(city.protestTimer)} сек. до потери контроля`
    });
  }

  return factors;
}
