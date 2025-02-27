
import { ResourceType } from '@/shared/marketTypes';

/**
 * Возвращает иконку для указанного типа ресурса
 * 
 * @param resourceType - Тип ресурса
 * @returns Иконка ресурса в виде emoji или SVG
 */
export function getResourceIcon(resourceType: ResourceType): React.ReactNode {
  switch (resourceType) {
    case 'gold':
      return '💰';
    case 'food':
      return '🌾';
    case 'wood':
      return '🌲';
    case 'oil':
      return '💧';
    case 'metal':
      return '⚙️';
    case 'steel':
      return '🔩';
    case 'weapons':
      return '⚔️';
    default:
      return '❓';
  }
}

/**
 * Возвращает отформатированное название ресурса
 * 
 * @param resourceType - Тип ресурса
 * @returns Отформатированное название ресурса на русском языке
 */
export function getResourceName(resourceType: ResourceType): string {
  switch (resourceType) {
    case 'gold':
      return 'Золото';
    case 'food':
      return 'Еда';
    case 'wood':
      return 'Дерево';
    case 'oil':
      return 'Нефть';
    case 'metal':
      return 'Металл';
    case 'steel':
      return 'Сталь';
    case 'weapons':
      return 'Оружие';
    default:
      return 'Неизвестный ресурс';
  }
}

/**
 * Возвращает цвет для указанного типа ресурса
 * 
 * @param resourceType - Тип ресурса
 * @returns CSS-класс для цвета текста
 */
export function getResourceColor(resourceType: ResourceType): string {
  switch (resourceType) {
    case 'gold':
      return 'text-yellow-500';
    case 'food':
      return 'text-green-500';
    case 'wood':
      return 'text-amber-700';
    case 'oil':
      return 'text-blue-500';
    case 'metal':
      return 'text-gray-500';
    case 'steel':
      return 'text-gray-700';
    case 'weapons':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}
