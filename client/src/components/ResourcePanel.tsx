import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Coins, Trees, Wheat, Droplet } from 'lucide-react';

export function ResourcePanel() {
  const { gameState } = useGameStore();

  const resources = [
    { icon: <Coins className="w-5 h-5" />, value: Math.floor(gameState.resources.gold), name: 'Gold' },
    { icon: <Trees className="w-5 h-5" />, value: Math.floor(gameState.resources.wood), name: 'Wood' },
    { icon: <Wheat className="w-5 h-5" />, value: Math.floor(gameState.resources.food), name: 'Food' },
    { icon: <Droplet className="w-5 h-5" />, value: Math.floor(gameState.resources.oil), name: 'Oil' }
  ];

  return (
    <Card className="fixed top-4 left-4 p-4 z-[1000]">
      <div className="flex gap-4">
        {resources.map((resource) => (
          <div key={resource.name} className="flex items-center gap-2">
            {resource.icon}
            <span className="font-medium">{resource.value}</span>
          </div>
        ))}
        <div className="border-l pl-4">
          <div className="flex items-center gap-2">
            <span>👥</span>
            <span className="font-medium">{Math.floor(gameState.population)}</span>
          </div>
        </div>
        <div className="border-l pl-4">
          <div className="flex items-center gap-2">
            <span>⚔️</span>
            <span className="font-medium">{Math.floor(gameState.military)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}