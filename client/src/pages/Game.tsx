import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Map } from '@/components/Map';
import { ResourcePanel } from '@/components/ResourcePanel';
import { CityPanel } from '@/components/CityPanel';
import { useGameStore } from '@/lib/store';
import type { City, GameState } from '@shared/schema';
import { BUILDINGS } from '@/lib/game';

const MarketButton = ({ onOpenMarket }) => (
  <button 
    onClick={onOpenMarket}
    className="fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg z-[1000] flex items-center space-x-2"
  >
    <span>💰</span>
    <span>Открыть рынок</span>
  </button>
);

// Импортируем компоненты для рынка заранее
import { MarketCreateListing } from '@/components/Market/MarketCreateListing';
import { MarketPriceChart } from '@/components/Market/MarketPriceChart';
import { MarketTransactions } from '@/components/Market/MarketTransactions';

const MarketPanel = ({ open, onClose }) => {
  // Обработчик успешного создания лота
  const handleListingCreated = () => {
    // Можно добавить логику обновления или уведомления
    console.log('Лот успешно создан');
  };

  // Если панель не открыта, не рендерим содержимое
  if (!open) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <div className="bg-white rounded-lg p-6 w-3/4 max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Рынок ресурсов</h1>
          <button 
            onClick={onClose}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg"
          >
            Закрыть
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Левая панель - создание лота */}
          <div className="md:col-span-1">
              <MarketCreateListing onSuccess={handleListingCreated} />
            </div>

            {/* Правая панель - графики и история */}
            <div className="md:col-span-2 space-y-6">
              {/* Графики цен для разных ресурсов */}
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-xl font-semibold mb-4">Графики цен</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MarketPriceChart resourceType="gold" />
                  <MarketPriceChart resourceType="food" />
                </div>
              </div>

              {/* История транзакций */}
              <div className="bg-white rounded-lg shadow p-4">
                <MarketTransactions limit={10} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


export default function Game() {
  const { setCities, setGameState } = useGameStore();
  const queryClient = useQueryClient();
  const [isMarketOpen, setIsMarketOpen] = useState(false);

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

  return (
    <div className="relative">
      <Map />
      <ResourcePanel />
      <CityPanel />
      <MarketButton onOpenMarket={() => setIsMarketOpen(true)} />
      <MarketPanel open={isMarketOpen} onClose={() => setIsMarketOpen(false)} />
    </div>
  );
}