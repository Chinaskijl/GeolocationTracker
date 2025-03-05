
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

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [hoveredResource, showTooltip]);

  const renderTooltip = (resourceType: string) => {
    const tooltipItems: React.ReactNode[] = [];

    // Check if there is income for this resource
    if (resourcesIncome && resourcesIncome[resourceType] !== 0) {
      tooltipItems.push(
        <div key="income" className="whitespace-nowrap">
          Income: <span className={resourcesIncome[resourceType] > 0 ? "text-green-500" : "text-red-500"}>
            {resourcesIncome[resourceType] > 0 ? "+" : ""}{resourcesIncome[resourceType].toFixed(1)}/s
          </span>
        </div>
      );
    }

    // Add production sources
    Object.entries(resourcesIncome || {}).forEach(([resource, amount]) => {
      if (resource === resourceType && amount !== 0) {
        tooltipItems.push({
          city: "Total",
          amount
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
          );
          
          return (
            <div 
              key={resource.key} 
              className="flex items-center gap-2 relative"
              onMouseEnter={() => {
                setHoveredResource(resource.key);
                setShowTooltip(true);
              }}
              onMouseLeave={() => {
                setShowTooltip(false);
              }}
            >
              <span className="text-lg">{resource.icon}</span>
              <div>
                <div className="font-medium">{Math.floor(resource.value)}</div>
                {totalProduction !== 0 && (
                  <div className={`text-xs ${totalProduction > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {totalProduction > 0 ? '+' : ''}{totalProduction.toFixed(1)}/s
                  </div>
                )}
              </div>
              {hoveredResource === resource.key && showTooltip && renderTooltip(resource.key)}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Also export as named export for components that might be importing it that way
export const ResourcePanel = ResourcePanel;
