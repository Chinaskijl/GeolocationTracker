
import { City } from '../../shared/regionTypes';

// Функция для получения всех факторов, влияющих на удовлетворенность
export function getSatisfactionFactors(city: City) {
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
    const citySatisfactionBonus = culturalBuildings.length * 5; // Примерный расчет бонуса
    factors.push({
      name: 'Культурные здания',
      impact: '+' + (citySatisfactionBonus * 0.1).toFixed(1) + '/с',
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

  // Проверка на наличие еды для населения
  if (city.population > 0) {
    const foodNeeded = city.population * 0.1; // 0.1 еды на человека
    if (foodNeeded > 0) {
      factors.push({
        name: 'Потребление еды',
        impact: 'Требуется: ' + foodNeeded.toFixed(1) + '/с',
        isPositive: true
      });
    }
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
