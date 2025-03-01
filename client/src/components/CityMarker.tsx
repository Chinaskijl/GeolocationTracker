const tooltipContent = `
    <div class="city-tooltip">
      <h3>${city.name}</h3>
      <p>Население: ${city.population} / ${city.maxPopulation}</p>
      ${city.military ? `<p>Военные: ${city.military}</p>` : ''}
    </div>
  `;
import { memo, useCallback } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useGameStore } from '@/lib/store';
import { getResourceIcon } from '@/lib/resources';
import { useMap } from 'react-leaflet';

interface CityMarkerProps {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  owner: string;
  resources: Record<string, number>;
  population: number;
  military?: number;
}

export const CityMarker = memo(function CityMarker({
  id,
  name,
  latitude,
  longitude,
  owner,
  resources,
  population,
  military
}: CityMarkerProps) {
  const { selectCity, gameState } = useGameStore();
  const map = useMap();
  
  // Получаем текущий зум карты
  const zoom = map.getZoom();
  
  // Рассчитываем размер маркера в зависимости от зума
  // Базовый размер маркера при зуме 10
  const baseSize = 24;
  const minSize = 16;
  const maxSize = 32;
  
  // Коэффициент масштабирования (при zoom < 6 будет меньше, при zoom > 6 будет больше)
  const scaleFactor = Math.max(0.5, Math.min(1.5, zoom / 8));
  const markerSize = Math.max(minSize, Math.min(maxSize, baseSize * scaleFactor));

  const handleClick = useCallback(() => {
    selectCity(id);
  }, [id, selectCity]);

  // Получаем только те ресурсы, которые игрок может производить
  const getPlayerProducedResources = () => {
    const producedResources = [];
    for (const [key, value] of Object.entries(resources)) {
      // Добавляем ресурс только если он уже производится игроком
      if (gameState.resources && gameState.resources[key as keyof typeof gameState.resources] > 0) {
        producedResources.push({ name: key, value });
      }
    }
    return producedResources;
  };

  const producedResources = getPlayerProducedResources();

  const color = owner === 'player' ? 'blue' : owner === 'neutral' ? 'gray' : 'red';

  return (
    <Marker
      position={[latitude, longitude]}
      icon={L.divIcon({
        className: `city-marker city-marker-${color}`,
        iconSize: [markerSize, markerSize],
        html: `<div style="width: ${markerSize}px; height: ${markerSize}px; background-color: ${
          color === 'blue' ? '#3b82f6' : color === 'gray' ? '#6b7280' : '#ef4444'
        }; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
          ${population > 0 ? Math.floor(population / 1000) + 'k' : ''}
        </div>`,
      })}
      eventHandlers={{
        click: handleClick,
      }}
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={1}>
        <div className="p-2">
          <div className="font-bold">{name}</div>
          <div className="text-sm">
            {owner === 'player' 
              ? 'Ваш город' 
              : owner === 'neutral' 
                ? 'Нейтральный город' 
                : 'Вражеский город'
            }
          </div>
          {population > 0 && (
            <div className="text-sm">
              Население: {population.toLocaleString()}
            </div>
          )}
          {military && military > 0 && (
            <div className="text-sm">
              Военные: {military.toLocaleString()}
            </div>
          )}
          {producedResources.length > 0 && (
            <div className="text-sm mt-1">
              <div>Ресурсы:</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {producedResources.map(({ name, value }) => (
                  <span key={name} className="px-1 py-0.5 bg-gray-100 rounded text-xs flex items-center">
                    {getResourceIcon(name)} {value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Tooltip>
    </Marker>
  );
});
