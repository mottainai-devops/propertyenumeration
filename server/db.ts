import { eq, like, or, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  buildings, 
  pickups,
  companies,
  operationalLots,
  validationLogs,
  type Building,
  type Pickup,
  type InsertBuilding,
  type InsertPickup,
  type Company,
  type OperationalLot,
  type InsertValidationLog
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USER FUNCTIONS (Keep existing)
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// BUILDING FUNCTIONS (Replaces polygon functions)
// ============================================================================

export async function createBuilding(building: InsertBuilding) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(buildings).values(building);
  return result[0].insertId;
}

export async function listBuildings() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(buildings).orderBy(desc(buildings.lastUpdated));
}

export async function getBuildingById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(buildings).where(eq(buildings.id, id)).limit(1);
  return result[0] || null;
}

export async function getBuildingByBuildingId(buildingId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(buildings).where(eq(buildings.buildingId, buildingId)).limit(1);
  return result[0] || null;
}

export async function updateBuilding(id: number, updates: Partial<Building>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(buildings).set(updates).where(eq(buildings.id, id));
}

export async function deleteBuilding(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(buildings).where(eq(buildings.id, id));
}

// Get buildings with customer labels
export async function getBuildingsWithCustomers() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(buildings)
    .where(sql`${buildings.customerLabels} IS NOT NULL AND ${buildings.customerLabels} != ''`)
    .orderBy(desc(buildings.lastUpdated));
}

// ============================================================================
// PICKUP FUNCTIONS (Replaces customer/property functions)
// ============================================================================

export async function createPickup(pickup: InsertPickup) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(pickups).values(pickup);
  return result[0].insertId;
}

export async function listPickups(filters?: {
  buildingId?: string;
  companyId?: string;
  userId?: string;
  synced?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(pickups);

  const conditions = [];
  if (filters?.buildingId) {
    conditions.push(eq(pickups.buildingId, filters.buildingId));
  }
  if (filters?.companyId) {
    conditions.push(eq(pickups.companyId, parseInt(filters.companyId)));
  }
  if (filters?.userId) {
    conditions.push(eq(pickups.userId, parseInt(filters.userId)));
  }
  if (filters?.synced !== undefined) {
    conditions.push(eq(pickups.synced, filters.synced));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return await query.orderBy(desc(pickups.createdAt));
}

export async function getPickupById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(pickups).where(eq(pickups.id, id)).limit(1);
  return result[0] || null;
}

export async function updatePickup(id: number, updates: Partial<Pickup>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(pickups).set(updates).where(eq(pickups.id, id));
}

export async function deletePickup(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(pickups).where(eq(pickups.id, id));
}

// Search pickups by customer info
export async function searchPickups(query: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(pickups)
    .where(
      or(
        like(pickups.formId, `%${query}%`),
        like(pickups.buildingId, `%${query}%`),
        like(pickups.supervisorId, `%${query}%`)
      )
    )
    .orderBy(desc(pickups.createdAt))
    .limit(50);
}

// Get pickups for a specific building
export async function getPickupsByBuilding(buildingId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(pickups)
    .where(eq(pickups.buildingId, buildingId))
    .orderBy(desc(pickups.createdAt));
}

// Update building customer labels after pickup creation
export async function updateBuildingCustomerLabels(buildingId: string) {
  const db = await getDb();
  if (!db) return;

  const pickupsForBuilding = await getPickupsByBuilding(buildingId);
  const customerNames = pickupsForBuilding
    .map(p => p.formId)
    .filter(id => id && id.trim() !== '')
    .join(', ');

  await db
    .update(buildings)
    .set({ customerLabels: customerNames || null })
    .where(eq(buildings.buildingId, buildingId));
}

// ============================================================================
// COMPANY FUNCTIONS (Keep existing)
// ============================================================================

export async function listCompanies() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(companies).where(eq(companies.active, 1));
}

export async function listOperationalLots(companyId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (companyId) {
    return await db
      .select()
      .from(operationalLots)
      .where(and(
        eq(operationalLots.active, 1),
        eq(operationalLots.companyId, companyId)
      ));
  }

  return await db.select().from(operationalLots).where(eq(operationalLots.active, 1));
}

// ============================================================================
// VALIDATION LOG FUNCTIONS
// ============================================================================

export async function listValidationLogs() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(validationLogs).orderBy(validationLogs.createdAt);
}

export async function createValidationLog(log: InsertValidationLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(validationLogs).values(log);
  return result[0]?.insertId || 0;
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;

  const [buildingCount] = await db.select({ count: sql<number>`count(*)` }).from(buildings);
  const [pickupCount] = await db.select({ count: sql<number>`count(*)` }).from(pickups);
  const [unsyncedCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pickups)
    .where(eq(pickups.synced, 0));

  return {
    totalBuildings: buildingCount?.count || 0,
    totalPickups: pickupCount?.count || 0,
    unsyncedPickups: unsyncedCount?.count || 0,
  };
}
