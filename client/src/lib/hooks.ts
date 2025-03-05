import { useEffect } from 'react';
import { useGameStore } from './store';

// Хук для отслеживания изменений удовлетворенности в городах
export function useSatisfactionTracker() {
  const cities = useGameStore(state => state.cities);

  useEffect(() => {
    if (cities.length > 0) {
      cities.forEach(city => {
        if (city.owner === 'player' && city.satisfaction === 0) {
          console.log(`SATISFACTION TRACKER: City ${city.name} has 0% satisfaction`);
        }
        if (city.owner === 'player' && city.satisfaction > 45 && city.satisfaction < 50) {
          console.log(`SATISFACTION TRACKER: City ${city.name} satisfaction reset to ~${city.satisfaction.toFixed(2)}%`);
        }
      });
    }
  }, [cities]);
}