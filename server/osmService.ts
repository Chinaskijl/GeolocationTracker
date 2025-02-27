import fs from 'fs';
import path from 'path';
import { storage } from './storage';

/**
 * Обновляет границы всех городов из заранее сохраненных файлов
 */
export async function updateAllCityBoundaries(): Promise<void> {
  const cities = await storage.getCities();
  
  for (const city of cities) {
    await updateCityBoundary(city.id);
  }
  
  console.log('Все границы городов успешно обновлены');
}

/**
 * Обновляет границы конкретного города из заранее сохраненного файла
 * @param cityId - ID города
 * @returns Обновленный город
 */
export async function updateCityBoundary(cityId: number): Promise<any> {
  const cities = await storage.getCities();
  const city = cities.find(c => c.id === cityId);
  
  if (!city) {
    throw new Error(`Город с ID ${cityId} не найден`);
  }
  
  try {
    // Проверяем наличие файла с границами города
    const filePath = path.join(__dirname, '..', 'data', 'city-boundaries', `${city.name}.json`);
    
    if (fs.existsSync(filePath)) {
      // Если файл существует, загружаем границы
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const boundaries = JSON.parse(fileContent);
      
      // Обновляем город с новыми границами
      const updatedCity = await storage.updateCity(cityId, { boundaries });
      
      console.log(`Границы города ${city.name} успешно обновлены`);
      return updatedCity;
    } else {
      // Если файла нет, создаем упрощенные границы
      console.log(`Файл с границами для города ${city.name} не найден. Используем упрощенные границы.`);
      
      // Создаем простой квадрат вокруг координат города
      const delta = 0.05; // размер области
      const simpleBoundaries = [
        [city.latitude - delta, city.longitude - delta],
        [city.latitude + delta, city.longitude - delta],
        [city.latitude + delta, city.longitude + delta],
        [city.latitude - delta, city.longitude + delta],
        [city.latitude - delta, city.longitude - delta], // замыкаем полигон
      ];
      
      // Обновляем город с упрощенными границами
      const updatedCity = await storage.updateCity(cityId, { boundaries: simpleBoundaries });
      
      return updatedCity;
    }
  } catch (error) {
    console.error(`Ошибка при обновлении границ города ${city.name}:`, error);
    throw error;
  }
}