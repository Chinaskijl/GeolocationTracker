
import { useState } from 'react';
import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import { Slider } from '@/components/ui/slider';

export function MilitaryActionPanel({ onAttack }: { onAttack: (fromCity: any, toCity: any, armySize: number) => void }) {
  const { cities, selectedCity, gameState } = useGameStore();
  const [targetCityId, setTargetCityId] = useState<number | null>(null);
  const [armySize, setArmySize] = useState<number>(0);
  const queryClient = useQueryClient();

  if (!selectedCity || !selectedCity.military || selectedCity.military <= 0) return null;

  const targetCity = targetCityId ? cities.find(city => city.id === targetCityId) : null;
  const availableCities = cities.filter(city => city.owner !== 'player' && city.id !== selectedCity.id);

  const handleAttack = async () => {
    if (!targetCity || armySize <= 0) return;
    
    try {
      // Сначала вызываем анимацию
      onAttack(selectedCity, targetCity, armySize);
      
      // Уменьшаем военных в источнике сразу
      await apiRequest('POST', `/api/cities/${selectedCity.id}/update-military`, {
        amount: -armySize
      });
      
      // Обновляем данные UI
      queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
      
      // Сбрасываем состояние
      setTargetCityId(null);
      setArmySize(0);
    } catch (error) {
      console.error('Failed to attack:', error);
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-80 p-4 space-y-4 z-[1000]">
      <h2 className="text-xl font-bold">Военные действия</h2>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Доступные войска</span>
          <span>{selectedCity.military}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="font-medium">Выберите цель</label>
        <div className="grid grid-cols-1 gap-2">
          {availableCities.map(city => (
            <Button
              key={city.id}
              variant={targetCityId === city.id ? "default" : "outline"}
              onClick={() => setTargetCityId(city.id)}
              className="w-full"
            >
              {city.name} ({city.owner === 'neutral' ? 'нейтральный' : 'вражеский'})
            </Button>
          ))}
        </div>
      </div>
      
      {targetCityId && (
        <>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="font-medium">Количество войск: {armySize}</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setArmySize(selectedCity.military)}
              >
                Макс.
              </Button>
            </div>
            <Slider
              value={[armySize]}
              min={0}
              max={selectedCity.military}
              step={1}
              onValueChange={(values) => setArmySize(values[0])}
            />
          </div>
          
          <Button
            className="w-full"
            disabled={armySize <= 0}
            onClick={handleAttack}
          >
            Атаковать
          </Button>
        </>
      )}
    </Card>
  );
}
