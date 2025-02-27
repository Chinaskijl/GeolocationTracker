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
  const city = useMemo(() => {
    if (cityId) {
      return cities.find(c => c.id === cityId);
    } else if (selectedCityId) {
      return cities.find(c => c.id === selectedCityId);
    }
    return null;
  }, [cities, cityId, selectedCityId]);

  if (!city) {
    return (
      <Card className="w-full h-full p-4">
        <div className="text-center py-8">
          <p>Выберите город на карте</p>
        </div>
      </Card>
    );
  }

  const selectedCity = city;

  // Проверка наличия столицы
  const hasCapital = cities.some(city => city.owner === 'player');

  // Список городов игрока, исключая текущий выбранный город
  const playerCities = cities.filter(city => 
    city.owner === 'player' && city.id !== selectedCity.id
  );

  // Обработчик для захвата города
  const handleCapture = async () => {
    try {
      await apiRequest('POST', `/api/cities/${selectedCity.id}/capture`, {});
      toast({
        title: 'Город захвачен',
        description: `Вы успешно захватили город ${selectedCity.name}.`,
      });
      queryClient.invalidateQueries({
        queryKey: ['cities'],
      });
      queryClient.invalidateQueries({
        queryKey: ['gameState'],
      });
    } catch (error) {
      toast({
        title: 'Ошибка захвата',
        description: 'Не удалось захватить город.',
        variant: 'destructive',
      });
    }
  };

  // Обработчик для перемещения военных
  const handleTransferMilitary = async (targetCityId: number) => {
    try {
      await apiRequest('POST', `/api/cities/${selectedCity.id}/transferMilitary`, {
        targetCityId,
      });
      toast({
        title: 'Войска перемещены',
        description: `Войска успешно перемещены.`,
      });
      queryClient.invalidateQueries({
        queryKey: ['cities'],
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось переместить войска.',
        variant: 'destructive',
      });
    }
  };

  // Обработчик для строительства зданий
  const handleBuild = async (buildingId: string) => {
    try {
      const building = BUILDINGS.find(b => b.id === buildingId);
      if (!building) {
        console.error('Building not found:', buildingId);
        return;
      }

      // Отправляем запрос на строительство
      await apiRequest('POST', `/api/cities/${selectedCity.id}/build`, {
        buildingId
      });

      // Обновляем данные
      queryClient.invalidateQueries({
        queryKey: ['cities'],
      });
      queryClient.invalidateQueries({
        queryKey: ['gameState'],
      });

      toast({
        title: 'Строительство завершено',
        description: `${building.name} построено в ${selectedCity.name}.`,
      });
    } catch (error) {
      console.error('Error building:', error);
      toast({
        title: 'Ошибка строительства',
        description: 'Не удалось построить здание.',
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

          {selectedCity.owner === 'player' && playerCities.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Перемещение войск</h3>
              <div className="grid grid-cols-2 gap-2">
                {playerCities.map(city => (
                  <Button
                    key={city.id}
                    variant="outline"
                    onClick={() => handleTransferMilitary(city.id)}
                    disabled={!selectedCity.military}
                    className="w-full"
                  >
                    Отправить в {city.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Информация о ресурсах города удалена */}

          {selectedCity.owner === 'neutral' && (
            <>
            <div className="space-y-2">
              <h3 className="font-medium">Административные действия</h3>
              <Button 
                onClick={handleCapture}
                disabled={hasCapital && gameState.military < selectedCity.maxPopulation / 4}
                className="w-full"
              >
                {!hasCapital ? 'Выбрать столицей' : 'Захватить город'}
              </Button>
              {hasCapital && gameState.military < selectedCity.maxPopulation / 4 && (
                <p className="text-sm text-red-500">
                  Требуется минимум {Math.ceil(selectedCity.maxPopulation / 4)} военных
                </p>
              )}
            </div>
            </>
          )}

          {selectedCity.owner === 'player' && (
            <div className="space-y-2">
              <h3 className="font-medium">Строительство</h3>
              {availableBuildings.length > 0 ? (
                <div className="space-y-2">
                  {availableBuildings.map((building) => (
                    <div key={building.id} className="border rounded p-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{building.name}</h4>
                          <p className="text-xs text-muted-foreground">{building.description}</p>
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

          {selectedCity.buildings.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Постройки</h3>
              <div className="space-y-2">
                {selectedCity.buildings.map((buildingId) => {
                  const building = BUILDINGS.find((b) => b.id === buildingId);
                  if (!building) return null;
                  return (
                    <div key={buildingId} className="border rounded p-2">
                      <h4 className="font-medium">{building.name}</h4>
                      <p className="text-xs text-muted-foreground">{building.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

function getResourceIcon(resource: string): string {
  switch (resource) {
    case 'gold': return '💰';
    case 'wood': return '🌲';
    case 'food': return '🌾';
    case 'oil': return '🛢️';
    default: return '📦';
  }
}

function canAffordBuilding(gameState: any, building: any): boolean {
  return Object.entries(building.cost).every(
    ([resource, amount]) => gameState.resources[resource as keyof typeof gameState.resources] >= amount
  );
}