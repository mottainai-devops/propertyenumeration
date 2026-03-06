# Joint API Contract — Mottainai Property Enumeration System

> **Document Version:** v1.2.0
> **Backend Version:** v4.5.5 (deployed March 6, 2026)
> **Mobile App Version:** v1.57.16
> **Status:** ✅ Signed Off — Both Teams
> **Authors:** Backend Team + Frontend Team
> **Date:** March 6, 2026

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0.0 | March 4, 2026 | Backend Team | Initial contract, 4 discrepancies documented |
| v1.1.0 | March 6, 2026 | Both Teams | 5 additional issues resolved (Issues 1–5 from frontend sign-off review); logout endpoint added; customer search endpoint added; `assignedLots` fix deployed; both teams signed off |
| v1.2.0 | March 6, 2026 | Backend Team | 6 gaps corrected from independent audit: removed non-existent fields (`ownerCompanyId`, `companyName`, `monthlyBilling`) from login response; corrected session start URL; corrected sessions list response shape (pagination wrapper); added Change Password endpoint (now implemented); added `arcgisBuildingId` filter to buildings list; documented analytics endpoints |

---

## Executive Summary

This document is the authoritative, jointly agreed API contract between the mobile app frontend team and the backend team for the Mottainai Property Enumeration System. It supersedes all previous questionnaires, response documents, and informal agreements.

All discrepancies and issues identified across both review cycles have been investigated and resolved. The system is now at **v4.5.5 (backend) / v1.57.16 (mobile app)**.

---

## 1. System Architecture

The system comprises two Node.js backends behind a single nginx reverse proxy. The mobile app communicates exclusively with `upwork.kowope.xyz`, which routes requests internally to the appropriate backend service.

| Service | Internal Port | PM2 Process | Responsibility |
|---------|--------------|-------------|----------------|
| `mottainai-backend` | 3000 | `mottainai-backend` | Property enumeration API (buildings, sessions, customers) |
| `mottainai-dashboard` | 3003 | `mottainai-dashboard` | Mobile authentication, admin tRPC |
| MongoDB | 27017 | — | Primary data store (`arcgis` database) |
| Nginx | 443 (SSL) | — | Routing, SSL termination, CORS |

**The mobile app uses a single base URL: `https://upwork.kowope.xyz`**

Nginx routes requests to the correct backend service transparently. The frontend does not need to know which internal port handles each request.

---

## 2. Authentication

### 2.1 Login

**Endpoint:** `POST https://upwork.kowope.xyz/api/mobile/users/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "BASE64_ENCODED_PASSWORD"
}
```

> **Note:** Passwords must be base64-encoded before sending. Example: `admin123` → `YWRtaW4xMjM=`. Plain text passwords are also accepted (v2.7+ behaviour) but base64 is the canonical format.

**Success Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {
    "id": "66212f85df2188147c7a81d7",
    "email": "user@example.com",
    "fullName": "Full Name",
    "phone": "08012345678",
    "role": "user",
    "companyId": "URBAN-SPIRIT",
    "defaultLotCode": "6",
    "assignedLots": [
      { "lotCode": "6", "lotName": "Lot 6", "companyName": "Urban Spirit Ltd" }
    ]
  },
  "company": {
    "companyId": "URBAN-SPIRIT",
    "companyName": "Urban Spirit Ltd",
    "operationalLots": [
      { "lotCode": "6", "lotName": "Lot 6" }
    ],
    "pin": "1234",
    "active": true
  }
}
```

> **v1.2.0 Correction:** The `user` object does **not** contain `ownerCompanyId`, `companyName`, or `monthlyBilling` — these fields do not exist in the backend. Company information is in the separate `company` object. `companyId` on the user is the string code (e.g., `"URBAN-SPIRIT"`), not a MongoDB ObjectId.

> **v4.5.4 Fix (Issue 1):** `assignedLots` and `defaultLotCode` are now always present in the login, `/me`, and register responses. `defaultLotCode` is the first lot in the company's `operationalLots` array. Admin users (no company) return `assignedLots: []`, `defaultLotCode: null`, and `company: null`.

> **Lot Code Format:** `defaultLotCode` and `lotCode` in `assignedLots` are bare number strings (e.g., `"6"`, `"27"`), not prefixed (e.g., `"LOT-6"`).

**Admin User Response (200):**

```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {
    "id": "66212f85df2188147c7a81d7",
    "email": "admin@admin.com",
    "fullName": "Admin",
    "phone": "123546789",
    "role": "admin",
    "companyId": null,
    "defaultLotCode": null,
    "assignedLots": []
  },
  "company": null
}
```

**Error Responses:**

| Status | Body | Meaning |
|--------|------|---------|
| 400 | `{ "error": "Email and password are required" }` | Missing fields |
| 400 | `{ "error": "Invalid email or password" }` | Bad credentials |
| 500 | `{ "error": "Internal server error" }` | Server error |

**Token Characteristics:**
- Algorithm: HS256
- Payload fields: `userId`, `email`, `role`, `companyId`
- Expiry: 30 days
- The token is accepted by all property enumeration endpoints on `upwork.kowope.xyz`

---

### 2.2 Get Current User

**Endpoint:** `GET https://upwork.kowope.xyz/api/mobile/users/me`

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "66212f85df2188147c7a81d7",
    "email": "user@example.com",
    "fullName": "Full Name",
    "phone": "08012345678",
    "role": "user",
    "companyId": "URBAN-SPIRIT",
    "defaultLotCode": "6",
    "assignedLots": [
      { "lotCode": "6", "lotName": "Lot 6", "companyName": "Urban Spirit Ltd" }
    ]
  },
  "company": {
    "companyId": "URBAN-SPIRIT",
    "companyName": "Urban Spirit Ltd",
    "operationalLots": [...],
    "active": true
  }
}
```

> **v4.5.5 Fix:** The `/me` endpoint now returns `assignedLots` and `defaultLotCode` (same as the login response). Previously it returned only the bare user object without these fields, which caused surveyors to lose their lot assignments on app resume.

---

### 2.3 Logout

**Endpoint:** `POST https://upwork.kowope.xyz/api/mobile/users/logout`

**Headers:** `Authorization: Bearer <token>`

**Request Body:** `{}` (empty JSON object)

**Success Response (200):**
```json
{ "success": true, "message": "Logged out successfully" }
```

**Error Response (401):**
```json
{ "success": false, "error": "No token provided" }
```

> **v4.5.4 Fix (Issue 2):** This endpoint is now live. The token is added to an in-memory blacklist on the server. All subsequent requests using that token are rejected with `401 { "error": "Unauthorized: Token has been invalidated. Please log in again." }`. The blacklist clears on server restart (acceptable given 30-day token expiry and deliberate deploy cycles).

---

### 2.4 Change Password

**Endpoint:** `PATCH https://upwork.kowope.xyz/api/mobile/users/me/password`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "BASE64_ENCODED_CURRENT_PASSWORD",
  "newPassword": "BASE64_ENCODED_NEW_PASSWORD"
}
```

**Success Response (200):**
```json
{ "success": true, "message": "Password updated successfully" }
```

**Error Responses:**

| Status | Body | Meaning |
|--------|------|---------|
| 400 | `{ "error": "Current password and new password are required" }` | Missing fields |
| 401 | `{ "error": "Current password is incorrect" }` | Wrong current password |
| 401 | `{ "error": "Unauthorized" }` | Invalid or missing token |

> **v1.2.0 Note:** This endpoint is implemented on the backend. The frontend team should implement the Change Password screen in a future version.

---

## 3. Property Enumeration — Buildings

All building endpoints require `Authorization: Bearer <token>` header. The backend automatically scopes results to the authenticated user's company.

### 3.1 Create Building

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/buildings`

**Request:** `multipart/form-data` (required when including photos; also accepted for text-only requests)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `address` | string | ✅ Yes | Full street address |
| `lotCode` | string | ✅ Yes | Bare number format: `"27"` (not `"LOT-27"`) |
| `propertyType` | string | ✅ Yes | One of: `"Residential"`, `"Commercial"`, `"Industrial"`, `"Mixed-Use"` |
| `numberOfUnits` | number | ✅ Yes | Integer ≥ 1 |
| `gpsLatitude` | number | ✅ Yes | Decimal degrees, e.g. `6.5244` |
| `gpsLongitude` | number | ✅ Yes | Decimal degrees, e.g. `3.3792` |
| `buildingName` | string | No | Optional building name |
| `landmarkDescription` | string | No | Nearby landmark |
| `gpsAccuracy` | number | No | GPS accuracy in metres |
| `contactPersonName` | string | No | On-site contact |
| `contactPhoneNumber` | string | No | Contact phone |
| `notes` | string | No | Free-text notes |
| `arcgisBuildingId` | string | No | ArcGIS feature ID if known |
| `photo` | file | No | Up to 4 photos; field name must be `photo` (not `photos`) |

> **v4.5.2 Fix:** The building creation endpoint now correctly parses `multipart/form-data`. Previously, sending a multipart request (even without photos) caused all fields to appear missing. The fix adds `multer` middleware to the route.

> **Field Name Clarification:** The backend uses `gpsLatitude`/`gpsLongitude` (not `latitude`/`longitude`). This was confirmed as Discrepancy 4 in v1.0.0 and is resolved.

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "building": {
      "buildingId": "URBAN-SPIRIT LOT-6 001",
      "address": "12 Awolowo Road",
      "lotCode": "6",
      "propertyType": "Residential",
      "numberOfUnits": 4,
      "gpsLatitude": 6.5244,
      "gpsLongitude": 3.3792,
      "companyId": "URBAN-SPIRIT",
      "enumeratorId": "66212f85...",
      "photoUrls": [],
      "createdAt": "2026-03-04T12:00:00.000Z"
    }
  }
}
```

> **v1.2.0 Correction:** The building is returned under `data.building` (not directly under `data`).

---

### 3.2 List Buildings

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/buildings`

**Query Parameters:**

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Max 100 |
| `lotCode` | string | — | Filter by lot (bare number or `LOT-` prefix, both accepted) |
| `propertyType` | string | — | Filter by type |
| `search` | string | — | Search address/buildingId |
| `arcgisBuildingId` | string | — | Filter by ArcGIS polygon ID (v4.5.3 fix — used for R1/R2/R3 counter) |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "buildings": [...],
    "pagination": {
      "total": 42,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

> **v1.2.0 Correction:** Pagination fields are nested inside a `pagination` wrapper object (not at the top level of `data`). Access as `data.pagination.total`, `data.pagination.totalPages`, etc.

---

### 3.3 Get Building by ID

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/buildings/:buildingId`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "building": { ...full building object... }
  }
}
```

---

### 3.4 Update Building

**Endpoint:** `PATCH https://upwork.kowope.xyz/api/property-enumeration/buildings/:buildingId`

The following fields are **protected** and cannot be updated after creation: `lotCode`, `gpsLatitude`, `gpsLongitude`, `unitCode`, `arcgisBuildingId`, `buildingId`, `userId`, `enumeratorId`, `companyId`, `createdAt`.

---

### 3.5 Building Photos

> **Note (v1.57.15+):** The photo capture and upload feature has been **removed from the mobile app** as of v1.57.15. The backend endpoints remain available for future use or other clients.

**Upload:** `POST https://upwork.kowope.xyz/api/property-enumeration/buildings/:buildingId/photos`
- Request: `multipart/form-data` with field name `photo` (not `photos`)
- Max 4 photos per building
- Response includes updated `photoUrls` array

**Delete:** `DELETE https://upwork.kowope.xyz/api/property-enumeration/buildings/:buildingId/photos/:photoIndex`
- `:photoIndex` is the URL-encoded photo URL (not a numeric index)

---

## 4. Property Enumeration — Sessions

### 4.1 Start Session

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/sessions/start`

> **v1.2.0 Correction:** The correct URL is `/sessions/start` (not `/sessions`). Sending `POST /sessions` returns 404.

**Request Body:**
```json
{
  "lotCode": "27",
  "startLocation": {
    "latitude": 6.5244,
    "longitude": 3.3792
  },
  "notes": "Optional session notes"
}
```

> **Note:** `startLocation` uses `latitude`/`longitude` (not `gpsLatitude`/`gpsLongitude`). This is intentional — session location uses a nested object with standard field names.

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "session": {
      "_id": "67abc123...",
      "sessionId": "SESS-URBAN-SPIRIT-001",
      "lotCode": "27",
      "startTime": "2026-03-04T08:00:00.000Z",
      "status": "active",
      "companyId": "URBAN-SPIRIT"
    }
  }
}
```

---

### 4.2 List Sessions

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/sessions`

No query parameters required. The backend scopes results to the authenticated user's company via JWT.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "_id": "67abc123...",
        "sessionId": "SESS-URBAN-SPIRIT-001",
        "startTime": "2026-03-04T08:00:00.000Z",
        "endTime": null,
        "status": "active",
        "buildingsRegistered": 5,
        "companyId": "URBAN-SPIRIT"
      }
    ],
    "pagination": {
      "total": 12,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

> **v1.2.0 Correction:** Sessions list response uses the same `pagination` wrapper as buildings. Access total as `data.pagination.total` (not `data.total`).

> **Deprecated field:** `photosUploaded` (integer count) is still returned in session responses for backward compatibility. It will be removed in a future version. The `photoUrls` array is the authoritative field.

---

### 4.3 End Session

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/sessions/:sessionId/end`

**Alternative (sessionId in body):** `POST https://upwork.kowope.xyz/api/property-enumeration/sessions/end`

```json
{ "sessionId": "67abc123...", "notes": "Optional closing notes" }
```

---

### 4.4 Get Session Buildings

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/sessions/:sessionId/buildings`

---

### 4.5 Session Analytics (Admin Only)

The following endpoints exist but are not required by the mobile app. They are documented here for completeness.

| Endpoint | Description |
|----------|-------------|
| `GET /api/property-enumeration/sessions/statistics` | Aggregate statistics |
| `GET /api/property-enumeration/sessions/analytics` | Detailed analytics with date range |
| `GET /api/property-enumeration/sessions/analytics/supervisor-performance` | Per-supervisor performance metrics |

---

## 5. Property Enumeration — Customers

### 5.1 List / Filter Customers

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/customers`

**Query Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| `page` | number | Default: 1 |
| `limit` | number | Default: 20, max 100 |
| `lotCode` | string | Bare number or `LOT-` prefix, both accepted |
| `isDigitalized` | boolean | Filter by digitalization status |
| `buildingId` | string | Filter by linked building |
| `search` | string | Search name/address/phone |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "customers": [...],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  }
}
```

> **v1.2.0 Correction:** Customers list also uses the `pagination` wrapper (same pattern as buildings and sessions).

---

### 5.2 Search Customers (Autocomplete)

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/customers/search`

**Query Parameters:** `q` (min 2 chars), `lotCode` (optional), `limit` (default 10, max 50)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "customers": [ { ...customer fields... } ],
    "count": 3
  }
}
```

> **Important:** This endpoint uses `count` (not `total`) and has **no pagination fields**. This is intentional — it is a lightweight autocomplete endpoint, not a paginated list.

---

### 5.3 JSON Bulk Import

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/customers/bulk`

**Required Roles:** `admin`, `superadmin`, `cherry_picker`

**Request Body:**
```json
{
  "ownerCompanyId": "URBAN-SPIRIT",
  "customers": [
    {
      "customerName": "John Doe",
      "address": "12 Awolowo Road, Ikeja",
      "lotCode": "6",
      "phone": "08012345678",
      "email": "john@example.com",
      "customerType": "Residential"
    }
  ]
}
```

**Field Rules:**

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| `customerName` | ✅ Yes | string | Full name |
| `address` | ✅ Yes | string | Full address |
| `lotCode` | ✅ Yes | string | **Bare number: `"6"`, not `"LOT-6"`**. The backend also accepts `"LOT-6"` format and strips the prefix automatically. Both formats are safe to send. |
| `phone` | No | string | Phone number |
| `email` | No | string | Email address |
| `customerType` | No | string | `"Residential"` (default), `"Commercial"`, or `"Industrial"`. **Must be capitalised.** |

**Maximum batch size:** 5,000 customers per request.

**Success Response (200):**
```json
{
  "success": true,
  "results": {
    "created": 45,
    "updated": 3,
    "failed": 2,
    "errors": [
      "Row missing required fields (customerName, address, lotCode): {...}"
    ]
  }
}
```

---

### 5.4 CSV File Import

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/customers/import`

**Request:** `multipart/form-data` with field `file` (CSV or Excel). Requires `lotCode` in the request body.

> **Recommendation:** Use the JSON bulk import (Section 5.3) for mobile apps. The CSV endpoint is provided for legacy compatibility only.

---

### 5.5 Link Customer to Building

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/customers/:customerId/link`

**Request Body:**
```json
{ "buildingId": "URBAN-SPIRIT LOT-6 001" }
```

---

### 5.6 Unlink Customer from Building

**Endpoint:** `DELETE https://upwork.kowope.xyz/api/property-enumeration/customers/:customerId/unlink`

---

## 6. Error Response Format

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

Some endpoints additionally include a `details` field with structured information:

```json
{
  "success": false,
  "error": "Missing required fields: gpsLatitude, gpsLongitude",
  "details": {
    "required": ["address", "lotCode", "gpsLatitude"],
    "received": ["address", "lotCode"]
  }
}
```

> **Note on inconsistency (LOW priority):** Some older endpoints in the codebase use `message` instead of `error` as the key for the error text. The standard going forward is `error`. The frontend's current fallback logic (`response.error || response.message`) correctly handles both cases. Standardisation to `error` is tracked as low-priority technical debt for a future cleanup pass.

**Standard HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (missing/invalid fields) |
| 401 | Unauthorized (missing or invalid token, or token blacklisted after logout) |
| 403 | Forbidden (insufficient role or company not found) |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 500 | Internal server error |

**Token Expiry / Invalidation Handling:**

When a 401 is received, the app shows a toast and redirects to the login screen. Token refresh is not currently implemented. Tokens have a 30-day expiry. Tokens are also invalidated immediately upon logout (in-memory blacklist, clears on server restart).

---

## 7. Discrepancy Resolution Log

### Discrepancy 1 — Auth Backend Mismatch (RESOLVED ✅)

Both `upwork.kowope.xyz/api/mobile/users/login` and `admin.kowope.xyz/api/mobile/users/login` route to the same backend service (port 3003). The frontend's current implementation using `upwork.kowope.xyz` is correct.

### Discrepancy 2 — Lot Code Format (RESOLVED ✅)

Both `"LOT-27"` and `"27"` are accepted by all endpoints. The bare number format (`"27"`) is the canonical internal format.

### Discrepancy 3 — Error Response Format Inconsistency (TRACKED ⚠️)

`error` is the standard key. `message` appears in 23 legacy places. Frontend fallback handles both. Future cleanup planned.

### Discrepancy 4 — Building GPS Field Names (RESOLVED ✅)

Building creation uses `gpsLatitude`/`gpsLongitude`. Session start uses `startLocation: { latitude, longitude }`. Both are intentional and documented in Sections 3.1 and 4.1.

### Issue 1 — `assignedLots` / `defaultLotCode` Missing from Login Response (RESOLVED ✅ — v4.5.4)

**Root cause:** Login handler was returning `company.operationalLots` as a nested company object instead of mapping it to `user.assignedLots`. **Fix:** Login, `/me`, and register responses now always include `assignedLots` and `defaultLotCode` directly on the user object.

### Issue 2 — No Logout Endpoint (RESOLVED ✅ — v4.5.4)

**Fix:** `POST /api/mobile/users/logout` is now live with in-memory token blacklisting. Verified live: token is rejected on all subsequent requests after logout.

### Issue 3 — Customer Search Endpoint (RESOLVED ✅ — v4.5.4)

**Fix:** `GET /api/property-enumeration/customers/search?q=<term>` is live. Response uses `count` (not `total`) and has no pagination.

### Issue 4 — Error Response Key Inconsistency (TRACKED ⚠️)

Documented above in Section 6. Low-priority tech debt. No action required from either team.

### Issue 5 — `photosUploaded` Field Deprecation (NOTED 📌)

`photosUploaded` (integer count) is still returned in session responses for backward compatibility. Photo feature removed from mobile app in v1.57.15. `photosUploaded` will be removed from session responses in a future backend version.

### Gap 1 (v1.2.0) — Non-Existent Fields in Login Response (CORRECTED ✅)

v1.1.0 documented `ownerCompanyId`, `companyName`, and `monthlyBilling` on the `user` object. These fields do not exist in the backend. Removed from contract. Company information is in the separate `company` object. `companyId` is the string code (e.g., `"URBAN-SPIRIT"`).

### Gap 2 (v1.2.0) — `/me` Missing `assignedLots` (RESOLVED ✅ — v4.5.5)

The `/me` endpoint was not updated when the `assignedLots` fix was applied to login in v4.5.4. Fixed in v4.5.5. The `/me` endpoint now returns the same `assignedLots` and `defaultLotCode` fields as the login response.

### Gap 3 (v1.2.0) — Session Start URL Wrong (CORRECTED ✅)

v1.1.0 documented `POST /sessions`. The correct URL is `POST /sessions/start`. Corrected in Section 4.1.

### Gap 4 (v1.2.0) — Pagination Wrapper Not Documented (CORRECTED ✅)

Buildings, sessions, and customers list responses all wrap pagination fields inside a `pagination` object (`data.pagination.total`, etc.). v1.1.0 showed these fields at the top level of `data`. Corrected in Sections 3.2, 4.2, and 5.1.

### Gap 5 (v1.2.0) — Change Password Endpoint (DOCUMENTED ✅)

v1.1.0 listed `PATCH /me/password` as a contract requirement but the endpoint did not exist. The endpoint is now implemented and documented in Section 2.4.

### Gap 6 (v1.2.0) — Analytics Endpoints Not Documented (DOCUMENTED ✅)

Three analytics endpoints exist on the backend but were absent from the contract. Added to Section 4.5.

---

## 8. ArcGIS Sync Status

The ArcGIS sync cron job (`arcgis_sync.mjs`) runs every 15 minutes via crontab. A bug was fixed in v4.5.0: the script was calling `Company.findById(building.companyId)` which failed when `companyId` is a string code (e.g., `"TESTCO"`) rather than a MongoDB ObjectId. The fix replaces this with `Company.findOne({ companyId: building.companyId })`.

**Verification (March 4, 2026):** 26 buildings found, 19 new features added to ArcGIS, 7 updated, 0 deleted.

---

## 9. Features Not Yet Implemented (Frontend)

The following features are confirmed as not yet started on the frontend as of v1.57.16. Backend endpoints exist for all items marked with ✅.

| Feature | Backend Endpoint | Status |
|---------|-----------------|--------|
| Photo capture and upload | `POST /buildings/:id/photos` ✅ | **Removed in v1.57.15** — may be re-added in a future version |
| Change Password screen | `PATCH /me/password` ✅ | Not started — endpoint now live (v4.5.5) |
| Building transfer between sessions | Not yet designed | Not started |
| Batch building operations | Not yet designed | Not started |
| Customer profile view | `GET /customers/:id` ✅ | Not started |
| Customer edit/delete | `PATCH/DELETE /customers/:id` ✅ | Not started |
| Sync conflict resolution | Not yet designed | Not started |
| Token refresh mechanism | Not yet designed | Not started |

---

## 10. Test Credentials

| Role | Email | Password (plain) | Password (base64) |
|------|-------|-----------------|-------------------|
| Admin | `admin@admin.com` | `admin123` | `YWRtaW4xMjM=` |
| Cherry Picker | `cherrypicker.test@mottainai.com` | `123456` | `MTIzNDU2` |
| Regular user (TESTCO) | `supervisor2@test.com` | Contact backend team | — |
| Regular user (URBAN-SPIRIT) | Contact backend team | — | — |

> **Note:** Test user passwords for regular accounts should be obtained directly from the backend team. Do not store plain-text passwords in this document.

---

## 11. Sign-off

| Team | Representative | Signature | Date |
|------|---------------|-----------|------|
| Backend | Backend Team | ✅ Signed — v4.5.5 deployed and verified | March 6, 2026 |
| Frontend (Mobile App) | Frontend Team | ⏳ Pending review of v1.2.0 corrections | — |

---

*Document v1.2.0 prepared by the backend team on March 6, 2026. This document supersedes v1.1.0 (March 6, 2026) and v1.0.0 (March 4, 2026).*
