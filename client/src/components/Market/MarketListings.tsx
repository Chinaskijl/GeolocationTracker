import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Listing, ResourceType } from '@shared/marketTypes';
import { getResourceIcon } from '@/lib/resources';
import { useGameStore } from '@/stores/gameStore';
import { getResourceName } from '@/lib/resources';

/**
 * Пропсы компонента для отображения списка лотов на рынке
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
      const response = await fetch('/api/market/listings');
      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }
      const data = await response.json();
      setListings(data);
      setError(null);
    } catch (err) {
      setError('Ошибка при загрузке лотов');
      console.error('Ошибка при загрузке лотов:', err);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка лотов при монтировании компонента и при изменении выбранного ресурса
  useEffect(() => {
    fetchListings();
    // Устанавливаем интервал для периодического обновления лотов
    const intervalId = setInterval(fetchListings, 10000); // Обновление каждые 10 секунд

    return () => clearInterval(intervalId); // Очистка при размонтировании
  }, [currentResource]);

  /**
   * Обработка покупки/продажи лота
   */
  const handlePurchase = async (listingId: number) => {
    try {
      const response = await fetch('/api/market/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to purchase listing');
      }

      // Обновляем список лотов
      fetchListings();

      // Вызываем callback если он предоставлен
      if (onListingPurchased) {
        onListingPurchased();
      }
    } catch (err) {
      setError(`Ошибка при покупке лота: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Ошибка при покупке лота:', err);
    }
  };

  /**
   * Изменение выбранного ресурса для фильтрации
   */
  const handleResourceChange = (resource: ResourceType) => {
    setCurrentResource(resource);
  };

  // Фильтрация лотов по выбранному типу ресурса
  const filteredListings = currentResource === 'all' 
    ? listings 
    : listings.filter(listing => listing.resourceType === currentResource);

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-white">Активные лоты на рынке</h2>

      {/* Фильтр по типу ресурса */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => handleResourceChange('all' as ResourceType)}
          className={`px-3 py-1 rounded-md text-sm ${
            currentResource === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Все ресурсы
        </button>

        {resources.map((resource) => (
          <button
            key={resource}
            onClick={() => handleResourceChange(resource)}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm ${
              currentResource === resource ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {getResourceIcon(resource)} {getResourceName(resource)}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="mt-2 text-gray-300">Загрузка лотов...</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="text-center py-8 text-gray-300">
          <p>Нет активных лотов для выбранного ресурса</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Тип лота
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Ресурс
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Количество
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Цена за единицу
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Общая стоимость
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Действие
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-600">
              {filteredListings.map((listing) => (
                <tr key={listing.id} className="hover:bg-gray-600">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      listing.type === 'sell' ? 'bg-green-700 text-green-100' : 'bg-blue-700 text-blue-100'
                    }`}>
                      {listing.type === 'sell' ? 'Продажа' : 'Покупка'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {getResourceIcon(listing.resourceType)}
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