# Backend Update — Property Enumeration Mobile App
## Frontend v1.30.0 → Backend Action Required

**Date:** February 28, 2026  
**Frontend Version:** v1.30.0 (Build #92)  
**Backend Base URL:** `https://upwork.kowope.xyz`  
**Prepared by:** Frontend AI Agent  
**For:** Backend Developer AI

---

## Executive Summary

The frontend mobile app is at v1.30.0. Since the last backend sync (v1.26.0), four new screens have been added that call endpoints the backend has not yet implemented. The app will display error states on those screens until the backend implements these endpoints. All other existing functionality continues to work — this update is **purely additive**.

**The four endpoints the backend must implement immediately:**

| Priority | Endpoint | Used By |
|---|---|---|
| 🔴 Critical | `POST /property-enumeration/buildings/:id/photos` | "Manage Photos" sheet in BuildingEdit |
| 🔴 Critical | `DELETE /property-enumeration/buildings/:id/photos/:ref` | Delete button in "Manage Photos" sheet |
| 🟠 High | `GET /api/mobile/users/me` | ProfileSettings screen (loads on mount) |
| 🟠 High | `PATCH /api/mobile/users/me/password` | ProfileSettings change-password form |

**One existing endpoint that needs a small update:**

| Priority | Endpoint | Change Needed |
|---|---|---|
| 🟡 Medium | `GET /property-enumeration/buildings` | Add `sessionId` filter query param |

---

## 1. Add Photos to Existing Building

### `POST /property-enumeration/buildings/:id/photos`

**Called from:** `buildingApi.addPhotos()` → `BuildingPhotoUpload.tsx`

**Request format:** `multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `photos` | `File[]` | Field name must be exactly `photos`. Up to 4 files, JPEG, max 5 MB each (already compressed by frontend). |

**Expected response:**
```json
{
  "success": true,
  "data": {
    "building": {
      "_id": "string",
      "photoUrls": ["url1", "url2", "..."],
      "..."  
    }
  }
}
```

> The frontend normalises `photoUrls[]` → `photos[]` internally, so the backend can return either `photoUrls` or `photos` as the field name. The important thing is that the response contains the **full updated building object** inside `data.building`.

**Backend implementation notes:**
- Append the new photo URLs to the building's existing `photoUrls` array (do not replace).
- Enforce the 4-photo maximum — reject with 400 if the building already has 4 photos.
- Store files in S3/GridFS and return the CDN URLs.
- Return the complete updated Building document in the standard envelope.

---

## 2. Delete Photo from Building

### `DELETE /property-enumeration/buildings/:id/photos/:photoRef`

**Called from:** `buildingApi.deletePhoto()` → delete button in `BuildingPhotoUpload.tsx`

**URL construction:** The frontend URL-encodes the photo URL before inserting it as the `:photoRef` path segment:
```javascript
const encoded = encodeURIComponent(photoUrl);
// e.g. DELETE /property-enumeration/buildings/abc123/photos/https%3A%2F%2Fcdn.example.com%2Fphoto.jpg
```

**Request body:** None.

**Expected response:**
```json
{
  "success": true,
  "data": {
    "building": { /* Full updated Building object with photo removed */ }
  }
}
```

**Backend implementation notes:**
1. Decode `:photoRef` with `decodeURIComponent()` to get the original URL.
2. Remove that URL from the building's `photoUrls` array.
3. Delete the file from S3/GridFS if applicable.
4. Return the complete updated Building document in the standard envelope.

---

## 3. Get User Profile

### `GET /api/mobile/users/me`

**Called from:** `authApi.getProfile()` → `ProfileSettings.tsx` (called on screen mount)

**Request:** No body. `Authorization: Bearer <token>` header is always present.

**Expected response:**
```json
{
  "success": true,
  "data": {
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
          "lotName": "string"
        }
      ]
    }
  }
}
```

> This is the same user shape returned by the login endpoint. The profile screen uses it to display the surveyor's name, email, company, and assigned lots. It also serves as a "refresh session" mechanism — if the user's details change server-side, the profile screen will show the latest values.

**Backend implementation notes:**
- Read the user ID from the JWT in the `Authorization` header.
- Return the user document with company and assignedLots populated.
- Return 401 if the token is invalid or expired (the frontend auto-redirects to login on 401).

---

## 4. Change Password

### `PATCH /api/mobile/users/me/password`

**Called from:** `authApi.changePassword()` → `ProfileSettings.tsx` change-password form

**Request body (JSON):**
```json
{
  "currentPassword": "string (base64-encoded)",
  "newPassword": "string (base64-encoded)"
}
```

> Both passwords are encoded with `btoa(plainText)` by the frontend — consistent with the login endpoint. The backend must decode with `atob()` or equivalent before hashing/comparing.

**Expected success response:**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Expected error response (wrong current password):**
```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```
HTTP status: `400` or `401`.

**Backend implementation notes:**
1. Decode `currentPassword` and `newPassword` from base64.
2. Verify `currentPassword` against the stored bcrypt hash.
3. Hash `newPassword` with bcrypt (same salt rounds as registration).
4. Update the user document.
5. Return the success response — the frontend shows a success toast and clears the form.
6. On failure, return the error response — the frontend shows an inline error message.

---

## 5. Session-Filtered Buildings List (Medium Priority)

### `GET /property-enumeration/buildings?sessionId=<id>`

**Called from:** `buildingApi.list({ sessionId })` → `BuildingsList.tsx` when opened from `SessionHistory` drill-down

**Current behaviour:** The frontend passes `sessionId` as a query param when the user taps "View Buildings from This Session" in the session history screen. If the backend ignores this param, it returns all buildings (not just those from that session), which is a degraded but non-breaking experience.

**Required change:** Add `sessionId` as an optional filter on the buildings list endpoint:
```
GET /property-enumeration/buildings?sessionId=abc123&page=1&limit=20
```
When `sessionId` is present, return only buildings where `building.sessionId === sessionId` (or buildings created between the session's `startTime` and `endTime` by the same user, if `sessionId` is not stored on the building document).

---

## 6. Existing Endpoints — Pending Fixes

These were flagged in the previous brief and are still outstanding:

### 6.1 `PATCH /property-enumeration/buildings/:id` — Must Confirm

The `BuildingEdit` screen has been live since v1.26.0. It sends:
```json
{
  "address": "string (optional)",
  "buildingName": "string (optional)",
  "propertyType": "Residential|Commercial|Industrial|Mixed-Use",
  "numberOfUnits": "number (optional)",
  "notes": "string (optional)"
}
```
Expected response: `{ success: true, data: { building: { /* updated */ } } }`

If this endpoint does not exist, the edit screen will show an error on every save attempt. **Please confirm it is implemented.**

### 6.2 `DELETE /api/property-enumeration/customers/:id/unlink` — Must Confirm

The "Unlink Customer" button in BuildingsList has been live since v1.26.0. It sends a `DELETE` with no body to this endpoint. If it does not exist, the button shows an inline error. **Please confirm it is implemented.**

### 6.3 `linkedCustomerId` / `linkedCustomerName` on Building Responses

When `POST /customers/:id/link` is called, the backend must also write `linkedCustomerId` and `linkedCustomerName` onto the Building document. Without this, the "Linked Customer" card in BuildingsList never appears even after a successful link.

### 6.4 `buildingsEnumerated` Counter on Session End

The session summary modal reads `session.buildingsEnumerated` from the end-session response. This is always `0` unless the backend counts buildings created during the session window. Please populate this field dynamically on session end.

---

## 7. Non-Breaking Constraints

The following must not change — they are working in production and the frontend depends on them exactly as-is:

- `POST /api/mobile/users/login` — base64 password, response shape with `token` + `user`
- `POST /property-enumeration/buildings` — `multipart/form-data` with flat `gpsLatitude`/`gpsLongitude`
- `Authorization: Bearer <JWT>` header on all authenticated requests
- `{ success: true, data: { ... } }` response envelope on all endpoints
- `search` query param key on `GET /api/property-enumeration/customers`
- 401 response triggers auto-logout and redirect to login screen

---

## 8. Complete Endpoint Status Table

| # | Method | Endpoint | Status | Action |
|---|---|---|---|---|
| 1 | POST | `/api/mobile/users/login` | ✅ Working | None |
| 2 | POST | `/property-enumeration/buildings` | ✅ Working | Add `buildingId` field; write `linkedCustomerId/Name` on link |
| 3 | GET | `/property-enumeration/buildings` | ✅ Working | Add `sessionId` filter param; include `linkedCustomerId/Name` in response |
| 4 | PATCH | `/property-enumeration/buildings/:id` | ⚠️ Unconfirmed | **Confirm implemented** — partial update of address/name/type/units/notes |
| 5 | POST | `/property-enumeration/buildings/:id/photos` | 🔴 **Missing** | **Must implement** — multipart, field `photos`, return updated Building |
| 6 | DELETE | `/property-enumeration/buildings/:id/photos/:ref` | 🔴 **Missing** | **Must implement** — URL-decode `:ref`, remove from array, return updated Building |
| 7 | GET | `/api/property-enumeration/customers` | ✅ Working | Confirm `search` param key |
| 8 | POST | `/api/property-enumeration/customers/:id/link` | ✅ Working | Also write `linkedCustomerId/Name` to Building document |
| 9 | DELETE | `/api/property-enumeration/customers/:id/unlink` | ⚠️ Unconfirmed | **Confirm implemented** — clear link on both Customer and Building |
| 10 | POST | `/property-enumeration/sessions/start` | ✅ Working | None |
| 11 | POST | `/property-enumeration/sessions/:id/end` | ✅ Working | Populate `buildingsEnumerated` + `photosUploaded` dynamically |
| 12 | GET | `/property-enumeration/sessions` | ✅ Working | None |
| 13 | GET | `/property-enumeration/sessions/:id` | ✅ Working | Ensure `buildings` array included in response |
| 14 | GET | `/property-enumeration/sessions/statistics` | ✅ Working | None |
| 15 | GET | `/api/mobile/users/me` | 🔴 **Missing** | **Must implement** — return user shape matching login response |
| 16 | PATCH | `/api/mobile/users/me/password` | 🔴 **Missing** | **Must implement** — base64 passwords, bcrypt verify + hash |
| 17 | GET | `/property-enumeration/sessions/:id/buildings` | 🟡 Planned | Needed for session drill-down screen |

---

*Prepared by Frontend AI Agent — v1.30.0 — February 28, 2026*
