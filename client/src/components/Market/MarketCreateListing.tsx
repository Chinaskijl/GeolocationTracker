
import React, { useState } from 'react';
import { useGameStore } from '@/lib/store';
import { ResourceType } from '@/shared/marketTypes';
import { getResourceIcon } from '@/lib/resources';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Свойства для компонента создания нового лота
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
    // Если игрок продает ресурсы, проверяем наличие ресурсов
    if (listingType === 'sell') {
      return amount > 0 && amount <= availableAmount && pricePerUnit > 0;
    } 
    // Если игрок покупает, проверяем наличие золота
    return amount > 0 && pricePerUnit > 0 && totalPrice <= gameState.resources.gold;
  };

  /**
   * Обработчик отправки формы
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreateListing()) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/market/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceType,
          amount,
          pricePerUnit,
          type: listingType,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Не удалось создать лот');
      }
      
      // Сбрасываем форму
      setAmount(1);
      setPricePerUnit(10);
      
      // Вызываем обратный вызов для обновления списка лотов
      onSuccess();
    } catch (err) {
      console.error('Ошибка при создании лота:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Список доступных ресурсов
   */
  const resources: ResourceType[] = ['gold', 'food', 'wood', 'oil', 'metal', 'steel', 'weapons'];

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Создать новый лот</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="listingType">Тип объявления</Label>
            <Select 
              value={listingType} 
              onValueChange={(value) => setListingType(value as 'buy' | 'sell')}
            >
              <SelectTrigger id="listingType">
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sell">Продать</SelectItem>
                <SelectItem value="buy">Купить</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Тип объявления</Label>
            <div className="flex space-x-4 mt-1 mb-3">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="sell"
                  name="listingType"
                  className="mr-2"
                  checked={listingType === 'sell'}
                  onChange={() => setListingType('sell')}
                />
                <Label htmlFor="sell" className="cursor-pointer">Продажа</Label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="buy"
                  name="listingType"
                  className="mr-2"
                  checked={listingType === 'buy'}
                  onChange={() => setListingType('buy')}
                />
                <Label htmlFor="buy" className="cursor-pointer">Покупка</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resourceType">Ресурс</Label>
            <Select 
              value={resourceType} 
              onValueChange={(value) => setResourceType(value as ResourceType)}
            >
              <SelectTrigger id="resourceType">
                <SelectValue placeholder="Выберите ресурс" />
              </SelectTrigger>
              <SelectContent>
                {availableResources.map((resource) => (
                  <SelectItem key={resource} value={resource}>
                    <span className="flex items-center">
                      {getResourceIcon(resource)}
                      <span className="ml-2 capitalize">{resource}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">
              Количество 
              {listingType === 'sell' && (
                <span className="text-xs ml-2 text-gray-500">
                  (Доступно: {Math.floor(availableAmount)})
                </span>
              )}
            </Label>
            <Input
              id="amount"
              type="number"
              min="1"
              max={listingType === 'sell' ? Math.floor(availableAmount) : undefined}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className={cn(
                listingType === 'sell' && amount > availableAmount && "border-red-500 focus:border-red-500"
              )}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="pricePerUnit">Цена за единицу</Label>
            <Input
              id="pricePerUnit"
              type="number"
              min="1"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(Number(e.target.value))}
            />
          </div>
          
          <div className="text-sm py-2 border-t border-b">
            <div className="flex justify-between">
              <span>Общая стоимость:</span>
              <span className="font-medium">{totalPrice} 💰</span>
            </div>
            
            {listingType === 'buy' && totalPrice > gameState.resources.gold && (
              <div className="mt-2 text-red-500 flex items-center text-xs">
                <AlertCircle className="h-4 w-4 mr-1" />
                Недостаточно золота
              </div>
            )}
          </div>
          
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          
          <Button 
            type="submit" 
            disabled={!canCreateListing() || loading}
            className="w-full"
          >
            {loading ? 'Обработка...' : 'Создать лот'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
