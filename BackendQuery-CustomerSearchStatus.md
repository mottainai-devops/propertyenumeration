# Backend Query — Customer Search HTTP Status (v1.40.0 Bug)

**Date:** 2026-03-01  
**Priority:** High — blocking customer linking in the mobile app  
**From:** Frontend Developer  
**To:** Backend Developer  

---

## The Problem

The customer search in Step 2 of the building registration form is still failing for the test account (`adeyadewuyi@gmail.com`, role: `user`, company: URBAN-SPIRIT).

The frontend now correctly reads the HTTP status code from the error. The error is **not** 403, 401, or a network error — it is falling into the generic catch, which means the backend is returning a status code that is **not** 404, 403, or 401.

---

## Specific Question

When a user from company **URBAN-SPIRIT** calls:

```
GET /api/property-enumeration/customers?search=Jo&limit=10
Authorization: Bearer <valid JWT>
```

...and **no customers have been loaded yet** for that company — what does the backend return?

Please confirm **exactly**:

1. **HTTP status code** — e.g. 200, 400, 404, 500?
2. **Response body** — e.g.:
   - `{ "success": true, "data": { "customers": [] } }` (empty array — this is ideal)
   - `{ "success": false, "message": "No customers found" }` with status 200
   - `{ "success": false, "message": "..." }` with status 400 or 404
   - Something else?

---

## What the Frontend Needs

The frontend can handle **any** of these correctly — but it needs to know which one the backend actually returns so the right case is handled:

| Backend returns | Frontend action |
|---|---|
| `200 { customers: [] }` | Show "No customers found" — already works |
| `200 { success: false }` | Show "No customers found" — already handled |
| `404` | Treat as empty — already handled |
| `400` | **Not yet handled** — currently shows error |
| `500` | Genuine server error — show error message |

---

## Additional Check

Please also confirm: does the `GET /customers` endpoint require a **minimum query length** (e.g. at least 3 characters)? The test above used `"Jo"` (2 characters). If the backend rejects queries shorter than 3 characters with a 400, the frontend needs to enforce the same minimum before sending the request.

---

## No Code Change Needed on Backend

This is **information only** — no backend change is required. Once you confirm the HTTP status and response body, the frontend will be fixed in v1.41.0 within the same session.
