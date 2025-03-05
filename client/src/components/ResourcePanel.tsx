import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Coins, Trees, Wheat, Droplet, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BUILDINGS } from '@/lib/game';
import { getSatisfactionFactors } from '@/lib/satisfactionHelpers'; // Added import

export function ResourcePanel() {
  const { gameState, cities, resourcesIncome } = useGameStore();
  const [resourceProduction, setResourceProduction] = useState({
    gold: 0,
    wood: 0,
    food: 0,
    oil: 0,
    metal: 0,
    steel: 0,
    weapons: 0,
    influence: 0
  });
  const [foodConsumption, setFoodConsumption] = useState(0);

  useEffect(() => {
    let goldProd = 0;
    let woodProd = 0;
    let foodProd = 0;
    let oilProd = 0;
    let metalProd = 0;
    let steelProd = 0;
    let weaponsProd = 0;
    let foodCons = 0;
    let influenceProd = 0;
    let taxIncome = 0;

    // We'll track building production separately from income in resourcesIncome
    // resourcesIncome comes from server and includes tax income and other special sources

    // Добавляем налоговый доход от сервера, если он есть
    if (resourcesIncome && resourcesIncome.gold !== undefined) {
      taxIncome = resourcesIncome.gold;

      // Явно добавляем информацию о налогах для отображения в тултипе
      if (Math.abs(taxIncome) > 0.01) {
        goldProd += taxIncome; // Включаем налоги в общую добычу золота
      }
    }

    cities.forEach(city => {
      if (city.owner === 'player') {
        city.buildings.forEach(buildingId => {
          const building = BUILDINGS.find(b => b.id === buildingId);
          if (building && building.resourceProduction) {
            const { type, amount } = building.resourceProduction;
            switch (type) {
              case 'gold':
                goldProd += amount;
                break;
              case 'wood':
                woodProd += amount;
                break;
              case 'food':
                foodProd += amount;
                break;
              case 'oil':
                oilProd += amount;
                break;
              case 'metal':
                metalProd += amount;
                break;
              case 'steel':
                steelProd += amount;
                break;
              case 'weapons':
                weaponsProd += amount;
                break;
              case 'influence':
                influenceProd += amount;
                break;
            }
          }
        });
        foodCons += city.population * 0.1;
      }
    });

    setResourceProduction({
      gold: goldProd + (resourcesIncome?.gold || 0),
      wood: woodProd,
      food: foodProd,
      oil: oilProd,
      metal: metalProd,
      steel: steelProd,
      weapons: weaponsProd,
      influence: influenceProd
    });

    setFoodConsumption(foodCons);
  }, [cities, gameState, resourcesIncome]);

  const resources = [
    { icon: <span className="w-5 h-5 flex items-center justify-center">💰</span>, value: Math.floor(gameState.resources.gold), name: 'Gold', production: resourceProduction.gold, key: 'gold' },
    { icon: <span className="w-5 h-5 flex items-center justify-center">🌲</span>, value: Math.floor(gameState.resources.wood), name: 'Wood', production: resourceProduction.wood, key: 'wood' },
    { icon: <span className="w-5 h-5 flex items-center justify-center">🌾</span>, value: Math.floor(gameState.resources.food), name: 'Food', production: resourceProduction.food, consumption: foodConsumption, netProduction: resourceProduction.food - foodConsumption, key: 'food' },
    { icon: <span className="w-5 h-5 flex items-center justify-center">💧</span>, value: Math.floor(gameState.resources.oil), name: 'Oil', production: resourceProduction.oil, key: 'oil' },
    { icon: <span className="w-5 h-5 flex items-center justify-center">⚙️</span>, value: Math.floor(gameState.resources.metal), name: 'Metal', production: resourceProduction.metal, key: 'metal' },
    { icon: <span className="w-5 h-5 flex items-center justify-center">🔩</span>, value: Math.floor(gameState.resources.steel), name: 'Steel', production: resourceProduction.steel, key: 'steel' },
    { icon: <span className="w-5 h-5 flex items-center justify-center">🔫</span>, value: Math.floor(gameState.resources.weapons), name: 'Weapons', production: resourceProduction.weapons, key: 'weapons' },
    { icon: <Globe className="w-5 h-5" />, value: Math.floor(gameState.resources.influence || 0), name: 'Influence', production: resourceProduction.influence, key: 'influence' }
  ];

  const getProductionColor = (production) => (production >= 0 ? 'text-green-500' : 'text-red-500');
  const formatProduction = (production) => `${production >= 0 ? '+' : ''}${Math.round(production * 10) / 10}`;

  // Функция для формирования содержимого тултипа
  const getTooltipContent = (resourceKey) => {
    const tooltipItems = [];

    // Добавляем информацию о производстве и потреблении еды
    if (resourceKey === 'food') {
      tooltipItems.push(
        <div key="food-base" className="whitespace-nowrap">
          <p>Производство: +{resourceProduction.food.toFixed(1)}</p>
          <p>Потребление: -{foodConsumption.toFixed(1)}</p>
          <p>Итого: {(resourceProduction.food - foodConsumption).toFixed(1)}</p>
          
          {cities.filter(c => c.owner === 'player').map(city => (
            <div key={`food-city-${city.id}`} className="text-xs ml-4">
              {city.name}: {city.population > 0 ? 
                <span className="text-green-500">+{((city.population || 1) / 100).toFixed(1)}/с</span> :
                <span className="text-yellow-500">+0/с (нет рабочих)</span>}
            </div>
          ))}
        </div>
      );
    }

    // Добавляем информацию о налогах для золота
    if (resourceKey === 'gold' && resourcesIncome?.gold) {
      tooltipItems.push(
        <div key="gold-base" className="whitespace-nowrap">
          Налоги: <span className={getProductionColor(resourcesIncome.gold)}>
            {formatProduction(resourcesIncome.gold)}/с
          </span>
          
          {cities.filter(c => c.owner === 'player').map(city => (
            <div key={`gold-${city.id}`} className="text-xs ml-4">
              {city.name}: 
              {city.taxRate === 0 ? 
                <span className="text-red-500">-{((city.population || 0) * 0.5).toFixed(1)}/с (субсидии)</span> : 
                <span className="text-green-500">+{((city.population * city.taxRate) / 5).toFixed(1)}/с</span>
              }
            </div>
          ))}
        </div>
      );
    }

    // Добавляем информацию о влиянии
    if (resourceKey === 'influence' && resourcesIncome?.influence) {
      tooltipItems.push(
        <div key="influence-base" className="whitespace-nowrap">
          Базовое производство: <span className={getProductionColor(resourcesIncome.influence)}>
            {formatProduction(resourcesIncome.influence)}/с
          </span>
          {cities.filter(c => c.owner === 'player').map(city => (
            <div key={`influence-${city.id}`} className="text-xs ml-4">
              {city.name}: <span className="text-green-500">
                {city.population > 0 ?
                  `+${(city.population * 0.1).toFixed(1)}/с` :
                  '+0/с (нет населения)'}
                {city.satisfaction && city.satisfaction > 70 ? 
                  ` +${((city.satisfaction - 70) * 0.05).toFixed(1)}/с (бонус удовлетворенности)` : 
                  ''}
              </span>
            </div>
          ))}
        </div>
      );
    }

    // Группируем здания по типу ресурса, который они производят
    const getBuildingsByResourceType = (resourceType) => {
      const buildingProduction = {};

      cities.forEach(city => {
        if (city.owner === 'player') {
          const cityBuildingCounts = {};

          city.buildings.forEach(buildingId => {
            const building = BUILDINGS.find(b => b.id === buildingId);
            if (building && building.resourceProduction && building.resourceProduction.type === resourceType) {
              // Проверяем, есть ли рабочие для здания
              const hasWorkers = city.population > 0;

              if (!cityBuildingCounts[buildingId]) {
                cityBuildingCounts[buildingId] = {
                  count: 1,
                  name: building.name,
                  production: hasWorkers ? building.resourceProduction.amount : 0,
                  notWorking: !hasWorkers
                };
              } else {
                cityBuildingCounts[buildingId].count++;
                if (hasWorkers) {
                  cityBuildingCounts[buildingId].production += building.resourceProduction.amount;
                } else {
                  cityBuildingCounts[buildingId].notWorking = true;
                }
              }
            }
          });

          Object.entries(cityBuildingCounts).forEach(([buildingId, data]) => {
            if (!buildingProduction[buildingId]) {
              buildingProduction[buildingId] = { ...data, cities: [city.name] };
            } else {
              buildingProduction[buildingId].count += data.count;
              buildingProduction[buildingId].production += data.production;
              buildingProduction[buildingId].cities.push(city.name);
              buildingProduction[buildingId].notWorking = buildingProduction[buildingId].notWorking || data.notWorking;
            }
          });
        }
      });

      return buildingProduction;
    };

    // Добавляем информацию о зданиях для данного типа ресурса
    const buildingProduction = getBuildingsByResourceType(resourceKey);
    if (Object.keys(buildingProduction).length > 0) {
      tooltipItems.push(
        <div key={`buildings-${resourceKey}`} className="mt-1">
          <div>Здания:</div>
          {Object.entries(buildingProduction).map(([buildingId, data]) => (
            <div key={`building-${buildingId}`} className="text-xs ml-4">
              {data.name} x{data.count}: 
              {data.notWorking ? 
                <span className="text-yellow-500"> +0/с (нехватка рабочих)</span> : 
                <span className="text-green-500"> +{data.production.toFixed(1)}/с</span>}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div>
        {tooltipItems.length > 0 ? tooltipItems : <p>Нет данных о производстве</p>}
      </div>
    );
  };

  return (
    <Card className="fixed top-4 left-4 p-4 z-[1000]">
      <div className="flex flex-wrap gap-4">
            <div key={`tax-${city.id}`} className="text-xs ml-4">
              {city.name}: {city.taxRate === 0 ?
                <span className="text-red-500">-{(city.population * 0.5).toFixed(1)}/с</span> :
                <span className="text-green-500">+{((city.population * city.taxRate) / 5).toFixed(1)}/с</span>
              }
            </div>
          ))}
        </div>
      );
    }

    // Add influence production sources
    if (resourceType === 'influence' && resourcesIncome?.influence) {
      tooltipItems.push(
        <div key="influence-base" className="whitespace-nowrap">
          Базовое производство: <span className={getProductionColor(resourcesIncome.influence)}>
            {formatProduction(resourcesIncome.influence)}/с
          </span>
          {cities.filter(c => c.owner === 'player').map(city => (
            <div key={`influence-${city.id}`} className="text-xs ml-4">
              {city.name}: <span className="text-green-500">
                +{(city.population * 0.1).toFixed(1)}/с
                {city.satisfaction && city.satisfaction > 70 ? 
                  ` +${((city.satisfaction - 70) * 0.05).toFixed(1)}/с (бонус удовлетворенности)` : 
                  ''}
              </span>
            </div>
          ))}
        </div>
      );
    }

    // Group buildings by type and city, and calculate total production
    const buildingProduction = {};

    cities.forEach(city => {
      if (city.owner === 'player') {
        // Count buildings by type in each city
        const cityBuildingCounts = {};

        city.buildings.forEach(buildingId => {
          const building = BUILDINGS.find(b => b.id === buildingId);
          if (building && building.resourceProduction && building.resourceProduction.type === resourceType) {
            // Check if workers are available for the building
            const hasWorkers = city.population > 0; // Simplified check, you may need more complex logic

            if (!cityBuildingCounts[buildingId]) {
              cityBuildingCounts[buildingId] = {
                count: 1,
                name: building.name,
                production: hasWorkers ? building.resourceProduction.amount : 0,
                notWorking: !hasWorkers
              };
            } else {
              cityBuildingCounts[buildingId].count++;
              if (hasWorkers) {
                cityBuildingCounts[buildingId].production += building.resourceProduction.amount;
              } else {
                cityBuildingCounts[buildingId].notWorking = true;
              }
            }
          }
        });

        // Add entries for each building type in the city
        Object.entries(cityBuildingCounts).forEach(([buildingId, data]) => {
          const { count, name, production, notWorking } = data as any;
          tooltipItems.push(
            <div key={`${city.name}-${buildingId}`} className="whitespace-nowrap">
              {name} ({city.name}) {count}: <span className={getProductionColor(production)}>
                {formatProduction(production)}/с
              </span>
              {notWorking && <span className="text-orange-500 text-xs ml-1">(нет рабочих)</span>}
            </div>
          );
        });
      }
    });

    // Add consumption for food
    if (resourceType === 'food' && gameState.population > 0) {
      tooltipItems.push(
        <div key="food-consumption" className="whitespace-nowrap">
          Population: <span className="text-red-500">-{(gameState.population * 0.1).toFixed(1)}/s</span>
        </div>
      );
    }

    return tooltipItems.length ? (
      <div className="absolute top-full left-0 bg-black/80 text-white p-2 rounded text-xs z-50">
        {tooltipItems}
      </div>
    ) : null;
  };

  // Обновляем данные каждые 250мс для более плавного отображения
  useEffect(() => {
    const interval = setInterval(() => {
      let goldProd = 0;
      let woodProd = 0;
      let foodProd = 0;
      let oilProd = 0;
      let metalProd = 0;
      let steelProd = 0;
      let weaponsProd = 0;
      let foodCons = 0;
      let influenceProd = 0;
      let taxIncome = 0;


      if (resourcesIncome && resourcesIncome.gold) {
        taxIncome = resourcesIncome.gold;
      }

      cities.forEach(city => {
        if (city.owner === 'player') {
          city.buildings.forEach(buildingId => {
            const building = BUILDINGS.find(b => b.id === buildingId);
            if (building && building.resourceProduction) {
              const { type, amount } = building.resourceProduction;
              // Проверяем наличие населения для работы зданий
              const hasWorkers = city.population > 0;
              
              // Map the building IDs to their actual server-side production values
              const actualProductionValues = {
                'logging_camp': hasWorkers ? 3 : 0, // Actual value on server
                'gold_mine': hasWorkers ? 3 : 0,
                'oil_rig': hasWorkers ? 3 : 0,
                'metal_factory': hasWorkers ? 2 : 0,
                'steel_factory': hasWorkers ? 1 : 0,
                'weapons_factory': hasWorkers ? 1 : 0,
                'farm': hasWorkers ? 5 * (city.population || 1) / 100 : 0,
                'theater': hasWorkers ? 1 : 0,
                'park': hasWorkers ? 1 : 0,
                'temple': hasWorkers ? 1 : 0
              };

              // Use the actual production value if available
              const actualAmount = actualProductionValues[building.id] || (hasWorkers ? amount : 0);

              switch (type) {
                case 'gold':
                  goldProd += actualAmount;
                  break;
                case 'wood':
                  woodProd += actualAmount;
                  break;
                case 'food':
                  foodProd += actualAmount;
                  break;
                case 'oil':
                  oilProd += actualAmount;
                  break;
                case 'metal':
                  metalProd += actualAmount;
                  break;
                case 'steel':
                  steelProd += actualAmount;
                  break;
                case 'weapons':
                  weaponsProd += amount;
                  break;
                case 'influence':
                  influenceProd += amount;
                  break;
              }
            }
          });
          foodCons += city.population * 0.1;
        }
      });

      setResourceProduction({
        gold: goldProd, // Теперь налоги уже включены в goldProd выше
        wood: woodProd,
        food: foodProd,
        oil: oilProd,
        metal: metalProd,
        steel: steelProd,
        weapons: weaponsProd,
        influence: influenceProd
      });

      setFoodConsumption(foodCons);
    }, 50); // Уменьшаем интервал для более быстрого обновления

    return () => clearInterval(interval);
  }, [cities, gameState, resourcesIncome]);

  // Function to create tooltip content showing production sources
  const createTooltipContent = (resourceType) => {
    const tooltipItems = [];

    // Add tax income for gold
    if (resourceType === 'gold' && resourcesIncome?.gold !== undefined) {
      tooltipItems.push(
        <div key="taxes" className="whitespace-nowrap">
          Налоги: <span className={resourcesIncome.gold >= 0 ? 'text-green-500' : 'text-red-500'}>
            {resourcesIncome.gold >= 0 ? '+' : ''}{resourcesIncome.gold.toFixed(1)}/с
          </span>
        </div>
      );
    }

    return (
      <div>
        {tooltipItems.length > 0 ? tooltipItems : <p>Нет данных о производстве</p>}
      </div>
    );
  };

  return (
    <Card className="fixed top-4 left-4 p-4 z-[1000]">
      <div className="flex flex-wrap gap-4">
        {resources.map((resource) => {
          // Для еды применяем специальную логику отображения
          let totalProduction;
          if (resource.key === 'food') {
            // Чистый прирост еды (производство минус потребление)
            totalProduction = resource.production - resource.consumption;
          } else {
            // Для других ресурсов - базовое производство плюс доход из других источников
            totalProduction = resource.production + (
              resourcesIncome && resourcesIncome[resource.key] ? resourcesIncome[resource.key] : 0
            );
          }

          return (
            <div key={resource.name} className="flex items-center gap-2 relative group">
              {resource.icon}
              <span className="font-medium">
                {resource.value}
                <span className={`ml-1 text-xs ${getProductionColor(totalProduction)}`}>
                  ({formatProduction(totalProduction)})
                </span>
              </span>

              {/* Tooltip that appears on hover */}
              <div className="hidden group-hover:block absolute bg-black bg-opacity-80 text-white p-2 rounded z-50 left-full ml-2 whitespace-nowrap">
                {getTooltipContent(resource.key)}
                ) : (
                  <p>+{resource.production.toFixed(1)} в тик</p>
                )}
              </div>
            </div>
          );
        })}
        <div className="border-l pl-4">
          <div className="flex items-center gap-2">
            <span>👥</span>
            <span className="font-medium">
              {Math.floor(gameState.population)}
              {gameState.resources.food <= 0 ? <span className="ml-1 text-xs text-red-500">(-1)</span> : ''}
            </span>
          </div>
        </div>

        {cities.filter(city => city.owner === 'player').map(city => (
          <div key={`satisfaction-${city.id}`} className="border-l pl-4 relative group">
            <div className="flex items-center gap-2">
              <span>{city.satisfaction >= 70 ? '😃' : city.satisfaction >= 30 ? '😐' : '😠'}</span>
              <span className="font-medium">
                {city.name.split(' ')[0]}: {Math.floor(city.satisfaction || 0)}%
                {city.protestTimer ? <span className="ml-1 text-xs text-red-500">(⚠️ {Math.floor(city.protestTimer)}s)</span> : ''}
              </span>
            </div>

            {/* Тултип для удовлетворенности */}
            <div className="hidden group-hover:block absolute top-full left-0 bg-black/80 text-white p-2 rounded text-xs z-50 w-64">
              <div className="font-bold mb-1">Факторы удовлетворенности:</div>
              {getSatisfactionFactors(city).map((factor, idx) => (
                <div key={`factor-${idx}`} className="flex justify-between items-center my-1">
                  <span>{factor.name}:</span>
                  <span className={`${factor.isPositive ? 'text-green-400' : factor.isWarning ? 'text-yellow-400' : 'text-red-400'}`}>
                    {factor.impact}
                  </span>
                </div>
              ))}
              {getSatisfactionFactors(city).length === 0 && (
                <div className="text-gray-300">Нет активных факторов</div>
              )}
            </div>
          </div>
        ))}
        <div className="border-l pl-4">
          <div className="flex items-center gap-2">
            <span>⚔️</span>
            <span className="font-medium">{Math.floor(gameState.military)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function getResourceIcon(type: string): string {
  const icons: { [key: string]: string } = {
    food: '🍞',
    gold: '💰',
    wood: '🪵',
    oil: '🛢️',
    influence: '🌐',
    weapons: '🔫',
    metal: '🔧',
    steel: '⚒️'
  };
  return icons[type] || '❓';
}