import { useGameStore } from '@/lib/store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BUILDINGS } from '@/lib/game';
import { apiRequest } from '@/lib/queryClient';
import { Progress } from '@/components/ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { useMemo, useState } from 'react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const CityPanel: React.FC<CityPanelProps> = ({ 
  selectedCity: cityProp, 
  closePanel, 
  onBuild,
  cityStats,
  onBuyResource,
  canBuyResource
}) => {
  // Проверяем, что город действительно выбран
  if (!cityProp) {
    return null;
  }
  // Update the building descriptions for theater and park
  const getBuildingDescription = (buildingId: string) => {
    switch(buildingId) {
      case 'theater':
        return "Повышает удовлетворённость населения на 10%";
      case 'park':
        return "Повышает удовлетворенность населения на 5%";
      default:
        const building = BUILDINGS.find(b => b.id === buildingId);
        return building?.description || "";
    }
  };

  const { gameState, cities, setSelectedCity, setCities } = useGameStore();
  // Use the city from props or from store
  const city = cityProp || gameState.selectedCity;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [taxRate, setTaxRate] = useState(city?.taxRate || 0);

  if (!city) return null;

  const hasCapital = cities.some(c => c.owner === 'player');

  const handleBuild = async (buildingId: string) => {
    try {
      console.log(`Attempting to build ${buildingId} in city ${city.id}`);
      const building = BUILDINGS.find(b => b.id === buildingId);
      if (!building) {
        console.error('Building not found:', buildingId);
        return;
      }

      console.log('Current resources:', gameState.resources);
      console.log('Building cost:', building.cost);

      // Отправляем запрос на строительство
      await apiRequest('POST', `/api/cities/${city.id}/build`, {
        buildingId
      });

      console.log('Building successful, invalidating queries');
      await queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
      await queryClient.invalidateQueries({ queryKey: ['game-state'] }); //Invalidate game state

      // No need to explicitly fetch updated data; invalidateQueries should trigger refetch

    } catch (error) {
      console.error('Failed to build:', error);
      toast({
        title: "Ошибка строительства",
        description: error instanceof Error ? error.message : "Не удалось построить здание",
        variant: "destructive"
      });
    }
  };

  const handleCapture = async (method: 'military' | 'influence' = 'military') => {
    try {
      console.log(`Attempting to capture city ${city.id} using method: ${method}`);

      if (!hasCapital) {
        // Для первой столицы необходимо передать isCapital: true
        await apiRequest('PATCH', `/api/cities/${city.id}/capture`, {
          isCapital: true
        });
        console.log('Capital city captured successfully');
      } else if (method === 'military' && gameState.military >= city.maxPopulation / 4) {
        console.log('Military strength:', gameState.military);
        console.log('Required strength:', city.maxPopulation / 4);
        await apiRequest('PATCH', `/api/cities/${city.id}/capture`, {
          isCapital: false
        });
        console.log('City captured successfully');
      } else if (method === 'influence' && gameState.resources.influence >= Math.ceil(city.maxPopulation / 500)) {
        await apiRequest('PATCH', `/api/cities/${city.id}/capture`, {
          isCapital: false,
          method: 'influence'
        });
        console.log('City captured successfully using influence');
      } else {
        throw new Error('Insufficient resources for capture.');
      }

      // Обновляем данные после успешного захвата
      await queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/game-state'] });
    } catch (error) {
      console.error('Failed to capture:', error);
      toast({
        title: "Ошибка захвата",
        description: error instanceof Error ? error.message : "Не удалось захватить город",
        variant: "destructive"
      });
    }
  };

  const handleTransferMilitary = async (targetCityId: number) => {
    try {
      // По умолчанию отправляем половину имеющихся войск
      const amount = Math.ceil((city.military || 0) / 2);

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
          fromCityId: city.id,
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
        description: `${amount} военных отправлены из ${city.name}`,
      });

      // Обновляем состояние текущего города
      setSelectedCity({
        ...city,
        military: (city.military || 0) - amount
      });

      // Обновляем список городов
      const updatedCities = cities.map(c => c.id === city.id ? {...c, military: (c.military || 0) - amount} : c);

      setCities(updatedCities);

    } catch (error) {
      console.error('Failed to transfer military:', error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось отправить армию",
        variant: "destructive"
      });
    }
  };

  // Функция для обновления налогового рейта
  const updateTaxRate = async (newRate: number) => {
    try {
      setTaxRate(newRate);

      if (!city) return;

      // Отправляем запрос на сервер для обновления налогового рейта
      const response = await fetch(`/api/cities/${city.id}/tax`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taxRate: newRate }),
      });

      if (!response.ok) {
        throw new Error('Не удалось обновить налоговый рейт');
      }

      // Обновляем данные города в локальном хранилище
      const updatedCities = cities.map(c => 
        c.id === city.id ? { ...c, taxRate: newRate } : c
      );

      setCities(updatedCities);

      toast({
        title: 'Налоговый рейт обновлен',
        description: `Текущая ставка: ${newRate}`,
      });

      // Обновляем данные
      await queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
      await queryClient.invalidateQueries({ queryKey: ['game-state'] });

    } catch (error) {
      console.error('Ошибка при обновлении налогового рейта:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить налоговый рейт',
        variant: 'destructive',
      });
    }
  };

  const playerCities = cities.filter(c => c.owner === 'player' && c.id !== city.id);

  return (
    <TooltipProvider>
      <Card className="fixed bottom-4 left-4 w-96 max-h-[80vh] overflow-hidden z-[1000]">
        <div className="p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{city.name}</h2>
            <span className={`px-2 py-1 rounded-full text-sm ${
              city.owner === 'player' ? 'bg-blue-100 text-blue-800' :
              city.owner === 'neutral' ? 'bg-gray-100 text-gray-800' :
              'bg-red-100 text-red-800'
            }`}>
              {city.owner === 'player' ? 'Ваш город' :
               city.owner === 'neutral' ? 'Нейтральный' : 'Вражеский город'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">Удовлетворенность:</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`${city.satisfaction < 30 ? 'text-red-500' : 'text-green-500'}`}>
                      {Math.round(city.satisfaction)}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="w-72 p-3">
                    <h4 className="font-bold mb-1">Факторы влияющие на удовлетворенность:</h4>
                    <ul className="text-sm space-y-1">
                      <li>- Базовое значение: 50%</li>
                      <li>- Количество рабочих мест: {city.satisfaction < 50 ? 
                        <span className="text-red-500">Недостаточно рабочих мест</span> : 
                        <span className="text-green-500">Достаточно</span>}
                      </li>
                      <li>- Бонусы от зданий: {city.buildings.some(b => b === 'theater' || b === 'park' || b === 'temple') ? 
                        <span className="text-green-500">+{city.buildings.filter(b => b === 'theater').length * 5 + 
                        city.buildings.filter(b => b === 'park').length * 3 + 
                        city.buildings.filter(b => b === 'temple').length * 10}%</span> : 
                        <span className="text-gray-500">0%</span>}
                      </li>
                      <li>- Протесты: {city.protestTimer ? 
                        <span className="text-red-500">Активны ({Math.ceil(city.protestTimer / 60)} мин)</span> : 
                        <span className="text-green-500">Нет</span>}
                      </li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>
                <span className="font-medium">Население:</span> {Math.floor(city.population)}/{city.maxPopulation}
              </div>
            </div>
            <Progress value={(city.population / city.maxPopulation) * 100} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center pb-2">
              <span className="font-medium">Военные</span>
              <span>{city.military || 0}</span>
            </div>
          </div>

          {city.owner === 'player' && playerCities.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Перемещение войск</h3>
              <div className="grid grid-cols-1 gap-2">
                {playerCities.map(targetCity => (
                  <Button
                    key={targetCity.id}
                    variant="outline"
                    onClick={() => handleTransferMilitary(targetCity.id)}
                    disabled={!city.military}
                    className="w-full"
                  >
                    Отправить в {targetCity.name}
                  </Button>
                ))}
              </div>
            </div>
          )}


          {!city.owner || city.owner === 'neutral' ? (
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-medium mb-2">Захват территории</h3>
                <p className="text-sm mb-4">
                  {!cities.some(city => city.owner === 'player') 
                    ? "Выберите эту область в качестве своей столицы" 
                    : "Вы можете захватить эту территорию, но вам понадобятся военные или влияние."}
                </p>
                <div className="space-y-2">
                  <Button 
                    onClick={handleCapture}
                    className="w-full"
                    disabled={hasCapital && gameState.military < Math.ceil(city.maxPopulation / 4)}
                  >
                    {hasCapital ? "Военный захват" : "Выбрать столицей"}
                  </Button>
                  {hasCapital && <p className="text-xs text-center">Будет использовано {Math.ceil(city.maxPopulation / 4)} военных</p>}

                  <Button 
                    onClick={() => handleCapture('influence')}
                    className="w-full mt-2"
                    variant="outline"
                    disabled={hasCapital && gameState.resources.influence < Math.ceil(city.maxPopulation / 500)}
                  >
                    Мирное присоединение
                  </Button>
                  {hasCapital && <p className="text-xs text-center">Будет использовано {Math.ceil(city.maxPopulation / 500)} влияния</p>}
                </div>
              </Card>

              <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-medium">Стоимость захвата</h4>
                  <p className="text-xs">
                    Для военного захвата города требуется {Math.ceil(city.maxPopulation / 4)} военных единиц.
                  </p>
                  <p className="text-xs">
                    Для мирного присоединения через влияние требуется {Math.ceil(city.maxPopulation / 500)} влияния.
                  </p>
                </div>

              {/* Отображаем возможные постройки для нейтральной области */}
              {city.buildings && city.buildings.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-medium mb-2">Построенные здания</h3>
                  <div className="text-sm">
                    <ul className="list-disc pl-5 space-y-1">
                      {city.buildings.map((buildingId, index) => (
                        <li key={`${buildingId}-${index}`}>
                          {BUILDINGS.find(b => b.id === buildingId)?.name || buildingId.replace('_', ' ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              )}

              {city.availableBuildings && city.availableBuildings.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-medium mb-2">Возможные постройки</h3>
                  <div className="text-sm">
                    <ul className="list-disc pl-5 space-y-1">
                      {city.availableBuildings.map((buildingId: string, index) => {
                        const limit = city.buildingLimits?.[buildingId] || 0;
                        const building = BUILDINGS.find(b => b.id === buildingId);
                        const currentCount = city.buildings.filter(b => b === buildingId).length;
                        return (
                          <li key={`${buildingId}-${index}`}>
                            {building?.name || buildingId.replace('_', ' ')} - построено {currentCount}/{limit} шт.
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </Card>
              )}
            </div>
          ) : city.owner === 'player' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Строительство</h3>
                <p className="text-sm">Постройте здания для производства ресурсов и расширения города.</p>

                <ScrollArea className="h-[300px] pr-3">
                  <div className="space-y-2">
                    {BUILDINGS.filter(building => 
                      // Фильтруем только доступные для этой области здания
                      city.availableBuildings && 
                      city.availableBuildings.includes(building.id)
                    ).map((building, index) => {
                      // Проверяем, можно ли построить здание с текущими ресурсами
                      const canAfford = Object.entries(building.cost).every(
                        ([resource, amount]) => gameState.resources[resource as keyof typeof gameState.resources] >= amount
                      );

                      // Проверяем лимит построек данного типа
                      const currentCount = city.buildings.filter((b: string) => b === building.id).length;
                      const maxCount = city.buildingLimits?.[building.id] || building.maxCount;
                      const atLimit = currentCount >= maxCount;

                      return (
                        <Button
                          key={`${building.id}-${index}`}
                          variant={canAfford && !atLimit ? "outline" : "ghost"}
                          disabled={!canAfford || atLimit}
                          className={`w-full flex justify-between items-start p-3 h-auto ${(!canAfford || atLimit) ? 'opacity-50' : ''}`}
                          onClick={() => handleBuild(building.id)}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{building.name}</span>
                            {/* Отображение описания */}
                            <p className="text-xs text-gray-600 mt-1">{getBuildingDescription(building.id)}</p>

                            {/* Отображение производства ресурсов */}
                            {building.resourceProduction && (
                              <span className="text-xs text-green-600 mt-1">
                                {getResourceIcon(building.resourceProduction.type)} +{building.resourceProduction.amount}/сек
                              </span>
                            )}

                            {/* Отображение потребления ресурсов */}
                            {building.resourceConsumption && building.resourceConsumption.type && (
                              <span className="text-xs text-red-600 mt-1">
                                {getResourceIcon(building.resourceConsumption.type)} -{building.resourceConsumption.amount}/сек
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

          {city.buildings.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Постройки</h3>
              <div className="space-y-1">
                {city.buildings.map((buildingId, index) => {
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

          {/* Показываем информацию о городе */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">{city?.name}</h2>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center">
                <span>👥 Население:</span>
                <span className="ml-2 font-medium">{city?.population} / {city?.maxPopulation}</span>
              </div>

              <div className="flex items-center">
                <span>🛡️ Военные:</span>
                <span className="ml-2 font-medium">{city?.military || 0}</span>
              </div>
            </div>

            {/* Блок налогов */}
            {city?.owner === 'player' && (
              <div className="mt-4 p-4 border rounded-md bg-card">
                <h3 className="text-lg font-semibold mb-2">Налоговая ставка</h3>
                <div className="flex items-center mb-2">
                  <span className="text-sm font-medium mr-2">
                    {taxRate === 0 ? "Без налогов (↑ удовлетворенность, ↓ золото)" : 
                     taxRate < 3 ? "Низкие налоги" :
                     taxRate < 7 ? "Средние налоги" :
                     taxRate < 10 ? "Высокие налоги" : "Максимальные налоги (↓ удовлетворенность, ↑ золото)"}
                  </span>
                  <span className="ml-auto font-bold">{taxRate}</span>
                </div>

                <div className="flex items-center">
                  <span className="text-sm">0</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={taxRate}
                    onChange={(e) => updateTaxRate(parseInt(e.target.value))}
                    className="flex-1 mx-2"
                  />
                  <span className="text-sm">10</span>
                </div>

                <div className="flex justify-between mt-3 text-xs">
                  <div className="text-green-500">+{Math.round((10 - taxRate) * 0.5)} к удовлетворенности</div>
                  <div className="text-yellow-500">
                    {taxRate === 0 ? "-1 золото/10 жителей" : `+${taxRate} золото/10 жителей`}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
};

function getResourceIcon(resource: string): string {
  switch (resource) {
    case 'gold': return '💰';
    case 'wood': return '🌲';
    case 'food': return '🌾';
    case 'oil': return '🛢️';
    case 'influence': return '👑'; // Added influence icon
    default: return '📦';
  }
}

function BuildingList({ buildings, city }: { buildings: string[], city: any }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {buildings.map(buildingId => {
        const building = BUILDINGS.find(b => b.id === buildingId);
        // Проверка на наличие достаточного количества работников
        const hasEnoughWorkers = !building?.workers || (city?.availableWorkers >= building.workers);
        const tooltipContent = () => {
          let content = `${building?.name || 'Здание'}`;

          if (building?.workers) {
            content += `\nТребуется рабочих: ${building.workers}`;
            if (!hasEnoughWorkers) {
              content += " (недостаточно!)";
            }
          }

          if (building?.resourceProduction) {
            content += `\nПроизводит: ${building.resourceProduction.amount} ${building.resourceProduction.type}/с`;
          }

          if (building?.resourceConsumption) {
            if (building.resourceConsumption.type && building.resourceConsumption.amount) {
              content += `\nПотребляет: ${building.resourceConsumption.amount} ${building.resourceConsumption.type}/с`;
            } else {
              for (const [resType, resAmount] of Object.entries(building.resourceConsumption)) {
                if (resType !== 'type' && resType !== 'amount') {
                  content += `\nПотребляет: ${resAmount} ${resType}/с`;
                }
              }
            }
          }

          return content;
        };

        return building ? (
          <TooltipProvider key={buildingId}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className={`p-2 border rounded flex flex-col items-center relative ${!hasEnoughWorkers ? 'bg-red-100' : ''}`}
                >
                  {building.workers && (
                    <div className="absolute top-0 right-0 text-xs bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                      {building.workers}
                    </div>
                  )}
                  <div className="text-xl">{building.icon || '🏢'}</div>
                  <div className="text-xs text-center mt-1">{building.name}</div>
                  {!hasEnoughWorkers && (
                    <div className="text-xs text-red-500 mt-1">⚠️ нет рабочих</div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs whitespace-pre-line">
                {tooltipContent()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null;
      })}
    </div>
  );
}

function ConstructionPanel({ 
  city, 
  onConstruct, 
  gameState 
}: { 
  city: any, 
  onConstruct: (buildingId: string) => void,
  gameState: any 
}) {
  const constructableBuildings = useMemo(() => {
    return city.availableBuildings.filter(buildingId => {
      const building = BUILDINGS.find(b => b.id === buildingId);
      if (!building) return false;

      // Count current buildings of this type
      const currentBuildingCount = city.buildings.filter(id => id === buildingId).length;

      // Check building limits
      const buildingLimit = city.buildingLimits?.[buildingId] || building.maxCount;
      if (currentBuildingCount >= buildingLimit) return false;

      // Check resources
      for (const [resource, amount] of Object.entries(building.cost)) {
        if (gameState.resources[resource] < amount) return false;
      }

      // Check population if workers are required
      if (building.workers && city.availableWorkers < building.workers) {
        // Можно строить здание даже если не хватает рабочих,
        // но оно не будет функционировать, пока не появятся рабочие
        // Просто пропускаем эту проверку
      }

      return true;
    });
  }, [city, gameState]);

  const canConstruct = constructableBuildings.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Строительство</CardTitle>
        <CardDescription>Доступные постройки в городе</CardDescription>
      </CardHeader>

      <CardContent>
        {canConstruct ? (
          <BuildingList 
            buildings={constructableBuildings} 
            city={city}
          />
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            Нет доступных построек. Проверьте наличие ресурсов или лимиты зданий.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function canAffordBuilding(gameState: any, building: any): boolean {
  return Object.entries(building.cost).every(
    ([resource, amount]) => gameState.resources[resource as keyof typeof gameState.resources] >= amount
  );
}

function countBuildingInstances(city: any, buildingId: string): number {
  return city.buildings.filter(b => b === buildingId).length;
}