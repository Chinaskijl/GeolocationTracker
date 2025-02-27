import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Map } from '@/components/Map';
import { ResourcePanel } from '@/components/ResourcePanel';
import { CityPanel } from '@/components/CityPanel';
import { useGameStore } from '@/lib/store';
import type { City, GameState } from '@shared/schema';
import { BUILDINGS } from '@/lib/game';

interface Attack {
  id: string;
  fromCityId: number;
  toCityId: number;
  amount: number;
  startTime: number;
  endTime: number;
}

export default function Game() {
  const { setCities, setGameState } = useGameStore();
  const queryClient = useQueryClient();
  const [attacks, setAttacks] = useState<Attack[]>([]);

  const { data: cities } = useQuery<City[]>({
    queryKey: ['/api/cities']
  });

  const { data: gameState } = useQuery<GameState>({
    queryKey: ['/api/game-state']
  });

  useEffect(() => {
    if (cities) {
      console.log('Cities updated:', cities);
      setCities(cities);
    }
  }, [cities, setCities]);

  useEffect(() => {
    if (gameState) {
      console.log('Game state updated:', gameState);
      setGameState(gameState);
    }
  }, [gameState, setGameState]);

  useEffect(() => {
    // Делаем BUILDINGS доступными глобально
    window.BUILDINGS = BUILDINGS;

    // Инициализация WebSocket соединения
    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'GAME_UPDATE' && message.gameState) {
          console.log('Received game state update:', message.gameState);
          setGameState(message.gameState);
        }

        if (message.type === 'CITIES_UPDATE' && message.cities) {
          console.log('Received cities update:', message.cities);
          setCities(message.cities);
        }

        if (message.type === 'CITY_UPDATE') {
          queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
        }
        if (message.type === 'ATTACK_STARTED' && message.attack) {
          setAttacks(prevAttacks => [...prevAttacks, message.attack]);
        }
        if (message.type === 'ATTACK_ENDED' && message.attackId){
          setAttacks(prevAttacks => prevAttacks.filter(attack => attack.id !== message.attackId));
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [queryClient]);


  // Placeholder for MilitaryActionPanel component
  const MilitaryActionPanel = () => <div>Military Actions</div>;

  // Placeholder for AttackAnimation component
  const AttackAnimation = ({ attack }: { attack: Attack }) => (
    <div>Attack from {attack.fromCityId} to {attack.toCityId} ({attack.amount})</div>
  );

  return (
    <div className="relative">
      <Map />
      <ResourcePanel />
      {cities && cities.map(city => (
          <div key={city.id}>{city.name}: Population - {city.population}, Military - {city.military || 0}</div>
        ))}
      {attacks.map(attack => (
        <AttackAnimation key={attack.id} attack={attack} />
      ))}
    </div>
  );
}

interface City {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  population: number;
  maxPopulation: number;
  owner: string;
  resources: Record<string, number>;
  boundaries: number[][];
  buildings: string[];
  military?: number;
}