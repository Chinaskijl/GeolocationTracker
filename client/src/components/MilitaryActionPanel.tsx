
import { useState } from 'react';
import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { calculateDistance } from '@/lib/utils';

export function MilitaryActionPanel() {
  const { selectedCity, cities } = useGameStore();
  const [targetCityId, setTargetCityId] = useState<number | null>(null);
  const [militaryAmount, setMilitaryAmount] = useState<number>(0);
  const queryClient = useQueryClient();

  if (!selectedCity || selectedCity.owner !== 'player' || !selectedCity.military) return null;

  const availableMilitary = selectedCity.military;
  const targetCities = cities.filter(c => c.id !== selectedCity.id && c.owner !== 'player');

  const handleAttack = async () => {
    if (!targetCityId || militaryAmount <= 0) return;

    const targetCity = cities.find(c => c.id === targetCityId);
    if (!targetCity) return;

    const distance = calculateDistance(
      selectedCity.latitude, 
      selectedCity.longitude, 
      targetCity.latitude, 
      targetCity.longitude
    );

    // Время похода зависит от расстояния (1 единица расстояния = 1 секунда)
    const travelTime = Math.ceil(distance * 5); // 5 секунд на каждую единицу расстояния

    try {
      await apiRequest('POST', `/api/cities/${selectedCity.id}/attack`, {
        fromCityId: selectedCity.id,
        toCityId: targetCityId,
        amount: militaryAmount,
        travelTime
      });

      queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/game-state'] });
      
      // Сбрасываем выбор после атаки
      setTargetCityId(null);
      setMilitaryAmount(0);
    } catch (error) {
      console.error('Failed to attack:', error);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Военные действия</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Выберите цель атаки:</label>
            <div className="grid grid-cols-2 gap-2">
              {targetCities.map(city => (
                <Button
                  key={city.id}
                  variant={targetCityId === city.id ? "default" : "outline"}
                  onClick={() => {
                    setTargetCityId(city.id);
                    setMilitaryAmount(Math.min(availableMilitary, Math.ceil(city.maxPopulation / 4)));
                  }}
                  className="w-full h-auto py-2"
                >
                  <div className="text-left w-full">
                    <div>{city.name}</div>
                    <div className="text-xs">
                      {city.owner === 'neutral' ? 'Нейтральный' : 'Вражеский'}
                    </div>
                    <div className="text-xs mt-1">
                      Расстояние: {calculateDistance(
                        selectedCity.latitude, 
                        selectedCity.longitude, 
                        city.latitude, 
                        city.longitude
                      ).toFixed(1)} км
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {targetCityId && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Количество войск: {militaryAmount} из {availableMilitary}
                </label>
                <Slider
                  value={[militaryAmount]}
                  min={1}
                  max={availableMilitary}
                  step={1}
                  onValueChange={(value) => setMilitaryAmount(value[0])}
                  className="mb-4"
                />
              </div>

              <Button
                onClick={handleAttack}
                disabled={militaryAmount <= 0}
                className="w-full"
              >
                Атаковать
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
