import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Coins, Trees, Wheat, Droplet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BUILDINGS } from '@/lib/game';

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
    let foodCons = 0;

    cities.forEach(city => {
      if (city.owner === 'player') {
        // Не учитываем базовое производство города, только постройки
        
        // Обработка зданий и их продукции
        city.buildings.forEach(buildingId => {
          const building = BUILDINGS.find(b => b.id === buildingId);
          if (building && building.resourceProduction) {
            const { type, amount } = building.resourceProduction;

            // Добавляем производство ресурсов от зданий
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
            }
          }
        });

        // Рассчитываем потребление еды населением
        foodCons += city.population * 0.1; // Предполагаемый коэффициент потребления
      }
    });

    setResourceProduction({
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
                  ({resource.production - resource.consumption >= 0 ? '+' : ''}{Math.round((resource.production - resource.consumption) * 10) / 10})
                </span>
              ) : (
                <span className="ml-1 text-xs text-green-500">(+{Math.round(resource.production * 10) / 10})</span>
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