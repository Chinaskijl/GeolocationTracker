import React, { useState, useEffect } from 'react';
import { Listing, ResourceType } from '@/shared/marketTypes';
import { getResourceIcon } from '@/lib/resources';

/**
 * Параметры компонента списка лотов
 */
interface MarketListingsProps {
  onRefreshNeeded?: () => void;
  selectedResource?: ResourceType; // Выбранный ресурс
  onListingPurchased?: () => void; // Обработчик успешной покупки лота
}

/**
 * Компонент для отображения списка активных лотов на рынке
 * 
 * @param onRefreshNeeded - Функция, вызываемая при необходимости обновления данных
 * @param selectedResource - Выбранный тип ресурса для фильтрации
 * @param onListingPurchased - Функция, вызываемая после успешной покупки лота
 */
export function MarketListings({ onRefreshNeeded, selectedResource, onListingPurchased }: MarketListingsProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentResource, setCurrentResource] = useState<ResourceType | undefined>(selectedResource || 'food');

  // Обновляем текущий ресурс, когда изменяется выбранный ресурс из родительского компонента
  useEffect(() => {
    if (selectedResource) {
      setCurrentResource(selectedResource);
    }
  }, [selectedResource]);

  // Список всех доступных ресурсов (без gold, так как это основная валюта)
  const resources: ResourceType[] = ['food', 'wood', 'oil', 'metal', 'steel', 'weapons'];

  // Загрузка списка лотов с сервера
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

  // Покупка лота
  const handleBuy = async (listingId: number) => {
    try {
      const response = await fetch('/api/market/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Не удалось купить лот');
      }

      // Обновляем список лотов после покупки
      fetchListings();

      // Уведомляем родительский компонент о необходимости обновления
      if (onRefreshNeeded) {
        onRefreshNeeded();
      }
      if (onListingPurchased) {
        onListingPurchased();
      }
    } catch (err) {
      console.error('Ошибка при покупке лота:', err);
      alert(err instanceof Error ? err.message : 'Ошибка при покупке лота');
    }
  };

  // Отмена своего лота
  const handleCancel = async (listingId: number) => {
    try {
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

      // Обновляем список лотов после отмены
      fetchListings();

      // Уведомляем родительский компонент о необходимости обновления
      if (onRefreshNeeded) {
        onRefreshNeeded();
      }
    } catch (err) {
      console.error('Ошибка при отмене лота:', err);
      alert(err instanceof Error ? err.message : 'Ошибка при отмене лота');
    }
  };

  // Загружаем список лотов при монтировании компонента
  useEffect(() => {
    fetchListings();

    // Устанавливаем интервал для периодического обновления списка лотов
    const interval = setInterval(fetchListings, 30000); // Обновляем каждые 30 секунд

    return () => clearInterval(interval);
  }, []);

  // Форматирование даты
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return <div className="text-center p-4">Загрузка списка лотов...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-500">
        Ошибка: {error}
        <button 
          onClick={fetchListings}
          className="ml-2 px-2 py-1 bg-blue-500 text-white rounded"
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

  // Удаление золота из списка ресурсов, если оно там есть
  const resourceTypes = Object.keys(filteredListings.reduce((acc, curr) => {
      acc[curr.resourceType] = true;
      return acc;
  }, {} as Record<ResourceType, boolean>));


  const groupedListings: Record<ResourceType, Listing[]> = {};
  resourceTypes.forEach(type => groupedListings[type as ResourceType] = []);
  filteredListings.forEach(listing => {
      if(listing.resourceType !== 'gold') { // Exclude gold
        groupedListings[listing.resourceType].push(listing);
      }
  });


  return (
    <div className="overflow-x-auto">
      <div className="mb-2">
        {resources.map((resource) => (
          <button
            key={resource}
            onClick={() => setCurrentResource(resource)}
            className={`px-3 py-1 mx-1 rounded ${currentResource === resource ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}
          >
            {resource}
          </button>
        ))}
      </div>
      <h3 className="text-lg font-medium mb-2">Активные лоты на рынке</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(groupedListings).map(([resourceType, resourceListings]) => {
          if (resourceListings.length === 0) return null;

          return (
            <div key={resourceType} className="border rounded-lg p-4">
              <div className="flex items-center mb-2">
                {getResourceIcon(resourceType as ResourceType)}
                <span className="ml-2 font-medium capitalize">{resourceType}</span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="p-2 text-left">Тип</th>
                    <th className="p-2 text-right">Кол-во</th>
                    <th className="p-2 text-right">Цена/ед.</th>
                    <th className="p-2 text-right">Всего</th>
                    <th className="p-2 text-right">Продавец</th>
                    <th className="p-2 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceListings.map((listing) => (
                    <tr key={listing.id} className="border-b dark:border-gray-700">
                      <td className="p-2 text-left">
                        <span className={`px-2 py-1 rounded text-xs ${
                          listing.type === 'sell' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {listing.type === 'sell' ? 'Продажа' : 'Покупка'}
                        </span>
                      </td>
                      <td className="p-2 text-right">{listing.amount}</td>
                      <td className="p-2 text-right">{listing.pricePerUnit}</td>
                      <td className="p-2 text-right">{listing.amount * listing.pricePerUnit}</td>
                      <td className="p-2 text-right">
                        {listing.owner === 'player' ? 'Вы' : 'ИИ'}
                      </td>
                      <td className="p-2 text-right">
                        {listing.owner === 'player' ? (
                          <button
                            onClick={() => handleCancel(listing.id)}
                            className="px-2 py-1 bg-red-500 text-white text-xs rounded"
                          >
                            Отменить
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBuy(listing.id)}
                            className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
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
          );
        })}
      </div>
    </div>
  );
}