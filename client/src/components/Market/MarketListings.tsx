
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
