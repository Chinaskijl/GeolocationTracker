import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",

import { createServer } from 'vite';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initDb } from './initDb.js';
import { registerRoutes } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Увеличиваем приоритет сервера для более быстрой обработки запросов
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = process.env.NODE_ENV === 'production';

export async function createViteServer() {
  // Инициализируем базу данных
  await initDb();

  // Создаем Express приложение
  const app = express();
  
  // Оптимизация для повышения производительности
  app.set('etag', false);
  app.use(express.json({ limit: '5mb' }));
  
  // Без этих заголовков браузер будет кэшировать ответы, что может вызывать задержки
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // В режиме разработки создаем Vite сервер
  if (!isProd) {
    const vite = await createServer({
      root: resolve(__dirname, '../client'),
      server: {
        middlewareMode: true,
        hmr: {
          // Оптимизация Hot Module Replacement
          protocol: 'ws',
          timeout: 5000, // Уменьшаем таймаут для более быстрого обновления
          port: 24678
        }
      },
      appType: 'spa',
      clearScreen: false
    });

    // Используем Vite middleware
    app.use(vite.middlewares);
  } else {
    // В продакшене просто раздаем статические файлы
    app.use(express.static(resolve(__dirname, '../client/dist')));
  }

  // Регистрируем API маршруты
  const httpServer = await registerRoutes(app);

  return httpServer;
}

    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}