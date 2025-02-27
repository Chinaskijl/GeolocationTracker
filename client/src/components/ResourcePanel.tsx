import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Coins, Trees, Wheat, Droplet } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ResourcePanel() {
  const { gameState, cities } = useGameStore();
  const [resourceProduction, setResourceProduction] = useState({
    gold: 0,
    wood: 0,
    food: 0,
    oil: 0
  });
  const [foodConsumption, setFoodConsumption] = useState(0);

  useEffect(() => {
    // Рассчитываем общее производство ресурсов и потребление еды
    let goldProd = 0;
    let woodProd = 0;
    let foodProd = 0;
    let oilProd = 0;
    let popCount = 0;

    cities.forEach(city => {
      if (city.owner === 'player') {
        popCount += city.population;

        // Добавляем базовое производство города
        if (city.resources.gold) goldProd += city.resources.gold;
        if (city.resources.wood) woodProd += city.resources.wood;
        if (city.resources.food) foodProd += city.resources.food;
        if (city.resources.oil) oilProd += city.resources.oil;

        // Проверяем здания
        city.buildings.forEach(buildingId => {
          const building = window.BUILDINGS?.find(b => b.id === buildingId);
          if (building?.resourceProduction) {
            const { type, amount } = building.resourceProduction;
            if (type === 'gold') goldProd += amount;
            if (type === 'wood') woodProd += amount;
            if (type === 'food') foodProd += amount;
            if (type === 'oil') oilProd += amount;
          }
        });
      }
    });

    // Рассчитываем потребление еды
    const foodCons = Math.round(popCount * 0.1); // 0.1 еды на 1 население

    setResourceProduction({
      gold: goldProd,
      wood: woodProd,
      food: foodProd,
      oil: oilProd
    });
    
    setFoodConsumption(foodCons);
  }, [cities, gameState]);

  const resources = [
    { 
      icon: <Coins className="w-5 h-5" />, 
      value: Math.floor(gameState.resources.gold), 
      name: 'Gold',
      production: resourceProduction.gold
    },
    { 
      icon: <Trees className="w-5 h-5" />, 
      value: Math.floor(gameState.resources.wood), 
      name: 'Wood',
      production: resourceProduction.wood
    },
    { 
      icon: <Wheat className="w-5 h-5" />, 
      value: Math.floor(gameState.resources.food), 
      name: 'Food',
      production: resourceProduction.food,
      consumption: foodConsumption
    },
    { 
      icon: <Droplet className="w-5 h-5" />, 
      value: Math.floor(gameState.resources.oil), 
      name: 'Oil',
      production: resourceProduction.oil
    }
  ];

  return (
    <Card className="fixed top-4 left-4 p-4 z-[1000]">
      <div className="flex gap-4">
        {resources.map((resource) => (
          <div key={resource.name} className="flex items-center gap-2">
            {resource.icon}
            <span className="font-medium">
              {resource.value}
              {resource.name === 'Food' ? (
                <span className={`ml-1 text-xs ${resource.production - resource.consumption >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ({resource.production - resource.consumption >= 0 ? '+' : ''}{resource.production - resource.consumption})
                </span>
              ) : (
                <span className="ml-1 text-xs text-green-500">(+{resource.production})</span>
              )}
            </span>
          </div>
        ))}
        <div className="border-l pl-4">
          <div className="flex items-center gap-2">
            <span>👥</span>
            <span className="font-medium">
              {Math.floor(gameState.population)}
              {gameState.resources.food <= 0 ? <span className="ml-1 text-xs text-red-500">(-1)</span> : ''}
            </span>
          </div>
        </div>
        <div className="border-l pl-4">
          <div className="flex items-center gap-2">
            <span>⚔️</span>
            <span className="font-medium">
              {Math.floor(gameState.military)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}