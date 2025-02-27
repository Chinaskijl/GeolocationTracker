
import React, { useState, useEffect } from 'react';
import { ResourceType, Listing } from '@shared/marketTypes';
import { getResourceIcon, getResourceName } from '@/lib/resources';
import { useGameStore } from '@/lib/store';

/**
 * Свойства компонента рыночных лотов
 */
interface MarketListingsProps {
  selectedResource?: ResourceType;
  onListingPurchased?: () => void;
}

/**
 * Компонент для отображения списка доступных лотов на рынке
 * 
 * @param selectedResource - Выбранный тип ресурса для фильтрации
 * @param onListingPurchased - Колбэк, вызываемый после успешной покупки/продажи лота
 */
export function MarketListings({ selectedResource, onListingPurchased }: MarketListingsProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const gameState = useGameStore((state) => state.gameState);

  // Загрузка списка лотов
  useEffect(() => {
    const fetchListings = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/market/listings');
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить список лотов');
        }
        
        const data = await response.json();
        setListings(data);
      } catch (err) {
        console.error('Ошибка при загрузке списка лотов:', err);
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    };

    fetchListings();

    // Обновляем список каждые 30 секунд
    const intervalId = setInterval(fetchListings, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Обработчик покупки/продажи лота
  const handlePurchase = async (listingId: number) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      const response = await fetch('/api/market/purchase-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Не удалось выполнить операцию');
      }

      // Обновляем список лотов после успешной операции
      const updatedListings = listings.filter(listing => listing.id !== listingId);
      setListings(updatedListings);
      
      // Вызываем колбэк для обновления интерфейса
      if (onListingPurchased) {
        onListingPurchased();
      }

    } catch (err) {
      console.error('Ошибка при покупке/продаже лота:', err);
      alert(err instanceof Error ? err.message : 'Произошла ошибка при выполнении операции');
    } finally {
      setIsProcessing(false);
    }
  };

  // Обработчик отмены своего лота
  const handleCancel = async (listingId: number) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      const response = await fetch('/api/market/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Не удалось отменить лот');
      }

      // Обновляем список лотов после успешной отмены
      const updatedListings = listings.filter(listing => listing.id !== listingId);
      setListings(updatedListings);
      
      // Вызываем колбэк для обновления интерфейса
      if (onListingPurchased) {
        onListingPurchased();
      }

    } catch (err) {
      console.error('Ошибка при отмене лота:', err);
      alert(err instanceof Error ? err.message : 'Произошла ошибка при отмене лота');
    } finally {
      setIsProcessing(false);
    }
  };

  // Фильтрация лотов по выбранному типу ресурса
  const filteredListings = selectedResource 
    ? listings.filter(listing => listing.resourceType === selectedResource)
    : listings;

  // Разделение лотов на лоты покупки и продажи
  const buyOrders = filteredListings.filter(listing => listing.type === 'buy');
  const sellOrders = filteredListings.filter(listing => listing.type === 'sell');

  // Проверка наличия ресурсов для продажи лота покупки
  const canSellToOrder = (listing: Listing) => {
    if (!gameState) return false;
    return gameState.resources[listing.resourceType] >= listing.amount;
  };

  // Проверка наличия золота для покупки лота продажи
  const canBuyOrder = (listing: Listing) => {
    if (!gameState) return false;
    const totalCost = listing.amount * listing.pricePerUnit;
    return gameState.resources.gold >= totalCost;
  };

  if (loading) {
    return <div className="text-center py-10">Загрузка лотов...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-10">Ошибка: {error}</div>;
  }

  if (filteredListings.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        {selectedResource 
          ? `Нет доступных лотов для ресурса ${getResourceName(selectedResource)}`
          : 'Нет доступных лотов на рынке'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Секция лотов продажи (Sell Orders) */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Лоты продажи (покупка ресурсов)</h3>
        {sellOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sellOrders.map(listing => (
              <div 
                key={listing.id} 
                className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                  listing.owner === 'player' ? 'border-blue-500' : 'border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    {getResourceIcon(listing.resourceType, 'w-6 h-6 mr-2')}
                    <span className="font-medium">{getResourceName(listing.resourceType)}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    listing.owner === 'player' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {listing.owner === 'player' ? 'Вы' : 'ИИ'}
                  </span>
                </div>
                
                <div className="mt-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Количество:</span>
                    <span className="font-medium">{listing.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Цена за единицу:</span>
                    <span className="font-medium">{listing.pricePerUnit} золота</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Итого:</span>
                    <span className="font-bold">{listing.amount * listing.pricePerUnit} золота</span>
                  </div>
                </div>
                
                <div className="mt-3">
                  {listing.owner === 'player' ? (
                    <button
                      onClick={() => handleCancel(listing.id)}
                      disabled={isProcessing}
                      className="w-full bg-red-100 hover:bg-red-200 text-red-800 py-1.5 px-3 rounded transition-colors disabled:opacity-50"
                    >
                      Отменить лот
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchase(listing.id)}
                      disabled={isProcessing || !canBuyOrder(listing)}
                      className={`w-full py-1.5 px-3 rounded transition-colors ${
                        canBuyOrder(listing)
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {canBuyOrder(listing) ? 'Купить ресурс' : 'Недостаточно золота'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-4">Нет доступных лотов продажи</div>
        )}
      </div>

      {/* Секция лотов покупки (Buy Orders) */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Лоты покупки (продажа ресурсов)</h3>
        {buyOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {buyOrders.map(listing => (
              <div 
                key={listing.id} 
                className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                  listing.owner === 'player' ? 'border-blue-500' : 'border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    {getResourceIcon(listing.resourceType, 'w-6 h-6 mr-2')}
                    <span className="font-medium">{getResourceName(listing.resourceType)}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    listing.owner === 'player' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {listing.owner === 'player' ? 'Вы' : 'ИИ'}
                  </span>
                </div>
                
                <div className="mt-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Требуется:</span>
                    <span className="font-medium">{listing.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Предлагает:</span>
                    <span className="font-medium">{listing.pricePerUnit} золота за единицу</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Итого получите:</span>
                    <span className="font-bold">{listing.amount * listing.pricePerUnit} золота</span>
                  </div>
                </div>
                
                <div className="mt-3">
                  {listing.owner === 'player' ? (
                    <button
                      onClick={() => handleCancel(listing.id)}
                      disabled={isProcessing}
                      className="w-full bg-red-100 hover:bg-red-200 text-red-800 py-1.5 px-3 rounded transition-colors disabled:opacity-50"
                    >
                      Отменить лот
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchase(listing.id)}
                      disabled={isProcessing || !canSellToOrder(listing)}
                      className={`w-full py-1.5 px-3 rounded transition-colors ${
                        canSellToOrder(listing)
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {canSellToOrder(listing) ? 'Продать ресурс' : 'Недостаточно ресурса'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-4">Нет доступных лотов покупки</div>
        )}
      </div>
    </div>
  );
}
