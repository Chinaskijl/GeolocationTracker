
import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { ResourceType } from '@shared/schema';
import { getResourceIcon } from '@/lib/resources';
import { getPriceHistory } from '@/lib/api';

// Регистрируем необходимые компоненты для графика
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MarketPriceChartProps {
  resourceType: ResourceType;
}

/**
 * Компонент отображения графика цен на ресурс
 */
export function MarketPriceChart({ resourceType }: MarketPriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<{timestamp: number, price: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchPriceHistory = async () => {
      try {
        setLoading(true);
        const history = await getPriceHistory(resourceType);
        
        if (isMounted) {
          setPriceHistory(history);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to fetch price history:', err);
        if (isMounted) {
          setError('Не удалось загрузить историю цен');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchPriceHistory();
    
    // Обновляем данные каждые 30 секунд
    const interval = setInterval(fetchPriceHistory, 30000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [resourceType]);
  
  // Подготавливаем данные для графика
  const chartData = {
    labels: priceHistory.map(item => {
      const date = new Date(item.timestamp);
      return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    }),
    datasets: [
      {
        label: `Цена ${resourceType}`,
        data: priceHistory.map(item => item.price),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  };
  
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `График цен на ${resourceType}`,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex items-center mb-2">
        {getResourceIcon(resourceType)}
        <h3 className="text-lg font-semibold ml-2 capitalize">{resourceType}</h3>
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
          <span>Нет данных об истории цен</span>
        </div>
      ) : (
        <Line data={chartData} options={chartOptions} />
      )}
    </div>
  );
}
