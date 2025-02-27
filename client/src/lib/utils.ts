
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Объединяет классы Tailwind CSS с помощью clsx и twMerge
 * 
 * @param inputs - Массив классов для объединения
 * @returns Объединенная строка классов, оптимизированная с помощью tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
