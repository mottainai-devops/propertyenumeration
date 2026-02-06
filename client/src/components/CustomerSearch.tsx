import { useState, useEffect, useRef } from 'react';
import { customerApi, type Customer } from '../api/client';
import { getRecentCustomers, saveRecentCustomer } from '../services/offlineStorage';

interface CustomerSearchProps {
  onSelect: (customer: Customer) => void;
  lotCode?: string;
  placeholder?: string;
}

type DigitalizationFilter = 'all' | 'digitalized' | 'not_digitalized';
type PropertyTypeFilter = 'all' | 'residential' | 'commercial' | 'mixed';

export default function CustomerSearch({ onSelect, lotCode, placeholder = "Search customer by name, address, or phone..." }: CustomerSearchProps) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digitalizationFilter, setDigitalizationFilter] = useState<DigitalizationFilter>('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<PropertyTypeFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load recent customers on mount
  useEffect(() => {
    loadRecentCustomers();
  }, []);

  const loadRecentCustomers = async () => {
    try {
      const recent = await getRecentCustomers();
      setRecentCustomers(recent);
    } catch (error) {
      console.error('Failed to load recent customers:', error);
    }
  };

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
          digitalizationStatus: digitalizationFilter !== 'all' ? digitalizationFilter : undefined,
          propertyType: propertyTypeFilter !== 'all' ? propertyTypeFilter : undefined,
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
  }, [query, lotCode, digitalizationFilter, propertyTypeFilter]);

  const handleSelect = async (customer: Customer) => {
    setQuery('');
    setCustomers([]);
    setShowDropdown(false);
    
    // Save to recent customers
    await saveRecentCustomer({
      id: customer._id,
      name: customer.customerName,
      address: customer.address,
      phoneNumber: customer.phoneNumber || '',
      digitalizationStatus: customer.isDigitalized ? 'digitalized' : 'not_digitalized',
    });
    
    // Reload recent customers
    await loadRecentCustomers();
    
    onSelect(customer);
  };

  const clearFilters = () => {
    setDigitalizationFilter('all');
    setPropertyTypeFilter('all');
  };

  const hasActiveFilters = digitalizationFilter !== 'all' || propertyTypeFilter !== 'all';

  return (
    <div ref={searchRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (customers.length > 0 || recentCustomers.length > 0) {
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-24 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-base"
        />
        
        {/* Filter Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute right-12 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
            hasActiveFilters ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-gray-100'
          }`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
        
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

      {/* Filter Panel */}
      {showFilters && (
        <div className="mt-2 p-4 bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>
          
          {/* Digitalization Status Filter */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Digitalization Status</label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'digitalized', 'not_digitalized'] as DigitalizationFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDigitalizationFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    digitalizationFilter === filter
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter === 'digitalized' ? 'Linked' : 'Not Linked'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Property Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'residential', 'commercial', 'mixed'] as PropertyTypeFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPropertyTypeFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                    propertyTypeFilter === filter
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && !showFilters && (
        <div className="mt-2 flex flex-wrap gap-2">
          {digitalizationFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700">
              {digitalizationFilter === 'digitalized' ? 'Linked' : 'Not Linked'}
              <button
                onClick={() => setDigitalizationFilter('all')}
                className="ml-2 hover:text-blue-900"
              >
                ×
              </button>
            </span>
          )}
          {propertyTypeFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-700 capitalize">
              {propertyTypeFilter}
              <button
                onClick={() => setPropertyTypeFilter('all')}
                className="ml-2 hover:text-purple-900"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Dropdown Results */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
          {/* Recent Customers Section */}
          {query.length < 2 && recentCustomers.length > 0 && (
            <div className="border-b border-gray-200">
              <div className="px-4 py-2 bg-gray-50 text-sm font-semibold text-gray-700">
                Recent Customers
              </div>
              {recentCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelect({
                    _id: customer.id,
                    customerName: customer.name,
                    address: customer.address,
                    phoneNumber: customer.phoneNumber,
                    customerId: customer.id,
                    isDigitalized: customer.digitalizationStatus === 'digitalized',
                  } as Customer)}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-900">{customer.name}</div>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Recent</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{customer.address}</div>
                      {customer.phoneNumber && (
                        <div className="text-sm text-gray-500 mt-1">{customer.phoneNumber}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* Search Results */}
          {customers.length > 0 && (
            <>
              {recentCustomers.length > 0 && query.length >= 2 && (
                <div className="px-4 py-2 bg-gray-50 text-sm font-semibold text-gray-700">
                  Search Results
                </div>
              )}
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
            </>
          )}
          
          {/* No Results */}
          {query.length >= 2 && customers.length === 0 && !loading && !error && (
            <div className="p-4 text-center text-gray-500">
              No customers found for "{query}"
            </div>
          )}
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
