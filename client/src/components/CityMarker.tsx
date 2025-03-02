
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
  
  // Получаем только доступные в городе ресурсы (не производство)
  const availableResources = Object.entries(city.resources || {})
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({ type: key, amount: value }));

  // Определяем, является ли город столицей игрока
  const isCapital = city.owner === 'player' && city.buildings.includes('capital');

  const handleClick = () => {
    map.flyTo([city.latitude, city.longitude], 10);
    selectCity(city);
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
              {city.population}
            </span>
            {city.military > 0 && (
              <span className="flex items-center">
                <Swords size={14} className="mr-1" />
                {city.military}
              </span>
            )}
          </div>
          
          {/* Доступные в городе ресурсы */}
          {availableResources.length > 0 && (
            <div className="border-t pt-1 mt-1">
              <div className="text-xs font-semibold mb-1">Доступные ресурсы:</div>
              <div className="flex flex-wrap gap-1">
                {availableResources.map(resource => {
                  const ResourceIcon = getResourceIcon(resource.type);
                  return (
                    <div key={resource.type} className="flex items-center text-xs">
                      <ResourceIcon size={12} className="mr-1" />
                      {resource.amount}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
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
        </Card>
      </div>
    </div>
  );
}
