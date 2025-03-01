
import React from 'react';
import { useMap } from 'react-leaflet';
import { BUILDINGS } from '@/lib/game';
import { useGameStore } from '@/lib/store';
import { getResourceIcon } from '@/lib/resources';
import type { Region } from '@/shared/regionTypes';

interface CityMarkerProps {
  city: Region;
  onClick: (city: Region) => void;
}

/**
 * Компонент маркера города на карте
 * Отображает название города и ресурсы, которые он производит (если город принадлежит игроку)
 */
const CityMarker: React.FC<CityMarkerProps> = ({ city, onClick }) => {
  const { zoom } = useMap();
  const { buildingUpgrades } = useGameStore();

  // Размер маркера зависит от зума карты
  const size = Math.max(8, Math.min(14, zoom * 1.5));

  // Рассчитываем ресурсы, производимые зданиями в городе (только для городов игрока)
  const playerProducedResources: Record<string, number> = {};

  if (city.owner === 'player' && city.buildings?.length > 0) {
    // Рассчитываем производство от зданий
    city.buildings.forEach(buildingId => {
      const building = BUILDINGS.find(b => b.id === buildingId);
      if (building?.resourceProduction) {
        const { type, amount } = building.resourceProduction;
        playerProducedResources[type] = (playerProducedResources[type] || 0) + amount;
      }
    });
  }

  // Фильтруем ресурсы, чтобы показывать только ненулевые производимые игроком ресурсы
  const resourceEntries = Object.entries(playerProducedResources);
  const hasResources = resourceEntries.length > 0;

  return (
    <div 
      className={`
        absolute transform -translate-x-1/2 -translate-y-1/2 
        rounded-full border-2 
        flex items-center justify-center 
        cursor-pointer hover:border-blue-400 
        transition-all duration-200
        ${city.owner === 'player' ? 'bg-blue-500 border-blue-700' : 'bg-gray-500 border-gray-700'}
      `}
      style={{ width: `${size}px`, height: `${size}px` }}
      onClick={() => onClick(city)}
    >
      <div className="text-xs font-semibold text-center text-white">
        {city.name.split(' ')[0]}

        {city.owner === 'player' && city.buildings && city.buildings.length > 0 && (
          <div className="mt-1 text-[8px]">
            {hasResources && 
              resourceEntries.map(([resource, amount]) => (
                <div key={resource} className="flex items-center justify-center">
                  {getResourceIcon(resource)} +{amount}
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default CityMarker;
