
import React, { useState, useEffect } from 'react';
import { Transaction } from '@/shared/marketTypes';
import { getResourceIcon } from '@/lib/resources';

/**
 * Свойства компонента истории транзакций
 */
interface MarketTransactionsProps {
  limit?: number;
}

/**
 * Компонент для отображения истории транзакций на рынке
 * 
 * @param limit - Ограничение количества отображаемых транзакций
 */
export function MarketTransactions({ limit = 10 }: MarketTransactionsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/market/transactions?limit=${limit}`);
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить историю транзакций');
        }
        
        const data = await response.json();
        setTransactions(data);
      } catch (err) {
        console.error('Ошибка при загрузке истории транзакций:', err);
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
    
    // Устанавливаем интервал обновления каждые 30 секунд
    const intervalId = setInterval(fetchTransactions, 30000);
    
    return () => clearInterval(intervalId);
  }, [limit]);

  /**
   * Форматирует время в формате "минуты назад"
   */
  const formatTimeInMinutes = (dateStr: string): string => {
    const date = new Date(dateStr);
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
    return <div className="text-center p-4">Загрузка истории транзакций...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">Ошибка: {error}</div>;
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        Нет доступной истории транзакций
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <h3 className="text-lg font-medium mb-2">История транзакций</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800">
            <th className="p-2 text-left">Ресурс</th>
            <th className="p-2 text-right">Количество</th>
            <th className="p-2 text-right">Цена за ед.</th>
            <th className="p-2 text-right">Всего</th>
            <th className="p-2 text-right">Продавец</th>
            <th className="p-2 text-right">Покупатель</th>
            <th className="p-2 text-right">Время</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id} className="border-b dark:border-gray-700">
              <td className="p-2 flex items-center">
                {getResourceIcon(transaction.resourceType)}
                <span className="ml-2 capitalize">{transaction.resourceType}</span>
              </td>
              <td className="p-2 text-right">{transaction.amount}</td>
              <td className="p-2 text-right">{transaction.pricePerUnit.toFixed(2)}</td>
              <td className="p-2 text-right">{transaction.totalPrice.toFixed(2)}</td>
              <td className="p-2 text-right">
                {transaction.seller === 'player' ? 'Вы' : 'ИИ'}
              </td>
              <td className="p-2 text-right">
                {transaction.buyer === 'player' ? 'Вы' : 'ИИ'}
              </td>
              <td className="p-2 text-right">
                {formatTimeInMinutes(transaction.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
