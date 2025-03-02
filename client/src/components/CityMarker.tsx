import React, { useState } from 'react';
import { useMap } from 'react-leaflet';
import { useGameStore } from '@/lib/store';
import { MapPinIcon, Crown, Swords, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BUILDINGS } from '@/lib/game';
import type { Region } from '@/shared/regionTypes';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';


// Placeholder for emoji mapping - needs actual implementation based on BUILDING IDs
const buildingEmojis: Record<string, string> = {
  'barracks': ' barracks 🛡️',
  'farm': 'farm 🌾',
  'mine': 'mine ⛏️',
  'capital': 'capital 👑',
  // Add more mappings as needed...
};

const getBuildingEmoji = (buildingId: string): string => {
  return buildingEmojis[buildingId] || buildingId; // Fallback to buildingId if emoji not found
};


export function CityMarker({ city }: { city: Region }) {
  const map = useMap();
  const selectCity = useGameStore(state => state.selectCity);
  const { setSelectedCity, gameState, cities } = useGameStore();
  const [showLabel, setShowLabel] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const { toast } = useToast(); 
  const queryClient = useQueryClient();

  let color = 'gray';  
  if (city.owner === 'player') {
    color = 'blue';   
  } else if (city.owner === 'ai') {
    color = 'red';    
  }

  const hasCapital = cities.some(c => c.owner === 'player' && c.buildings.includes('capital'));

  const handleCapture = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await apiRequest('PATCH', `/api/cities/${city.id}/capture`, {
        isCapital: !hasCapital 
      });

      if (response.success) {
        toast({
          title: hasCapital ? "Город захвачен!" : "Столица выбрана!",
          description: hasCapital ? "Вы успешно захватили город" : "Вы успешно выбрали столицу",
          variant: "success",
        });

        await queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/game-state'] });
      }
    } catch (error) {
      console.error('Ошибка при захвате города:', error);

      toast({
        title: "Ошибка захвата",
        description: "Не удалось захватить город. Возможно, не хватает военных.",
        variant: "destructive",
      });
    }
  };


  const availableBuildings = city.availableBuildings || [];

  const buildingCounts: Record<string, number> = {};
  (city.buildings || []).forEach((buildingId: string) => {
    buildingCounts[buildingId] = (buildingCounts[buildingId] || 0) + 1;
  });

  return (
    <div 
      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
      style={{ left: `${city.x}px`, top: `${city.y}px` }} 
      onMouseEnter={() => { setShowLabel(true); setShowTooltip(true); }}
      onMouseLeave={() => { setShowLabel(false); setShowTooltip(false); }}
      onClick={() => {
        selectCity(city);
        setSelectedCity(city);
      }}
    >
      <div className={`w-4 h-4 rounded-full bg-${color}-500 border-2 border-white`}></div>

      {showLabel && (
        <div className="absolute whitespace-nowrap bg-gray-800 text-white px-2 py-1 rounded-md text-xs -mt-8 left-1/2 transform -translate-x-1/2">
          {city.name}
        </div>
      )}

      {showTooltip && (
        <Card className="absolute z-20 p-2 min-w-[200px] shadow-lg -mt-6 ml-3">
          <div className="text-sm font-semibold">{city.name}</div>

          {city.owner === 'neutral' ? (
            <>
              <div className="text-xs mt-1">Нейтральный город</div>

              <div className="mt-2 space-y-1">
                {availableBuildings.length > 0 ? (
                  <div className="text-xs">
                    <div className="font-semibold">Возможные постройки:</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {availableBuildings.map((buildingId: string) => (
                        <span key={buildingId} title={buildingId}>
                          {getBuildingEmoji(buildingId)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2" 
                  onClick={handleCapture}
                >
                  {!hasCapital ? "Выбрать столицей" : "Захватить"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs mt-1">
                Владелец: {city.owner === 'player' ? 'Вы' : 'Противник'}
              </div>

              <div className="mt-2 space-y-1">
                <div className="text-xs">Население: {city.population}</div>
                <div className="text-xs">Военные: {city.military || 0}</div>

                {Object.keys(buildingCounts).length > 0 ? (
                  <div className="text-xs">
                    <div className="font-semibold">Постройки:</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(buildingCounts).map(([buildingId, count]) => (
                        <div key={buildingId} className="flex items-center gap-1 bg-gray-100 rounded px-1">
                          {getBuildingEmoji(buildingId)} x{count}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}