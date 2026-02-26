# Backend API Specification for Duplicate Detection

## Overview
This document specifies the backend API endpoints required to support duplicate detection in the Property Enumeration mobile app. These endpoints check if a building already has registered customers and retrieve customer details.

## Base URL
```
https://your-backend-api.com/api/property-enumeration
```

## Authentication
All endpoints require JWT authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### 1. Check Building for Existing Customers

**Endpoint**: `GET /buildings/check`

**Description**: Checks if a building already has registered customers.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `buildingId` | string | Yes | The building ID to check (e.g., "B001") |

**Response** (200 OK):
```json
{
  "exists": true,
  "customerCount": 3,
  "buildingId": "B001",
  "lastUpdated": "2026-02-26T10:30:00Z"
}
```

**Response Fields**:
- `exists` (boolean): Whether the building has any registered customers
- `customerCount` (number): Total number of customers registered for this building
- `buildingId` (string): The building ID that was checked
- `lastUpdated` (string): ISO 8601 timestamp of last customer registration

**Error Responses**:
- `400 Bad Request`: Missing or invalid buildingId parameter
- `401 Unauthorized`: Invalid or missing JWT token
- `404 Not Found`: Building ID does not exist in the system
- `500 Internal Server Error`: Server error

---

### 2. Get Building Customers

**Endpoint**: `GET /customers`

**Description**: Retrieves all customers registered for a specific building.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `buildingId` | string | Yes | The building ID (e.g., "B001") |

**Response** (200 OK):
```json
{
  "buildingId": "B001",
  "customerCount": 3,
  "customers": [
    {
      "id": "cust-001",
      "name": "John Residential",
      "label": "R1",
      "type": "residential",
      "registeredAt": "2026-02-20T14:30:00Z",
      "registeredBy": "supervisor@example.com"
    },
    {
      "id": "cust-002",
      "name": "Jane Residential",
      "label": "R2",
      "type": "residential",
      "registeredAt": "2026-02-21T09:15:00Z",
      "registeredBy": "supervisor@example.com"
    },
    {
      "id": "cust-003",
      "name": "Acme Business",
      "label": "B1",
      "type": "business",
      "registeredAt": "2026-02-22T16:45:00Z",
      "registeredBy": "admin@example.com"
    }
  ]
}
```

**Response Fields**:
- `buildingId` (string): The building ID
- `customerCount` (number): Total number of customers
- `customers` (array): List of customer objects
  - `id` (string): Unique customer ID
  - `name` (string): Customer name or business name
  - `label` (string): Customer label (e.g., "R1", "R2", "B1")
  - `type` (string): Customer type ("residential" or "business")
  - `registeredAt` (string): ISO 8601 timestamp of registration
  - `registeredBy` (string): Email of user who registered this customer

**Error Responses**:
- `400 Bad Request`: Missing or invalid buildingId parameter
- `401 Unauthorized`: Invalid or missing JWT token
- `404 Not Found`: Building ID does not exist or has no customers
- `500 Internal Server Error`: Server error

---

## Database Schema Requirements

### Buildings Table
Add the following column to the `buildings` table:

```sql
ALTER TABLE buildings ADD COLUMN polygon_geometry JSON;
```

**Column Description**:
- `polygon_geometry`: Stores GeoJSON polygon geometry from ArcGIS
- Example value:
```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [3.3549, 6.5795],
      [3.3550, 6.5795],
      [3.3550, 6.5796],
      [3.3549, 6.5796],
      [3.3549, 6.5795]
    ]
  ]
}
```

### Customers Table
Add the following column to the `customers` table:

```sql
ALTER TABLE customers ADD COLUMN label VARCHAR(10);
```

**Column Description**:
- `label`: Customer label for display (e.g., "R1", "R2", "B1")
- Format: `[R|B][number]` where R = Residential, B = Business
- Auto-generated on customer creation based on existing customers in the same building

**Label Generation Logic**:
1. Query existing customers for the building
2. Count residential customers → Next label is `R{count+1}`
3. Count business customers → Next label is `B{count+1}`
4. Example: If building has R1, R2, B1 → Next residential is R3, next business is B2

---

## Frontend Integration

The frontend already has placeholder code ready for integration:

**Service**: `client/src/services/duplicateDetectionService.ts`
- Replace mock data with actual API calls
- Uncomment `fetch()` calls and update URLs

**Component**: `client/src/components/DuplicateWarningDialog.tsx`
- Already displays duplicate warning with customer list
- No changes needed

**Integration**: `client/src/App.tsx`
- Already calls `checkBuildingDuplicates()` on location confirm
- Shows warning dialog if duplicates exist
- Allows user to continue or cancel

---

## Testing Checklist

### Backend Testing
- [ ] Test `/buildings/check` with existing building (should return exists: true)
- [ ] Test `/buildings/check` with new building (should return exists: false)
- [ ] Test `/buildings/check` with invalid buildingId (should return 404)
- [ ] Test `/customers` with building that has customers (should return list)
- [ ] Test `/customers` with building that has no customers (should return empty array)
- [ ] Test authentication (should return 401 without valid JWT)

### Frontend Testing
- [ ] Select building with existing customers (should show warning dialog)
- [ ] Click "Cancel" in warning dialog (should close dialog, stay on map)
- [ ] Click "Continue Anyway" in warning dialog (should open BuildingForm)
- [ ] Select building with no customers (should open BuildingForm directly)
- [ ] Verify customer labels display correctly in warning dialog
- [ ] Verify customer count is accurate

### Integration Testing
- [ ] Register first customer in building (should get label R1 or B1)
- [ ] Register second customer in same building (should trigger warning)
- [ ] Verify labels increment correctly (R1, R2, R3 or B1, B2, B3)
- [ ] Test with multiple building types (residential, business, mixed)

---

## Implementation Priority

1. **High Priority** (Required for v1.9.0):
   - ✅ Frontend duplicate detection UI (completed)
   - ⏳ Backend `/buildings/check` endpoint
   - ⏳ Backend `/customers` endpoint
   - ⏳ Database schema updates (polygon_geometry, label columns)

2. **Medium Priority** (v1.10.0):
   - Label auto-generation logic
   - Customer label display in map polygons
   - Reverse geocoding for address lookup

3. **Low Priority** (Future):
   - Bulk duplicate detection for entire lot
   - Duplicate resolution workflow
   - Customer merge functionality

---

## Example Implementation (Node.js/Express)

```javascript
// GET /api/property-enumeration/buildings/check
app.get('/api/property-enumeration/buildings/check', authenticateJWT, async (req, res) => {
  const { buildingId } = req.query;
  
  if (!buildingId) {
    return res.status(400).json({ error: 'buildingId parameter is required' });
  }
  
  try {
    // Check if building exists
    const building = await db.query('SELECT * FROM buildings WHERE building_id = ?', [buildingId]);
    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }
    
    // Count customers for this building
    const customers = await db.query('SELECT COUNT(*) as count FROM customers WHERE building_id = ?', [buildingId]);
    const customerCount = customers[0].count;
    
    // Get last updated timestamp
    const lastCustomer = await db.query('SELECT MAX(created_at) as lastUpdated FROM customers WHERE building_id = ?', [buildingId]);
    
    res.json({
      exists: customerCount > 0,
      customerCount,
      buildingId,
      lastUpdated: lastCustomer[0].lastUpdated || null
    });
  } catch (error) {
    console.error('Error checking building:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/property-enumeration/customers
app.get('/api/property-enumeration/customers', authenticateJWT, async (req, res) => {
  const { buildingId } = req.query;
  
  if (!buildingId) {
    return res.status(400).json({ error: 'buildingId parameter is required' });
  }
  
  try {
    // Get all customers for this building
    const customers = await db.query(`
      SELECT 
        id,
        name,
        label,
        customer_type as type,
        created_at as registeredAt,
        created_by as registeredBy
      FROM customers 
      WHERE building_id = ?
      ORDER BY created_at ASC
    `, [buildingId]);
    
    res.json({
      buildingId,
      customerCount: customers.length,
      customers
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## Notes

- The frontend uses **mock data** for testing until backend endpoints are ready
- Mock data simulates buildings ending in "1" or "5" having 3 existing customers
- Replace mock data in `duplicateDetectionService.ts` once backend is deployed
- Ensure CORS is configured to allow requests from the mobile app domain
- Consider rate limiting to prevent abuse of duplicate checking endpoint
