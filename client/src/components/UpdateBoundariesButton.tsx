
import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useGameStore } from '@/lib/store';

export function UpdateBoundariesButton() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const { setGameState } = useGameStore();

  const handleUpdateBoundaries = async () => {
    try {
      setIsLoading(true);
      toast({
        title: 'Обновление границ',
        description: 'Получение актуальных границ городов из OpenStreetMap...',
      });

      // Отправляем запрос на обновление границ всех городов
      const updatedCities = await apiRequest('POST', '/api/cities/update-boundaries', {});
      
      // Обновляем состояние игры с новыми границами
      setGameState(prev => ({
        ...prev,
        cities: updatedCities
      }));

      toast({
        title: 'Границы обновлены',
        description: 'Границы городов успешно обновлены.',
      });
    } catch (error) {
      console.error('Ошибка при обновлении границ:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить границы городов.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleUpdateBoundaries} 
      disabled={isLoading}
      className="w-full"
    >
      {isLoading ? 'Обновление...' : 'Обновить границы городов'}
    </Button>
  );
}
