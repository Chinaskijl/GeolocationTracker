import React, { useMemo } from 'react';
import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BUILDINGS } from '@/lib/game';
import { apiRequest } from '@/lib/queryClient';
import { Progress } from '@/components/ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import type { City } from '@shared/schema';

/**
 * Компонент панели города, отображающий информацию о выбранном городе
 * @param cityId - ID города для отображения (опционально)
 */
interface CityPanelProps {
  cityId?: number;
}

export function CityPanel({ cityId }: CityPanelProps) {
  const cities = useGameStore((state) => state.cities);
  const selectedCityId = useGameStore((state) => state.selectedCity);
  const gameState = useGameStore((state) => state.gameState);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Используем useMemo для кэширования выбранного города и предотвращения бесконечных обновлений
  const selectedCity = useMemo(() => {
    if (cityId) {
      return cities.find(c => c.id === cityId);
    } else if (selectedCityId) {
      return cities.find(c => c.id === selectedCityId);
    }
    return null;
  }, [cities, cityId, selectedCityId]);

  if (!selectedCity) {
    return (
      <Card className="w-full h-full p-4">
        <div className="text-center py-8">
          <p>Выберите город на карте</p>
        </div>
      </Card>
    );
  }

  // Проверка наличия столицы
  const hasCapital = cities.some(city => city.owner === 'player');

  // Захват города
  const handleCapture = async () => {
    try {
      const response = await apiRequest(`/api/cities/${selectedCity.id}/capture`, {
        method: 'POST',
      });

      // Успешное выполнение
      toast({
        title: 'Город захвачен!',
        description: 'Вы успешно захватили город.',
      });

      // Обновляем данные
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      queryClient.invalidateQueries({ queryKey: ['gameState'] });
    } catch (error: any) {
      // Показываем ошибку
      toast({
        title: 'Ошибка захвата города',
        description: error.message || 'Не удалось захватить город.',
        variant: 'destructive',
      });
    }
  };

  // Строительство здания
  const handleBuild = async (buildingId: string) => {
    try {
      const response = await apiRequest(`/api/cities/${selectedCity.id}/build`, {
        method: 'POST',
        body: JSON.stringify({ buildingId }),
      });

      // Успешное выполнение
      toast({
        title: 'Здание построено!',
        description: 'Вы успешно построили здание.',
      });

      // Обновляем данные
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      queryClient.invalidateQueries({ queryKey: ['gameState'] });
    } catch (error: any) {
      // Показываем ошибку
      toast({
        title: 'Ошибка строительства',
        description: error.message || 'Не удалось построить здание.',
        variant: 'destructive',
      });
    }
  };

  // Определяем доступные для строительства здания
  const availableBuildings = BUILDINGS.filter(building => {
    // Проверяем, нет ли уже такого здания в городе
    const hasBuilding = selectedCity.buildings.some(b => b === building.id);
    if (hasBuilding) return false;

    // Проверяем, хватает ли ресурсов для строительства
    for (const [resource, amount] of Object.entries(building.cost)) {
      if ((gameState.resources as any)[resource] < amount) {
        return false;
      }
    }

    return true;
  });

  return (
    <Card className="w-full h-full overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">{selectedCity.name}</h2>
        <p className="text-sm text-muted-foreground">
          {selectedCity.owner === 'player' ? 'Ваш город' : 'Нейтральный город'}
        </p>
      </div>

      <ScrollArea className="h-[calc(100%-4rem)] p-4">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Население</span>
              <span>{selectedCity.population} / {selectedCity.maxPopulation}</span>
            </div>
            <Progress value={(selectedCity.population / selectedCity.maxPopulation) * 100} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Военные</span>
              <span>{selectedCity.military || 0}</span>
            </div>
          </div>

          {selectedCity.owner !== 'player' && (
            <div className="mt-4">
              <Button 
                onClick={handleCapture} 
                className="w-full"
                disabled={hasCapital && gameState.military < Math.ceil(selectedCity.maxPopulation / 4)}
              >
                {hasCapital ? `Захватить (требуется ${Math.ceil(selectedCity.maxPopulation / 4)} военных)` : 'Сделать столицей'}
              </Button>
            </div>
          )}

          {selectedCity.owner === 'player' && (
            <div className="mt-4 space-y-4">
              <h3 className="font-medium">Строительство</h3>

              {availableBuildings.length > 0 ? (
                <div className="space-y-4">
                  {availableBuildings.map(building => (
                    <div key={building.id} className="border p-3 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{building.name}</h4>
                          <p className="text-sm text-muted-foreground">{building.description}</p>
                        </div>
                        <Button size="sm" onClick={() => handleBuild(building.id)}>
                          Построить
                        </Button>
                      </div>
                      <div className="mt-2 text-xs">
                        Стоимость:
                        {Object.entries(building.cost).map(([resource, amount]) => (
                          <span key={resource} className="ml-1">
                            {resource}: {amount}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Нет доступных зданий для строительства
                </p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}