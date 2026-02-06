import { Preferences } from '@capacitor/preferences';

export interface PendingBuilding {
  id: string; // Temporary local ID
  timestamp: number;
  data: {
    address: string;
    lotCode: string;
    propertyType: string;
    contactName?: string;
    contactPhone?: string;
    gpsCoordinates: {
      latitude: number;
      longitude: number;
    };
    photos: string[]; // Base64 encoded photos
    customerId?: string; // Optional customer link
  };
  syncStatus: 'pending' | 'syncing' | 'failed';
  syncAttempts: number;
  lastSyncAttempt?: number;
  errorMessage?: string;
}

const STORAGE_KEYS = {
  PENDING_BUILDINGS: 'pending_buildings',
  RECENT_CUSTOMERS: 'recent_customers',
  LAST_SYNC: 'last_sync_timestamp',
};

/**
 * Save a building to the offline queue
 */
export async function savePendingBuilding(building: Omit<PendingBuilding, 'id' | 'timestamp' | 'syncStatus' | 'syncAttempts'>): Promise<string> {
  const pendingBuildings = await getPendingBuildings();
  
  const newBuilding: PendingBuilding = {
    id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    syncStatus: 'pending',
    syncAttempts: 0,
    ...building,
  };
  
  pendingBuildings.push(newBuilding);
  await Preferences.set({
    key: STORAGE_KEYS.PENDING_BUILDINGS,
    value: JSON.stringify(pendingBuildings),
  });
  
  return newBuilding.id;
}

/**
 * Get all pending buildings from storage
 */
export async function getPendingBuildings(): Promise<PendingBuilding[]> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.PENDING_BUILDINGS });
  if (!value) return [];
  
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('Failed to parse pending buildings:', error);
    return [];
  }
}

/**
 * Update a pending building's sync status
 */
export async function updateBuildingSyncStatus(
  buildingId: string,
  status: PendingBuilding['syncStatus'],
  errorMessage?: string
): Promise<void> {
  const pendingBuildings = await getPendingBuildings();
  const index = pendingBuildings.findIndex(b => b.id === buildingId);
  
  if (index !== -1) {
    pendingBuildings[index].syncStatus = status;
    pendingBuildings[index].lastSyncAttempt = Date.now();
    
    if (status === 'syncing' || status === 'failed') {
      pendingBuildings[index].syncAttempts += 1;
    }
    
    if (errorMessage) {
      pendingBuildings[index].errorMessage = errorMessage;
    }
    
    await Preferences.set({
      key: STORAGE_KEYS.PENDING_BUILDINGS,
      value: JSON.stringify(pendingBuildings),
    });
  }
}

/**
 * Remove a successfully synced building from the queue
 */
export async function removeSyncedBuilding(buildingId: string): Promise<void> {
  const pendingBuildings = await getPendingBuildings();
  const filtered = pendingBuildings.filter(b => b.id !== buildingId);
  
  await Preferences.set({
    key: STORAGE_KEYS.PENDING_BUILDINGS,
    value: JSON.stringify(filtered),
  });
}

/**
 * Get count of pending buildings
 */
export async function getPendingBuildingsCount(): Promise<number> {
  const buildings = await getPendingBuildings();
  return buildings.filter(b => b.syncStatus === 'pending' || b.syncStatus === 'failed').length;
}

/**
 * Save recent customer to local storage
 */
export async function saveRecentCustomer(customer: {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  digitalizationStatus: string;
}): Promise<void> {
  const recentCustomers = await getRecentCustomers();
  
  // Remove if already exists
  const filtered = recentCustomers.filter(c => c.id !== customer.id);
  
  // Add to beginning
  filtered.unshift({
    ...customer,
    timestamp: Date.now(),
  });
  
  // Keep only last 10
  const limited = filtered.slice(0, 10);
  
  await Preferences.set({
    key: STORAGE_KEYS.RECENT_CUSTOMERS,
    value: JSON.stringify(limited),
  });
}

/**
 * Get recent customers from storage
 */
export async function getRecentCustomers(): Promise<Array<{
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  digitalizationStatus: string;
  timestamp: number;
}>> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.RECENT_CUSTOMERS });
  if (!value) return [];
  
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('Failed to parse recent customers:', error);
    return [];
  }
}

/**
 * Update last sync timestamp
 */
export async function updateLastSyncTimestamp(): Promise<void> {
  await Preferences.set({
    key: STORAGE_KEYS.LAST_SYNC,
    value: Date.now().toString(),
  });
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTimestamp(): Promise<number | null> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.LAST_SYNC });
  return value ? parseInt(value, 10) : null;
}

/**
 * Clear all offline data (use with caution)
 */
export async function clearAllOfflineData(): Promise<void> {
  await Preferences.remove({ key: STORAGE_KEYS.PENDING_BUILDINGS });
  await Preferences.remove({ key: STORAGE_KEYS.RECENT_CUSTOMERS });
  await Preferences.remove({ key: STORAGE_KEYS.LAST_SYNC });
}
