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

const MarketPanel = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState('buy');
  const [listings, setListings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [priceHistory, setPriceHistory] = useState({});
  const [selectedResource, setSelectedResource] = useState('food');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [loadingListings, setLoadingListings] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { gameState } = useGameStore();
  
  const resourceNames = {
    gold: 'Золото',
    food: 'Еда',
    wood: 'Дерево',
    oil: 'Нефть',
    metal: 'Металл',
    steel: 'Сталь',
    weapons: 'Оружие'
  };
  
  const resourceIcons = {
    gold: '💰',
    food: '🍗',
    wood: '🌲',
    oil: '🛢️',
    metal: '🔧',
    steel: '⚙️',
    weapons: '⚔️'
  };
  
  useEffect(() => {
    if (open) {
      fetchListings();
      fetchTransactions();
      fetchPriceHistory(selectedResource);
    }
  }, [open, selectedResource]);
  
  const fetchListings = async () => {
    try {
      setLoadingListings(true);
      const response = await fetch('/api/market/listings');
      const data = await response.json();
      setListings(data);
      setLoadingListings(false);
    } catch (error) {
      console.error('Ошибка при загрузке лотов:', error);
      setLoadingListings(false);
    }
  };
  
  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/market/transactions');
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error('Ошибка при загрузке транзакций:', error);
    }
  };
  
  const fetchPriceHistory = async (resource) => {
    try {
      const response = await fetch(`/api/market/price-history/${resource}`);
      const data = await response.json();
      setPriceHistory(prev => ({ ...prev, [resource]: data }));
    } catch (error) {
      console.error('Ошибка при загрузке истории цен:', error);
    }
  };
  
  const handleCreateListing = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!amount || !price) {
      setError('Укажите количество и цену');
      return;
    }
    
    if (isNaN(Number(amount)) || isNaN(Number(price)) || Number(amount) <= 0 || Number(price) <= 0) {
      setError('Количество и цена должны быть положительными числами');
      return;
    }
    
    // Проверка достаточно ли ресурсов
    if (activeTab === 'sell' && gameState?.resources[selectedResource] < Number(amount)) {
      setError(`У вас недостаточно ${resourceNames[selectedResource]}`);
      return;
    }
    
    // Проверка достаточно ли золота для покупки
    if (activeTab === 'buy' && gameState?.resources.gold < Number(amount) * Number(price)) {
      setError('У вас недостаточно золота для создания заявки на покупку');
      return;
    }
    
    try {
      const response = await fetch('/api/market/create-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resourceType: selectedResource,
          amount: Number(amount),
          pricePerUnit: Number(price),
          type: activeTab
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Лот успешно создан');
        setAmount('');
        setPrice('');
        fetchListings();
      } else {
        setError('Не удалось создать лот');
      }
    } catch (error) {
      console.error('Ошибка при создании лота:', error);
      setError('Произошла ошибка');
    }
  };
  
  const handleBuyListing = async (listingId) => {
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/market/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listingId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Сделка успешно совершена');
        fetchListings();
        fetchTransactions();
      } else {
        setError('Не удалось совершить сделку');
      }
    } catch (error) {
      console.error('Ошибка при покупке лота:', error);
      setError('Произошла ошибка');
    }
  };
  
  const handleCancelListing = async (listingId) => {
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/market/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listingId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Лот успешно отменен');
        fetchListings();
      } else {
        setError('Не удалось отменить лот');
      }
    } catch (error) {
      console.error('Ошибка при отмене лота:', error);
      setError('Произошла ошибка');
    }
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Фильтрация лотов по типу и ресурсу
  const filteredListings = listings.filter(listing => {
    if (activeTab === 'buy') {
      // Для вкладки покупок показываем только лоты продажи (от других игроков)
      return listing.type === 'sell';
    } else if (activeTab === 'sell') {
      // Для вкладки продаж показываем только лоты покупки (от других игроков)
      return listing.type === 'buy';
    } else if (activeTab === 'myListings') {
      // Для моих лотов показываем только лоты игрока
      return listing.owner === 'player';
    }
    return true;
  });
  
  return (
    <div 
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <div className="bg-white rounded-lg p-4 w-4/5 max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Рынок ресурсов</h1>
          <button 
            onClick={onClose}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg"
          >
            Закрыть
          </button>
        </div>
        
        {/* Вкладки */}
        <div className="flex border-b mb-4">
          <button 
            className={`px-4 py-2 ${activeTab === 'buy' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
            onClick={() => setActiveTab('buy')}
          >
            Купить
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'sell' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
            onClick={() => setActiveTab('sell')}
          >
            Продать
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'myListings' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
            onClick={() => setActiveTab('myListings')}
          >
            Мои лоты
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'history' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            История сделок
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'priceChart' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
            onClick={() => setActiveTab('priceChart')}
          >
            График цен
          </button>
        </div>
        
        {/* Сообщения об ошибках и успехе */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded mb-4">
            {success}
          </div>
        )}
        
        {/* Создание нового лота */}
        {(activeTab === 'buy' || activeTab === 'sell') && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h2 className="text-lg font-semibold mb-2">
              {activeTab === 'buy' ? 'Создать заявку на покупку' : 'Продать ресурсы'}
            </h2>
            <form onSubmit={handleCreateListing} className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">Ресурс</label>
                <select 
                  value={selectedResource} 
                  onChange={(e) => setSelectedResource(e.target.value)}
                  className="border rounded p-2"
                >
                  {Object.entries(resourceNames).map(([key, name]) => (
                    <option key={key} value={key}>
                      {resourceIcons[key]} {name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Количество</label>
                <input 
                  type="number" 
                  min="1"
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  className="border rounded p-2 w-28"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Цена за единицу</label>
                <input 
                  type="number" 
                  min="0.1"
                  step="0.1"
                  value={price} 
                  onChange={(e) => setPrice(e.target.value)}
                  className="border rounded p-2 w-28"
                />
              </div>
              
              <div>
                <button 
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                >
                  {activeTab === 'buy' ? 'Создать заявку' : 'Выставить на продажу'}
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* Список лотов */}
        {(activeTab === 'buy' || activeTab === 'sell' || activeTab === 'myListings') && (
          <>
            <h2 className="text-lg font-semibold mb-2">
              {activeTab === 'buy' ? 'Доступные для покупки' : 
               activeTab === 'sell' ? 'Заявки на покупку' : 'Мои активные лоты'}
            </h2>
            
            {loadingListings ? (
              <p className="text-gray-500">Загрузка...</p>
            ) : filteredListings.length === 0 ? (
              <p className="text-gray-500">Нет доступных лотов</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Ресурс</th>
                      <th className="border p-2 text-left">Количество</th>
                      <th className="border p-2 text-left">Цена за единицу</th>
                      <th className="border p-2 text-left">Общая стоимость</th>
                      <th className="border p-2 text-left">Тип</th>
                      <th className="border p-2 text-left">Владелец</th>
                      <th className="border p-2 text-left">Дата создания</th>
                      <th className="border p-2 text-left">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredListings.map(listing => (
                      <tr key={listing.id} className="hover:bg-gray-50">
                        <td className="border p-2">
                          {resourceIcons[listing.resourceType]} {resourceNames[listing.resourceType]}
                        </td>
                        <td className="border p-2">{listing.amount}</td>
                        <td className="border p-2">{listing.pricePerUnit}</td>
                        <td className="border p-2">{(listing.amount * listing.pricePerUnit).toFixed(1)}</td>
                        <td className="border p-2">
                          {listing.type === 'sell' ? 'Продажа' : 'Покупка'}
                        </td>
                        <td className="border p-2">
                          {listing.owner === 'player' ? 'Ваш' : 'ИИ'}
                        </td>
                        <td className="border p-2">{formatDate(listing.createdAt)}</td>
                        <td className="border p-2">
                          {listing.owner === 'player' ? (
                            <button
                              onClick={() => handleCancelListing(listing.id)}
                              className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm"
                            >
                              Отменить
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBuyListing(listing.id)}
                              className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-sm"
                            >
                              {listing.type === 'sell' ? 'Купить' : 'Продать'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        
        {/* История сделок */}
        {activeTab === 'history' && (
          <>
            <h2 className="text-lg font-semibold mb-2">История сделок</h2>
            
            {transactions.length === 0 ? (
              <p className="text-gray-500">Нет истории сделок</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Ресурс</th>
                      <th className="border p-2 text-left">Количество</th>
                      <th className="border p-2 text-left">Цена за единицу</th>
                      <th className="border p-2 text-left">Общая стоимость</th>
                      <th className="border p-2 text-left">Покупатель</th>
                      <th className="border p-2 text-left">Продавец</th>
                      <th className="border p-2 text-left">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(transaction => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="border p-2">
                          {resourceIcons[transaction.resourceType]} {resourceNames[transaction.resourceType]}
                        </td>
                        <td className="border p-2">{transaction.amount}</td>
                        <td className="border p-2">{transaction.pricePerUnit}</td>
                        <td className="border p-2">{transaction.totalPrice}</td>
                        <td className="border p-2">
                          {transaction.buyer === 'player' ? 'Вы' : 'ИИ'}
                        </td>
                        <td className="border p-2">
                          {transaction.seller === 'player' ? 'Вы' : 'ИИ'}
                        </td>
                        <td className="border p-2">{formatDate(transaction.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        
        {/* График цен */}
        {activeTab === 'priceChart' && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold mb-2">График цен</h2>
              
              <div className="mb-4">
                <label className="mr-2">Выберите ресурс:</label>
                <select 
                  value={selectedResource} 
                  onChange={(e) => setSelectedResource(e.target.value)}
                  className="border rounded p-2"
                >
                  {Object.entries(resourceNames).map(([key, name]) => (
                    <option key={key} value={key}>
                      {resourceIcons[key]} {name}
                    </option>
                  ))}
                </select>
              </div>
              
              {priceHistory[selectedResource] && priceHistory[selectedResource].length > 0 ? (
                <div className="border p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">История цен: {resourceNames[selectedResource]}</span>
                    <span className="text-sm text-gray-500">
                      Текущая цена: {priceHistory[selectedResource][priceHistory[selectedResource].length - 1]?.price || "Н/Д"}
                    </span>
                  </div>
                  <div className="h-60 bg-gray-50 rounded flex items-end p-2 gap-1">
                    {priceHistory[selectedResource].map((record, index) => {
                      const maxPrice = Math.max(...priceHistory[selectedResource].map(r => r.price));
                      const height = maxPrice ? (record.price / maxPrice) * 100 : 0;
                      
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center">
                          <div 
                            className="w-full bg-blue-500 rounded-t" 
                            style={{ height: `${height}%` }}
                            title={`Цена: ${record.price}`}
                          ></div>
                          {index % Math.ceil(priceHistory[selectedResource].length / 5) === 0 && (
                            <div className="text-xs mt-1 rotate-45 origin-left">
                              {new Date(record.timestamp).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Нет данных о ценах для выбранного ресурса</p>
              )}
            </div>
          </>
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