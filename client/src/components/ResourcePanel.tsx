import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { useGameStore } from '@/lib/store';

export default function ResourcePanel() {
  const { gameState, resourcesIncome } = useGameStore();
  const [hoveredResource, setHoveredResource] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Define resources based on gameState
  const resources = useMemo(() => {
    return [
      { key: 'gold', name: 'Gold', icon: '💰', value: Math.floor(gameState.resources.gold), production: 0, consumption: 0 },
      { key: 'wood', name: 'Wood', icon: '🪵', value: Math.floor(gameState.resources.wood), production: 0, consumption: 0 },
      { key: 'food', name: 'Food', icon: '🍞', value: Math.floor(gameState.resources.food), production: 0, consumption: gameState.population * 0.1 },
      { key: 'oil', name: 'Oil', icon: '🛢️', value: Math.floor(gameState.resources.oil), production: 0, consumption: 0 },
      { key: 'metal', name: 'Metal', icon: '🔧', value: Math.floor(gameState.resources.metal), production: 0, consumption: 0 },
      { key: 'steel', name: 'Steel', icon: '⚒️', value: Math.floor(gameState.resources.steel), production: 0, consumption: 0 },
      { key: 'weapons', name: 'Weapons', icon: '🔫', value: Math.floor(gameState.resources.weapons), production: 0, consumption: 0 },
      { key: 'influence', name: 'Influence', icon: '🌐', value: Math.floor(gameState.resources.influence), production: 0, consumption: 0 },
    ];
  }, [gameState]);

  useEffect(() => {
    // Any effects you need
    const handleMouseMove = (e: MouseEvent) => {
      if (hoveredResource && showTooltip) {
        // Handle tooltip positioning if needed
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [hoveredResource, showTooltip]);

  // Function to determine production/consumption color
  const getProductionColor = (value: number) => {
    if (value > 0) return 'text-green-500';
    if (value < 0) return 'text-red-500';
    return 'text-gray-500';
  };

  // Render tooltips for resources
  const renderTooltip = (resourceType: string) => {
    const tooltipItems: React.ReactNode[] = [];

    // City production sources
    gameState.cities?.forEach(city => {
      if (city.owner === 'player') {
        city.buildings?.forEach(buildingId => {
          const building = window.BUILDINGS?.find(b => b.id === buildingId);
          if (building?.resourceProduction?.type === resourceType) {
            tooltipItems.push(
              <div key={`${city.id}-${buildingId}`} className="whitespace-nowrap">
                {city.name} ({building.name}): <span className="text-green-500">+{building.resourceProduction.amount}/s</span>
                {city.population < (building.workers || 0) && <span className="text-red-500 ml-1">(нет рабочих)</span>}
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
                  {totalProduction !== 0 ? `(${totalProduction > 0 ? '+' : ''}${totalProduction.toFixed(1)}/s)` : ''}
                </span>
              </span>
              {hoveredResource === resource.key && showTooltip && renderTooltip(resource.key)}
            </div>
          );
        })}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span>👥</span>
            <span className="font-medium">{Math.floor(gameState.population)}</span>
          </div>
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