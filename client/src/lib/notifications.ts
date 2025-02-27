
/**
 * Система уведомлений для игры
 */

// Типы уведомлений
type NotificationType = 'success' | 'error' | 'warning' | 'info';

// Интерфейс для параметров уведомления
interface NotificationOptions {
  title: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

/**
 * Показать уведомление пользователю
 * @param options Параметры уведомления
 */
export function showNotification(options: NotificationOptions): void {
  const { title, message, type, duration = 3000 } = options;
  
  // Создаем элемент уведомления
  const notification = document.createElement('div');
  notification.className = `notification notification-${type} fixed top-4 right-4 p-4 rounded-lg shadow-lg z-[9999] max-w-md`;
  
  // Добавляем стили в зависимости от типа
  switch (type) {
    case 'success':
      notification.classList.add('bg-green-500', 'text-white');
      break;
    case 'error':
      notification.classList.add('bg-red-500', 'text-white');
      break;
    case 'warning':
      notification.classList.add('bg-yellow-500', 'text-white');
      break;
    case 'info':
      notification.classList.add('bg-blue-500', 'text-white');
      break;
  }
  
  // Создаем содержимое уведомления
  notification.innerHTML = `
    <div class="flex items-start">
      <div class="flex-1">
        <h3 class="font-bold">${title}</h3>
        <p>${message}</p>
      </div>
      <button class="ml-4 text-white" aria-label="Закрыть">×</button>
    </div>
  `;
  
  // Добавляем в DOM
  document.body.appendChild(notification);
  
  // Добавляем обработчик для кнопки закрытия
  const closeButton = notification.querySelector('button');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      document.body.removeChild(notification);
    });
  }
  
  // Автоматически скрываем через указанное время
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, duration);
}
