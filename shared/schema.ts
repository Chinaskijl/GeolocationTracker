import { pgTable, text, serial, integer, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  population: integer("population").notNull(),
  maxPopulation: integer("max_population").notNull(),
  resources: jsonb("resources").$type<{
    gold?: number;
    wood?: number;
    food?: number;
    oil?: number;
  }>().notNull(),
  boundaries: jsonb("boundaries").$type<[number, number][]>().notNull(),
  owner: text("owner").default("neutral"),
  buildings: jsonb("buildings").$type<string[]>().default([]).notNull()
});

export const insertCitySchema = createInsertSchema(cities);
export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof cities.$inferSelect;

export interface GameState {
  resources: {
    gold: number;
    wood: number;
    food: number;
    oil: number;
  };
  population: number;
  military: number;
}

export interface Building {
  id: string;
  name: string;
  cost: {
    gold?: number;
    wood?: number;
    food?: number;
    oil?: number;
  };
  resourceProduction?: {
    type: 'gold' | 'wood' | 'food' | 'oil';
    amount: number;
  };
  military?: {
    production: number;
    populationUse: number;
  };
  population?: {
    housing: number;
    growth: number;
  };
  maxCount: number;
}