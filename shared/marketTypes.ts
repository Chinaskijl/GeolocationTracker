export type ResourceType = 'gold' | 'food' | 'wood' | 'oil' | 'metal' | 'steel' | 'weapons';

/**
 * Интерфейс для лота на рынке
 */
export interface Listing {
  /** Уникальный идентификатор лота */
  id: number;
  
  /** Тип ресурса */
  resourceType: ResourceType;
  
  /** Количество ресурса */
  amount: number;
  
  /** Цена за единицу */
  pricePerUnit: number;
  
  /** Тип лота: покупка или продажа */
  type: 'buy' | 'sell';
  
  /** Дата создания лота */
  createdAt: string;
  
  /** Владелец лота: 'player' (игрок) или 'ai' (ИИ) */
  owner: 'player' | 'ai';
}

/**
 * Интерфейс для завершенной транзакции на рынке
 */
export interface Transaction {
  /** Уникальный идентификатор транзакции */
  id: number;
  
  /** ID лота, по которому совершена транзакция */
  listingId: number;
  
  /** Тип ресурса */
  resourceType: ResourceType;
  
  /** Количество ресурса */
  amount: number;
  
  /** Цена за единицу */
  pricePerUnit: number;
  
  /** Общая стоимость транзакции */
  totalPrice: number;
  
  /** Дата и время транзакции */
  timestamp: string;
  
  /** Продавец: 'player' (игрок) или 'ai' (ИИ) */
  seller: 'player' | 'ai';
  
  /** Покупатель: 'player' (игрок) или 'ai' (ИИ) */
  buyer: 'player' | 'ai';
}