
import React, { useState } from 'react';
import { ResourceType } from '@/shared/marketTypes';
import { MarketPriceChart } from './MarketPriceChart';
import { getResourceIcon } from '@/lib/resources';

/**
 * Компонент для отображения графика цен с возможностью выбора ресурса
 */
export function MarketPriceChartSelector() {
  const [selectedResource, setSelectedResource] = useState<ResourceType>('food');

  // Список всех доступных ресурсов
  const resources: ResourceType[] = ['food', 'wood', 'oil', 'gold', 'metal', 'steel', 'weapons'];

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-semibold mb-4">График цен на ресурсы</h2>
      
      <div className="mb-4 flex flex-wrap gap-2">
        {resources.map((resource) => (
          <button
            key={resource}
            onClick={() => setSelectedResource(resource)}
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
      
      <div className="h-64">
        <MarketPriceChart resourceType={selectedResource} />
      </div>
    </div>
  );
}
