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
    metal?: number;
    steel?: number;
    weapons?: number;
  }>().notNull(),
  boundaries: jsonb("boundaries").$type<[number, number][]>().notNull(),
  owner: text("owner").default("neutral"),
  buildings: jsonb("buildings").$type<string[]>().default([]).notNull(),
  military: integer("military").default(0).notNull(),
  adjacentCities: jsonb("adjacent_cities").$type<number[]>().default([]).notNull() // Added adjacentCities field
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
    metal: number;
    steel: number;
    weapons: number;
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
    type: 'gold' | 'wood' | 'food' | 'oil' | 'metal' | 'steel' | 'weapons';
    amount: number;
  };
  resourceConsumption?: {
    type?: 'gold' | 'wood' | 'food' | 'oil' | 'metal' | 'steel' | 'weapons';
    amount?: number;
    wood?: number;
    gold?: number;
    food?: number;
    oil?: number;
    metal?: number;
    steel?: number;
    weapons?: number;
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

export interface ArmyTransfer {
  id: number;
  fromCityId: number;
  toCityId: number;
  amount: number;
  startTime: number;
  arrivalTime: number;
  isUsingRoute?: boolean;
}

export interface CityRoute {
  id: number;
  fromCityId: number;
  toCityId: number;
  distance: number;
  travelTime: number;
}