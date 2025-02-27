
import { useState } from 'react';
import { useGameStore } from '@/lib/store';
import { ResourceType } from '@/shared/marketTypes';
import { getResourceIcon, getResourceName } from '@/lib/resources';
import axios from 'axios';

/**
 * Свойства компонента создания нового лота
 */
interface MarketCreateListingProps {
  onSuccess: () => void;
}

/**
 * Компонент для создания нового лота на рынке
 * 
 * @param onSuccess - Функция обратного вызова, вызываемая после успешного создания лота
 */
export function MarketCreateListing({ onSuccess }: MarketCreateListingProps) {
  const { gameState } = useGameStore();
  const [resourceType, setResourceType] = useState<ResourceType>('food');
  const [amount, setAmount] = useState<number>(1);
  const [pricePerUnit, setPricePerUnit] = useState<number>(10);
  const [listingType, setListingType] = useState<'buy' | 'sell'>('sell');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Список ресурсов без золота (т.к. это основная валюта)
  const availableResources: ResourceType[] = ['food', 'wood', 'oil', 'metal', 'steel', 'weapons'];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Доступное количество выбранного ресурса
   */
  const availableAmount = gameState.resources[resourceType];

  /**
   * Общая стоимость лота
   */
  const totalPrice = amount * pricePerUnit;

  /**
   * Проверка возможности создания лота
   */
  const canCreateListing = () => {
    if (amount <= 0 || pricePerUnit <= 0) {
      return false;
    }

    if (listingType === 'sell') {
      // При продаже проверяем наличие ресурса
      return availableAmount >= amount;
    } else {
      // При покупке проверяем наличие золота
      return gameState.resources.gold >= totalPrice;
    }
  };

  /**
   * Создание нового лота
   */
  const handleCreateListing = async () => {
    if (!canCreateListing()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/market/create-listing', {
        resourceType,
        amount,
        pricePerUnit,
        type: listingType
      });

      // Сбрасываем форму
      setAmount(1);
      setPricePerUnit(10);
      
      // Вызываем коллбэк успешного создания
      onSuccess();
    } catch (error) {
      console.error('Error creating listing:', error);
      setError('Ошибка при создании лота');
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const selectResource = (resource: ResourceType) => {
    setResourceType(resource);
    setIsDropdownOpen(false);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-semibold mb-4">Создать новый лот</h2>
      
      {/* Тип операции (продажа/покупка) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Тип операции</label>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setListingType('sell')}
            className={`px-4 py-2 rounded ${
              listingType === 'sell' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            Продать
          </button>
          <button
            type="button"
            onClick={() => setListingType('buy')}
            className={`px-4 py-2 rounded ${
              listingType === 'buy' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            Купить
          </button>
        </div>
      </div>
      
      {/* Выбор ресурса */}
      <div className="mb-4 relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">Ресурс</label>
        <button
          type="button"
          onClick={toggleDropdown}
          className="relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <span className="flex items-center">
            <span className="mr-2">{getResourceIcon(resourceType)}</span>
            <span>{getResourceName(resourceType)}</span>
          </span>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </span>
        </button>
        
        {isDropdownOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-md bg-white shadow-lg">
            <ul className="max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
              {availableResources.map((resource) => (
                <li
                  key={resource}
                  className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-100"
                  onClick={() => selectResource(resource)}
                >
                  <div className="flex items-center">
                    <span className="mr-2">{getResourceIcon(resource)}</span>
                    <span className={resourceType === resource ? 'font-semibold' : 'font-normal'}>
                      {getResourceName(resource)}
                    </span>
                  </div>
                  
                  {resourceType === resource && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                      <svg className="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Количество */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Количество
          {listingType === 'sell' && (
            <span className="text-gray-500 ml-2">
              (доступно: {availableAmount.toFixed(0)})
            </span>
          )}
        </label>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Цена за единицу */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Цена за единицу (золото)</label>
        <input
          type="number"
          min="1"
          value={pricePerUnit}
          onChange={(e) => setPricePerUnit(Math.max(1, parseInt(e.target.value) || 0))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Информация о сделке */}
      <div className="mb-4 p-3 bg-gray-50 rounded-md">
        <div className="flex justify-between">
          <span className="font-medium">Итого:</span>
          <span className="font-medium">
            {listingType === 'sell' ? `Получите: ${totalPrice} 💰` : `Отдадите: ${totalPrice} 💰`}
          </span>
        </div>
        {listingType === 'buy' && (
          <div className="mt-1 text-sm text-gray-600">
            {gameState.resources.gold < totalPrice ? (
              <span className="text-red-600">Недостаточно золота для покупки</span>
            ) : (
              <span>После сделки останется: {gameState.resources.gold - totalPrice} 💰</span>
            )}
          </div>
        )}
        {listingType === 'sell' && availableAmount < amount && (
          <div className="mt-1 text-sm text-red-600">
            Недостаточно ресурсов для продажи
          </div>
        )}
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      <button
        type="button"
        onClick={handleCreateListing}
        disabled={!canCreateListing() || loading}
        className={`w-full px-4 py-2 rounded-md ${
          canCreateListing() && !loading
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? 'Обработка...' : 'Создать лот'}
      </button>
    </div>
  );
}
