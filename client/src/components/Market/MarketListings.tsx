
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Listing, ResourceType } from '@/shared/marketTypes';
import { getResourceIcon, getResourceName } from '@/lib/resources';

/**
 * Параметры компонента для отображения списка лотов на рынке
 */
interface MarketListingsProps {
  onListingPurchased?: () => void;
  selectedResource?: ResourceType;
}

/**
 * Компонент для отображения списков лотов на рынке
 * 
 * @param onListingPurchased - Функция обратного вызова, вызываемая после успешной покупки лота
 * @param selectedResource - Текущий выбранный тип ресурса для фильтрации
 */
export function MarketListings({ onListingPurchased, selectedResource = 'food' }: MarketListingsProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentResource, setCurrentResource] = useState<ResourceType>(selectedResource);

  // Получение списка доступных ресурсов для фильтрации (без золота)
  const resources: ResourceType[] = ['food', 'wood', 'oil', 'metal', 'steel', 'weapons'];

  // Обновляем текущий ресурс, когда меняется selectedResource из props
  useEffect(() => {
    if (selectedResource) {
      setCurrentResource(selectedResource);
    }
  }, [selectedResource]);

  /**
   * Загрузка лотов с сервера
   */
  const fetchListings = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/market/listings');
      setListings(response.data);
      setError(null);
    } catch (err) {
      console.error('Ошибка при загрузке лотов:', err);
      setError('Не удалось загрузить лоты. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Загрузка лотов при монтировании компонента
   */
  useEffect(() => {
    fetchListings();

    // Настраиваем интервал для периодического обновления лотов
    const interval = setInterval(fetchListings, 10000); // Каждые 10 секунд

    // Очищаем интервал при размонтировании компонента
    return () => clearInterval(interval);
  }, []);

  /**
   * Обработчик покупки лота
   */
  const handlePurchase = async (listingId: string) => {
    try {
      await axios.post(`/api/market/purchase/${listingId}`);
      
      // Обновляем список лотов после успешной покупки
      fetchListings();
      
      // Вызываем коллбэк, если он предоставлен
      if (onListingPurchased) {
        onListingPurchased();
      }
    } catch (err) {
      console.error('Ошибка при покупке лота:', err);
      setError('Не удалось купить лот. Возможно, у вас недостаточно ресурсов или лот уже продан.');
    }
  };

  /**
   * Обработчик выбора ресурса
   */
  const handleResourceSelect = (resource: ResourceType) => {
    setCurrentResource(resource);
  };

  /**
   * Фильтрация лотов по выбранному ресурсу
   */
  const filteredListings = listings.filter(listing => listing.resourceType === currentResource);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-semibold mb-4">Активные лоты на рынке</h2>
      
      {/* Кнопки выбора ресурса */}
      <div className="mb-4 flex flex-wrap gap-2">
        {resources.map((resource) => (
          <button
            key={resource}
            onClick={() => handleResourceSelect(resource)}
            className={`flex items-center px-3 py-1.5 rounded-full text-sm ${
              currentResource === resource
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="mr-1">{getResourceIcon(resource)}</span>
            <span className="capitalize">{getResourceName(resource)}</span>
          </button>
        ))}
      </div>

      {/* Отображение ошибки, если она есть */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Отображение индикатора загрузки */}
      {loading && (
        <div className="text-center py-4">
          <svg className="animate-spin h-5 w-5 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {/* Отображение лотов */}
      {!loading && filteredListings.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          Нет активных лотов для {getResourceName(currentResource)}
        </div>
      )}

      {!loading && filteredListings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тип
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ресурс
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Количество
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Цена за единицу
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Общая стоимость
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действие
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredListings.map((listing) => (
                <tr key={listing.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      listing.type === 'sell' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {listing.type === 'sell' ? 'Продажа' : 'Покупка'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="mr-2">{getResourceIcon(listing.resourceType)}</span>
                      <span>{getResourceName(listing.resourceType)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {listing.amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {listing.pricePerUnit} {getResourceIcon('gold')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {listing.amount * listing.pricePerUnit} {getResourceIcon('gold')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {listing.type === 'sell' && (
                      <button
                        onClick={() => handlePurchase(listing.id)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm"
                      >
                        Купить
                      </button>
                    )}
                    {listing.type === 'buy' && (
                      <button
                        onClick={() => handlePurchase(listing.id)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm"
                      >
                        Продать
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Listing, ResourceType } from '@shared/marketTypes';
import { getResourceIcon } from '@/lib/resources';
import { useGameStore } from '@/lib/store';

interface MarketListingsProps {
  selectedResource?: string;
  onListingPurchased?: () => void;
}

/**
 * Компонент для отображения списка лотов на рынке
 * 
 * @param selectedResource - Выбранный ресурс для фильтрации
 * @param onListingPurchased - Callback для обновления родительского компонента после покупки лота
 */
export function MarketListings({ selectedResource, onListingPurchased }: MarketListingsProps) {
  const { setGameState } = useGameStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
  
  // Получение списка лотов
  const { data: listings = [], isLoading, error, refetch } = useQuery<Listing[]>({
    queryKey: ['/api/market/listings'],
    queryFn: async () => {
      const response = await fetch('/api/market/listings');
      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }
      return response.json();
    }
  });

  // Мутация для покупки/продажи лота
  const purchaseMutation = useMutation({
    mutationFn: async (listingId: number) => {
      const response = await fetch('/api/market/purchase-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ listingId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to purchase listing');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Обновляем состояние игры из полученных данных
      if (data.gameState) {
        setGameState(data.gameState);
      }
      
      // Инвалидируем кеш для обновления списка лотов
      queryClient.invalidateQueries({ queryKey: ['/api/market/listings'] });
      
      // Вызываем callback для обновления родительского компонента
      if (onListingPurchased) {
        onListingPurchased();
      }
    }
  });

  // Фильтрация лотов
  const filteredListings = listings.filter(listing => {
    // Фильтр по типу операции
    if (filter !== 'all' && listing.type !== filter) {
      return false;
    }
    
    // Фильтр по типу ресурса
    if (selectedResource && listing.resourceType !== selectedResource) {
      return false;
    }
    
    return true;
  });

  // Обработчик покупки/продажи лота
  const handlePurchaseListing = (listingId: number) => {
    purchaseMutation.mutate(listingId);
  };

  // Отображение имени владельца в более читаемом формате
  const getOwnerName = (owner: string) => {
    return owner === 'player' ? 'Игрок' : 'ИИ';
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Доступные лоты</h2>
        
        {/* Фильтры лотов */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md text-sm ${
              filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => setFilter('buy')}
            className={`px-3 py-1 rounded-md text-sm ${
              filter === 'buy' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Покупка
          </button>
          <button
            onClick={() => setFilter('sell')}
            className={`px-3 py-1 rounded-md text-sm ${
              filter === 'sell' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Продажа
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="text-center p-4">Загрузка лотов...</div>
      ) : error ? (
        <div className="text-center p-4 text-red-500">Ошибка загрузки лотов</div>
      ) : filteredListings.length === 0 ? (
        <div className="text-center p-4 text-gray-500">Нет доступных лотов</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Ресурс</th>
                <th className="p-2 text-right">Тип</th>
                <th className="p-2 text-right">Количество</th>
                <th className="p-2 text-right">Цена за ед.</th>
                <th className="p-2 text-right">Всего</th>
                <th className="p-2 text-center">Продавец</th>
                <th className="p-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredListings.map((listing) => (
                <tr key={listing.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 flex items-center">
                    {getResourceIcon(listing.resourceType)}
                    <span className="ml-2 capitalize">{listing.resourceType}</span>
                  </td>
                  <td className="p-2 text-right">
                    {listing.type === 'sell' ? 'Продажа' : 'Покупка'}
                  </td>
                  <td className="p-2 text-right">{listing.amount}</td>
                  <td className="p-2 text-right">{listing.pricePerUnit}</td>
                  <td className="p-2 text-right">{listing.amount * listing.pricePerUnit}</td>
                  <td className="p-2 text-center">{getOwnerName(listing.owner)}</td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => handlePurchaseListing(listing.id)}
                      disabled={purchaseMutation.isPending}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                    >
                      {listing.type === 'sell' ? 'Купить' : 'Продать'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
