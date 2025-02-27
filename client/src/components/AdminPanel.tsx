
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UpdateBoundariesButton } from './UpdateBoundariesButton';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

export function AdminPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefreshGameState = async () => {
    try {
      setIsRefreshing(true);
      await apiRequest('GET', '/api/game-state', {});
      await queryClient.invalidateQueries({ queryKey: ['game-state'] });
      toast({
        title: 'Состояние игры обновлено',
        description: 'Состояние игры успешно обновлено.',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить состояние игры.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Панель администратора</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <UpdateBoundariesButton />
        
        <Button 
          variant="outline"
          onClick={handleRefreshGameState}
          disabled={isRefreshing}
          className="w-full"
        >
          {isRefreshing ? 'Обновление...' : 'Обновить состояние игры'}
        </Button>
      </CardContent>
    </Card>
  );
}
