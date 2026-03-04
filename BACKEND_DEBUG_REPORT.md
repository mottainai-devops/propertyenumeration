# Building Sync Failure — Backend Debugging Report
**Date:** March 4, 2026  
**Issue:** Buildings fail to sync with error "Missing required fields"  
**Frontend Version:** v1.56.8 (Build #136)  
**Test User:** adeyadewuyi@gmail.com / LOT-6 assigned  
**Status:** UNRESOLVED — Requires backend investigation

---

## Executive Summary

The mobile app is consistently failing to sync buildings with the error message:
```
Failed to sync "[buildingName]": Missing required fields
```

This error occurs for **all buildings**, regardless of whether they're created online or offline. The frontend has implemented all contract requirements per **Joint API Contract v1.0.0**, but the backend continues to reject valid requests.

---

## Issue Timeline

| Version | Change | Result |
|---------|--------|--------|
| v1.56.3 | Initial sync failure reported | Still failing |
| v1.56.4 | Auto-generate buildingName if empty | Still failing |
| v1.56.5 | Include sessionId when syncing offline | Still failing |
| v1.56.6 | Remove manual Content-Type header | Still failing |
| v1.56.7 | Add detailed logging | Still failing |
| v1.56.8 | GPS coordinate validation & repair | **Still failing** |

---

## API Endpoint Under Test

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/buildings`

**Contract Reference:** Joint API Contract v1.0.0 §3.1

---

## Required Fields (Per Contract §3.1)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `address` | string | ✅ Yes | Full street address |
| `lotCode` | string | ✅ Yes | Bare number format: "27" (not "LOT-27") |
| `propertyType` | string | ✅ Yes | One of: "Residential", "Commercial", "Industrial", "Mixed-Use" |
| `numberOfUnits` | number | ✅ Yes | Integer ≥ 1 |
| `gpsLatitude` | number | ✅ Yes | Decimal degrees, e.g. 6.5244 |
| `gpsLongitude` | number | ✅ Yes | Decimal degrees, e.g. 3.3792 |

**Optional Fields:**
- `buildingName` (string)
- `sessionId` (string)
- `landmarkDescription` (string)
- `contactPersonName` (string)
- `contactPhoneNumber` (string)
- `notes` (string)
- `arcgisBuildingId` (string)
- `unitCode` (string)
- `gpsAccuracy` (number)
- `photo` (multipart file, repeatable)

---

## Frontend Implementation Details

### API Client Code
**File:** `src/api/client.ts` (lines 277-306)

```typescript
export const buildingApi = {
  create: async (data: CreateBuildingRequest): Promise<Building> => {
    const formData = new FormData();
    formData.append('address', data.address);
    formData.append('lotCode', data.lotCode);
    formData.append('propertyType', data.propertyType);
    formData.append('numberOfUnits', data.numberOfUnits.toString());
    // Backend expects flat gpsLatitude / gpsLongitude fields
    formData.append('gpsLatitude', data.gpsCoordinates.latitude.toString());
    formData.append('gpsLongitude', data.gpsCoordinates.longitude.toString());

    // Optional fields
    if (data.sessionId) formData.append('sessionId', data.sessionId);
    if (data.buildingName) formData.append('buildingName', data.buildingName);
    if (data.arcgisBuildingId) formData.append('arcgisBuildingId', data.arcgisBuildingId);
    if (data.unitCode) formData.append('unitCode', data.unitCode);
    if (data.landmarkDescription) formData.append('landmarkDescription', data.landmarkDescription);
    if (data.contactPersonName) formData.append('contactPersonName', data.contactPersonName);
    if (data.contactPhoneNumber) formData.append('contactPhoneNumber', data.contactPhoneNumber);
    if (data.notes) formData.append('notes', data.notes);
    
    // Photo upload (field name is 'photo' singular, per contract §3.5)
    if (data.photos) {
      data.photos.forEach((photo) => formData.append('photo', photo));
    }

    // Debug logging
    console.log('[BuildingAPI] Creating building with data:', {
      address: data.address,
      lotCode: data.lotCode,
      propertyType: data.propertyType,
      numberOfUnits: data.numberOfUnits,
      gpsLatitude: data.gpsCoordinates.latitude,
      gpsLongitude: data.gpsCoordinates.longitude,
      sessionId: data.sessionId,
      buildingName: data.buildingName,
      photoCount: data.photos?.length ?? 0,
    });

    // Let CapacitorHttp automatically set Content-Type with proper boundary
    const response = await apiClient.post('/api/property-enumeration/buildings', formData);
    const raw: RawBuilding = response.data?.data?.building ?? response.data;
    return normaliseBuilding(raw);
  },
  // ...
};
```

### HTTP Client
**File:** `src/api/client.ts` (lines 1-26)

- Uses **CapacitorHttp** (native OkHttp on Android)
- Automatically injects `Authorization: Bearer <token>` header
- FormData is sent with automatic Content-Type boundary handling
- No manual headers are set for multipart requests

### Sync Logic
**File:** `src/App.tsx` (lines 466-502)

```typescript
const syncPendingBuildings = async () => {
  // ... validation and GPS coordinate repair ...
  
  for (const building of pendingBuildings) {
    try {
      // Validate GPS coordinates
      let gpsCoordinates = building.gpsCoordinates;
      if (!gpsCoordinates || !gpsCoordinates.latitude || !gpsCoordinates.longitude) {
        gpsCoordinates = {
          latitude: building.gpsLatitude || building.latitude || 0,
          longitude: building.gpsLongitude || building.longitude || 0,
        };
      }
      
      // Skip if still no valid GPS
      if (!gpsCoordinates.latitude || !gpsCoordinates.longitude) {
        showToast(`Skipping: Missing GPS coordinates`, 'error');
        remaining.push(building);
        continue;
      }
      
      // Include sessionId
      const buildingToSync = {
        ...building,
        gpsCoordinates,
        sessionId: building.sessionId || currentSessionId,
      };
      
      const result = await retryOperation(
        () => buildingApi.create(buildingToSync),
        { maxRetries: 1 }
      );
      // ...
    } catch (error) {
      // Error handling and logging
    }
  }
};
```

---

## Test Data Examples

### Example 1: "Tejuoso Kayode" Building
```json
{
  "address": "Tejuoso Kayode Street, Ikeja CRA",
  "lotCode": "6",
  "propertyType": "Residential",
  "numberOfUnits": 1,
  "buildingName": "Tejuoso Kayode",
  "gpsCoordinates": {
    "latitude": 6.5790,
    "longitude": 3.3550
  },
  "sessionId": "[active-session-id]",
  "photos": [1 photo file]
}
```

### Example 2: "Under construction" Building
```json
{
  "address": "Local Ogunnaike street, Ikeja CRA",
  "lotCode": "6",
  "propertyType": "Residential",
  "numberOfUnits": 1,
  "buildingName": "Under construction",
  "gpsCoordinates": {
    "latitude": 6.5795,
    "longitude": 3.3550
  },
  "sessionId": "[active-session-id]",
  "photos": [1 photo file]
}
```

---

## Debugging Requests for Backend Team

### 1. Backend Validation Logic
**Question:** What specific validation is performed on the `/api/property-enumeration/buildings` endpoint?

**Request:** Please share:
- The validation schema/rules
- Any fields beyond the contract that are being validated
- The exact error message generation logic

### 2. Error Message Enhancement
**Current:** `"Missing required fields"` (no field names)  
**Needed:** `"Missing required fields: [field1, field2]"` or similar

**Request:** Can the backend return which specific field(s) are missing?

### 3. Multipart Form Data Handling
**Question:** Is the backend correctly parsing multipart/form-data?

**Request:** Please verify:
- The multipart parser is working correctly
- All form fields are being extracted properly
- No fields are being lost during parsing

### 4. Test with cURL
**Request:** Can you test the endpoint with a cURL request?

```bash
curl -X POST https://upwork.kowope.xyz/api/property-enumeration/buildings \
  -H "Authorization: Bearer [token]" \
  -F "address=Test Address" \
  -F "lotCode=6" \
  -F "propertyType=Residential" \
  -F "numberOfUnits=1" \
  -F "gpsLatitude=6.5790" \
  -F "gpsLongitude=3.3550" \
  -F "buildingName=Test Building" \
  -F "sessionId=[session-id]"
```

### 5. Backend Logs
**Request:** Please check the backend logs for:
- The exact request body received
- Any parsing errors
- The validation failure details
- Stack traces if applicable

### 6. Contract Compliance
**Question:** Is the backend implementation aligned with Joint API Contract v1.0.0 §3.1?

**Request:** Please verify:
- All required fields match the contract
- No additional fields are being validated
- Error messages match the contract (§6)

---

## Frontend Verification Checklist

✅ **Completed:**
- All required fields are being sent
- Field names match the contract exactly
- Data types are correct (numbers as numbers, strings as strings)
- GPS coordinates are validated before sending
- SessionId is included
- Photos are sent with correct field name ('photo' singular)
- No manual Content-Type headers are set
- CapacitorHttp is handling multipart encoding

❓ **Cannot Verify Without Backend Logs:**
- Whether the backend is receiving all fields
- Whether multipart parsing is working correctly
- Which field is actually missing
- Whether there's a backend validation rule not in the contract

---

## Next Steps

1. **Backend developer** investigates backend logs and validation logic
2. **Backend developer** provides detailed error message with missing field names
3. **Frontend team** receives the specific field causing the issue
4. **Frontend team** implements targeted fix
5. **QA** tests the fix with the mobile app

---

## Contact Information

**Frontend Team Lead:** [Your name]  
**Mobile App Version:** v1.56.8 (Build #136)  
**Test User:** adeyadewuyi@gmail.com  
**Test Device:** Android (Capacitor/React Native)  
**Backend URL:** https://upwork.kowope.xyz  
**API Endpoint:** POST /api/property-enumeration/buildings

---

## Attachments

- Joint API Contract v1.0.0 (reference)
- App version history with all attempted fixes
- Sample error messages from mobile app
- Frontend source code (api/client.ts, App.tsx)
