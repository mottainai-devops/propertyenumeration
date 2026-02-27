import { useState } from 'react';
import { buildingApi } from '../api/client';
import type { Building } from '../api/client';

interface BuildingEditProps {
  building: Building;
  onSaved: (updated: Building) => void;
  onClose: () => void;
}

type PropertyType = 'residential' | 'commercial' | 'industrial' | 'mixed-use';

const PROPERTY_TYPES: PropertyType[] = ['residential', 'commercial', 'industrial', 'mixed-use'];

export default function BuildingEdit({ building, onSaved, onClose }: BuildingEditProps) {
  const [address, setAddress] = useState(building.address);
  const [buildingName, setBuildingName] = useState(building.buildingName ?? '');
  const [propertyType, setPropertyType] = useState<PropertyType>(building.propertyType);
  const [numberOfUnits, setNumberOfUnits] = useState(building.numberOfUnits.toString());
  const [notes, setNotes] = useState(building.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!address.trim()) {
      setError('Address is required');
      return;
    }
    const units = parseInt(numberOfUnits, 10);
    if (isNaN(units) || units < 1) {
      setError('Number of units must be at least 1');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await buildingApi.update(building._id, {
        address: address.trim(),
        buildingName: buildingName.trim() || undefined,
        propertyType,
        numberOfUnits: units,
        notes: notes.trim() || undefined,
      });
      onSaved(updated);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to save changes';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Edit Building</h2>
              <p className="text-xs text-gray-500 font-mono">{building._id}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              aria-label="Close"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="px-5 py-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Enter building address"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
            />
          </div>

          {/* Building Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Building / Business Name
            </label>
            <input
              type="text"
              value={buildingName}
              onChange={e => setBuildingName(e.target.value)}
              placeholder="Optional"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
            />
          </div>

          {/* Property Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Property Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PROPERTY_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPropertyType(type)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition capitalize ${
                    propertyType === type
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Number of Units */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Number of Units <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setNumberOfUnits(v => Math.max(1, parseInt(v, 10) - 1).toString())}
                className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center font-bold text-gray-700 text-lg"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                value={numberOfUnits}
                onChange={e => setNumberOfUnits(e.target.value)}
                className="flex-1 text-center px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                type="button"
                onClick={() => setNumberOfUnits(v => (parseInt(v, 10) + 1).toString())}
                className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center font-bold text-gray-700 text-lg"
              >
                +
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes about this building"
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent resize-none"
            />
          </div>

          {/* Read-only fields */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Read-only Fields</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Lot Code</span>
              <span className="font-medium text-gray-800">{building.lotCode}</span>
            </div>
            {building.gpsCoordinates && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">GPS</span>
                <span className="font-medium text-gray-800 font-mono text-xs">
                  {building.gpsCoordinates.latitude.toFixed(6)}, {building.gpsCoordinates.longitude.toFixed(6)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Photos</span>
              <span className="font-medium text-gray-800">{building.photos?.length ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Created</span>
              <span className="font-medium text-gray-800">
                {new Date(building.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-2 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Saving…
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
