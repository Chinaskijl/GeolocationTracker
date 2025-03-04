import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Coins, Trees, Wheat, Droplet, Globe } from 'lucide-react'; // Added Globe icon
import { useEffect, useState } from 'react';
import { BUILDINGS } from '@/lib/game';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ResourcePanel() {
  const { gameState, cities, resourcesIncome } = useGameStore();
  // Расширяем состояние для хранения детальной информации о производстве и потреблении ресурсов
  const [resourceDetails, setResourceDetails] = useState({
    gold: {
      totalProduction: 0,
      sources: [], // [{source: string, amount: number}]
      consumption: [] // [{source: string, amount: number}]
    },
    wood: {
      totalProduction: 0,
      sources: [],
      consumption: []
    },
    food: {
      totalProduction: 0,
      sources: [],
      consumption: []
    },
    oil: {
      totalProduction: 0,
      sources: [],
      consumption: []
    },
    metal: {
      totalProduction: 0,
      sources: [],
      consumption: []
    },
    steel: {
      totalProduction: 0,
      sources: [],
      consumption: []
    },
    weapons: {
      totalProduction: 0,
      sources: [],
      consumption: []
    },
    influence: {
      totalProduction: 0,
      sources: [],
      consumption: []
    }
  });

  const [foodConsumption, setFoodConsumption] = useState(0);

  useEffect(() => {
    // Создаем объекты для хранения информации о ресурсах
    let details = {
      gold: { totalProduction: 0, sources: [], consumption: [] },
      wood: { totalProduction: 0, sources: [], consumption: [] },
      food: { totalProduction: 0, sources: [], consumption: [] },
      oil: { totalProduction: 0, sources: [], consumption: [] },
      metal: { totalProduction: 0, sources: [], consumption: [] },
      steel: { totalProduction: 0, sources: [], consumption: [] },
      weapons: { totalProduction: 0, sources: [], consumption: [] },
      influence: { totalProduction: 0, sources: [], consumption: [] }
    };

    let foodCons = 0;

    // Добавляем налоговую прибыль, если она есть в resourcesIncome
    if (resourcesIncome?.gold) {
      details.gold.totalProduction += resourcesIncome.gold;
      details.gold.sources.push({ source: "Налоги", amount: resourcesIncome.gold });
    }

    // Добавляем прибыль от влияния, если она есть в resourcesIncome
    if (resourcesIncome?.influence) {
      details.influence.totalProduction += resourcesIncome.influence;
      details.influence.sources.push({ source: "Дипломатия", amount: resourcesIncome.influence });
    }

    cities.forEach(city => {
      if (city.owner === 'player') {
        // Обработка зданий и их продукции
        city.buildings.forEach(buildingId => {
          const building = BUILDINGS.find(b => b.id === buildingId);
          if (building && building.resourceProduction) {
            const { type, amount } = building.resourceProduction;

            // Добавляем производство ресурсов от зданий
            if (type && amount) {
              details[type].totalProduction += amount;
              details[type].sources.push({ 
                source: `${building.name} (${city.name})`, 
                amount: amount 
              });
            }
          }

          // Добавляем потребление ресурсов от зданий
          if (building && building.resourceConsumption) {
            for (const [resType, resAmount] of Object.entries(building.resourceConsumption)) {
              if (resType !== 'type' && resType !== 'amount' && details[resType]) {
                const amount = -Number(resAmount);
                details[resType].totalProduction += amount;
                details[resType].consumption.push({ 
                  source: `${building.name} (${city.name})`, 
                  amount: -amount 
                });
              }
            }
          }
        });

        // Рассчитываем потребление еды населением
        const cityFoodCons = city.population * 0.1;
        foodCons += cityFoodCons;
        details.food.consumption.push({ source: `Население (${city.name})`, amount: cityFoodCons });

        // Если в городе нулевые налоги, добавляем расход золота
        if (city.taxRate === 0) {
          const goldConsumption = -Math.round(city.population * 0.05);
          details.gold.totalProduction += goldConsumption;
          details.gold.consumption.push({ 
            source: `Содержание (${city.name})`, 
            amount: -goldConsumption 
          });
        }
      }
    });

    setResourceDetails(details);
    setFoodConsumption(foodCons);
  }, [cities, gameState, resourcesIncome]);

  const resources = [
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">💰</span>, 
      value: Math.floor(gameState.resources.gold), 
      name: 'Gold',
      type: 'gold',
      production: resourceDetails.gold.totalProduction
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">🌲</span>, 
      value: Math.floor(gameState.resources.wood), 
      name: 'Wood',
      type: 'wood',
      production: resourceDetails.wood.totalProduction
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">🌾</span>, 
      value: Math.floor(gameState.resources.food), 
      name: 'Food',
      type: 'food',
      production: resourceDetails.food.totalProduction,
      consumption: foodConsumption
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">💧</span>, 
      value: Math.floor(gameState.resources.oil), 
      name: 'Oil',
      type: 'oil',
      production: resourceDetails.oil.totalProduction
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">⚙️</span>, 
      value: Math.floor(gameState.resources.metal), 
      name: 'Metal',
      type: 'metal',
      production: resourceDetails.metal.totalProduction
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">🔩</span>, 
      value: Math.floor(gameState.resources.steel), 
      name: 'Steel',
      type: 'steel',
      production: resourceDetails.steel.totalProduction
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">🔫</span>, 
      value: Math.floor(gameState.resources.weapons), 
      name: 'Weapons',
      type: 'weapons',
      production: resourceDetails.weapons.totalProduction
    },
    { 
      icon: <Globe className="w-5 h-5" />, 
      value: Math.floor(gameState.resources.influence || 0), 
      name: 'Influence',
      type: 'influence',
      production: resourceDetails.influence.totalProduction
    },
  ];

  // Функция для рендеринга содержимого всплывающей подсказки
  const renderResourceDetails = (type) => {
    const details = resourceDetails[type];

    return (
      <div className="p-2 max-w-md">
        <div className="font-bold mb-2">{type.charAt(0).toUpperCase() + type.slice(1)} детали:</div>

        {details.sources.length > 0 && (
          <div className="mb-2">
            <div className="font-semibold text-green-500">Производство:</div>
            {details.sources.map((source, index) => (
              <div key={`prod-${index}`} className="flex justify-between">
                <span>{source.source}</span>
                <span className="ml-4 text-green-500">+{source.amount.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}

        {details.consumption.length > 0 && (
          <div>
            <div className="font-semibold text-red-500">Потребление:</div>
            {details.consumption.map((consumption, index) => (
              <div key={`cons-${index}`} className="flex justify-between">
                <span>{consumption.source}</span>
                <span className="ml-4 text-red-500">-{consumption.amount.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}

        {details.sources.length === 0 && details.consumption.length === 0 && (
          <div className="text-gray-500">Нет источников производства или потребления</div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Card className="p-3 rounded-md h-auto">
        <h3 className="text-xs font-semibold mb-1">Resources</h3>
        <div className="space-y-2">
          {resources.map((resource) => (
            <Tooltip key={resource.name}>
              <TooltipTrigger asChild>
                <div className="flex items-center text-sm cursor-help">
                  <div className="mr-2">{resource.icon}</div>
                  <div className="flex-1">{resource.name}</div>
                  <div className="font-semibold">
                    {resource.value}
                    {resource.production > 0 && (
                      <span className="text-green-500 text-xs ml-1">+{resource.production.toFixed(1)}</span>
                    )}
                    {resource.production < 0 && (
                      <span className="text-red-500 text-xs ml-1">{resource.production.toFixed(1)}</span>
                    )}
                    {resource.production === 0 && (
                      <span className="text-gray-500 text-xs ml-1">+0</span>
                    )}
                    {resource.consumption > 0 && (
                      <span className="text-red-500 text-xs ml-1">(-{resource.consumption.toFixed(1)})</span>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" align="start" className="bg-gray-800 text-white border-gray-700">
                {renderResourceDetails(resource.type)}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </Card>
    </TooltipProvider>
  );
}