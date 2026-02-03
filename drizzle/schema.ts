import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. Optional for custom auth. */
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  /** Hashed password for email/password authentication */
  password: varchar("password", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Mottainai Survey App Integration Tables

/**
 * Buildings table - stores building/polygon data with GeoJSON geometry
 * Synced with Android app for property enumeration
 */
export const buildings = mysqlTable("buildings", {
  id: int("id").autoincrement().primaryKey(),
  buildingId: varchar("buildingId", { length: 255 }).notNull().unique(),
  businessName: text("businessName"),
  custPhone: varchar("custPhone", { length: 50 }),
  customerEmail: varchar("customerEmail", { length: 255 }),
  address: text("address"),
  zone: varchar("zone", { length: 100 }),
  socioEconomicGroups: varchar("socioEconomicGroups", { length: 100 }),
  geometry: text("geometry").notNull(), // GeoJSON polygon data
  centerLat: varchar("centerLat", { length: 50 }).notNull(),
  centerLon: varchar("centerLon", { length: 50 }).notNull(),
  customerLabels: text("customerLabels"), // Comma-separated customer names for map display
  lastUpdated: timestamp("lastUpdated").defaultNow().notNull(),
});

export type Building = typeof buildings.$inferSelect;
export type InsertBuilding = typeof buildings.$inferInsert;

/**
 * Pickups table - stores customer survey/pickup records
 * Created by field workers via Android app
 */
export const pickups = mysqlTable("pickups", {
  id: int("id").autoincrement().primaryKey(),
  formId: varchar("formId", { length: 255 }).notNull().unique(),
  supervisorId: varchar("supervisorId", { length: 255 }),
  customerType: varchar("customerType", { length: 50 }),
  binType: varchar("binType", { length: 50 }),
  wheelieBinType: varchar("wheelieBinType", { length: 50 }),
  binQuantity: int("binQuantity"),
  buildingId: varchar("buildingId", { length: 255 }), // Links to buildings.buildingId
  pickUpDate: varchar("pickUpDate", { length: 50 }),
  firstPhoto: text("firstPhoto"),
  secondPhoto: text("secondPhoto"),
  incidentReport: text("incidentReport"),
  userId: int("userId"),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  synced: int("synced").default(0).notNull(), // 0 = unsynced, 1 = synced
  companyId: int("companyId"),
  companyName: varchar("companyName", { length: 255 }),
  lotCode: varchar("lotCode", { length: 100 }),
  lotName: varchar("lotName", { length: 255 }),
  socioClass: varchar("socioClass", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Pickup = typeof pickups.$inferSelect;
export type InsertPickup = typeof pickups.$inferInsert;

/**
 * Companies table - stores company information
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 100 }),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

/**
 * Operational lots table - stores operational lot assignments
 */
export const operationalLots = mysqlTable("operational_lots", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  lotCode: varchar("lotCode", { length: 100 }).notNull(),
  lotName: varchar("lotName", { length: 255 }).notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OperationalLot = typeof operationalLots.$inferSelect;
export type InsertOperationalLot = typeof operationalLots.$inferInsert;

/**
 * Validation logs table - tracks approval/rejection of pickup records
 */
export const validationLogs = mysqlTable("validation_logs", {
  id: int("id").autoincrement().primaryKey(),
  pickupId: int("pickupId").notNull(),
  validatedBy: int("validatedBy").notNull(), // user.id
  status: mysqlEnum("status", ["approved", "rejected"]).notNull(),
  comments: text("comments"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ValidationLog = typeof validationLogs.$inferSelect;
export type InsertValidationLog = typeof validationLogs.$inferInsert;