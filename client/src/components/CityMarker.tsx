import React, { useState } from 'react';
import { useMap } from 'react-leaflet';
import { useGameStore } from '@/lib/store';
import { MapPinIcon, Crown, Swords, Users, Wheat, Coins, Trees, Droplet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BUILDINGS } from '@/lib/game';
import type { Region } from '@/shared/regionTypes';
import { Button } from '@/components/ui/button'; // Added import
import { useQueryClient } from '@tanstack/react-query'; // Added import
import { apiRequest } from '@/lib/api'; // Added import


export function CityMarker({ city }: { city: Region }) {
  const map = useMap();
  const selectCity = useGameStore(state => state.selectCity);
  const { setSelectedCity, gameState, cities } = useGameStore();
  const [showLabel, setShowLabel] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const { toast } = useToast(); // Assuming useToast is available
  const queryClient = useQueryClient();

  // Определяем цвет маркера в зависимости от владельца
  let color = 'gray';  // нейтральный
  if (city.owner === 'player') {
    color = 'blue';    // игрок
  } else if (city.owner === 'ai') {
    color = 'red';     // ИИ противник
  }

  // Проверяем, выбрал ли игрок уже столицу
  const hasCapital = cities.some(c => c.owner === 'player' && c.buildings.includes('capital'));

  const handleCapture = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await apiRequest('PATCH', `/api/cities/${city.id}/capture`, {
        isCapital: !hasCapital // Если ещё нет столицы, захватываем как столицу
      });

      if (response.success) {
        toast({
          title: hasCapital ? "Город захвачен!" : "Столица выбрана!",
          description: hasCapital ? "Вы успешно захватили город" : "Вы успешно выбрали столицу",
          variant: "success",
        });

        // Обновляем данные
        await queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/game-state'] });
      }
    } catch (error) {
      console.error('Ошибка при захвате города:', error);

      toast({
        title: "Ошибка захвата",
        description: "Не удалось захватить город. Возможно, не хватает военных.",
        variant: "destructive",
      });
    }
  };

  // Справочник иконок для ресурсов
  const resourceIcons: Record<string, JSX.Element> = {
    food: <Wheat size={14} />,
    gold: <Coins size={14} />,
    wood: <Trees size={14} />,
    oil: <Droplet size={14} />
  };

  // Получаем список доступных зданий для постройки
  const availableBuildings = city.availableBuildings || [];

  // Получаем счетчик каждого типа зданий в городе
  const buildingCounts: Record<string, number> = {};
  (city.buildings || []).forEach((buildingId: string) => {
    buildingCounts[buildingId] = (buildingCounts[buildingId] || 0) + 1;
  });

  return (
    <div 
      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
      style={{ left: `${city.x}px`, top: `${city.y}px` }} //Using x and y coordinates directly, assuming they are present in the city object
      onMouseEnter={() => { setShowLabel(true); setShowTooltip(true); }}
      onMouseLeave={() => { setShowLabel(false); setShowTooltip(false); }}
      onClick={() => {
        selectCity(city);
        setSelectedCity(city);
      }}
    >
      {/* Маркер города */}
      <div className={`w-4 h-4 rounded-full bg-${color}-500 border-2 border-white`}></div>

      {/* Название города */}
      {showLabel && (
        <div className="absolute whitespace-nowrap bg-gray-800 text-white px-2 py-1 rounded-md text-xs -mt-8 left-1/2 transform -translate-x-1/2">
          {city.name}
        </div>
      )}

      {/* Всплывающая подсказка с информацией о городе */}
      {showTooltip && (
        <Card className="absolute z-20 p-2 min-w-[200px] shadow-lg -mt-6 ml-3">
          <div className="text-sm font-semibold">{city.name}</div>

          {city.owner === 'neutral' ? (
            <>
              {/* Информация для нейтрального города */}
              <div className="text-xs mt-1">Нейтральный город</div>

              <div className="mt-2 space-y-1">
                {availableBuildings.length > 0 ? (
                  <div className="text-xs">
                    <div className="font-semibold">Возможные постройки:</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {availableBuildings.map((buildingId: string) => {
                        // Получаем лимит для здания
                        const limit = city.buildingLimits?.[buildingId] || 0;
                        return (
                          <div key={buildingId} className="flex items-center gap-1 bg-gray-100 rounded px-1">
                            {buildingId.replace('_', ' ')} ({limit})
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2" 
                  onClick={handleCapture}
                >
                  {!hasCapital ? "Выбрать столицей" : "Захватить"}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Информация для города игрока или ИИ */}
              <div className="text-xs mt-1">
                Владелец: {city.owner === 'player' ? 'Вы' : 'Противник'}
              </div>

              <div className="mt-2 space-y-1">
                <div className="text-xs">Население: {city.population}</div>
                <div className="text-xs">Военные: {city.military || 0}</div>

                {Object.keys(buildingCounts).length > 0 ? (
                  <div className="text-xs">
                    <div className="font-semibold">Постройки:</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(buildingCounts).map(([buildingId, count]) => (
                        <div key={buildingId} className="flex items-center gap-1 bg-gray-100 rounded px-1">
                          {buildingId.replace('_', ' ')} x{count}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}