
import React from 'react';
import { useMap } from 'react-leaflet';
import { useGameStore } from '@/lib/store';
import { getResourceIcon } from '@/lib/resources';
import { MapPinIcon, Crown, Swords, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BUILDINGS } from '@/lib/game';
import type { Region } from '@/shared/regionTypes';

interface CityMarkerProps {
  city: Region;
  onClick: (city: Region) => void;
}

/**
 * Компонент маркера города на карте
 * Отображает информацию о городе: население, военные и производимые ресурсы
 */
const CityMarker: React.FC<CityMarkerProps> = ({ city, onClick }) => {
  const { zoom } = useMap();
  const { buildingUpgrades } = useGameStore();

  // Размер маркера зависит от зума карты
  const size = Math.max(8, Math.min(14, zoom * 1.5));

  // Рассчитываем ресурсы, производимые зданиями в городе (только для городов игрока)
  const playerProducedResources: Record<string, number> = {};
  
  if (city.owner === 'player' && city.buildings?.length > 0) {
    city.buildings.forEach(buildingId => {
      const building = BUILDINGS.find(b => b.id === buildingId);
      if (building?.resourceProduction) {
        const { type, amount } = building.resourceProduction;
        
        // Учитываем улучшения
        const upgrade = buildingUpgrades[buildingId] || 0;
        const actualAmount = amount * (1 + upgrade * 0.2);
        
        if (!playerProducedResources[type]) {
          playerProducedResources[type] = 0;
        }
        playerProducedResources[type] += actualAmount;
      }
    });
  }

  // Преобразуем объект с ресурсами в массив для отображения
  const producedResourceEntries = Object.entries(playerProducedResources);
  const hasProducedResources = producedResourceEntries.length > 0;

  return (
    <div className="relative" onClick={() => onClick(city)}>
      <div 
        className={`flex items-center justify-center rounded-full cursor-pointer
          ${city.owner === 'player' ? 'bg-blue-500' : 
            city.owner === 'enemy' ? 'bg-red-500' : 'bg-gray-500'}`} 
        style={{ 
          width: `${size}px`, 
          height: `${size}px`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}
      >
        {city.owner === 'player' && <Crown className="text-white" size={size * 0.5} />}
      </div>

      <Card className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 z-50 p-1 shadow-lg bg-white min-w-[80px] text-[6px] text-center">
        <div className="font-semibold text-[8px]">{city.name}</div>
        
        <div className="flex items-center justify-center gap-1 mt-1">
          <Users size={7} />
          <span>{city.population}/{city.maxPopulation}</span>
        </div>
        
        {city.military > 0 && (
          <div className="flex items-center justify-center gap-1 mt-1">
            <Swords size={7} />
            <span>{city.military}</span>
          </div>
        )}
        
        {city.owner === 'player' && hasProducedResources && (
          <div className="mt-1">
            <div className="text-[7px] font-semibold">Производство:</div>
            <div className="grid grid-cols-2 gap-x-1 mt-0.5">
              {producedResourceEntries.map(([resource, amount]) => (
                <div key={resource} className="flex items-center justify-start gap-0.5">
                  {getResourceIcon(resource, { size: 6 })} 
                  <span>+{amount.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-1">
          <div className="text-[7px] font-semibold">Возможные ресурсы:</div>
          {/* Это поле оставляем пустым, как вы просили */}
        </div>
      </Card>
    </div>
  );
};

export default CityMarker;
