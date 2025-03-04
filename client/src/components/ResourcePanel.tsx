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

    // Process building production
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

    // Set resource production without adding resourcesIncome to gold
    // This prevents double-counting since we'll use resourcesIncome directly in the UI
    setResourceProduction({
      gold: goldProd,
      wood: woodProd,
      food: foodProd,
      oil: oilProd,
      metal: metalProd,
      steel: steelProd,
      weapons: weaponsProd,
      influence: influenceProd
    });

    setFoodConsumption(foodCons);
  }, [cities, resourcesIncome]);

  const resources = [
    { icon: <Coins className="w-5 h-5" />, value: Math.floor(gameState.resources.gold), name: 'Gold', production: resourceProduction.gold, key: 'gold' },
    { icon: <Trees className="w-5 h-5" />, value: Math.floor(gameState.resources.wood), name: 'Wood', production: resourceProduction.wood, key: 'wood' },
    { icon: <Wheat className="w-5 h-5" />, value: Math.floor(gameState.resources.food), name: 'Food', production: resourceProduction.food - foodConsumption, consumption: foodConsumption, key: 'food' },
    { icon: <Droplet className="w-5 h-5" />, value: Math.floor(gameState.resources.oil), name: 'Oil', production: resourceProduction.oil, key: 'oil' },
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
              {city.name}: <span className="text-green-500">+{(city.population * 0.1).toFixed(1)}/с</span>
            </div>
          ))}
        </div>
      );
    }

    // Add buildings that produce this resource, grouped by city and building type
    const buildingsByCity = {};

    cities.forEach(city => {
      if (city.owner === 'player') {
        // Group buildings by ID to count them
        const buildingCounts = {};

        city.buildings.forEach(buildingId => {
          buildingCounts[buildingId] = (buildingCounts[buildingId] || 0) + 1;
        });

        // For each building type, check if it produces the current resource
        Object.entries(buildingCounts).forEach(([buildingId, count]) => {
          const building = BUILDINGS.find(b => b.id === buildingId);
          if (building && building.resourceProduction && building.resourceProduction.type === resourceType) {
            if (!buildingsByCity[city.name]) {
              buildingsByCity[city.name] = [];
            }

            const totalProduction = building.resourceProduction.amount * (count as number);

            buildingsByCity[city.name].push({
              buildingName: building.name,
              count: count as number,
              amount: building.resourceProduction.amount,
              totalProduction: totalProduction
            });
          }
        });
      }
    });

    // Add grouped buildings to tooltip
    Object.entries(buildingsByCity).forEach(([cityName, buildings]) => {
      buildings.forEach((buildingInfo: any) => {
        tooltipItems.push(
          <div key={`${cityName}-${buildingInfo.buildingName}`} className="whitespace-nowrap">
            {buildingInfo.buildingName} ({cityName}): {buildingInfo.count}x <span className={getProductionColor(buildingInfo.totalProduction)}>
              {formatProduction(buildingInfo.totalProduction)}/с
            </span>
          </div>
        );
      });
    });

    // If there are no sources for this resource
    if (tooltipItems.length === 0) {
      tooltipItems.push(<div key="no-sources">Нет источников производства</div>);
    }

    return (
      <div className="p-2">
        <h4 className="font-bold mb-1">{resources.find(r => r.key === resourceType)?.name} Production</h4>
        {tooltipItems}
      </div>
    );
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