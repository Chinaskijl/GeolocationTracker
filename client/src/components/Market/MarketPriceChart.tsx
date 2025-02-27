import { useEffect, useState } from 'react';
import { ResourceType } from '@shared/schema';
import { getResourceIcon } from '@/lib/resources';
import { getPriceHistory } from '@/lib/api';
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

interface MarketPriceChartProps {
  resourceType: ResourceType;
  selectedResource?: ResourceType;
}

/**
 * Компонент отображения графика цен на ресурс
 * @param resourceType - Тип ресурса для отображения графика цен
 * @param selectedResource - Выбранный ресурс для сравнения (если задан)
 */
export function MarketPriceChart({ resourceType, selectedResource }: MarketPriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<{timestamp: number, price: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Если передан selectedResource и он отличается от resourceType, используем его
  const displayResourceType = selectedResource || resourceType;

  useEffect(() => {
    const fetchPriceData = async () => {
      try {
        setLoading(true);
        const data = await getPriceHistory(displayResourceType);
        setPriceHistory(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching price history:', err);
        setError('Не удалось загрузить историю цен');
      } finally {
        setLoading(false);
      }
    };

    fetchPriceData();
    // Обновляем данные каждые 30 секунд
    const interval = setInterval(fetchPriceData, 30000);

    return () => clearInterval(interval);
  }, [displayResourceType]);

  // Форматируем данные для графика
  const chartData = priceHistory.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString(),
    price: item.price
  }));

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex items-center mb-2">
        {getResourceIcon(displayResourceType)}
        <h3 className="text-lg font-semibold ml-2 capitalize">{displayResourceType}</h3>
      </div>

      {loading && priceHistory.length === 0 ? (
        <div className="h-40 flex items-center justify-center">
          <span>Загрузка данных...</span>
        </div>
      ) : error ? (
        <div className="h-40 flex items-center justify-center text-red-500">
          {error}
        </div>
      ) : priceHistory.length === 0 ? (
        <div className="h-40 flex items-center justify-center">
          <span>Нет данных по ценам</span>
        </div>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#8884d8" 
                activeDot={{ r: 8 }} 
                name={`Цена ${displayResourceType}`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}