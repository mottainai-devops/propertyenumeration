import { useState } from 'react';
import { formatFileSize } from '../utils/photoUtils';

interface PendingBuilding {
  address: string;
  buildingName?: string;
  lotCode: string;
  propertyType: string;
  numberOfUnits: number;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  photos?: File[];
  notes?: string;
  timestamp: number;
}

interface OfflineQueueProps {
  pendingBuildings: PendingBuilding[];
  onSync: () => Promise<void>;
  onRemove: (index: number) => void;
  onClose: () => void;
  isSyncing: boolean;
}

export default function OfflineQueue({
  pendingBuildings,
  onSync,
  onRemove,
  onClose,
  isSyncing,
}: OfflineQueueProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                aria-label="Close"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Offline Queue</h2>
                <p className="text-sm text-gray-600">{pendingBuildings.length} pending building{pendingBuildings.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {pendingBuildings.length > 0 && (
              <button
                onClick={onSync}
                disabled={isSyncing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Syncing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync All
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {pendingBuildings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">All Synced!</h3>
              <p className="text-gray-600">No pending buildings in offline queue</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-yellow-900">Offline Mode</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      These buildings were registered offline and will be synced when internet connection is restored.
                    </p>
                  </div>
                </div>
              </div>

              {/* Building List */}
              {pendingBuildings.map((building, index) => (
                <div
                  key={index}
                  className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition"
                >
                  {/* Building Header */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleExpand(index)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-500 uppercase">#{index + 1}</span>
                          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                            Pending
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 mb-1">
                          {building.buildingName || building.address}
                        </h3>
                        {building.buildingName && (
                          <p className="text-sm text-gray-600 mb-1">{building.address}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatTimestamp(building.timestamp)}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {building.propertyType}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            {building.numberOfUnits} unit{building.numberOfUnits > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(index);
                          }}
                          className="p-2 hover:bg-red-50 rounded-lg transition text-red-600"
                          aria-label="Remove from queue"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${expandedIndex === index ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedIndex === index && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
                      {/* GPS Coordinates */}
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">GPS Coordinates</p>
                        <p className="text-sm text-gray-600">
                          Lat: {building.gpsCoordinates.latitude.toFixed(6)}, Lng: {building.gpsCoordinates.longitude.toFixed(6)}
                          {building.gpsCoordinates.accuracy && ` (±${building.gpsCoordinates.accuracy.toFixed(0)}m)`}
                        </p>
                      </div>

                      {/* Lot Code */}
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">Lot Code</p>
                        <p className="text-sm text-gray-600">{building.lotCode}</p>
                      </div>

                      {/* Photos */}
                      {building.photos && building.photos.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-2">
                            Photos ({building.photos.length})
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {building.photos.map((photo, photoIndex) => (
                              <div key={photoIndex} className="relative aspect-square">
                                <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded-b-lg text-center">
                                  {formatFileSize(photo.size)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {building.notes && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-1">Notes</p>
                          <p className="text-sm text-gray-600">{building.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
