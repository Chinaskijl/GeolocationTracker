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
    oil: 0,
    metal: 0,
    steel: 0,
    weapons: 0
  });
  const [foodConsumption, setFoodConsumption] = useState(0);

  useEffect(() => {
    // Рассчитываем общее производство ресурсов и потребление еды
    let goldProd = 0;
    let woodProd = 0;
    let foodProd = 0;
    let oilProd = 0;
    let metalProd = 0;
    let steelProd = 0;
    let weaponsProd = 0;
    let popCount = 0;

    cities.forEach(city => {
      if (city.owner === 'player') {
        popCount += city.population;

        // Добавляем базовое производство города
        if (city.resources.gold) goldProd += city.resources.gold;
        if (city.resources.wood) woodProd += city.resources.wood;
        if (city.resources.food) foodProd += city.resources.food;
        if (city.resources.oil) oilProd += city.resources.oil;

        // Обрабатываем здания
        city.buildings.forEach(buildingId => {
          const building = getBuilding(buildingId);
          if (building?.resourceProduction) {
            const { type, amount } = building.resourceProduction;
            switch (type) {
              case 'gold': goldProd += amount; break;
              case 'wood': woodProd += amount; break;
              case 'food': foodProd += amount; break;
              case 'oil': oilProd += amount; break;
              case 'metal': metalProd += amount; break;
              case 'steel': steelProd += amount; break;
              case 'weapons': weaponsProd += amount; break;
            }
          }
        });
      }
    });

    // Потребление еды населением
    const foodCons = Math.round(popCount * 0.1);

    setResourceProduction({
      gold: parseFloat(goldProd.toFixed(1)),
      wood: parseFloat(woodProd.toFixed(1)),
      food: parseFloat(foodProd.toFixed(1)),
      oil: parseFloat(oilProd.toFixed(1)),
      metal: parseFloat(metalProd.toFixed(1)),
      steel: parseFloat(steelProd.toFixed(1)),
      weapons: parseFloat(weaponsProd.toFixed(1))
    });

    // Для отладки
    console.log("Производство ресурсов:", {
      gold: goldProd,
      wood: woodProd,
      food: foodProd,
      oil: oilProd,
      metal: metalProd,
      steel: steelProd,
      weapons: weaponsProd
    });

    setFoodConsumption(foodCons);
  }, [cities, gameState]);

  const resources = [
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">💰</span>, 
      value: Math.floor(gameState.resources.gold), 
      name: 'Gold',
      production: resourceProduction.gold
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">🌲</span>, 
      value: Math.floor(gameState.resources.wood), 
      name: 'Wood',
      production: resourceProduction.wood
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">🌾</span>, 
      value: Math.floor(gameState.resources.food), 
      name: 'Food',
      production: resourceProduction.food,
      consumption: foodConsumption
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">💧</span>, 
      value: Math.floor(gameState.resources.oil), 
      name: 'Oil',
      production: resourceProduction.oil
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">⚙️</span>, 
      value: Math.floor(gameState.resources.metal), 
      name: 'Metal',
      production: resourceProduction.metal
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">🔩</span>, 
      value: Math.floor(gameState.resources.steel), 
      name: 'Steel',
      production: resourceProduction.steel
    },
    { 
      icon: <span className="w-5 h-5 flex items-center justify-center">⚔️</span>, 
      value: Math.floor(gameState.resources.weapons), 
      name: 'Weapons',
      production: resourceProduction.weapons
    }
  ];

  return (
    <Card className="fixed top-4 left-4 p-4 z-[1000]">
      <div className="flex flex-wrap gap-4">
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
            <span className="font-medium">{Math.floor(gameState.military)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Вспомогательная функция для получения информации о здании
function getBuilding(id: string) {
  const buildings = [
    {
      id: 'farm',
      name: 'Ферма',
      cost: { wood: 100, gold: 50 },
      resourceProduction: {
        type: 'food',
        amount: 5
      },
      maxCount: 5
    },
    {
      id: 'mine',
      name: 'Рудник',
      cost: { wood: 150, gold: 100 },
      resourceProduction: {
        type: 'gold',
        amount: 5
      },
      maxCount: 3
    },
    {
      id: 'lumbermill',
      name: 'Лесопилка',
      cost: { wood: 50, gold: 100 },
      resourceProduction: {
        type: 'wood',
        amount: 8
      },
      maxCount: 3
    },
    {
      id: 'house',
      name: 'Жилой дом',
      cost: { wood: 200, gold: 50 },
      population: {
        housing: 100,
        growth: 2
      },
      maxCount: 10
    },
    {
      id: 'oilwell',
      name: 'Нефтяная скважина',
      cost: { wood: 300, gold: 200 },
      resourceProduction: {
        type: 'oil',
        amount: 3
      },
      maxCount: 3
    },
    {
      id: 'barracks',
      name: 'Казармы',
      cost: { wood: 250, gold: 150 },
      military: {
        production: 1,
        populationUse: 1
      },
      maxCount: 1
    },
    {
      id: 'metal_factory',
      name: 'Завод металла',
      cost: { wood: 250, gold: 150 },
      resourceProduction: {
        type: 'metal',
        amount: 2
      },
      maxCount: 2
    },
    {
      id: 'steel_factory',
      name: 'Завод стали',
      cost: { wood: 350, gold: 100 },
      resourceProduction: {
        type: 'steel',
        amount: 1
      },
      resourceConsumption: {
        metal: 5
      },
      maxCount: 2
    },
    {
      id: 'weapons_factory',
      name: 'Оружейный станок',
      cost: { wood: 150 },
      resourceProduction: {
        type: 'weapons',
        amount: 1
      },
      resourceConsumption: {
        wood: 15,
        steel: 1
      },
      maxCount: 3
    }
  ];

  return buildings.find(b => b.id === id);
}