/**
 * Duplicate Warning Dialog
 * Shows warning when user selects a building that already has registered customers
 */

import React from 'react';
import type { DuplicateCheckResult } from '../services/duplicateDetectionService';

interface DuplicateWarningDialogProps {
  open: boolean;
  buildingId: string;
  duplicateInfo: DuplicateCheckResult | null;
  onContinue: () => void;
  onCancel: () => void;
}

export default function DuplicateWarningDialog({
  open,
  buildingId,
  duplicateInfo,
  onContinue,
  onCancel,
}: DuplicateWarningDialogProps) {
  if (!duplicateInfo || !duplicateInfo.exists) {
    return null;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 text-yellow-700 mb-2">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-xl font-bold">Building Already Registered</h2>
          </div>
          <p className="text-sm text-gray-600">
            This building (<strong>{buildingId}</strong>) already has{' '}
            <strong>{duplicateInfo.customerCount}</strong> registered customer(s).
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm font-semibold mb-2 text-gray-700">Existing Customers:</p>
          <ul className="space-y-2 mb-4">
            {duplicateInfo.customers.map((customer) => (
              <li
                key={customer.id}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200"
              >
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                  {customer.label}
                </span>
                <span className="text-sm text-gray-800">{customer.name}</span>
              </li>
            ))}
          </ul>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> Registering another customer in this building may indicate a
              duplicate entry. Please verify before continuing.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
