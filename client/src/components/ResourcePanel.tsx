import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Coins, Trees, Wheat, Droplet, Globe } from 'lucide-react'; // Added Globe icon
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
    influence: 0 // Added influence
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
    let influenceProd = 0;
    
    // Добавляем налоговую прибыль, если она есть в resourcesIncome
    if (resourcesIncome?.gold) {
      goldProd += resourcesIncome.gold;
    }
    
    // Добавляем прибыль от влияния, если она есть в resourcesIncome
    if (resourcesIncome?.influence) {
      influenceProd += resourcesIncome.influence;
    }

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
              case 'influence':
                influenceProd += amount;
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
      weapons: weaponsProd,
      influence: influenceProd // Added influence
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
      icon: <span className="w-5 h-5 flex items-center justify-center">🔫</span>, 
      value: Math.floor(gameState.resources.weapons), 
      name: 'Weapons',
      production: resourceProduction.weapons
    },
    { 
      icon: <Globe className="w-5 h-5" />, 
      value: Math.floor(gameState.resources.influence || 0), 
      name: 'Influence',
      production: resourceProduction.influenceroduction.weapons
    },
    { // Added influence resource
      icon: <Globe className="h-4 w-4 mr-1 text-purple-500" />,
      value: Math.floor(gameState.resources.influence),
      name: 'Influence',
      production: resourceProduction.influence
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
        
        {/* Удовлетворенность населения */}
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