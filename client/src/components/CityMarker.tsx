import React from 'react';
import { useMap } from 'react-leaflet';
import { useGameStore } from '@/lib/store';
import { getResourceIcon } from '@/lib/resources';
import { MapPinIcon, Crown, Swords, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BUILDINGS } from '@/lib/game';
import type { Region } from '@/shared/regionTypes';

export function CityMarker({ city }: { city: Region }) {
  const map = useMap();
  const selectCity = useGameStore(state => state.selectCity);
  const selectedCity = useGameStore(state => state.selectedCity);

  const isSelected = selectedCity && selectedCity.id === city.id;

  // Neutral cities have 0 population and military
  const population = city.owner === 'neutral' ? 0 : city.population;
  const military = city.owner === 'neutral' ? 0 : city.military;

  // Get available buildings for this region
  const availableBuildings = city.owner === 'neutral' ? [] : city.availableBuildings || [];

  // Get building limits if defined
  const buildingLimits = city.buildingLimits || {};

  const isCapital = city.owner === 'player' && city.buildings.includes('capital');

  const handleClick = () => {
    map.flyTo([city.latitude, city.longitude], 10);
    selectCity(city);
  };

  const getBuildingName = (buildingId: string): string => {
    const building = BUILDINGS.find(b => b.id === buildingId);
    return building?.name || buildingId;
  };

  return (
    <div 
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-50 ${
        isSelected ? 'z-[1000]' : 'z-50'
      }`} 
      style={{ 
        left: map.latLngToLayerPoint([city.latitude, city.longitude]).x,
        top: map.latLngToLayerPoint([city.latitude, city.longitude]).y
      }}
      onClick={handleClick}
    >
      <div className="relative cursor-pointer group">
        {/* Маркер города */}
        <div className={`
          flex items-center justify-center w-8 h-8 rounded-full 
          ${city.owner === 'player' ? 'bg-blue-500' : 
            city.owner === 'ai' ? 'bg-red-500' : 'bg-gray-500'} 
          text-white shadow-md hover:scale-110 transition-transform
          ${isSelected ? 'ring-2 ring-white scale-110' : ''}
        `}>
          {isCapital ? <Crown size={16} /> : <MapPinIcon size={16} />}
        </div>

        {/* Всплывающая карточка с информацией */}
        <Card className="absolute bottom-full mb-2 p-2 w-40 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-sm font-bold mb-1 truncate">{city.name}</div>

          <div className="flex justify-between text-xs mb-1">
            <span className="flex items-center">
              <Users size={14} className="mr-1" />
              {population}
            </span>
            {military > 0 && (
              <span className="flex items-center">
                <Swords size={14} className="mr-1" />
                {military}
              </span>
            )}
          </div>

          {/* Доступные в городе ресурсы */}
          <div className="resources-info">
            <small>Доступные ресурсы:</small>
            <div className="resource-items">
              {city.resources.food > 0 && <span>🌾 {city.resources.food}</span>}
              {city.resources.wood > 0 && <span>🌲 {city.resources.wood}</span>}
              {city.resources.gold > 0 && <span>💰 {city.resources.gold}</span>}
              {city.resources.oil > 0 && <span>🛢️ {city.resources.oil}</span>}
              {city.resources.metal > 0 && <span>⚙️ {city.resources.metal}</span>}
            </div>

            {/* Отображаем доступные для постройки здания */}
            {city.availableBuildings && city.availableBuildings.length > 0 && (
              <>
                <small className="mt-1">Доступные постройки:</small>
                <div className="building-items">
                  {city.availableBuildings.map((buildingId) => {
                    const building = BUILDINGS.find(b => b.id === buildingId);
                    if (!building) return null;
                    
                    // Подсчитываем, сколько таких зданий уже построено
                    const builtCount = city.buildings.filter(b => b === buildingId).length;
                    
                    // Получаем лимит для этого здания в этом городе
                    const limit = city.buildingLimits && city.buildingLimits[buildingId] 
                      ? city.buildingLimits[buildingId] 
                      : (building.maxCount || 999);
                    
                    return (
                      <span key={buildingId}>
                        {building.icon || '🏢'} {building.name || buildingId} ({builtCount}/{limit})
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Построенные здания */}
          {city.buildings.length > 0 && (
            <div className="border-t pt-1 mt-1">
              <div className="text-xs font-semibold mb-1">Постройки:</div>
              <div className="flex flex-wrap gap-1">
                {city.buildings.map((buildingId, index) => {
                  const building = BUILDINGS.find(b => b.id === buildingId);
                  return (
                    <div key={`${buildingId}-${index}`} className="text-xs">
                      {building?.name || buildingId}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Buildings */}
          {city.availableBuildings && city.availableBuildings.length > 0 && (
            <div className="border-t pt-1 mt-1">
              <div className="text-xs font-semibold mb-1">Доступные здания:</div>
              <div className="flex flex-wrap gap-1">
                {city.availableBuildings.map((buildingId, indexx) => (
                  <div key={`${buildingId}-${index}`} className="text-xs">
                    {getBuildingName(buildingId)}
                  </div>
                ))}
              </div>
            </div>
          )}


        </Card>
      </div>
    </div>
  );
}