/**
 * Duplicate Detection Service
 * Checks if a building already has registered customers
 * 
 * NOTE: This service requires backend API endpoints to be implemented:
 * 1. GET /api/property-enumeration/buildings/check?buildingId=B001
 *    Response: { exists: boolean, customerCount: number }
 * 
 * 2. GET /api/property-enumeration/customers?buildingId=B001
 *    Response: { customers: Array<{ id: string, name: string, label: string }> }
 */

export interface DuplicateCheckResult {
  exists: boolean;
  customerCount: number;
  customers: Array<{
    id: string;
    name: string;
    label: string; // e.g., "R1", "R2", "B1"
  }>;
}

/**
 * Check if a building already has registered customers
 * 
 * @param buildingId - The building ID to check (e.g., "B001")
 * @returns Promise<DuplicateCheckResult>
 */
export async function checkBuildingDuplicates(
  buildingId: string
): Promise<DuplicateCheckResult> {
  try {
    // TODO: Replace with actual API call when backend is ready
    // const response = await fetch(`/api/property-enumeration/buildings/check?buildingId=${buildingId}`);
    // const data = await response.json();
    
    // MOCK DATA FOR TESTING
    // Simulate some buildings having existing customers
    const mockHasDuplicates = buildingId.endsWith('1') || buildingId.endsWith('5');
    
    if (mockHasDuplicates) {
      return {
        exists: true,
        customerCount: 3,
        customers: [
          { id: '1', name: 'John Residential', label: 'R1' },
          { id: '2', name: 'Jane Residential', label: 'R2' },
          { id: '3', name: 'Acme Business', label: 'B1' },
        ],
      };
    }
    
    return {
      exists: false,
      customerCount: 0,
      customers: [],
    };
  } catch (error) {
    console.error('Error checking building duplicates:', error);
    // Return no duplicates on error to allow user to proceed
    return {
      exists: false,
      customerCount: 0,
      customers: [],
    };
  }
}

/**
 * Get all customers for a specific building
 * 
 * @param buildingId - The building ID (e.g., "B001")
 * @returns Promise<Array<Customer>>
 */
export async function getBuildingCustomers(buildingId: string) {
  try {
    // TODO: Replace with actual API call when backend is ready
    // const response = await fetch(`/api/property-enumeration/customers?buildingId=${buildingId}`);
    // return await response.json();
    
    // MOCK DATA FOR TESTING
    const result = await checkBuildingDuplicates(buildingId);
    return result.customers;
  } catch (error) {
    console.error('Error fetching building customers:', error);
    return [];
  }
}
