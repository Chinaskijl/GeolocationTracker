
import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useGameStore } from '@/lib/store';

interface UpdateBoundariesButtonProps {
  cityId?: number;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => Promise<void>;
}

/**
 * Кнопка для обновления границ городов
 * Может работать как для всех городов, так и для конкретного
 */
export function UpdateBoundariesButton({ 
  cityId, 
  className = "",
  children,
  onClick
}: UpdateBoundariesButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const { setGameState } = useGameStore();

  const handleUpdateBoundaries = async () => {
    if (onClick) {
      await onClick();
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Уведомление о начале процесса
      toast({
        title: 'Обновление границ',
        description: cityId 
          ? 'Получение актуальных границ города...' 
          : 'Получение актуальных границ всех городов...',
      });

      let updatedData;
      
      // В зависимости от наличия cityId обновляем либо все города, либо конкретный
      if (cityId) {
        updatedData = await apiRequest('POST', `/api/cities/${cityId}/updateBoundaries`, {});
      } else {
        updatedData = await apiRequest('POST', '/api/cities/update-boundaries', {});
      }
      
      // Обновляем состояние игры с новыми границами
      if (Array.isArray(updatedData)) {
        // Если обновлялись все города
        setGameState(prev => ({
          ...prev,
          cities: updatedData
        }));
      } else {
        // Если обновлялся один город
        setGameState(prev => ({
          ...prev,
          cities: prev.cities.map(city => 
            city.id === cityId ? updatedData : city
          )
        }));
      }

      toast({
        title: 'Границы обновлены',
        description: cityId 
          ? `Границы города успешно обновлены.`
          : 'Границы всех городов успешно обновлены.',
      });
    } catch (error) {
      console.error('Ошибка при обновлении границ:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить границы. Попробуйте позже.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleUpdateBoundaries}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? 'Обновление...' : children || 'Обновить границы'}
    </Button>
  );
}
