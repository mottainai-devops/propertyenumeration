import { useState, useEffect, useRef } from 'react';
import { customerApi, type Customer } from '../api/client';

interface CustomerSearchProps {
  onSelect: (customer: Customer) => void;
  lotCode?: string;
  placeholder?: string;
}

export default function CustomerSearch({ onSelect, lotCode, placeholder = "Search customer by name, address, or phone..." }: CustomerSearchProps) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search customers with debounce
  useEffect(() => {
    if (query.length < 2) {
      setCustomers([]);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const results = await customerApi.search({
          q: query,
          lotCode,
          limit: 20,
        });
        setCustomers(results);
        setShowDropdown(true);
      } catch (err: any) {
        console.error('Customer search error:', err);
        setError(err.response?.data?.message || 'Failed to search customers');
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, lotCode]);

  const handleSelect = (customer: Customer) => {
    setQuery('');
    setCustomers([]);
    setShowDropdown(false);
    onSelect(customer);
  };

  return (
    <div ref={searchRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (customers.length > 0) {
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-base"
        />
        
        {/* Search Icon / Loading Spinner */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
        <div className="mt-2 p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Dropdown Results */}
      {showDropdown && customers.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-80 overflow-y-auto">
          {customers.map((customer) => (
            <button
              key={customer._id}
              onClick={() => handleSelect(customer)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{customer.customerName}</div>
                  <div className="text-sm text-gray-600 mt-1">{customer.address}</div>
                  {customer.phoneNumber && (
                    <div className="text-sm text-gray-500 mt-1">{customer.phoneNumber}</div>
                  )}
                </div>
                <div className="ml-4 flex flex-col items-end">
                  <div className="text-xs font-mono text-gray-500">{customer.customerId}</div>
                  {customer.isDigitalized && (
                    <div className="mt-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      Linked
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {showDropdown && !loading && query.length >= 2 && customers.length === 0 && !error && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 text-center text-gray-500">
          No customers found for "{query}"
        </div>
      )}

      {/* Hint */}
      {query.length > 0 && query.length < 2 && (
        <div className="mt-2 text-sm text-gray-500">
          Type at least 2 characters to search...
        </div>
      )}
    </div>
  );
}
