import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Coins, Trees, Wheat, Droplet, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BUILDINGS } from '@/lib/game';

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
    if (resourcesIncome && resourcesIncome.gold) {
      taxIncome = resourcesIncome.gold;
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
    { icon: <span className="w-5 h-5 flex items-center justify-center">🌾</span>, value: Math.floor(gameState.resources.food), name: 'Food', production: resourceProduction.food, consumption: foodConsumption, key: 'food' },
    { icon: <span className="w-5 h-5 flex items-center justify-center">💧</span>, value: Math.floor(gameState.resources.oil), name: 'Oil', production: resourceProduction.oil, key: 'oil' },
    { icon: <span className="w-5 h-5 flex items-center justify-center">⚙️</span>, value: Math.floor(gameState.resources.metal), name: 'Metal', production: resourceProduction.metal, key: 'metal' },
    { icon: <span className="w-5 h-5 flex items-center justify-center">🔩</span>, value: Math.floor(gameState.resources.steel), name: 'Steel', production: resourceProduction.steel, key: 'steel' },
    { icon: <span className="w-5 h-5 flex items-center justify-center">🔫</span>, value: Math.floor(gameState.resources.weapons), name: 'Weapons', production: resourceProduction.weapons, key: 'weapons' },
    { icon: <Globe className="w-5 h-5" />, value: Math.floor(gameState.resources.influence || 0), name: 'Influence', production: resourceProduction.influence, key: 'influence' }
  ];

  const getProductionColor = (production) => (production >= 0 ? 'text-green-500' : 'text-red-500');
  const formatProduction = (production) => `${production >= 0 ? '+' : ''}${Math.round(production * 10) / 10}`;

  const renderTooltipContent = (resourceKey) => {
    let tooltipContent = <p>No data available.</p>;
    if (resourceKey === 'food') {
      tooltipContent = <>
        <p>Production: {resourceProduction.food}</p>
        <p>Consumption: {foodConsumption}</p>
      </>;
    }
    return tooltipContent;
  };


  // Function to create tooltip content showing production sources
  const createTooltipContent = (resourceType) => {
    const tooltipItems = [];
    
    // Add tax income for gold
    if (resourceType === 'gold' && resourcesIncome?.gold) {
      tooltipItems.push(
        <div key="taxes" className="whitespace-nowrap">
          Налоги: <span className={getProductionColor(resourcesIncome.gold)}>
            {formatProduction(resourcesIncome.gold)}/с
          </span>
          {cities.filter(c => c.owner === 'player').map(city => (
            <div key={`tax-${city.id}`} className="text-xs ml-4">
              {city.name}: {city.taxRate === 0 ? 
                <span className="text-red-500">-{(city.population * 0.5).toFixed(1)}/с</span> : 
                <span className="text-green-500">+{(city.population * (city.taxRate / 5)).toFixed(1)}/с</span>}
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
              {city.name}: {city.satisfaction > 90 ? 
                <span className="text-green-500">+3.0/с</span> : 
                city.satisfaction > 70 ? <span className="text-green-500">+1.0/с</span> : 
                <span className="text-gray-500">+0.0/с</span>}
            </div>
          ))}
        </div>
      );
    }
    
    // Add building production items
    cities.forEach(city => {
      if (city.owner === 'player') {
        city.buildings.forEach(buildingId => {
          const building = BUILDINGS.find(b => b.id === buildingId);
          if (building && building.resourceProduction && building.resourceProduction.type === resourceType) {
            tooltipItems.push(
              <div key={`${city.id}-${buildingId}-${Math.random()}`} className="whitespace-nowrap">
                {building.name} <span className="text-xs">({city.name})</span>: <span className="text-green-500">+{building.resourceProduction.amount}/с</span>
              </div>
            );
          }
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

  return (
    <Card className="fixed top-4 left-4 p-4 z-[1000]">
      <div className="flex flex-wrap gap-4">
        {resources.map((resource) => {
          // Calculate actual production including income from resourcesIncome
          const totalProduction = resource.production + (
            resourcesIncome && resourcesIncome[resource.key] ? resourcesIncome[resource.key] : 0
          ) - (resource.consumption || 0);
          
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
              <div className="hidden group-hover:block">
                {createTooltipContent(resource.key)}
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
          <div key={`satisfaction-${city.id}`} className="border-l pl-4">
            <div className="flex items-center gap-2">
              <span>{city.satisfaction >= 70 ? '😃' : city.satisfaction >= 30 ? '😐' : '😠'}</span>
              <span className="font-medium">
                {city.name.split(' ')[0]}: {Math.floor(city.satisfaction || 0)}%
                {city.protestTimer ? <span className="ml-1 text-xs text-red-500">(⚠️ {Math.floor(city.protestTimer)}s)</span> : ''}
              </span>
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