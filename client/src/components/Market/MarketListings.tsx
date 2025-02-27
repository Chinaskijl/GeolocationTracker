import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Listing, ResourceType } from '@/shared/marketTypes';
import { getResourceIcon, getResourceName } from '@/lib/resources';

/**
 * Параметры компонента для отображения списка лотов на рынке
 */
interface MarketListingsProps {
  onListingPurchased?: () => void;
  currentResource?: ResourceType;
  onResourceSelect?: (resource: ResourceType) => void;
}

/**
 * Компонент для отображения списков лотов на рынке
 * 
 * @param onListingPurchased - Функция обратного вызова, вызываемая после успешной покупки лота
 * @param currentResource - Текущий выбранный тип ресурса для фильтрации
 * @param onResourceSelect - Функция обратного вызова при выборе ресурса
 */
export function MarketListings({ onListingPurchased, currentResource, onResourceSelect }: MarketListingsProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Получение списка доступных ресурсов для фильтрации (без золота)
  const resources: ResourceType[] = ['food', 'wood', 'oil', 'metal', 'steel', 'weapons'];

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
   * Покупка лота
   * 
   * @param listingId - ID лота для покупки
   */
  const purchaseListing = async (listingId: number) => {
    try {
      await axios.post(`/api/market/buy/${listingId}`);
      // Обновляем список лотов после покупки
      fetchListings();
      if (onListingPurchased) {
        onListingPurchased();
      }
    } catch (err: any) {
      console.error('Ошибка при покупке лота:', err);
      setError(err.response?.data?.message || 'Не удалось купить лот');
    }
  };

  // Загрузка лотов при монтировании компонента
  useEffect(() => {
    fetchListings();
  }, []);

  // Обработчик выбора ресурса
  const handleResourceSelect = (resource: ResourceType) => {
    if (onResourceSelect) {
      onResourceSelect(resource);
    }
  };

  if (loading) {
    return <div className="text-center p-4">Загрузка лотов...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-500">
        <p>{error}</p>
        <button 
          onClick={fetchListings} 
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (listings.length === 0) {
    return <div className="text-center p-4 text-gray-500">Нет активных лотов</div>;
  }

  // Фильтрация лотов по выбранному ресурсу, если он указан
  const filteredListings = currentResource
    ? listings.filter(listing => listing.resourceType === currentResource)
    : listings;

  return (
    <div>
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

      <div className="space-y-4">
        {filteredListings.length > 0 ? (
          filteredListings.map((listing) => (
            <div key={listing.id} className="border rounded-lg p-4 shadow-sm bg-white">
              <div className="flex justify-between items-center">
                <div>
                  <span className="mr-2 text-lg">{getResourceIcon(listing.resourceType)}</span>
                  <span className="font-medium">{getResourceName(listing.resourceType)}</span>
                  <span className="ml-2 text-gray-600">x{listing.amount}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    Цена: <span className="font-medium">{listing.price}</span> 💰
                  </div>
                  <div className="text-sm text-gray-600">
                    За единицу: <span className="font-medium">{(listing.price / listing.amount).toFixed(2)}</span> 💰
                  </div>
                </div>
              </div>
              <div className="mt-2 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Продавец: <span className="font-medium">{listing.seller}</span>
                </div>
                <button
                  onClick={() => purchaseListing(listing.id)}
                  className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Купить
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center p-4 text-gray-500">
            Нет лотов с выбранным ресурсом
          </div>
        )}
      </div>
    </div>
  );
}