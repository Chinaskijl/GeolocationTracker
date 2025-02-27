
import React from 'react';
import { useGameStore } from '../lib/store';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

/**
 * Компонент панели города, отображающий информацию о выбранном городе
 */
interface CityPanelProps {
  cityId?: number;
}

export function CityPanel({ cityId }: CityPanelProps) {
  const { cities, selectedCity, selectCity } = useGameStore((state) => ({
    cities: state.cities,
    selectedCity: state.selectedCity,
    selectCity: state.selectCity,
  }));

  const city = cityId 
    ? cities.find(c => c.id === cityId) 
    : selectedCity 
      ? cities.find(c => c.id === selectedCity) 
      : null;

  if (!city) {
    return (
      <Card className="min-w-80">
        <CardHeader>
          <CardTitle>Выберите город</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Выберите город на карте для просмотра информации</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-80">
      <CardHeader>
        <CardTitle>{city.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Население:</h3>
            <p>{city.population} / {city.maxPopulation}</p>
          </div>
          
          <div>
            <h3 className="font-medium">Ресурсы:</h3>
            <ul className="list-disc list-inside">
              {Object.entries(city.resources).map(([key, value]) => (
                <li key={key}>{key}: {value}</li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium">Владелец:</h3>
            <p>{city.owner === 'neutral' ? 'Нейтральный' : city.owner}</p>
          </div>
          
          <div>
            <h3 className="font-medium">Военная сила:</h3>
            <p>{city.military}</p>
          </div>
          
          <div>
            <h3 className="font-medium">Здания:</h3>
            {city.buildings.length > 0 ? (
              <ul className="list-disc list-inside">
                {city.buildings.map((building, index) => (
                  <li key={index}>{building}</li>
                ))}
              </ul>
            ) : (
              <p>Нет построенных зданий</p>
            )}
          </div>
          
          <Button className="w-full">Обновить границы города</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default CityPanel;
