
import React, { useState, useEffect } from 'react';
import { ResourceType } from '@/shared/marketTypes';
import { MarketPriceChart } from './MarketPriceChart';
import { getResourceIcon } from '@/lib/resources';

interface MarketPriceChartSelectorProps {
  onResourceSelect?: (resource: ResourceType) => void;
  excludeResource?: ResourceType;
}

/**
 * Компонент для отображения графика цен с возможностью выбора ресурса
 * 
 * @param onResourceSelect - Функция для передачи выбранного ресурса родительскому компоненту
 * @param excludeResource - Ресурс, который нужно исключить из списка (например, gold)
 */
export function MarketPriceChartSelector({ onResourceSelect, excludeResource }: MarketPriceChartSelectorProps) {
  const [selectedResource, setSelectedResource] = useState<ResourceType>('food');

  // Список всех доступных ресурсов
  const allResources: ResourceType[] = ['food', 'wood', 'oil', 'metal', 'steel', 'weapons'];
  
  // Фильтруем ресурсы, исключая указанный ресурс
  const resources = excludeResource 
    ? allResources.filter(r => r !== excludeResource) 
    : allResources;

  // При изменении выбранного ресурса вызываем функцию обратного вызова
  useEffect(() => {
    if (onResourceSelect) {
      onResourceSelect(selectedResource);
    }
  }, [selectedResource, onResourceSelect]);

  const handleResourceSelect = (resource: ResourceType) => {
    setSelectedResource(resource);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-xl font-semibold mb-4">График цен на ресурсы</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {resources.map((resource) => (
          <button
            key={resource}
            onClick={() => handleResourceSelect(resource)}
            className={`flex items-center px-3 py-1.5 rounded-full text-sm ${
              selectedResource === resource
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="mr-1">{getResourceIcon(resource)}</span>
            <span className="capitalize">{resource}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <MarketPriceChart resourceType={selectedResource} />
      </div>
    </div>
  );
}
