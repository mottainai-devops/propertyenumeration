import { useState, useEffect } from 'react';

interface Lot {
  lotCode: string;
  lotName: string;
  companyName?: string; // Optional, for admin/cherry_picker roles
}

interface LotDropdownProps {
  value: string;
  onChange: (lotCode: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

export default function LotDropdown({
  value,
  onChange,
  label = 'Select Lot',
  required = true,
  className = '',
}: LotDropdownProps) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAssignedLots();
  }, []);

  const loadAssignedLots = () => {
    try {
      const storedLots = localStorage.getItem('assignedLots');
      if (storedLots) {
        const parsedLots: Lot[] = JSON.parse(storedLots);
        setLots(parsedLots);
        
        // Auto-select if only one lot and no value is set
        if (parsedLots.length === 1 && !value) {
          onChange(parsedLots[0].lotCode);
        }
      } else {
        setError('No lots assigned to your account');
      }
    } catch (err) {
      console.error('Error loading assigned lots:', err);
      setError('Failed to load assigned lots');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
            {required && <span className="text-red-500"> *</span>}
          </label>
        )}
        <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
          Loading lots...
        </div>
      </div>
    );
  }

  if (error || lots.length === 0) {
    return (
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
            {required && <span className="text-red-500"> *</span>}
          </label>
        )}
        <div className="w-full px-4 py-3 border border-red-300 rounded-lg bg-red-50 text-red-700">
          {error || 'No lots assigned to your account'}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
      >
        <option value="">Select a lot...</option>
        {lots.map((lot) => (
          <option key={lot.lotCode} value={lot.lotCode}>
            {lot.lotCode} - {lot.lotName}
            {lot.companyName ? ` (${lot.companyName})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
