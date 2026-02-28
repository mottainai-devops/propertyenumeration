# Backend Instructions for Frontend Developer — v4.0.0

**Date:** February 28, 2026  
**Frontend Version:** v1.36.0 (Build #98)  
**Backend Target Version:** v4.0.0  
**Prepared by:** Frontend AI Agent  
**Audience:** Backend Developer AI  
**Backend Base URL:** `https://upwork.kowope.xyz`

---

## Executive Summary

The frontend is at v1.36.0. Login, session management, building registration, customer search and linking, profile viewing, and password change are all **fully working**. The following 4 endpoints are **fully implemented on the frontend** and are the only remaining blockers. The app will silently fail or show error toasts on those screens until the backend implements them.

**All other endpoints must remain unchanged.** The app is live and working — any breaking change to an existing endpoint will break production.

---

## Critical Rules (Do Not Break)

These are confirmed working in production. Do not modify them.

| Rule | Detail |
|---|---|
| Base64 passwords | Frontend sends `btoa(plainText)`. Backend must decode with `atob()` or equivalent on login AND password change. |
| `multipart/form-data` on building creation | POST /buildings uses FormData with flat `gpsLatitude` / `gpsLongitude` fields (not nested). |
| `Authorization: Bearer <token>` | Every authenticated request sends this header. A 401 response clears the token and redirects to login. |
| Response envelope | All responses must use `{ "success": true, "data": { ... } }`. The frontend parsers depend on this exact nesting. |
| `search` query param | Customer search uses `?search=` (not `?q=` or `?query=`). |
| 409 conflict on session start | Must return `{ "success": false, "details": { "sessionId": "...", "startTime": "...", "lotCode": "..." } }`. |

---

## 4 Endpoints to Implement

### 1. `PATCH /property-enumeration/buildings/:id` — Edit Building

**Called from:** `src/api/client.ts → buildingApi.update()`, triggered by the Building Edit screen (`BuildingEdit.tsx`).

**The `:id` parameter** is the building's `_id` (MongoDB ObjectId string) from the GET /buildings response.

**Request:**
```
PATCH /property-enumeration/buildings/6622b0d1f9f81b0481c7e99f
Content-Type: application/json
Authorization: Bearer <token>
```
```json
{
  "address": "47 Test Street, Lagos",
  "buildingName": "Updated Building Name",
  "propertyType": "commercial",
  "numberOfUnits": 5,
  "landmarkDescription": "Near the market",
  "contactPersonName": "Jane Doe",
  "contactPhoneNumber": "08098765432",
  "notes": "Updated notes"
}
```

All fields are **optional** — only the fields present in the body should be updated (partial update / PATCH semantics). Do not overwrite fields that are absent from the request body.

**Expected response:**
```json
{
  "success": true,
  "data": {
    "building": {
      "_id": "6622b0d1f9f81b0481c7e99f",
      "buildingId": "USRLOT6001",
      "address": "47 Test Street, Lagos",
      "buildingName": "Updated Building Name",
      "lotCode": "LOT-6",
      "propertyType": "commercial",
      "numberOfUnits": 5,
      "gpsLatitude": 6.5244,
      "gpsLongitude": 3.3792,
      "photoUrls": [],
      "unitCode": "R1",
      "arcgisBuildingId": "ARCGIS-BLDG-001",
      "linkedCustomerId": null,
      "linkedCustomerName": null,
      "enumeratedAt": "2026-02-28T10:00:00.000Z",
      "createdAt": "2026-02-28T10:00:00.000Z",
      "updatedAt": "2026-02-28T10:05:00.000Z"
    }
  },
  "message": "Building updated successfully"
}
```

**Error responses:**
- `404` if building not found: `{ "success": false, "message": "Building not found" }`
- `403` if the building belongs to a different user/company: `{ "success": false, "message": "Forbidden" }`

**Notes:**
- The frontend normalises `propertyType` to lowercase before sending on PATCH. Store it as received.
- The `updatedAt` field must be refreshed to the current timestamp.
- Do not allow editing of `lotCode`, `gpsLatitude`, `gpsLongitude`, `unitCode`, `arcgisBuildingId`, `buildingId`, or `userId` via this endpoint.

---

### 2. `DELETE /api/property-enumeration/customers/:customerId/unlink` — Unlink Customer from Building

**Called from:** `src/api/client.ts → customerApi.unlink()`, triggered by the "Unlink" button in `BuildingsList.tsx`.

**The `:customerId` parameter** is the customer's `_id`.

**Request:**
```
DELETE /api/property-enumeration/customers/6622b0d1f9f81b0481c7e99f/unlink
Content-Type: application/json
Authorization: Bearer <token>
```
```json
{
  "buildingId": "USRLOT6001"
}
```

> The `buildingId` in the request body is the **building code** (e.g. `USRLOT6001`), not the MongoDB `_id`. This is consistent with the existing `POST /customers/:id/link` endpoint which also receives the building code.

**The backend must:**
1. Find the customer by `:customerId`.
2. Find the building by the `buildingId` code in the request body.
3. Clear `customer.linkedBuildingId` and `customer.linkedBuildingAddress` on the Customer document.
4. Clear `building.linkedCustomerId` and `building.linkedCustomerName` on the Building document.
5. Return a success response.

**Expected response:**
```json
{
  "success": true,
  "message": "Customer unlinked successfully"
}
```

**Error responses:**
- `404` if customer not found: `{ "success": false, "message": "Customer not found" }`
- `404` if building not found: `{ "success": false, "message": "Building not found" }`

---

### 3. `POST /property-enumeration/buildings/:id/photos` — Add Photos to Existing Building

**Called from:** `src/api/client.ts → buildingApi.addPhotos()`, used in `BuildingPhotoUpload.tsx`.

**The `:id` parameter** is the building's `_id`.

**Request:**
```
POST /property-enumeration/buildings/6622b0d1f9f81b0481c7e99f/photos
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

Form fields:
| Field | Type | Notes |
|---|---|---|
| `photos` | File (multiple) | JPEG/PNG images, up to 4 files, max 5 MB each (frontend compresses before upload) |

**The backend must:**
1. Accept `multipart/form-data` with field name `photos` (multiple files allowed).
2. Upload each file to storage (S3/GridFS/etc.).
3. **Append** the new photo URLs to the building's existing `photoUrls` array (do not replace).
4. Return the updated photo list.

**Expected response:**
```json
{
  "success": true,
  "data": {
    "photoUrls": [
      "https://storage.example.com/buildings/photo1.jpg",
      "https://storage.example.com/buildings/photo2.jpg"
    ],
    "totalPhotos": 2
  },
  "message": "Photos uploaded successfully"
}
```

> **Important:** The frontend reads `response.data.data.photoUrls` and `response.data.data.totalPhotos` from this response — not a full building object. Return exactly this shape.

**Error responses:**
- `404` if building not found: `{ "success": false, "message": "Building not found" }`
- `400` if no files provided: `{ "success": false, "message": "No photos provided" }`

---

### 4. `DELETE /property-enumeration/buildings/:id/photos/:photoRef` — Delete a Photo from Building

**Called from:** `src/api/client.ts → buildingApi.deletePhoto()`, used in `BuildingPhotoUpload.tsx`.

**The `:id` parameter** is the building's `_id`.  
**The `:photoRef` parameter** is a **URL-encoded** photo URL. The frontend calls `encodeURIComponent(photoUrl)` before inserting it into the path.

**Example request:**
```
DELETE /property-enumeration/buildings/6622b0d1f9f81b0481c7e99f/photos/https%3A%2F%2Fstorage.example.com%2Fbuildings%2Fphoto1.jpg
Authorization: Bearer <token>
```

**The backend must:**
1. Decode `:photoRef` using `decodeURIComponent()` to get the original URL string.
2. Find the building by `:id`.
3. Remove the matching URL from the building's `photoUrls` array.
4. Delete the file from storage (S3/GridFS/etc.) if applicable.
5. Return the updated photo list.

**Expected response:**
```json
{
  "success": true,
  "data": {
    "photoUrls": [
      "https://storage.example.com/buildings/photo2.jpg"
    ],
    "totalPhotos": 1
  },
  "message": "Photo deleted successfully"
}
```

> **Important:** Same shape as the add-photos response — the frontend reads `response.data.data.photoUrls` and `response.data.data.totalPhotos`.

**Error responses:**
- `404` if building not found: `{ "success": false, "message": "Building not found" }`
- `404` if photo URL not found in building's array: `{ "success": false, "message": "Photo not found" }`

---

## Integration Checklist for Backend

- [ ] `PATCH /property-enumeration/buildings/:id` — partial update, returns updated Building object
- [ ] `DELETE /api/property-enumeration/customers/:customerId/unlink` — clears link on both Customer and Building documents; accepts `{ buildingId: "<code>" }` in body
- [ ] `POST /property-enumeration/buildings/:id/photos` — appends photos, returns `{ photoUrls, totalPhotos }`
- [ ] `DELETE /property-enumeration/buildings/:id/photos/:photoRef` — `:photoRef` is URL-encoded; decode before use; returns `{ photoUrls, totalPhotos }`

---

## Planned (Not Yet Wired on Frontend)

The following endpoint is not yet called from any UI screen but will be needed for the upcoming Session Detail screen. The backend should plan for it now.

**`GET /property-enumeration/sessions/:sessionId/buildings`**

Expected response:
```json
{
  "success": true,
  "data": {
    "buildings": [ /* Array of Building objects registered in this session */ ]
  }
}
```

---

## Currently Working — Do Not Change

| Endpoint | Status |
|---|---|
| `POST /api/mobile/users/login` | ✅ Working |
| `POST /property-enumeration/buildings` | ✅ Working |
| `GET /property-enumeration/buildings` | ✅ Working (with `arcgisBuildingId` filter) |
| `GET /api/property-enumeration/customers` | ✅ Working |
| `POST /api/property-enumeration/customers/:id/link` | ✅ Working |
| `POST /property-enumeration/sessions/start` | ✅ Working |
| `POST /property-enumeration/sessions/:id/end` | ✅ Working |
| `GET /property-enumeration/sessions` | ✅ Working |
| `GET /property-enumeration/sessions/:id` | ✅ Working |
| `GET /property-enumeration/sessions/statistics` | ✅ Working |
| `GET /api/mobile/users/me` | ✅ Working (v3.0.0) |
| `PATCH /api/mobile/users/me/password` | ✅ Working (v3.0.0) |

---

*Backend Instructions — v4.0.0 | February 28, 2026 | Frontend AI Agent*
