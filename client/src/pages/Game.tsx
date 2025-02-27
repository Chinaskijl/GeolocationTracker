import React, { useEffect, useState } from 'react';
import { Map } from '@/components/Map';
import { ResourcePanel } from '@/components/ResourcePanel';
import { CityPanel } from '@/components/CityPanel';
import { MilitaryActionPanel } from '@/components/MilitaryActionPanel';
import { AttackAnimation } from '@/components/AttackAnimation';
import { useQuery } from '@tanstack/react-query';
import { useGameStore } from '@/lib/store';
import { useWebSocketListener } from '@/lib/hooks';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';

export function Game() {
  const { setGameState, setCities } = useGameStore();
  const [attack, setAttack] = useState<{ 
    fromCity: any; 
    toCity: any; 
    armySize: number; 
    active: boolean; 
  } | null>(null);
  const queryClient = useQueryClient();

  useWebSocketListener('GAME_UPDATE', (data) => {
    console.log('Received game state update:', data.gameState);
    setGameState(data.gameState);
  });

  useWebSocketListener('CITIES_UPDATE', (data) => {
    console.log('Received cities update:', data.cities);
    setCities(data.cities);
  });

  const handleAttack = (fromCity: any, toCity: any, armySize: number) => {
    setAttack({ fromCity, toCity, armySize, active: true });
  };

  const handleAttackComplete = async () => {
    if (!attack) return;

    try {
      // Выполняем атаку на сервере
      const result = await apiRequest('POST', `/api/cities/${attack.toCity.id}/attack`, {
        fromCityId: attack.fromCity.id,
        armySize: attack.armySize
      });

      // Обновляем данные
      queryClient.invalidateQueries({ queryKey: ['/api/cities'] });

      // Сбрасываем анимацию
      setAttack(null);
    } catch (error) {
      console.error('Attack failed:', error);
      setAttack(null);
    }
  };

  return (
    <div className="h-screen w-screen relative">
      <ResourcePanel />
      <Map />
      <CityPanel />

      <MilitaryActionPanel onAttack={handleAttack} />

      {attack?.active && (
        <AttackAnimation 
          fromCity={attack.fromCity}
          toCity={attack.toCity}
          armySize={attack.armySize}
          onComplete={handleAttackComplete}
        />
      )}
    </div>
  );
}