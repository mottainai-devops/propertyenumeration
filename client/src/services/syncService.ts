import { Network } from '@capacitor/network';
import {
  getPendingBuildings,
  updateBuildingSyncStatus,
  removeSyncedBuilding,
  updateLastSyncTimestamp,
} from './offlineStorage';
import { buildingApi, customerApi } from '../api/client';

export type SyncStatus = 'online' | 'offline' | 'syncing';
export type SyncResult = {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ buildingId: string; error: string }>;
};

let syncInProgress = false;
let networkListenerAdded = false;

/**
 * Get current network status
 */
export async function getNetworkStatus(): Promise<SyncStatus> {
  const status = await Network.getStatus();
  return status.connected ? 'online' : 'offline';
}

/**
 * Start monitoring network status and auto-sync
 */
export function startNetworkMonitoring(onStatusChange?: (status: SyncStatus) => void): void {
  if (networkListenerAdded) return;
  
  Network.addListener('networkStatusChange', async (status) => {
    const syncStatus: SyncStatus = status.connected ? 'online' : 'offline';
    
    if (onStatusChange) {
      onStatusChange(syncStatus);
    }
    
    // Auto-sync when network is restored
    if (status.connected && !syncInProgress) {
      console.log('Network restored, starting auto-sync...');
      await syncPendingBuildings();
    }
  });
  
  networkListenerAdded = true;
}

/**
 * Stop monitoring network status
 */
export async function stopNetworkMonitoring(): Promise<void> {
  await Network.removeAllListeners();
  networkListenerAdded = false;
}

/**
 * Sync all pending buildings to the backend
 */
export async function syncPendingBuildings(
  onProgress?: (current: number, total: number) => void
): Promise<SyncResult> {
  if (syncInProgress) {
    console.log('Sync already in progress');
    return { success: false, synced: 0, failed: 0, errors: [{ buildingId: '', error: 'Sync already in progress' }] };
  }
  
  const networkStatus = await getNetworkStatus();
  if (networkStatus === 'offline') {
    console.log('Cannot sync: offline');
    return { success: false, synced: 0, failed: 0, errors: [{ buildingId: '', error: 'No network connection' }] };
  }
  
  syncInProgress = true;
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };
  
  try {
    const pendingBuildings = await getPendingBuildings();
    const buildingsToSync = pendingBuildings.filter(
      b => b.syncStatus === 'pending' || b.syncStatus === 'failed'
    );
    
    console.log(`Syncing ${buildingsToSync.length} pending buildings...`);
    
    for (let i = 0; i < buildingsToSync.length; i++) {
      const building = buildingsToSync[i];
      
      if (onProgress) {
        onProgress(i + 1, buildingsToSync.length);
      }
      
      try {
        await updateBuildingSyncStatus(building.id, 'syncing');
        
        // Convert base64 photos to File
        const photoFiles = building.data.photos.map((base64, idx) => {
          const byteString = atob(base64.split(',')[1]);
          const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let j = 0; j < byteString.length; j++) {
            ia[j] = byteString.charCodeAt(j);
          }
          const blob = new Blob([ab], { type: mimeString });
          const extension = mimeString.split('/')[1];
          return new File([blob], `photo_${idx + 1}.${extension}`, { type: mimeString });
        });
        
        // Register building
        const buildingResponse = await buildingApi.create({
          address: building.data.address,
          lotCode: building.data.lotCode,
          propertyType: building.data.propertyType as 'residential' | 'commercial' | 'industrial' | 'institutional',
          gpsCoordinates: building.data.gpsCoordinates,
          contactName: building.data.contactName,
          contactPhone: building.data.contactPhone,
          photos: photoFiles,
        });
        
        // Link customer if provided
        if (building.data.customerId && buildingResponse.buildingId) {
          await customerApi.link(building.data.customerId, { buildingId: buildingResponse.buildingId });
        }
        
        // Remove from queue
        await removeSyncedBuilding(building.id);
        result.synced++;
        
        console.log(`Successfully synced building ${building.id}`);
      } catch (error: any) {
        console.error(`Failed to sync building ${building.id}:`, error);
        
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        await updateBuildingSyncStatus(building.id, 'failed', errorMessage);
        
        result.failed++;
        result.errors.push({
          buildingId: building.id,
          error: errorMessage,
        });
        
        // Stop syncing if too many failures (network might be unstable)
        if (result.failed >= 3) {
          console.log('Too many failures, stopping sync');
          result.success = false;
          break;
        }
      }
    }
    
    if (result.synced > 0) {
      await updateLastSyncTimestamp();
    }
    
    console.log(`Sync complete: ${result.synced} synced, ${result.failed} failed`);
  } catch (error: any) {
    console.error('Sync failed:', error);
    result.success = false;
    result.errors.push({
      buildingId: '',
      error: error.message || 'Unknown error',
    });
  } finally {
    syncInProgress = false;
  }
  
  return result;
}

/**
 * Check if sync is currently in progress
 */
export function isSyncInProgress(): boolean {
  return syncInProgress;
}
