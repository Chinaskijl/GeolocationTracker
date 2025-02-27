import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function calculateDistance(city1: any, city2: any): number {
  const R = 6371; // Радиус Земли в км
  const lat1 = city1.latitude * Math.PI / 180;
  const lat2 = city2.latitude * Math.PI / 180;
  const dLat = (city2.latitude - city1.latitude) * Math.PI / 180;
  const dLon = (city2.longitude - city1.longitude) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon/2) * Math.sin(dLon/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Расстояние в км
}

export function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
