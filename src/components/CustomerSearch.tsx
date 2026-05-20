import { useState, useEffect, useRef } from 'react';
import { customerApi, type Customer } from '../api/client';

interface CustomerSearchProps {
  onSelect: (customer: Customer) => void;
  placeholder?: string;
}

export default function CustomerSearch({ onSelect, placeholder = 'Search customers by name, phone, or address...' }: CustomerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        // Read companyId from stored user to enforce data segregation
        let companyId: string | undefined;
        try {
          const u = JSON.parse(localStorage.getItem('user') || '{}');
          companyId =
            u.companyId ||
            u.ownerCompanyId ||
            u.company?.companyId ||
            undefined;
        } catch { /* ignore */ }
        const customers = await customerApi.search({ query: query.trim(), limit: 10, companyId });
        setResults(customers);
        setShowDropdown(true);
      } catch (err: any) {
        const httpStatus: number = err?.httpStatus ?? err?.response?.status ?? 0;
        const errMsg: string = err?.message || 'unknown';
        console.error('[CustomerSearch] search error:', `HTTP:${httpStatus} | ${errMsg}`);
        // Show a helpful message distinguishing API errors from "no data yet"
        if (httpStatus === 403 || errMsg.toLowerCase().includes('forbidden')) {
          setError('Access denied — contact your administrator to set up customer data.');
        } else if (httpStatus === 401) {
          setError('Session expired — please log out and log in again.');
        } else if (httpStatus === 0 || errMsg.toLowerCase().includes('network')) {
          setError('No internet connection. You can continue without linking.');
        } else {
          setError('Could not load customers. Try again or continue without linking.');
        }
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        
        {/* Search Icon or Loading Spinner */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Dropdown Results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map((customer) => (
            <button
              key={customer._id}
              onClick={() => handleSelect(customer)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{customer.name ?? customer.customerName}</div>
              <div className="text-sm text-gray-600 mt-1">
                {(customer.phone ?? customer.phoneNumber) && <span className="mr-3">📞 {customer.phone ?? customer.phoneNumber}</span>}
                {customer.address && <span>📍 {customer.address}</span>}
              </div>
              {customer.linkedBuildingId && (
                <div className="text-xs text-green-600 mt-1">
                  ✓ Linked to: {customer.linkedBuildingAddress || 'Building'}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {showDropdown && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-4 text-center">
          <p className="text-sm text-gray-700 font-medium mb-1">No customers found for &ldquo;{query}&rdquo;</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            This searches the registered customer database. If the customer exists only in the field map data, they won&rsquo;t appear here — you can continue without linking and register them as a new customer.
          </p>
        </div>
      )}
    </div>
  );
}
