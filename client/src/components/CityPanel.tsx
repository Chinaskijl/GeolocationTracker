import { useGameStore } from '@/lib/store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BUILDINGS } from '@/lib/game';
import { apiRequest } from '@/lib/queryClient';
import { Progress } from '@/components/ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import React from "react";

// Placeholder Slider component - replace with actual implementation
const Slider = ({ defaultValue, min, max, step, onValueCommit }) => {
  const [value, setValue] = React.useState(defaultValue[0]);
  
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="flex-1"
        onChange={(e) => {
          const newValue = parseInt(e.target.value, 10);
          setValue(newValue);
          onValueCommit(newValue);
        }}
      />
      <span className="text-sm font-medium w-10">{value}%</span>
    </div>
  );
};


export const CityPanel: React.FC<CityPanelProps> = ({
  selectedCity: cityProp,
  closePanel,
  onBuild,
  cityStats,
  onBuyResource,
  canBuyResource
}) => {
  // Update the building descriptions for theater and park
  const getBuildingDescription = (buildingId: string) => {
    switch (buildingId) {
      case 'theater':
        return "Повышает удовлетворённость населения на 10%";
      case 'park':
        return "Повышает удовлетворенность населения на 5%";
      default:
        const building = BUILDINGS.find(b => b.id === buildingId);
        return building?.description || "";
    }
  };

  const { gameState, cities, selectedCity: cityFromStore, setGameState } = useGameStore();
  // Use the city from props or from store
  const city = cityProp || cityFromStore;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!city) return null;

  const hasCapital = cities.some(c => c.owner === 'player');

  // Строительство нового здания
  const handleBuild = async (buildingId: string) => {
    if (!city) return;

    console.log(`Attempting to build ${buildingId} in city ${city.id}`);
    console.log(`Current resources:`, gameState.resources);

    // Выводим стоимость здания для отладки
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (building) {
      console.log(`Building cost:`, building.cost);
    }

    try {
      const response = await fetch(`/api/cities/${city.id}/build`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ buildingId }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.log(`Failed to build:`, result);
        toast({
          title: 'Ошибка строительства',
          description: result.message || 'Не удалось построить здание',
          variant: 'destructive',
        });
        return;
      }

      console.log(`Build successful:`, result);
      toast({
        title: 'Успешно!',
        description: 'Здание построено',
      });

    } catch (error) {
      console.error('Error building structure:', error);
      toast({
        title: 'Ошибка строительства',
        description: 'Не удалось построить здание',
        variant: 'destructive',
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
      useGameStore.getState().setSelectedCity({
        ...city,
        military: (city.military || 0) - amount
      });

      // Обновляем список городов
      const updatedCities = cities.map(c => c.id === city.id ? { ...c, military: (c.military || 0) - amount } : c);

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

  const playerCities = cities.filter(c => c.owner === 'player' && c.id !== city.id);

  const handleTaxRateChange = async (taxRate: number) => {
    try {
      const response = await fetch(`/api/cities/${city.id}/tax`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taxRate }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Не удалось изменить налоговую ставку');
      }

      toast.success(`Налоговая ставка изменена на ${taxRate}`);
      // Обновление будет через веб-сокет
    } catch (error) {
      console.error('Error updating tax rate:', error);
      toast.error((error as Error).message);
    }
  };

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
                    <div className="space-y-1 text-sm">
                      {(() => {
                        const { analyzeSatisfactionFactors } = require('@/lib/satisfactionHelpers');
                        const factors = analyzeSatisfactionFactors(city);
                        
                        return factors.map((factor, index) => (
                          <div key={`factor-${index}`} className="flex justify-between">
                            <span>{factor.name}:</span>
                            <span className={factor.impact === 'positive' ? 'text-green-400' : 
                                            factor.impact === 'negative' ? 'text-red-400' : 'text-gray-400'}>
                              {factor.value > 0 ? '+' : ''}{factor.value.toFixed(1)}/с
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      {city.protestTimer 
                        ? `⚠️ Протесты! Осталось ${Math.floor(city.protestTimer)} сек. до потери города.` 
                        : city.satisfaction < 30 
                          ? '⚠️ Низкая удовлетворенность! Город скоро начнет протестовать.' 
                          : '✅ Удовлетворенность в норме.'}
                    </p>Name="text-sm space-y-1">
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
                      {/* Группируем здания по типу и считаем количество */}
                      {Object.entries(
                        city.buildings.reduce((acc, buildingId) => {
                          acc[buildingId] = (acc[buildingId] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([buildingId, count]) => {
                        const building = BUILDINGS.find(b => b.id === buildingId);
                        const maxCount = city.buildingLimits?.[buildingId] || building?.maxCount || 0;

                        return (
                          <li key={`${buildingId}-built`} className="text-green-600" title={`Занято ${city.usedWorkers || 0} из ${city.totalWorkers || 0} рабочих, свободно ${(city.totalWorkers || 0) - (city.usedWorkers || 0)} рабочих`}>
                            {building?.name || buildingId.replace("_", " ")}: {building?.icon || '🏢'} {count}/{maxCount}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </Card>
              )}

              {city.availableBuildings && city.availableBuildings.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-medium mb-2">Возможные постройки</h3>
                  <div className="text-sm">
                    <ul className="list-disc pl-5 space-y-1">
                      {city.availableBuildings.map((buildingId, index) => {
                        const limit = city.buildingLimits?.[buildingId] || 0;
                        const building = BUILDINGS.find(b => b.id === buildingId);
                        const currentCount = city.buildings.filter(b => b === buildingId).length;

                        return (
                          <li key={`${buildingId}-${index}`} className="text-gray-500">
                            {building?.name || buildingId.replace("_", " ")}: {building?.icon || '🏢'} {' '}
                            <span className={currentCount > 0 ? "text-green-600" : ""}>
                              построено {currentCount}/{limit} шт.
                            </span>
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
              {/* Ползунок с налогами */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Налоговая ставка</h3>
                  <span className="text-sm">{city.taxRate !== undefined ? city.taxRate : 5}%</span>
                </div>
                <div className="p-1">
                  <Slider
                    defaultValue={[city.taxRate !== undefined ? city.taxRate : 5]}
                    min={0}
                    max={10}
                    step={1}
                    onValueCommit={handleTaxRateChange}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Более высокие налоги снижают удовлетворенность населения,
                  но увеличивают доход от города.
                </p>
              </div>

              {/* Налоговая ставка */}

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
                          onClick={() => {
                            console.log(`Attempting to build ${building.id}`);
                            handleBuild(building.id);
                          }}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{building.name}</span>
                            {/* Отображение описания */}
                            <p className="text-xs text-gray-600 mt-1">{getBuildingDescription(building.id)}</p>

                            {/* Отображение производства ресурсов */}
                            {building.resourceProduction && (
                              <span 
                                className="text-xs text-green-600 mt-1"
                                title={`Производит ${building.resourceProduction.amount} ${building.resourceProduction.type} в секунду`}
                              >
                                {getResourceIcon(building.resourceProduction.type)} +{building.resourceProduction.amount}/сек
                              </span>
                            )}

                            {/* Отображение потребления ресурсов */}
                            {building.resourceConsumption && building.resourceConsumption.type && (
                              <span 
                                className="text-xs text-red-600 mt-1"
                                title={`Потребляет ${building.resourceConsumption.amount} ${building.resourceConsumption.type} в секунду`}
                              >
                                {getResourceIcon(building.resourceConsumption.type)} -{building.resourceConsumption.amount}/сек
                              </span>
                            )}

                            {/* Отображение производства населения */}
                            {building.population?.growth > 0 && (
                              <span 
                                className="text-xs text-green-600 mt-1"
                                title={`Прирост населения: ${building.population.growth} человек в секунду`}
                              >
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

                  // Количество требуемых рабочих для этого здания
                  const requiredWorkers = building.workers || 0;

                  // Подсказка с информацией о рабочих
                  const workerTooltip = `${requiredWorkers > 0 ? 
                    `Рабочих мест: ${Math.min(requiredWorkers, city.population || 0)}/${requiredWorkers} занято` : 
                    'Не требует рабочих'} 
                    (Всего в городе: ${city.population || 0} чел.)`;

                  return (
                    <div 
                      key={`${buildingId}-${index}`} 
                      className="flex justify-between items-center p-1 hover:bg-gray-100 rounded"
                      title={`${workerTooltip}
${building.resourceProduction ? `\nПроизводит: ${getResourceIcon(building.resourceProduction.type)} ${building.resourceProduction.amount}/сек` : ''}
${building.resourceConsumption ? `\nПотребляет: ${getResourceIcon(building.resourceConsumption.type)} ${building.resourceConsumption.amount}/сек` : ''}
${building.population?.growth ? `\nПрирост населения: ${building.population.growth}/сек` : ''}
${building.military?.production ? `\nПроизводство военных: ${building.military.production}/сек` : ''}`}
                    >
                      <span>{building.name} {requiredWorkers > 0 ? `👥 ${Math.min(requiredWorkers, city.population || 0)}/${requiredWorkers}` : ''}</span>
                      <div className="flex items-center gap-2 text-sm">
                        {building.resourceProduction && (
                          <span className={requiredWorkers > city.population ? "text-red-500" : ""}>
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


          {/* Вкладки панели */}
          <div className="flex border-b">
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

function BuildingList({ buildings, onSelect, city }: { buildings: string[], onSelect: (building: string) => void, city: any }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {buildings.map((buildingId, index) => {
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (!building) return null;

        return (
          <div
            key={`${buildingId}-${index}`}
            onClick={() => onSelect(buildingId)}
            className="p-2 border rounded hover:bg-gray-100 cursor-pointer"
            title={`Занято ${city.usedWorkers || 0} из ${city.totalWorkers || 0} рабочих, свободно ${(city.totalWorkers || 0) - (city.usedWorkers || 0)} рабочих`}
          >
            <div className="text-sm font-medium">{building.name}</div>

            {/* Отображение производства ресурсов */}
            {building.resourceProduction && building.resourceProduction.type && (
              <span className="text-xs text-green-600 block">
                {getResourceIcon(building.resourceProduction.type)} +{building.resourceProduction.amount}/сек
              </span>
            )}

            {/* Отображение потребления ресурсов */}
            {building.resourceConsumption && building.resourceConsumption.type && (
              <span className="text-xs text-red-600 mt-1">
                {getResourceIcon(building.resourceConsumption.type)} -{building.resourceConsumption.amount}/сек
              </span>
            )}
          </div>
        );
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

      // Проверка лимитов зданий
      const currentCount = city.buildings.filter(b => b === buildingId).length;
      const limit = city.buildingLimits?.[buildingId] || 0;
      if (currentCount >= limit) return false;

      // Проверка наличия ресурсов
      if (building.cost) {
        for (const [resourceType, amount] of Object.entries(building.cost)) {
          if ((gameState.resources as any)[resourceType] < amount) {
            return false;
          }
        }
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
            onSelect={onConstruct}
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