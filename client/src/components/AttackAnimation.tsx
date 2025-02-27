
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

interface AttackAnimationProps {
  attack: {
    id: string;
    fromCityId: number;
    toCityId: number;
    amount: number;
    startTime: number;
    endTime: number;
  }
}

export function AttackAnimation({ attack }: AttackAnimationProps) {
  const { cities } = useGameStore();
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const fromCity = cities.find(c => c.id === attack.fromCityId);
  const toCity = cities.find(c => c.id === attack.toCityId);

  if (!fromCity || !toCity) return null;

  // Координаты на карте
  const fromPos = { x: fromCity.longitude, y: fromCity.latitude };
  const toPos = { x: toCity.longitude, y: toCity.latitude };

  // Расчет времени
  const totalDuration = attack.endTime - attack.startTime;
  const currentTime = Date.now();
  const elapsed = currentTime - attack.startTime;
  const remainingTime = Math.max(0, attack.endTime - currentTime);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      if (now >= attack.endTime) {
        setProgress(1);
        setIsComplete(true);
        clearInterval(timer);
      } else {
        const elapsed = now - attack.startTime;
        const newProgress = Math.min(1, elapsed / totalDuration);
        setProgress(newProgress);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [attack, totalDuration]);

  // Если анимация завершена, не отображаем
  if (isComplete) return null;

  return (
    <motion.div
      style={{
        position: 'absolute',
        zIndex: 1000,
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        backgroundColor: '#ef4444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '10px',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
      }}
      initial={{
        x: fromPos.x,
        y: fromPos.y,
      }}
      animate={{
        x: `calc(${fromPos.x}px + ${progress * (toPos.x - fromPos.x)}px)`,
        y: `calc(${fromPos.y}px + ${progress * (toPos.y - fromPos.y)}px)`,
      }}
    >
      {attack.amount}
    </motion.div>
  );
}
