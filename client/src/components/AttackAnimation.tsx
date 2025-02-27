
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { calculateDistance } from '@/lib/utils';

interface AttackAnimationProps {
  fromCity: any;
  toCity: any;
  armySize: number;
  onComplete: () => void;
}

export function AttackAnimation({ fromCity, toCity, armySize, onComplete }: AttackAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  useEffect(() => {
    // Расчет расстояния и длительности похода
    const distance = calculateDistance(fromCity, toCity);
    const speed = 50; // км/ч - скорость перемещения войск
    const travelTime = Math.max(1, Math.ceil(distance / speed)); // в часах, минимум 1 час
    
    // Для игровых целей, сократим время в анимации (1 час = 3 секунды)
    const animationDuration = travelTime * 3;
    setDuration(animationDuration);
    
    // Анимируем движение
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (animationDuration * 10)); // 10 fps
        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 500); // Вызов колбэка завершения с небольшой задержкой
          return 100;
        }
        return newProgress;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [fromCity, toCity, onComplete]);
  
  // Начальная и конечная точки для анимации
  const startPoint = { x: fromCity.longitude, y: fromCity.latitude };
  const endPoint = { x: toCity.longitude, y: toCity.latitude };
  
  // Промежуточная точка для текущего прогресса
  const currentPoint = {
    x: startPoint.x + (endPoint.x - startPoint.x) * (progress / 100),
    y: startPoint.y + (endPoint.y - startPoint.y) * (progress / 100)
  };
  
  // Масштабирование для отображения на карте (зависит от вашей реализации карты)
  const scale = Math.min(1, armySize / 100) * 0.8 + 0.2; // Минимальный размер 0.2, максимальный 1
  
  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      <motion.div 
        className="absolute flex flex-col items-center justify-center"
        style={{
          left: `calc(50% + ${(currentPoint.x - 37) * 20}px)`, 
          top: `calc(50% - ${(currentPoint.y - 55) * 20}px)`,
          transform: `translate(-50%, -50%) scale(${scale})`
        }}
      >
        <div className="bg-red-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-lg">
          {armySize}
        </div>
        <div className="mt-1 bg-black text-white px-2 rounded text-xs">
          {Math.floor(duration * (1 - progress / 100))}с
        </div>
      </motion.div>
    </div>
  );
}
