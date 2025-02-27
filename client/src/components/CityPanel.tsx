import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BUILDINGS } from '@/lib/game';
import { apiRequest } from '@/lib/queryClient';
import { Progress } from '@/components/ui/progress';

export function CityPanel() {
  const { selectedCity, gameState } = useGameStore();

  if (!selectedCity) return null;

  const handleBuild = async (buildingId: string) => {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) return;

    try {
      await apiRequest('POST', `/api/cities/${selectedCity.id}/build`, {
        buildingId
      });
    } catch (error) {
      console.error('Failed to build:', error);
    }
  };

  const handleCapture = async () => {
    if (selectedCity.owner === 'neutral' && gameState.military >= selectedCity.population / 4) {
      try {
        await apiRequest('POST', `/api/cities/${selectedCity.id}/capture`, {
          owner: 'player'
        });
      } catch (error) {
        console.error('Failed to capture:', error);
      }
    }
  };

  return (
    <Card className="fixed bottom-4 left-4 p-4 z-[1000] w-96">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">{selectedCity.name}</h2>
          <span className={`px-2 py-1 rounded-full text-sm ${
            selectedCity.owner === 'player' ? 'bg-blue-100 text-blue-800' :
            selectedCity.owner === 'neutral' ? 'bg-gray-100 text-gray-800' :
            'bg-red-100 text-red-800'
          }`}>
            {selectedCity.owner}
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
              disabled={gameState.military < selectedCity.population / 4}
              className="w-full"
            >
              {selectedCity.buildings.length === 0 ? 'Выбрать столицей' : 'Захватить город'}
            </Button>
            {gameState.military < selectedCity.population / 4 && (
              <p className="text-sm text-red-500">
                Требуется {Math.ceil(selectedCity.population / 4)} военных
              </p>
            )}
          </div>
        )}

        {selectedCity.owner === 'player' && (
          <div className="space-y-2">
            <h3 className="font-medium">Строительство</h3>
            <div className="grid grid-cols-1 gap-2">
              {BUILDINGS.map(building => (
                <Button
                  key={building.id}
                  variant="outline"
                  onClick={() => handleBuild(building.id)}
                  className="w-full flex justify-between items-center"
                  disabled={!canAffordBuilding(gameState, building)}
                >
                  <span>{building.name}</span>
                  <span className="text-sm">
                    {Object.entries(building.cost).map(([resource, amount]) => (
                      <span key={resource} className="ml-2">
                        {getResourceIcon(resource)} {amount}
                      </span>
                    ))}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {selectedCity.buildings.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium">Постройки</h3>
            <div className="space-y-1">
              {selectedCity.buildings.map(buildingId => {
                const building = BUILDINGS.find(b => b.id === buildingId);
                if (!building) return null;
                return (
                  <div key={buildingId} className="flex justify-between items-center">
                    <span>{building.name}</span>
                    {building.resourceProduction && (
                      <span>
                        {getResourceIcon(building.resourceProduction.type)} +{building.resourceProduction.amount}
                      </span>
                    )}
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