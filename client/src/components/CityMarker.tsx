
import React, { useState } from 'react';
import { Region } from '../../../shared/regionTypes';
import { useMap } from 'react-leaflet';
import { useGameStore } from '../stores/gameStore';
import { Button } from './ui/button';
import { apiRequest } from '../lib/apiRequest';
import { useToast } from './ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';

// Эмодзи для зданий
const buildingEmojis: Record<string, string> = {
  house: '🏠',
  farm: '🌾',
  barracks: '⚔️',
  gold_mine: '💰',
  metal_mine: '⛏️',
  research_center: '🔬',
  oil_rig: '🛢️',
  factory: '🏭',
  market: '🏪',
  capital: '👑',
  port: '⚓',
  shipyard: '🚢',
  airport: '✈️',
  university: '🎓',
  hospital: '🏥'
  // Добавьте другие здания по необходимости
};

// Функция для получения эмодзи здания
const getBuildingEmoji = (buildingId: string): string => {
  return buildingEmojis[buildingId] || buildingId; // Если эмодзи нет, возвращаем ID
};

export function CityMarker({ city }: { city: Region }) {
  const map = useMap();
  const { setSelectedCity, gameState, cities } = useGameStore();
  const [showLabel, setShowLabel] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Определяем цвет в зависимости от владельца
  let color = 'gray';
  if (city.owner === 'player') {
    color = 'blue';
  } else if (city.owner === 'ai') {
    color = 'red';
  }

  // Проверяем, есть ли уже выбранная столица
  const hasCapital = cities.some(c => c.owner === 'player' && c.buildings.includes('capital'));

  // Получаем доступные для строительства здания
  const availableBuildings = city.availableBuildings || [];
  
  // Получаем лимиты зданий
  const buildingLimits = city.buildingLimits || {};

  // Обработчик для захвата города
  const handleCapture = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      console.log(`Attempting to capture city ${city.id}`);
      const response = await apiRequest('PATCH', `/api/cities/${city.id}/capture`, {
        isCapital: !hasCapital
      });

      if (response.success) {
        toast({
          title: hasCapital ? "Город захвачен!" : "Столица выбрана!",
          description: hasCapital ? "Вы успешно захватили город" : "Вы успешно выбрали столицу",
          variant: "success",
        });

        // Обновляем данные после захвата
        await queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/game-state'] });
      } else {
        toast({
          title: "Ошибка!",
          description: response.error || "Не удалось захватить город",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error capturing city:', error);
      toast({
        title: "Ошибка!",
        description: "Произошла ошибка при захвате города",
        variant: "destructive",
      });
    }
  };

  // Формируем информацию о текущих постройках
  const builtBuildingsCounts: Record<string, number> = {};
  city.buildings.forEach(building => {
    builtBuildingsCounts[building] = (builtBuildingsCounts[building] || 0) + 1;
  });

  // Подготовка контента для маркера
  return (
    <div 
      className={`city-marker city-marker-${color} absolute transform -translate-x-1/2 -translate-y-1/2`}
      onClick={() => setSelectedCity(city)}
      onMouseEnter={() => setShowLabel(true)}
      onMouseLeave={() => setShowLabel(false)}
    >
      <div className="text-center min-w-[150px] bg-white/90 p-2 rounded shadow-md border border-gray-200">
        <div className="font-semibold text-sm">{city.name}</div>
        
        {/* Основная информация */}
        <div className="text-xs mt-1">
          <div>👥 Население: {city.population} / {city.maxPopulation}</div>
          <div>⚔️ Военные: {city.military || 0}</div>
        </div>
        
        {/* Доступные постройки */}
        {city.owner === 'neutral' && (
          <div className="mt-1">
            <div className="text-xs font-semibold">Возможные постройки:</div>
            <div className="flex flex-wrap gap-1 mt-1 justify-center">
              {availableBuildings.map(buildingId => {
                const limit = buildingLimits[buildingId] || 0;
                return (
                  <div 
                    key={buildingId} 
                    className="tooltip" 
                    title={`${buildingId} (макс. ${limit})`}
                  >
                    {getBuildingEmoji(buildingId)}
                    <span className="text-[10px] align-top">{limit}</span>
                  </div>
                );
              })}
            </div>
            
            {/* Кнопка захвата */}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-2 text-xs py-1" 
              onClick={handleCapture}
            >
              {!hasCapital ? "Выбрать столицей" : "Захватить"}
            </Button>
          </div>
        )}
        
        {/* Если город принадлежит игроку, показываем уже построенные здания */}
        {city.owner === 'player' && (
          <div className="mt-1 text-xs">
            <div className="font-semibold">Построено:</div>
            <div className="flex flex-wrap gap-1 mt-1 justify-center">
              {Object.entries(builtBuildingsCounts).map(([buildingId, count]) => (
                <div key={buildingId} title={buildingId} className="tooltip">
                  {getBuildingEmoji(buildingId)}
                  <span className="text-[10px] align-top">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
