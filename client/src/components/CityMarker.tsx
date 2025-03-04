import React, { useState, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useGameStore } from '@/lib/store';
import { MapPinIcon, Crown, Swords, Users, Wheat, Coins, Trees, Droplet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BUILDINGS } from '@/lib/game';
import type { Region } from '@/shared/regionTypes';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';


export function CityMarker({ city }: { city: Region }) {
  const map = useMap();
  const selectCity = useGameStore(state => state.selectCity);
  const { setSelectedCity, gameState, cities } = useGameStore();
  const [showLabel, setShowLabel] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(map.getZoom());
  const queryClient = useQueryClient();

  // Обновляем зум при изменении масштаба карты
  useEffect(() => {
    const updateZoom = () => {
      setZoomLevel(map.getZoom());
    };

    map.on('zoom', updateZoom);

    return () => {
      map.off('zoom', updateZoom);
    };
  }, [map]);

  let color = 'gray';
  if (city.owner === 'player') {
    color = 'blue';
  } else if (city.owner === 'ai') {
    color = 'red';
  }

  const hasCapital = cities.some(c => c.owner === 'player' && c.buildings.includes('capital'));

  const handleCapture = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await apiRequest('PATCH', `/api/cities/${city.id}/capture`, {
        isCapital: !hasCapital
      });

      if (response.success) {
        await queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/game-state'] });
      }
    } catch (error) {
      console.error('Failed to capture city:', error);
    }
  };

  // Размер маркера зависит от уровня масштабирования
  const getMarkerSize = () => {
    if (zoomLevel < 8) return 40;
    if (zoomLevel > 12) return 20;
    return 30 - ((zoomLevel - 8) * 2); // Плавное изменение от 30 до 20
  };

  const markerSize = getMarkerSize();
  const halfSize = markerSize / 2;

  return (
    <div
      className={`city-marker city-marker-${color}`}
      style={{
        width: `${markerSize}px`,
        height: `${markerSize}px`,
        position: 'absolute',
        left: map.latLngToLayerPoint([city.latitude, city.longitude]).x - halfSize,
        top: map.latLngToLayerPoint([city.latitude, city.longitude]).y - halfSize,
        zIndex: showTooltip ? 1000 : city.owner === 'player' ? 800 : city.owner === 'ai' ? 700 : 500,
        fontSize: `${Math.max(10, Math.min(14, zoomLevel))}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectCity(city);
        setSelectedCity(city);
      }}
      onMouseEnter={() => {
        setShowLabel(true);
        setShowTooltip(true);
      }}
      onMouseLeave={() => {
        setShowLabel(false);
        setShowTooltip(false);
      }}
    >
      {showTooltip && (
        <Card 
          className={`absolute z-20 shadow-lg city-tooltip-card ${zoomLevel < 8 ? 'scale-150' : zoomLevel > 12 ? 'scale-75' : ''}`}
          style={{
            transform: `scale(${Math.max(0.6, Math.min(1.5, zoomLevel / 10))})`,
            transformOrigin: 'top left',
            maxWidth: '180px',
            padding: '0.5rem',
            marginTop: '-1.5rem',
            marginLeft: '0.75rem'
          }}
        >
          <div className="text-sm font-semibold truncate">{city.name}</div>

          {city.owner === 'neutral' ? (
            <>
              <div className="text-xs mt-1">Нейтральный город</div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 text-xs py-1"
                onClick={handleCapture}
              >
                {!hasCapital ? "Выбрать столицей" : "Захватить"}
              </Button>
            </>
          ) : (
            <>
              <div className="text-xs mt-1">
                Владелец: {city.owner === 'player' ? 'Вы' : 'Противник'}
              </div>
              <div className="mt-1 space-y-0.5">
                <div className="text-xs">Население: {city.population}</div>
                <div className="text-xs">Военные: {city.military || 0}</div>
                {city.buildings.length > 0 && (
                  <>
                    <h4 className="text-xs font-semibold mt-1">Постройки:</h4>
                    <div className="grid grid-cols-1 gap-0.5">
                      {city.buildings.slice(0, 3).map((buildingId, index) => {
                        const building = BUILDINGS.find(b => b.id === buildingId);
                        return building ? (
                          <div key={index} className="flex items-center text-xs">
                            <span className="mr-1">{building.icon || '🏢'}</span>
                            <span className="truncate">{building.name}</span>
                          </div>
                        ) : null;
                      })}
                      {city.buildings.length > 3 && (
                        <div className="text-xs text-gray-500">+{city.buildings.length - 3} ещё</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}