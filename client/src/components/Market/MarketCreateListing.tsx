import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useGameStore } from '@/lib/store';
import { ResourceType } from '@shared/schema';
import { getResourceIcon } from '@/lib/resources';
import { showNotification } from '@/lib/notifications';
import { createListing } from '@/lib/api';

/**
 * Компонент создания нового объявления на рынке
 * @param onSuccess - Callback, вызываемый при успешном создании объявления
 */

interface MarketCreateListingProps {
  onSuccess: () => void;
  onResourceSelect?: (resource: ResourceType) => void;
}

/**
 * Компонент создания нового объявления на рынке
 */
export function MarketCreateListing({ onSuccess, onResourceSelect }: MarketCreateListingProps) {
  const { gameState } = useGameStore();
  // Исключаем золото из списка ресурсов для продажи
  const availableResources: ResourceType[] = ['food', 'wood', 'oil', 'metal', 'steel', 'weapons'];
  const [resourceType, setResourceType] = useState<ResourceType>(availableResources[0]);
  const [amount, setAmount] = useState<number>(1);
  const [pricePerUnit, setPricePerUnit] = useState<number>(10);
  const [listingType, setListingType] = useState<'buy' | 'sell'>('sell');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Создание нового объявления на рынке
   */
  const handleCreateListing = async () => {
    if (amount <= 0) {
      setError('Количество должно быть больше 0');
      return;
    }

    if (pricePerUnit <= 0) {
      setError('Цена должна быть больше 0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createListing({
        resourceType,
        amount,
        pricePerUnit,
        type: listingType
      });

      // Сбрасываем форму
      setAmount(1);
      setPricePerUnit(10);

      showNotification({
        title: 'Успех',
        message: 'Объявление успешно создано',
        type: 'success'
      });

      // Вызываем callback для обновления списка объявлений
      onSuccess();
    } catch (err) {
      console.error('Failed to create listing:', err);
      setError('Не удалось создать объявление. Проверьте наличие ресурсов.');

      showNotification({
        title: 'Ошибка',
        message: 'Не удалось создать объявление',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Создать объявление</h2>

      <div className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="resourceType">Ресурс</Label>
            <Select
              value={resourceType}
              onValueChange={(value) => {
                const resourceValue = value as ResourceType;
                setResourceType(resourceValue);
                if (onResourceSelect) {
                  onResourceSelect(resourceValue);
                }
              }}
            >
              <SelectTrigger id="resourceType" className="w-full">
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
            <Label htmlFor="amount">Количество</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricePerUnit">Цена за единицу (золото)</Label>
            <Input
              id="pricePerUnit"
              type="number"
              min="1"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(parseInt(e.target.value) || 0)}
            />
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <Button 
            className="w-full mt-4" 
            onClick={handleCreateListing}
            disabled={loading}
          >
            {loading ? 'Создание...' : 'Создать объявление'}
          </Button>
        </div>
      </div>
    </div>
  );
}