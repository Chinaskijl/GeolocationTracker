import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Map } from '@/components/Map';
import { ResourcePanel } from '@/components/ResourcePanel';
import { CityPanel } from '@/components/CityPanel';
import { useGameStore } from '@/lib/store';
import type { City, GameState } from '@shared/schema';

export default function Game() {
  const { setCities, setGameState } = useGameStore();
  const queryClient = useQueryClient();

  const { data: cities } = useQuery<City[]>({
    queryKey: ['/api/cities']
  });

  const { data: gameState } = useQuery<GameState>({
    queryKey: ['/api/game-state']
  });

  useEffect(() => {
    if (cities) {
      setCities(cities);
    }
  }, [cities, setCities]);

  useEffect(() => {
    if (gameState) {
      setGameState(gameState);
    }
  }, [gameState, setGameState]);

  useEffect(() => {
    // Use secure WebSocket if the page is served over HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'CITY_UPDATE') {
          queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
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

  return (
    <div className="relative">
      <Map />
      <ResourcePanel />
      <CityPanel />
    </div>
  );
}