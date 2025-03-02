
/**
 * Интерфейс для описания области в игре
 */
export interface Region {
  /** Уникальный идентификатор области */
  id: number;
  
  /** Название области */
  name: string;
  
  /** Широта центра области */
  latitude: number;
  
  /** Долгота центра области */
  longitude: number;
  
  /** Текущее население области */
  population: number;
  
  /** Максимальное население области */
  maxPopulation: number;
  
  /** Доступные ресурсы области */
  resources: {
    food?: number;
    gold?: number;
    wood?: number;
    oil?: number;
    metal?: number;
  };
  
  /** Координаты границ области в формате многоугольника [[lat, lng], ...] */
  boundaries: number[][];
  
  /** Владелец области: 'player', 'ai', 'neutral' */
  owner: string;
  
  /** Список идентификаторов построенных зданий */
  buildings: string[];
  
  /** Количество военных единиц */
  military: number;
  
  /** Ограничения на количество зданий каждого типа */
  buildingLimits?: {
    [buildingId: string]: number;
  };
}
