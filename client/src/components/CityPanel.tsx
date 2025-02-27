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
            <span>Population</span>
            <span>{selectedCity.population} / {selectedCity.maxPopulation}</span>
          </div>
          <Progress value={(selectedCity.population / selectedCity.maxPopulation) * 100} />
        </div>

        {selectedCity.owner === 'neutral' && (
          <Button 
            onClick={handleCapture}
            disabled={gameState.military < selectedCity.population / 4}
          >
            Capture City
          </Button>
        )}

        {selectedCity.owner === 'player' && (
          <div className="space-y-2">
            <h3 className="font-medium">Build</h3>
            <div className="grid grid-cols-2 gap-2">
              {BUILDINGS.map(building => (
                <Button
                  key={building.id}
                  variant="outline"
                  onClick={() => handleBuild(building.id)}
                  className="w-full"
                >
                  {building.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}