import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BUILDINGS } from '@/lib/game';
import { apiRequest } from '@/lib/queryClient';
import { Progress } from '@/components/ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';

export function CityPanel() {
  const { selectedCity, gameState, cities } = useGameStore();
  const queryClient = useQueryClient();

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

      await apiRequest('POST', `/api/cities/${selectedCity.id}/build`, {
        buildingId
      });

      console.log('Building successful, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/game-state'] });
    } catch (error) {
      console.error('Failed to build:', error);
    }
  };

  const handleCapture = async () => {
    try {
      console.log(`Attempting to capture city ${selectedCity.id}`);

      if (!hasCapital) {
        await apiRequest('POST', `/api/cities/${selectedCity.id}/capture`, {
          owner: 'player'
        });
        console.log('Capital city captured successfully');
      } else if (gameState.military >= selectedCity.maxPopulation / 4) {
        console.log('Military strength:', gameState.military);
        console.log('Required strength:', selectedCity.maxPopulation / 4);
        await apiRequest('POST', `/api/cities/${selectedCity.id}/capture`, {
          owner: 'player'
        });
        console.log('City captured successfully');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
    } catch (error) {
      console.error('Failed to capture:', error);
    }
  };

  const handleTransferMilitary = async (toCityId: number) => {
    try {
      const amount = Math.floor(selectedCity.military || 0);
      if (amount <= 0) return;

      await apiRequest('POST', `/api/cities/${selectedCity.id}/transfer-military`, {
        fromCityId: selectedCity.id,
        toCityId,
        amount
      });

      queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
    } catch (error) {
      console.error('Failed to transfer military:', error);
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

        <div className="space-y-2">
          <h3 className="font-medium">Ресурсы города:</h3>
          {Object.entries(selectedCity.resources).map(([resource, amount]) => (
            <div key={resource} className="flex items-center justify-between">
              <span>{getResourceIcon(resource)} {resource}</span>
              <span>+{amount}</span>
            </div>
          ))}
        </div>

        {selectedCity.owner === 'neutral' && (
          <div className="space-y-2">
            <Button 
              onClick={handleCapture}
              disabled={hasCapital && gameState.military < selectedCity.maxPopulation / 4}
              className="w-full"
            >
              {!hasCapital ? 'Выбрать столицей' : 'Захватить город'}
            </Button>
            {hasCapital && gameState.military < selectedCity.maxPopulation / 4 && (
              <p className="text-sm text-red-500">
                Требуется {Math.ceil(selectedCity.maxPopulation / 4)} военных
              </p>
            )}
          </div>
        )}

        {selectedCity.owner === 'player' && (
          <div className="space-y-2">
            <h3 className="font-medium">Строительство</h3>
            <ScrollArea className="h-60 w-full rounded-md border">
              <div className="p-4 space-y-4">
                {BUILDINGS.map(building => {
                  const buildingCount = selectedCity.buildings.filter(b => b === building.id).length;
                  const atLimit = building.maxCount > 0 && buildingCount >= building.maxCount;
                  
                  return (
                    <Button
                      key={building.id}
                      variant="outline"
                      onClick={() => handleBuild(building.id)}
                      className="w-full p-4 h-auto"
                      disabled={!canAffordBuilding(gameState, building) || atLimit}
                    >
                      <div className="w-full space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-medium">{building.name}</span>
                          <span className="text-sm text-gray-500">
                            {buildingCount}/{building.maxCount}
                          </span>
                        </div>
                        <div className="text-sm text-left text-gray-600">
                          {building.resourceProduction && (
                            <div>+{building.resourceProduction.amount} {building.resourceProduction.type}/сек</div>
                          )}
                          {building.population?.growth && (
                            <div>+{building.population.growth} население/сек</div>
                          )}
                          {building.military?.production && (
                            <div>+{building.military.production} военные/сек (-{building.military.populationUse} население)</div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          {Object.entries(building.cost).map(([resource, amount]) => (
                            <span
                              key={resource}
                              className={`text-sm px-2 py-1 rounded ${
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
        )}

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