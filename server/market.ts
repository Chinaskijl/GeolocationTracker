import type { Listing, Transaction, ResourceType } from '@shared/marketTypes';
import { storage } from './storage';

/**
 * Класс, реализующий рыночную систему
 */
class Market {
  private listings: Listing[] = [];
  private transactions: Transaction[] = [];
  private priceHistory: Record<ResourceType, { timestamp: number, price: number }[]> = {
    gold: [],
    food: [],
    wood: [],
    oil: [],
    metal: [],
    steel: [],
    weapons: []
  };

  /**
   * Получение всех активных лотов на рынке
   * @returns Массив активных лотов
   */
  getListings(): Listing[] {
    return this.listings;
  }

  /**
   * Создание нового лота игроком
   * @param listingData - Данные о лоте
   * @returns true, если лот успешно создан, иначе false
   */
  async createPlayerListing(listingData: {
    resourceType: ResourceType;
    amount: number;
    pricePerUnit: number;
    type: 'buy' | 'sell';
  }): Promise<boolean> {
    const gameState = await storage.getGameState();

    // Проверка наличия ресурсов при продаже
    if (listingData.type === 'sell') {
      const currentAmount = gameState.resources[listingData.resourceType];
      if (currentAmount < listingData.amount) {
        return false; // Недостаточно ресурсов
      }

      // Списываем ресурсы при создании лота продажи
      const newResources = { ...gameState.resources };
      newResources[listingData.resourceType] -= listingData.amount;
      await storage.setGameState({ ...gameState, resources: newResources });
    } else if (listingData.type === 'buy') {
      // Для лота покупки проверяем наличие золота для зарезервирования
      const totalCost = listingData.amount * listingData.pricePerUnit;
      if (gameState.resources.gold < totalCost) {
        return false; // Недостаточно золота
      }

      // Резервируем золото для покупки
      const newResources = { ...gameState.resources };
      newResources.gold -= totalCost;
      await storage.setGameState({ ...gameState, resources: newResources });
    }

    // Создаем новый лот
    const newListing: Listing = {
      id: Date.now(),
      resourceType: listingData.resourceType,
      amount: listingData.amount,
      pricePerUnit: listingData.pricePerUnit,
      type: listingData.type,
      createdAt: new Date().toISOString(),
      owner: 'player'
    };

    this.listings.push(newListing);

    // Обновляем историю цен при создании лота
    this.updatePriceHistory(listingData.resourceType, listingData.pricePerUnit);

    return true;
  }

  /**
   * Покупка лота
   * @param listingId - ID лота для покупки
   * @param buyer - Покупатель лота
   * @returns true, если покупка успешна, иначе false
   */
  async buyListing(listingId: number, buyer: string): Promise<boolean> {
    const listingIndex = this.listings.findIndex(l => l.id === listingId);
    if (listingIndex === -1) {
      return false; // Лот не найден
    }

    const listing = this.listings[listingIndex];

    // Проверка, что покупатель не является владельцем
    if (listing.owner === buyer) {
      return false; // Нельзя купить свой же лот
    }

    const gameState = await storage.getGameState();
    const totalCost = listing.amount * listing.pricePerUnit;

    if (listing.type === 'sell') {
      // Покупка у продавца
      if (buyer === 'player' && gameState.resources.gold < totalCost) {
        return false; // Игроку не хватает золота
      }

      const newResources = { ...gameState.resources };

      if (buyer === 'player') {
        // Игрок покупает ресурсы
        newResources.gold -= totalCost;
        newResources[listing.resourceType] += listing.amount;
      } else {
        // ИИ покупает ресурсы у игрока
        newResources.gold += totalCost;
      }

      await storage.setGameState({ ...gameState, resources: newResources });
    } else if (listing.type === 'buy') {
      // Продажа покупателю
      if (buyer === 'player' && gameState.resources[listing.resourceType] < listing.amount) {
        return false; // Игроку не хватает ресурсов
      }

      const newResources = { ...gameState.resources };

      if (buyer === 'player') {
        // Игрок продает ресурсы
        newResources[listing.resourceType] -= listing.amount;
        newResources.gold += totalCost;
      } else {
        // ИИ продает ресурсы игроку
        newResources[listing.resourceType] += listing.amount;
        newResources.gold -= totalCost;
      }

      await storage.setGameState({ ...gameState, resources: newResources });
    }

    // Создаем запись о транзакции
    const transaction: Transaction = {
      id: Date.now(),
      listingId: listing.id,
      resourceType: listing.resourceType,
      amount: listing.amount,
      pricePerUnit: listing.pricePerUnit,
      totalPrice: totalCost,
      timestamp: new Date().toISOString(),
      seller: listing.type === 'sell' ? listing.owner : buyer,
      buyer: listing.type === 'sell' ? buyer : listing.owner
    };

    this.transactions.push(transaction);

    // Удаляем лот из списка
    this.listings.splice(listingIndex, 1);

    return true;
  }

  /**
   * Отмена лота
   * @param listingId - ID лота для отмены
   * @returns true, если отмена успешна, иначе false
   */
  async cancelListing(listingId: number): Promise<boolean> {
    const listingIndex = this.listings.findIndex(l => l.id === listingId);
    if (listingIndex === -1) {
      return false; // Лот не найден
    }

    const listing = this.listings[listingIndex];

    // Можно отменять только свои лоты
    if (listing.owner !== 'player') {
      return false;
    }

    const gameState = await storage.getGameState();
    const newResources = { ...gameState.resources };

    if (listing.type === 'sell') {
      // Возвращаем ресурсы продавцу
      newResources[listing.resourceType] += listing.amount;
    } else if (listing.type === 'buy') {
      // Возвращаем золото покупателю
      newResources.gold += listing.amount * listing.pricePerUnit;
    }

    await storage.setGameState({ ...gameState, resources: newResources });

    // Удаляем лот из списка
    this.listings.splice(listingIndex, 1);

    return true;
  }

  /**
   * Получение истории транзакций
   * @returns Массив транзакций
   */
  getTransactions(): Transaction[] {
    return this.transactions;
  }

  /**
   * Обновление истории цен
   * @param resourceType - Тип ресурса
   * @param price - Цена
   */
  private updatePriceHistory(resourceType: ResourceType, price: number): void {
    this.priceHistory[resourceType].push({
      timestamp: Date.now(),
      price
    });

    // Ограничиваем историю последними 100 записями
    if (this.priceHistory[resourceType].length > 100) {
      this.priceHistory[resourceType].shift();
    }
  }

  /**
   * Получение истории цен для ресурса
   * @param resourceType - Тип ресурса
   * @param days - Количество дней для фильтрации (опционально)
   * @returns История цен
   */
  getPriceHistory(resourceType: ResourceType, days?: number): { timestamp: number, price: number }[] {
    if (!this.priceHistory[resourceType].length) {
      return [];
    }

    if (!days) {
      return this.priceHistory[resourceType];
    }

    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.priceHistory[resourceType].filter(record => record.timestamp >= cutoffTime);
  }

  /**
   * Создание лотов ИИ
   * Метод создает лоты продажи и покупки от имени ИИ для обеспечения ликвидности рынка
   */
  createAIListings(): void {
    // Добавление лотов ИИ для обеспечения ликвидности рынка
    const resourceTypes: ResourceType[] = ['food', 'wood', 'oil', 'metal', 'steel', 'weapons'];

    // Базовые цены для различных ресурсов
    const basePrices: Record<ResourceType, number> = {
      gold: 1,
      food: 2,
      wood: 3,
      oil: 5,
      metal: 7,
      steel: 12,
      weapons: 20
    };

    // Для каждого типа ресурсов создаем по одному лоту покупки и продажи
    for (const resourceType of resourceTypes) {
      const basePrice = basePrices[resourceType];

      // Случайное отклонение цены до ±20%
      const sellPriceVariation = 1 + (Math.random() * 0.4 - 0.2);
      const buyPriceVariation = 1 - (Math.random() * 0.3); // Цена покупки всегда ниже базовой

      const sellPrice = Math.round(basePrice * sellPriceVariation * 100) / 100;
      const buyPrice = Math.round(basePrice * buyPriceVariation * 100) / 100;

      const sellAmount = Math.floor(Math.random() * 10) + 5; // 5-15 единиц
      const buyAmount = Math.floor(Math.random() * 15) + 10; // 10-25 единиц

      // Лот продажи (ИИ продает ресурс)
      this.listings.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        resourceType,
        amount: sellAmount,
        pricePerUnit: sellPrice,
        type: 'sell',
        createdAt: new Date().toISOString(),
        owner: 'ai'
      });

      // Лот покупки (ИИ покупает ресурс)
      this.listings.push({
        id: Date.now() + Math.floor(Math.random() * 1000) + 1000,
        resourceType,
        amount: buyAmount,
        pricePerUnit: buyPrice,
        type: 'buy',
        createdAt: new Date().toISOString(),
        owner: 'ai'
      });

      // Обновляем историю цен
      this.updatePriceHistory(resourceType, (sellPrice + buyPrice) / 2);
    }
  }

  /**
   * Очистка устаревших лотов
   * Метод удаляет лоты, созданные AI, которые устарели
   */
  cleanupOldListings(): void {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000; // 24 часа назад

    this.listings = this.listings.filter(listing => {
      // Сохраняем все лоты игрока
      if (listing.owner === 'player') {
        return true;
      }

      // Для AI лотов проверяем время создания
      const createdAt = new Date(listing.createdAt).getTime();
      return createdAt > oneDayAgo;
    });
  }

  /**
   * Инициализация рынка
   * Создает начальные лоты от AI
   */
  initialize(): void {
    // Создаем начальные лоты от AI
    this.createAIListings();

    // Устанавливаем периодическое обновление лотов ИИ
    setInterval(() => {
      this.cleanupOldListings();

      // Если лотов мало, добавляем новые
      if (this.listings.filter(l => l.owner === 'ai').length < 5) {
        this.createAIListings();
      }
    }, 30 * 60 * 1000); // Каждые 30 минут
  }


  private createTransaction(transactionData: {
    resourceType: ResourceType;
    amount: number;
    pricePerUnit: number;
    timestamp: number;
    type: 'buy' | 'sell';
  }): void {
    const transaction: Transaction = {
      id: Date.now(),
      listingId: 0, // Не используется в этом методе
      resourceType: transactionData.resourceType,
      amount: transactionData.amount,
      pricePerUnit: transactionData.pricePerUnit,
      totalPrice: transactionData.amount * transactionData.pricePerUnit,
      timestamp: new Date(transactionData.timestamp).toISOString(),
      seller: 'player', //  Предполагаем, что игрок всегда участвует в транзакции
      buyer: 'ai' // Предполагаем, что ИИ всегда участвует в транзакции
    };
    this.transactions.push(transaction);
  }

  /**
   * Обработка покупки лота
   * @param listingId - ID лота
   * @returns true, если покупка успешна, иначе false
   */
  async purchaseListing(listingId: string | number): Promise<boolean> {
    const listingIdNum = typeof listingId === 'string' ? parseInt(listingId, 10) : listingId;
    const listing = this.listings.find(l => l.id === listingIdNum);
    
    if (!listing) {
      console.log(`Лот ${listingId} не найден`);
      return false;
    }

    // Получаем текущее состояние игры
    const gameState = await storage.getGameState();
    const totalPrice = listing.amount * listing.pricePerUnit;

    try {
      if (listing.type === 'sell') {
        // Игрок покупает ресурс
        
        // Проверка наличия достаточного количества золота
        if (gameState.resources.gold < totalPrice) {
          console.log(`Недостаточно золота для покупки. Требуется: ${totalPrice}, Имеется: ${gameState.resources.gold}`);
          return false;
        }

        // Создаем новый объект состояния для изменений
        const newResources = { ...gameState.resources };
        
        // Снимаем золото
        newResources.gold -= totalPrice;
        
        // Добавляем ресурс (убедимся, что значение не undefined)
        newResources[listing.resourceType] = (newResources[listing.resourceType] || 0) + listing.amount;
        
        // Сохраняем обновленное состояние
        await storage.setGameState({ 
          ...gameState, 
          resources: newResources 
        });

        // Создаем запись о транзакции
        this.createTransaction({
          resourceType: listing.resourceType,
          amount: listing.amount,
          pricePerUnit: listing.pricePerUnit,
          timestamp: Date.now(),
          type: 'buy'
        });

        // Удаляем лот из рынка
        this.listings = this.listings.filter(l => l.id !== listingIdNum);

        console.log(`Успешная покупка лота ${listingId}. Ресурс: ${listing.resourceType}, Количество: ${listing.amount}, Цена: ${totalPrice}`);
        return true;
        
      } else if (listing.type === 'buy') {
        // Игрок продает ресурс
        
        // Проверка наличия достаточного количества ресурса
        if ((gameState.resources[listing.resourceType] || 0) < listing.amount) {
          console.log(`Недостаточно ресурса для продажи. Требуется: ${listing.amount}, Имеется: ${gameState.resources[listing.resourceType] || 0}`);
          return false;
        }

        // Создаем новый объект состояния для изменений
        const newResources = { ...gameState.resources };
        
        // Снимаем ресурс
        newResources[listing.resourceType] -= listing.amount;
        
        // Добавляем золото
        newResources.gold += totalPrice;
        
        // Сохраняем обновленное состояние
        await storage.setGameState({ 
          ...gameState, 
          resources: newResources 
        });

        // Создаем запись о транзакции
        this.createTransaction({
          resourceType: listing.resourceType,
          amount: listing.amount,
          pricePerUnit: listing.pricePerUnit,
          timestamp: Date.now(),
          type: 'sell'
        });

        // Удаляем лот из рынка
        this.listings = this.listings.filter(l => l.id !== listingIdNum);

        console.log(`Успешная продажа лота ${listingId}. Ресурс: ${listing.resourceType}, Количество: ${listing.amount}, Получено золота: ${totalPrice}`);
        return true;
      }
    } catch (error) {
      console.error('Ошибка при обработке транзакции:', error);
      return false;
    }

    return false;
  }
}

/**
 * Экземпляр маркета для использования в приложении
 */
export const market = new Market();

// Инициализируем рынок при импорте модуля
market.initialize();