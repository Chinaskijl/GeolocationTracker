
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

  // Добавляем базовый прирост удовлетворенности
  factors.push({
    name: 'Базовый прирост',
    impact: '+0.5/с',
    isPositive: true
  });

  // Проверяем влияние нехватки рабочих
  const cityTotalWorkers = city.buildings?.length || 0;
  const cityPopulation = city.population || 0;
  const cityAvailableWorkers = cityPopulation - cityTotalWorkers;
  
  if (cityTotalWorkers > 0) {
    // Применяем штраф только если работников не хватает
    const workerSatisfactionImpact = (cityAvailableWorkers < 0) ? 
      -5 : // Сильное падение если вообще не хватает работников
      (cityAvailableWorkers < cityTotalWorkers * 0.5) ? 
        Math.min(0, -5 * (0.5 - cityAvailableWorkers / cityTotalWorkers)) : // Постепенное падение при менее 50% работников
        0; // Нет штрафа если достаточно работников
    
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

  // Добавляем штраф за отсутствие золота при нулевой ставке
  const globalResources = window.gameStore?.getState()?.gameState?.resources;
  if (taxRate === 0 && globalResources && globalResources.gold <= 0) {
    factors.push({
      name: 'Нет золота для субсидий',
      impact: '-2.0/с',
      isPositive: false,
      isWarning: true
    });
  }

  // Проверка наличия еды в глобальных ресурсах, а не в ресурсах города
  // Импортируем состояние игры из store для проверки глобальных ресурсов
  const globalFood = window.gameStore?.getState()?.gameState?.resources?.food;
  
  if (city.population > 0 && globalFood !== undefined) {
    const foodNeeded = city.population * 0.1; // 0.1 еды на человека
    
    if (globalFood < foodNeeded) {
      factors.push({
        name: 'Нехватка еды',
        impact: '-1.0/с',
        isPositive: false,
        isWarning: true
      });
    } else {
      // Если еды достаточно, отображаем позитивный фактор
      factors.push({
        name: 'Достаточно еды',
        impact: '+0.0/с',
        isPositive: true
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

  // Если нет отрицательных факторов, добавляем базовый прирост
  if (factors.filter(f => !f.isPositive).length === 0 && city.satisfaction < 100) {
    factors.push({
      name: 'Базовый прирост',
      impact: '+0.5/с',
      isPositive: true
    });
  }

  // Если идут протесты
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
