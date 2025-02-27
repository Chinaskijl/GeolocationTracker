
import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { ResourceType } from '@/shared/marketTypes';
import { getResourceIcon } from '@/lib/resources';

/**
 * Интерфейс для точки данных на графике цен
 */
interface PricePoint {
  time: string;
  price: number;
}

/**
 * Свойства компонента графика цен
 */
interface MarketPriceChartProps {
  resourceType: ResourceType;
}

/**
 * Компонент для отображения графика цен ресурса на рынке
 * 
 * @param resourceType - Тип ресурса для которого отображается график
 */
export function MarketPriceChart({ resourceType }: MarketPriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/market/prices/${resourceType}`);
        if (!response.ok) {
          throw new Error('Не удалось загрузить историю цен');
        }
        
        const data = await response.json();
        
        // Преобразуем временные метки в формат минут
        const formattedData = data.map((point: any) => ({
          time: formatTimeInMinutes(new Date(point.timestamp)),
          price: point.price
        }));
        
        setPriceHistory(formattedData);
      } catch (err) {
        console.error('Ошибка при загрузке истории цен:', err);
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    };

    fetchPriceHistory();
    
    // Обновляем данные каждую минуту
    const intervalId = setInterval(fetchPriceHistory, 60000);
    
    return () => clearInterval(intervalId);
  }, [resourceType]);

  /**
   * Форматирует время в формате "минуты назад"
   */
  const formatTimeInMinutes = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) {
      return 'сейчас';
    } else if (diffMinutes === 1) {
      return '1 мин. назад';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} мин. назад`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      if (hours === 1) {
        return '1 час назад';
      } else if (hours < 24) {
        return `${hours} ч. назад`;
      } else {
        return `${Math.floor(hours / 24)} д. назад`;
      }
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Загрузка графика цен...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Ошибка: {error}</div>;
  }

  if (priceHistory.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Нет доступной истории цен для {getResourceIcon(resourceType)} {resourceType}
      </div>
    );
  }

  return (
    <div className="w-full h-64 p-2">
      <h3 className="text-lg font-medium mb-2 flex items-center">
        {getResourceIcon(resourceType)} 
        <span className="ml-2">История цен {resourceType}</span>
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={priceHistory}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="price" 
            name="Цена" 
            stroke="#8884d8" 
            activeDot={{ r: 8 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
