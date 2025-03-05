
import { City } from '../../shared/regionTypes';

// Интерфейс для факторов удовлетворенности
export interface SatisfactionFactor {
  name: string;
  impact: string;
  isPositive: boolean;
  isWarning?: boolean;
}

// Функция для получения всех факторов, влияющих на удовлетворенность
export function getSatisfactionFactors(city: City): SatisfactionFactor[] {
  const factors = [];

  // Проверяем влияние нехватки рабочих
  const cityTotalWorkers = city.buildings?.length || 0;
  const cityPopulation = city.population || 0;
  const cityAvailableWorkers = cityPopulation - cityTotalWorkers;
  
  if (cityTotalWorkers > 0) {
    const workerSatisfactionImpact = (cityAvailableWorkers < 0) ? 
      -5 : // Сильное падение если вообще не хватает работников
      Math.min(0, -5 * (1 - cityAvailableWorkers / cityTotalWorkers)); // Постепенное падение
    
    if (workerSatisfactionImpact < 0) {
      factors.push({
        name: 'Нехватка рабочих',
        impact: workerSatisfactionImpact.toFixed(1) + '/с',
        isPositive: false
      });
    }
  }

  // Добавляем влияние от культурных зданий
  const culturalBuildings = city.buildings?.filter(buildingId => 
    ['theater', 'park', 'temple'].includes(buildingId)) || [];
  
  if (culturalBuildings.length > 0) {
    const citySatisfactionBonus = culturalBuildings.length * 0.5; // Корректировка бонуса
    factors.push({
      name: 'Культурные здания',
      impact: '+' + citySatisfactionBonus.toFixed(1) + '/с',
      isPositive: true
    });
  }

  // Влияние налоговой ставки на удовлетворенность
  const taxRate = city.taxRate !== undefined ? city.taxRate : 5; // По умолчанию 5
  const taxSatisfactionImpact = (5 - taxRate) * 0.5; // Коэффициент влияния налогов
  
  if (taxSatisfactionImpact !== 0) {
    factors.push({
      name: 'Налоговая ставка',
      impact: (taxSatisfactionImpact > 0 ? '+' : '') + taxSatisfactionImpact.toFixed(1) + '/с',
      isPositive: taxSatisfactionImpact > 0
    });
  }

  // Проверка на общее потребление еды
  if (city.population > 0) {
    const foodNeeded = city.population * 0.1; // 0.1 еды на человека
    const foodBalance = city.resources?.food || 0;
    
    if (foodBalance < foodNeeded) {
      factors.push({
        name: 'Нехватка еды',
        impact: '-1.0/с',
        isPositive: false,
        isWarning: true
      });
    }
  }

  // Добавляем влияние перенаселения
  if (city.population > 0 && city.maxPopulation > 0) {
    const populationRatio = city.population / city.maxPopulation;
    if (populationRatio > 0.8) {
      const overpopulationImpact = -2 * (populationRatio - 0.8) / 0.2;
      factors.push({
        name: 'Перенаселение',
        impact: overpopulationImpact.toFixed(1) + '/с',
        isPositive: false
      });
    }
  }

  // Базовое падение при росте населения
  if (city.population > 20) {
    const baseDecayImpact = -0.2 - (city.population * 0.01);
    factors.push({
      name: 'Базовое падение',
      impact: baseDecayImpact.toFixed(1) + '/с',
      isPositive: false
    });
  }

  // Статус протестов
  if (city.protestTimer) {
    factors.push({
      name: 'Протесты',
      impact: 'Осталось: ' + Math.floor(city.protestTimer) + ' сек',
      isPositive: false,
      isWarning: true
    });
  }

  return factors;
}
