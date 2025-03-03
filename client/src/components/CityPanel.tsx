import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BUILDINGS } from '@/lib/game';
import { apiRequest } from '@/lib/queryClient';
import { Progress } from '@/components/ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';


export function CityPanel() {
  const { selectedCity, gameState, cities } = useGameStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!selectedCity) return null;

  const hasCapital = cities.some(city => city.owner === 'player');

  const handleBuild = async (buildingId: string) => {
    try {
      console.log(`Attempting to build ${buildingId} in city ${selectedCity.id}`);
      const building = BUILDINGS.find(b => b.id === buildingId);
      if (!building) {
        console.error('Building not found:', buildingId);
        return;
      }

      console.log('Current resources:', gameState.resources);
      console.log('Building cost:', building.cost);

      // Отправляем запрос на строительство
      await apiRequest('POST', `/api/cities/${selectedCity.id}/build`, {
        buildingId
      });

      console.log('Building successful, invalidating queries');
      await queryClient.invalidateQueries({ queryKey: ['/api/cities'] });

      // Явно получаем обновленные данные с сервера
      const updatedCities = await queryClient.fetchQuery({ 
        queryKey: ['/api/cities'],
        staleTime: 0
      });

      console.log('Received updated cities after building:', updatedCities);

      // Находим обновленный город в полученных данных
      const updatedCity = updatedCities.find(city => city.id === selectedCity.id);

      if (updatedCity) {
        console.log('Updated city data:', updatedCity);

        // Обновляем список городов
        useGameStore.getState().setCities(updatedCities);

        // Обновляем выбранный город
        useGameStore.getState().setSelectedCity(updatedCity);

        // Проверяем, обновились ли данные как ожидалось
        console.log('Updated selected city in store:', useGameStore.getState().selectedCity);
      } else {
        console.error('Could not find updated city in response');
      }
    } catch (error) {
      console.error('Failed to build:', error);
    }
  };

  const handleCapture = async () => {
    try {
      console.log(`Attempting to capture city ${selectedCity.id}`);

      if (!hasCapital) {
        // Для первой столицы необходимо передать isCapital: true
        await apiRequest('PATCH', `/api/cities/${selectedCity.id}/capture`, {
          isCapital: true
        });
        console.log('Capital city captured successfully');
      } else if (gameState.military >= selectedCity.maxPopulation / 4) {
        console.log('Military strength:', gameState.military);
        console.log('Required strength:', selectedCity.maxPopulation / 4);
        await apiRequest('PATCH', `/api/cities/${selectedCity.id}/capture`, {
          isCapital: false
        });
        console.log('City captured successfully');
      }

      // Обновляем данные после успешного захвата
      await queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/game-state'] });
    } catch (error) {
      console.error('Failed to capture:', error);
      toast({
        title: "Ошибка захвата",
        description: "Не удалось захватить город",
        variant: "destructive"
      });
    }
  };

  const handleTransferMilitary = async (targetCityId: number) => {
    try {
      // По умолчанию отправляем половину имеющихся войск
      const amount = Math.ceil((selectedCity.military || 0) / 2);

      if (!amount) {
        toast({
          title: "Ошибка",
          description: "Недостаточно военных для отправки",
          variant: "destructive"
        });
        return;
      }

      // Запрос на сервер для отправки армии
      const response = await fetch('/api/military/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromCityId: selectedCity.id,
          toCityId: targetCityId,
          amount
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Не удалось отправить армию');
      }

      const result = await response.json();

      toast({
        title: "Войска отправлены",
        description: `${amount} военных отправлены из ${selectedCity.name}`,
      });

      // Обновляем состояние текущего города
      useGameStore.getState().setSelectedCity({
        ...selectedCity,
        military: (selectedCity.military || 0) - amount
      });

      // Обновляем список городов
      const updatedCities = cities.map(city => {
        if (city.id === selectedCity.id) {
          return {
            ...city,
            military: (city.military || 0) - amount
          };
        }
        return city;
      });

      useGameStore.getState().setCities(updatedCities);

    } catch (error) {
      console.error('Failed to transfer military:', error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось отправить армию",
        variant: "destructive"
      });
    }
  };

  const playerCities = cities.filter(city => city.owner === 'player' && city.id !== selectedCity.id);

  return (
    <Card className="fixed bottom-4 left-4 w-96 max-h-[80vh] overflow-hidden z-[1000]">
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">{selectedCity.name}</h2>
          <span className={`px-2 py-1 rounded-full text-sm ${
            selectedCity.owner === 'player' ? 'bg-blue-100 text-blue-800' :
            selectedCity.owner === 'neutral' ? 'bg-gray-100 text-gray-800' :
            'bg-red-100 text-red-800'
          }`}>
            {selectedCity.owner === 'player' ? 'Ваш город' :
             selectedCity.owner === 'neutral' ? 'Нейтральный' : 'Вражеский город'}
          </span>
        </div>

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
            <div className="grid grid-cols-1 gap-2">
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


        {!selectedCity.owner || selectedCity.owner === 'neutral' ? (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-medium mb-2">Захват территории</h3>
              <p className="text-sm mb-4">
                {!cities.some(city => city.owner === 'player') 
                  ? "Выберите эту область в качестве своей столицы" 
                  : "Вы можете захватить эту территорию, но вам понадобятся военные."}
              </p>
              <Button 
                onClick={handleCapture}
                disabled={hasCapital && gameState.military < selectedCity.maxPopulation / 4}
                className="w-full"
              >
                {!hasCapital ? "Выбрать столицей" : "Захватить территорию"}
              </Button>
            </Card>

            {/* Отображаем возможные постройки для нейтральной области */}
            {selectedCity.buildings && selectedCity.buildings.length > 0 && (
              <Card className="p-4">
                <h3 className="font-medium mb-2">Построенные здания</h3>
                <div className="text-sm">
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedCity.buildings.map((buildingId, index) => {
                      const building = BUILDINGS.find(b => b.id === buildingId);
                      return building ? (
                        <li key={index}>
                          {building.name || buildingId.replace('_', ' ')}
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              </Card>
            )}

            {selectedCity.availableBuildings && selectedCity.availableBuildings.length > 0 && (
              <Card className="p-4">
                <h3 className="font-medium mb-2">Возможные постройки</h3>
                <div className="text-sm">
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedCity.availableBuildings.map((buildingId: string) => {
                      const limit = selectedCity.buildingLimits?.[buildingId] || 0;
                      const building = BUILDINGS.find(b => b.id === buildingId);
                      const currentCount = selectedCity.buildings.filter(b => b === buildingId).length;
                      return (
                        <li key={buildingId}>
                          {building?.name || buildingId.replace('_', ' ')} - построено {currentCount}/{limit} шт.
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Card>
            )}
          </div>
        ) : selectedCity.owner === 'player' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Строительство</h3>
              <p className="text-sm">Постройте здания для производства ресурсов и расширения города.</p>

              <ScrollArea className="h-[300px] pr-3">
                <div className="space-y-2">
                  {BUILDINGS.filter(building => 
                    // Фильтруем только доступные для этой области здания
                    (selectedCity as any).availableBuildings && 
                    (selectedCity as any).availableBuildings.includes(building.id)
                  ).map(building => {
                    // Проверяем, можно ли построить здание с текущими ресурсами
                    const canAfford = Object.entries(building.cost).every(
                      ([resource, amount]) => gameState.resources[resource as keyof typeof gameState.resources] >= amount
                    );

                    // Проверяем лимит построек данного типа
                    const currentCount = selectedCity.buildings.filter((b: string) => b === building.id).length;
                    const maxCount = selectedCity.buildingLimits?.[building.id] || building.maxCount;
                    const atLimit = currentCount >= maxCount;

                    return (
                      <Button
                        key={building.id}
                        variant={canAfford && !atLimit ? "outline" : "ghost"}
                        disabled={!canAfford || atLimit}
                        className={`w-full flex justify-between items-start p-3 h-auto ${(!canAfford || atLimit) ? 'opacity-50' : ''}`}
                        onClick={() => handleBuild(building.id)}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{building.name}</span>
                          <span className="text-xs text-muted-foreground">{building.description}</span>

                          {/* Отображение производства ресурсов */}
                          {building.resourceProduction && (
                            <span className="text-xs text-green-600 mt-1">
                              {getResourceIcon(building.resourceProduction.type)} +{building.resourceProduction.amount}/сек
                            </span>
                          )}

                          {/* Отображение производства населения */}
                          {building.population?.growth > 0 && (
                            <span className="text-xs text-green-600 mt-1">
                              👥 +{building.population.growth}/сек
                            </span>
                          )}

                          {/* Отображение производства военной мощи */}
                          {building.military?.production > 0 && (
                            <span className="text-xs text-green-600 mt-1">
                              🪖 +{building.military.production}/сек
                            </span>
                          )}

                          <span className="text-xs text-blue-600 mt-1">
                            {currentCount}/{maxCount} построено
                          </span>
                        </div>

                        <div className="flex flex-col items-end">
                          <div className="flex flex-wrap gap-1 justify-end">
                            {Object.entries(building.cost).map(([resource, amount]) => (
                              <span
                                key={resource}
                                className={`text-xs px-1 py-0.5 rounded ${
                                  gameState.resources[resource as keyof typeof gameState.resources] >= amount
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {getResourceIcon(resource)} {amount}
                              </span>
                            ))}
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : null}

        {selectedCity.buildings.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium">Постройки</h3>
            <div className="space-y-1">
              {selectedCity.buildings.map((buildingId, index) => {
                const building = BUILDINGS.find(b => b.id === buildingId);
                if (!building) return null;
                return (
                  <div key={`${buildingId}-${index}`} className="flex justify-between items-center">
                    <span>{building.name}</span>
                    <div className="flex items-center gap-2 text-sm">
                      {building.resourceProduction && (
                        <span>
                          {getResourceIcon(building.resourceProduction.type)} +{building.resourceProduction.amount}
                        </span>
                      )}
                      {building.population?.growth && (
                        <span>👥 +{building.population.growth}</span>
                      )}
                      {building.military?.production && (
                        <span>⚔️ +{building.military.production}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
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