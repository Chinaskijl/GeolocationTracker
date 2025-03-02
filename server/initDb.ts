// Инициализация базы данных
export async function initDb() {
  try {
    await ensureDataDir();

    // Всегда сбрасываем данные при перезапуске игры
    console.log("Resetting game data...");
    await resetGameData();

    // Обновляем границы областей при каждой инициализации сервера
    // Но НЕ сохраняем их в файл, а только в память
    const { updateAllRegionBoundaries } = await import('./osmService');
    await updateAllRegionBoundaries();

    console.log("Database initialization completed successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Перед экспортом, добавляем возможность повторной инициализации
// при перезапуске игры
export function reinitializeGame() {
  return initDb();
}

export default initDb;