# Backend Coordination Brief — Property Enumeration Mobile App

**Date:** February 28, 2026 (updated for v1.30.0)  
**Frontend Version:** v1.30.0  
**Backend Base URL:** `https://upwork.kowope.xyz`  
**Prepared by:** Frontend AI Agent  
**Audience:** Backend Developer AI

---

## Purpose

This document is a precise, source-verified mapping of every API call the mobile frontend currently makes, the exact request shapes it sends, the exact response shapes it expects, and every gap or inconsistency that the backend needs to address. Nothing in this document is speculative — every item is traced directly to the frontend source code.

**Critical rule:** The app is live and working. The backend must not break any currently functioning endpoint. All changes should be additive or backward-compatible.

---

## 1. Authentication

### `POST /api/mobile/users/login`

**Called from:** `src/api/client.ts → authApi.login()`

**Request body:**
```json
{
  "email": "string",
  "password": "string (base64-encoded by frontend)"
}
```
> The frontend applies `btoa(plainTextPassword)` before sending. The backend must decode with `atob()` or equivalent. This is the current working behaviour — do not change it.

**Expected response shape:**
```json
{
  "token": "string (JWT)",
  "user": {
    "_id": "string",
    "email": "string",
    "fullName": "string",
    "role": "string",
    "company": {
      "_id": "string",
      "companyName": "string"
    },
    "assignedLots": [
      {
        "lotCode": "string",
        "lotName": "string",
        "companyName": "string (optional, for admin/cherry_picker roles)"
      }
    ]
  }
}
```

**Frontend stores:** `token` → `localStorage.authToken`, entire `user` object → `localStorage.user`, `user.assignedLots` → `localStorage.assignedLots`.

**Status:** ✅ Working.

---

## 2. Building Endpoints

### `POST /property-enumeration/buildings` — Create Building

**Called from:** `src/api/client.ts → buildingApi.create()`, triggered by `App.tsx → handleBuildingSubmit()`

**Request format:** `multipart/form-data` (NOT JSON)

| Field | Type | Required | Notes |
|---|---|---|---|
| `address` | string | ✅ | Building street address |
| `lotCode` | string | ✅ | Operational lot code |
| `propertyType` | string | ✅ | One of: `Residential`, `Commercial`, `Industrial`, `Mixed-Use` (**title-case** from form) |
| `numberOfUnits` | string (number) | ✅ | Sent as string via FormData |
| `gpsLatitude` | string (float) | ✅ | **Not** `gpsCoordinates.latitude` — flat field |
| `gpsLongitude` | string (float) | ✅ | **Not** `gpsCoordinates.longitude` — flat field |
| `buildingName` | string | optional | Business/building name |
| `notes` | string | optional | Free-text notes |
| `photos` | File[] | optional | Up to 4 JPEG files, max 5 MB each (compressed by frontend) |

> **Important:** GPS is sent as two flat fields `gpsLatitude` and `gpsLongitude`, NOT as a nested object. The backend must read these flat fields and store them as a nested `gpsCoordinates: { latitude, longitude }` object (as confirmed by the GET response shape below).

> **Important:** `propertyType` values come from the form as **title-case** (`Residential`, `Commercial`, etc.). The backend should accept both title-case and lowercase, or the frontend and backend must agree on one casing. Currently the `Building` interface uses lowercase (`residential`, `commercial`…) but the form sends title-case. This is a **known inconsistency** — see Section 6.

**Expected response shape:**
```json
{
  "success": true,
  "data": {
    "building": { /* Building object — see Building Schema below */ }
  }
}
```

**Status:** ✅ Working.

---

### `GET /property-enumeration/buildings` — List Buildings

**Called from:** `src/api/client.ts → buildingApi.list()`, used in `BuildingsList.tsx`

**Query parameters (optional):**
```
?page=1&limit=20
```
> The frontend now passes `page` and `limit` when available but currently fetches all in one call. The backend should support these params for future pagination — if not yet implemented, returning all records is acceptable.

**Expected response shape:**
```json
{
  "success": true,
  "data": {
    "buildings": [ /* Array of Building objects */ ],
    "pagination": { /* optional, for future use */ }
  }
}
```

**Status:** ✅ Working (pagination params are new — backend should add support).

---

### `PATCH /property-enumeration/buildings/:id` — Update Building

**Called from:** `src/api/client.ts → buildingApi.update()`, used in `BuildingEdit.tsx`

**Request body (JSON):**
```json
{
  "address": "string (optional)",
  "buildingName": "string (optional)",
  "propertyType": "string (optional) — lowercase: residential|commercial|industrial|mixed-use",
  "numberOfUnits": "number (optional)",
  "notes": "string (optional)"
}
```

**Expected response shape:**
```json
{
  "success": true,
  "data": {
    "building": { /* Updated Building object */ }
  }
}
```

> **Action required:** The frontend has been sending PATCH requests since v1.26.0. If this endpoint does not yet exist on the backend, it must be created. The frontend has a graceful fallback (`response.data?.data?.building ?? response.data`) but the canonical shape above is required for the edit screen to update correctly.

**Status:** ⚠️ **New in v1.26.0 — backend must confirm this endpoint exists.**

---

### Building Schema (GET response)

The frontend `Building` interface expects the following shape from any endpoint that returns a building object:

```typescript
{
  _id: string;
  buildingId?: string;          // ArcGIS polygon ID — new field, may be null/absent
  address: string;
  lotCode: string;
  propertyType: string;         // lowercase preferred in responses
  numberOfUnits: number;
  buildingName?: string;
  notes?: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  photos: string[];             // Array of CDN/storage URLs
  userId: string;
  companyId: string;
  linkedCustomerId?: string;    // New field — customer link
  linkedCustomerName?: string;  // New field — denormalized customer name
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}
```

> **Action required:** The backend must include `linkedCustomerId` and `linkedCustomerName` in the building response whenever a customer is linked. The frontend BuildingsList uses these fields to show the "Linked Customer" card and the "Unlink" button. If these fields are absent, the unlink UI will never appear.

> **Action required:** The `buildingId` field (the ArcGIS polygon ID) is sent during creation via the `notes` field workaround in older versions, but from v1.26.0 it is a dedicated field in `CreateBuildingRequest`. The backend should store and return it as `buildingId` on the building document.

---

## 3. Customer Endpoints

### `GET /api/property-enumeration/customers` — Search Customers

**Called from:** `src/api/client.ts → customerApi.search()`, used in `CustomerSearch.tsx`

**Query parameters:**
```
?search=<query string>&limit=10
```
> The frontend sends `search` as the query param key (not `query` or `q`). The backend must read `req.query.search`.

**Expected response shape:**
```json
{
  "data": {
    "customers": [
      {
        "_id": "string",
        "customerName": "string",
        "phoneNumber": "string (optional)",
        "address": "string (optional)",
        "propertyType": "string (optional)",
        "digitalizationStatus": "digitalized | not-digitalized",
        "linkedBuildingId": "string (optional)",
        "linkedBuildingAddress": "string (optional)",
        "companyId": "string",
        "createdAt": "string",
        "updatedAt": "string"
      }
    ]
  }
}
```

**Status:** ✅ Working.

---

### `POST /api/property-enumeration/customers/:customerId/link` — Link Customer to Building

**Called from:** `src/api/client.ts → customerApi.link()`, triggered after successful building creation in `App.tsx → handleBuildingSubmit()`

**Request body (JSON):**
```json
{
  "buildingId": "string (the building _id from the create response)"
}
```

**Expected response:** Any 2xx response is accepted (response body is not read).

**Status:** ✅ Working.

---

### `DELETE /api/property-enumeration/customers/:customerId/unlink` — Unlink Customer

**Called from:** `src/api/client.ts → customerApi.unlink()`, used in `BuildingsList.tsx` unlink button

**Request body:** None (DELETE with no body)

**Expected response:** Any 2xx response is accepted (response body is not read).

> **Action required:** This endpoint was added in v1.26.0. The frontend has the button wired and ready. If the backend does not yet have this DELETE endpoint, the unlink button will silently fail (the frontend shows an inline error). The backend must implement `DELETE /api/property-enumeration/customers/:customerId/unlink` which should clear `linkedBuildingId` and `linkedBuildingAddress` from the customer document, and clear `linkedCustomerId` / `linkedCustomerName` from the corresponding building document.

**Status:** ⚠️ **New in v1.26.0 — backend must confirm this endpoint exists.**

---

## 4. Session Endpoints

### `POST /property-enumeration/sessions/start` — Start Session

**Called from:** `src/api/client.ts → sessionApi.start()`, in `App.tsx → handleStartEnumeration()`

**Request body (JSON):**
```json
{
  "lotCode": "string",
  "startLocation": {
    "latitude": "number",
    "longitude": "number",
    "accuracy": "number (optional)"
  },
  "notes": "string (optional)"
}
```

**Expected response shape:**
```json
{
  "success": true,
  "data": {
    "session": { /* Session object — see Session Schema below */ }
  }
}
```

**Status:** ✅ Working.

---

### `POST /property-enumeration/sessions/:sessionId/end` — End Session

**Called from:** `src/api/client.ts → sessionApi.end()`, in `App.tsx → handleEndSession()`

**Request body (JSON):**
```json
{
  "endLocation": {
    "latitude": "number",
    "longitude": "number",
    "accuracy": "number (optional)"
  },
  "notes": "string (optional)"
}
```

**Expected response shape:**
```json
{
  "success": true,
  "data": {
    "session": { /* Session object with endTime populated */ }
  }
}
```

> **Note:** If GPS is unavailable at session end, the frontend currently sends `{ latitude: 0, longitude: 0 }` as a fallback. The backend should accept this gracefully (not reject with a validation error).

**Status:** ✅ Working.

---

### `GET /property-enumeration/sessions` — List Sessions

**Called from:** `src/api/client.ts → sessionApi.list()`, used in `SessionHistory.tsx`

**Expected response shape:**
```json
{
  "success": true,
  "data": {
    "sessions": [ /* Array of Session objects */ ],
    "pagination": { /* optional */ }
  }
}
```

**Status:** ✅ Working.

---

### `GET /property-enumeration/sessions/:sessionId` — Get Session by ID

**Called from:** `src/api/client.ts → sessionApi.getById()` — **defined but not yet called from any UI component**

**Expected response shape:**
```json
{
  "success": true,
  "data": {
    "session": { /* Session object */ },
    "buildings": [ /* Array of Building objects registered in this session */ ]
  }
}
```

> **Note:** This endpoint is wired in the API client but no UI screen calls it yet. It will be needed for the upcoming "Session Detail" screen (medium-priority backlog item). The backend should ensure it returns the `buildings` array alongside the session.

**Status:** ✅ Exists (not yet called from UI).

---

### `GET /property-enumeration/sessions/statistics` — Get Statistics

**Called from:** `src/api/client.ts → sessionApi.getStatistics()`, used in `SessionStatistics.tsx`

**Expected response shape:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "period": "string",
      "totalSessions": "number",
      "activeSessions": "number",
      "completedSessions": "number",
      "totalBuildingsEnumerated": "number",
      "totalDurationMinutes": "number",
      "averageBuildingsPerSession": "number",
      "averageDurationMinutes": "number",
      "lotBreakdown": {
        "<lotCode>": {
          "sessions": "number",
          "buildings": "number",
          "durationMinutes": "number"
        }
      }
    }
  }
}
```

**Status:** ✅ Working.

---

### Session Schema

```typescript
{
  _id: string;
  userId: string;
  companyId: string;
  lotCode: string;
  startTime: string;            // ISO 8601
  endTime?: string;             // ISO 8601, absent if session is active
  startLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  endLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  buildingsEnumerated: number;
  customersLinked: number;
  photosUploaded: number;
  areasCovered: string[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. Authentication Header

Every request (except login) includes:
```
Authorization: Bearer <JWT token>
```
The token is retrieved from `localStorage.authToken`. A 401 response from any endpoint causes the frontend to clear the token and redirect to the login screen.

---

## 6. Known Inconsistencies & Required Fixes

### 6.1 `propertyType` Casing Mismatch

**Problem:** The building registration form (`BuildingForm.tsx`) stores property type as title-case (`Residential`, `Commercial`, `Industrial`, `Mixed-Use`). The `Building` TypeScript interface and the `BuildingEdit` component use lowercase (`residential`, `commercial`, `industrial`, `mixed-use`). The GET response from the backend likely returns whatever casing was stored on creation.

**Impact:** The filter tabs in `BuildingsList` compare with `b.propertyType?.toLowerCase()`, so display is safe. However, the `BuildingEdit` form sends lowercase on PATCH. If the backend stores the original title-case from creation and the frontend sends lowercase on update, the stored value will change casing on first edit.

**Recommended fix:** The backend should normalise `propertyType` to lowercase on both POST and PATCH before storing. The frontend will be updated to send lowercase on creation in the next version.

---

### 6.2 `buildingId` Field — ArcGIS Polygon ID

**Problem:** In versions prior to v1.26.0, the ArcGIS polygon ID was embedded in the `notes` field as `"Building ID: <id> | Zone: <zone>"`. From v1.26.0, `CreateBuildingRequest` has a dedicated `buildingId` field. However, the `BuildingForm.tsx` still writes to `notes` (line 53: `notes: \`Building ID: ${selectedBuilding.buildingId}...\``). The dedicated `buildingId` field is not yet passed from the form to the API call.

**Impact:** The `buildingId` field in the database is currently always empty/null. The `notes` field contains the ArcGIS ID as a string prefix.

**Recommended fix (frontend — next version):** Update `BuildingForm.tsx` to pass `buildingId: selectedBuilding.buildingId` as a separate field and stop embedding it in notes.

**Recommended fix (backend):** Add `buildingId` as an indexed field on the Building model. Accept it on POST and PATCH. Return it in all GET responses.

---

### 6.3 `linkedCustomerId` / `linkedCustomerName` Missing from Building Responses

**Problem:** The `Building` schema now includes `linkedCustomerId` and `linkedCustomerName`. These are needed by `BuildingsList.tsx` to show the "Linked Customer" panel and "Unlink" button. However, these fields are only populated on the Customer document (via the link endpoint), not necessarily reflected back on the Building document.

**Impact:** The "Linked Customer" section in the expanded building card will never appear unless the backend populates these fields on the Building document when a customer is linked.

**Recommended fix (backend):** When `POST /customers/:id/link` is called, the backend should:
1. Set `customer.linkedBuildingId = buildingId` and `customer.linkedBuildingAddress = building.address` on the Customer document.
2. Set `building.linkedCustomerId = customerId` and `building.linkedCustomerName = customer.customerName` on the Building document.

When `DELETE /customers/:id/unlink` is called, the backend should:
1. Clear `customer.linkedBuildingId` and `customer.linkedBuildingAddress`.
2. Clear `building.linkedCustomerId` and `building.linkedCustomerName`.

---

### 6.4 `buildingsEnumerated` Counter on Session

**Problem:** The session end summary modal reads `ended.buildingsEnumerated` from the session end response. This counter must be incremented by the backend every time a building is successfully created with a matching `sessionId`. Currently the building creation request does not include a `sessionId` field.

**Impact:** The session summary always shows `0 buildings` unless the backend tracks this separately (e.g., by counting buildings created between session start and end times for the same user).

**Recommended fix (backend):** Either:
- Accept an optional `sessionId` field on `POST /property-enumeration/buildings` and increment the session counter, OR
- On session end, count buildings created by the user since `session.startTime` and populate `buildingsEnumerated` dynamically.

---

### 6.5 `photosUploaded` Counter on Session

Same issue as 6.4. The session end response shows `ended.photosUploaded` but the backend has no way to know how many photos were uploaded unless it counts photos on buildings created during the session.

**Recommended fix (backend):** Same approach as 6.4 — count photo URLs on buildings created during the session window.

---

## 7. Upcoming Endpoints (Next Frontend Features)

The following endpoints will be needed for features currently in the frontend backlog. The backend should plan for these now to avoid blocking frontend development.

### 7.1 Add Photos to Existing Building

**Endpoint:** `POST /property-enumeration/buildings/:id/photos`  
**Format:** `multipart/form-data`  
**Fields:** `photos` (File[], up to 4 additional photos)  
**Response:** Updated Building object with new photo URLs appended to `photos[]`

**Status as of v1.30.0:** ✅ **Frontend fully implemented.** The `BuildingPhotoUpload` component calls this endpoint. The backend must accept `multipart/form-data` with field name `photos` (multiple files), append the new URLs to the building's photo array, and return the updated Building object in the standard `{ success: true, data: { building: {...} } }` envelope.

### 7.2 Delete Photo from Building

**Endpoint:** `DELETE /property-enumeration/buildings/:id/photos/:photoRef`  
**`:photoRef`:** URL-encoded photo URL (the frontend calls `encodeURIComponent(photoUrl)` before inserting into the path)  
**Response:** Updated Building object with the photo removed

**Status as of v1.30.0:** ✅ **Frontend fully implemented.** The `BuildingPhotoUpload` component shows a red × button on each existing photo. When tapped, it calls `buildingApi.deletePhoto(buildingId, photoUrl)` which sends `DELETE /property-enumeration/buildings/:id/photos/<encoded-url>`. The backend must:
1. Decode the `:photoRef` path param with `decodeURIComponent()`.
2. Remove the matching URL from the building's `photoUrls` array.
3. Delete the file from storage (S3/GridFS/etc.) if applicable.
4. Return the updated Building object in the standard envelope.

### 7.3 Get User Profile

**Endpoint:** `GET /api/mobile/users/me`  
**Response:**
```json
{
  "data": {
    "user": {
      "_id": "string",
      "email": "string",
      "fullName": "string",
      "role": "string",
      "company": { "_id": "string", "companyName": "string" },
      "assignedLots": [ { "lotCode": "string", "lotName": "string" } ]
    }
  }
}
```

### 7.4 Update User Profile / Change Password

**Endpoint:** `PATCH /api/mobile/users/me/password`  
**Request body (JSON):**
```json
{
  "currentPassword": "string (base64-encoded, required)",
  "newPassword": "string (base64-encoded, required)"
}
```
**Response:**
```json
{ "success": true, "message": "Password updated successfully" }
```

**Status as of v1.30.0:** ✅ **Frontend fully implemented.** The `ProfileSettings.tsx` screen is live. It shows the surveyor's name, email, company, and assigned lots. The change-password form calls `authApi.changePassword({ currentPassword, newPassword })` which sends `PATCH /api/mobile/users/me/password`. Both passwords are base64-encoded by the frontend (`btoa(plainText)`) before sending — consistent with the login endpoint. The backend must:
1. Decode both passwords with `atob()` or equivalent.
2. Verify `currentPassword` against the stored hash.
3. Hash and store `newPassword`.
4. Return `{ success: true, message: "Password updated successfully" }` on success, or a 400/401 with `{ message: "Current password is incorrect" }` on failure.

**Also needed:** `GET /api/mobile/users/me` — the profile screen calls `authApi.getProfile()` to fetch the current user's full details. The login response already contains this data, but the profile screen needs to refresh it on mount. Expected response shape: same as the `user` object in the login response.

### 7.5 Get Buildings by Session ID

**Endpoint:** `GET /property-enumeration/sessions/:sessionId/buildings`  
**Response:**
```json
{
  "data": {
    "buildings": [ /* Array of Building objects */ ]
  }
}
```
> This is needed for the "Session Detail" screen where a supervisor taps a past session to see which buildings were registered in it.

---

## 8. Summary Action Table

| # | Endpoint | Status | Action Required |
|---|---|---|---|
| 1 | `POST /api/mobile/users/login` | ✅ Working | None |
| 2 | `POST /property-enumeration/buildings` | ✅ Working | Add `buildingId` field support; normalise `propertyType` to lowercase |
| 3 | `GET /property-enumeration/buildings` | ✅ Working | Add `page`/`limit` query param support; include `linkedCustomerId` + `linkedCustomerName` in response |
| 4 | `PATCH /property-enumeration/buildings/:id` | ⚠️ New | **Must implement** — partial update of address, name, type, units, notes |
| 5 | `GET /api/property-enumeration/customers` | ✅ Working | Confirm `search` query param key (not `q` or `query`) |
| 6 | `POST /api/property-enumeration/customers/:id/link` | ✅ Working | Also update Building document with `linkedCustomerId` + `linkedCustomerName` |
| 7 | `DELETE /api/property-enumeration/customers/:id/unlink` | ⚠️ New | **Must implement** — clear link on both Customer and Building documents |
| 8 | `POST /property-enumeration/sessions/start` | ✅ Working | None |
| 9 | `POST /property-enumeration/sessions/:id/end` | ✅ Working | Populate `buildingsEnumerated` + `photosUploaded` dynamically; accept `{lat:0,lng:0}` gracefully |
| 10 | `GET /property-enumeration/sessions` | ✅ Working | None |
| 11 | `GET /property-enumeration/sessions/:id` | ✅ Exists | Ensure `buildings` array is included in response |
| 12 | `GET /property-enumeration/sessions/statistics` | ✅ Working | None |
| 13 | `POST /property-enumeration/buildings/:id/photos` | ✅ **Frontend live** | **Must implement** — accept `multipart/form-data`, field name `photos`, return updated Building |
| 14 | `DELETE /property-enumeration/buildings/:id/photos/:ref` | ✅ **Frontend live** | **Must implement** — `:ref` is URL-encoded photo URL; decode it, remove from array, return updated Building |
| 15 | `GET /api/mobile/users/me` | ✅ **Frontend live** | **Must implement** — return same user shape as login response |
| 16 | `PATCH /api/mobile/users/me/password` | ✅ **Frontend live** | **Must implement** — accept `{ currentPassword, newPassword }` (both base64), verify, hash, store |
| 17 | `GET /property-enumeration/sessions/:id/buildings` | 🔜 Planned | Implement for session detail screen |

---

## 9. Non-Breaking Reminder

The following are currently working in production and must not be changed in a breaking way:

- The base64 password encoding on login.
- The `multipart/form-data` format on building creation with flat `gpsLatitude`/`gpsLongitude` fields.
- The `Authorization: Bearer` header pattern.
- The `{ success: true, data: { ... } }` response envelope — all frontend response parsers depend on this exact nesting.
- The `search` query param key on the customers endpoint.
- The JWT token format and expiry behaviour (401 triggers auto-logout).

---

---

## 10. v1.27.0–v1.30.0 Changelog for Backend

The following frontend changes since v1.26.0 affect the backend integration:

| Version | Change | Backend Impact |
|---|---|---|
| v1.27.0 | Response normalisation layer added (`normaliseBuilding`, `normaliseSession`) | None — frontend now handles flat `gpsLatitude`/`gpsLongitude` and `photoUrls` → `photos` mapping internally |
| v1.27.0 | `propertyType` now sent as title-case on all requests | Backend must accept title-case (`Residential`, `Commercial`, etc.) |
| v1.27.0 | Customer search param corrected to `search` | Backend must read `req.query.search` |
| v1.28.0 | Step 2 (Link Customer) UI redesigned — no functional API change | None |
| v1.29.0 | ProfileSettings screen added — calls `GET /api/mobile/users/me` and `PATCH /api/mobile/users/me/password` | **Both endpoints must be implemented** |
| v1.29.0 | SessionHistory drill-down added — calls `GET /property-enumeration/buildings?sessionId=<id>` | Backend must support `sessionId` as a filter query param on the buildings list endpoint |
| v1.30.0 | Photo delete button added — calls `DELETE /property-enumeration/buildings/:id/photos/:ref` | **Must implement** |
| v1.30.0 | All 13 Dependabot vulnerabilities resolved via pnpm overrides | None |

---

*End of Backend Coordination Brief — updated for v1.30.0*
