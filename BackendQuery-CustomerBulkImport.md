# Backend Coordination Query — Customer Bulk Import
**Date:** March 1, 2026  
**From:** Frontend Team  
**To:** Backend Developer  
**Re:** Customer pre-population / bulk import for franchisee digitalisation  
**Priority:** High — blocks customer linking for all new franchisees

---

## Context

The mobile app's customer linking flow (Step 2 of building registration) works by searching the backend's customer database in real time via:

```
GET /api/property-enumeration/customers?search=<query>&limit=10
```

This means **all customers must already exist in the backend database before a surveyor can link them to a building**. Currently there is no way to create a new customer from the mobile app — the app is search-and-link only by design.

The question is: **how do franchisees/companies load their existing customer lists into the system before enumeration begins?**

---

## Questions for the Backend Developer

### Question 1 — Does a bulk import endpoint already exist?

Please confirm whether any of the following already exist on the backend:

| # | Endpoint | Description |
|---|---|---|
| A | `POST /api/property-enumeration/customers/bulk` | Accepts an array of customer objects in JSON |
| B | `POST /api/property-enumeration/customers/import` | Accepts a CSV or Excel file upload |
| C | `POST /api/property-enumeration/customers` | Single customer create (can be called in a loop) |
| D | Any admin portal / dashboard route for customer upload | Web-based import tool |

If **any** of the above exist, please provide:
- The exact endpoint path and HTTP method
- The accepted request format (JSON array, CSV, Excel/XLSX, multipart)
- The required and optional fields per customer record
- The expected response shape (success count, error list, etc.)
- Any rate limits or batch size limits

---

### Question 2 — Is customer data scoped per company (franchisee)?

This is the most critical architectural question. The backend already has a `companyId` field on every customer document (confirmed from the `GET /customers` response shape). The question is whether the import and search are **scoped to the authenticated user's company** or **global across all companies**.

**Specifically:**

1. When a surveyor calls `GET /api/property-enumeration/customers?search=John`, does the backend return:
   - **(A) Only customers belonging to the surveyor's company** (`companyId` matches the JWT token's company), or
   - **(B) All customers across all companies** (global search)?

2. When a franchisee imports customers (via bulk import, if it exists), are those customers:
   - **(A) Automatically scoped to their company** (the `companyId` is inferred from the authenticated admin's token), or
   - **(B) Assigned to a company via an explicit field in the import payload** (e.g. `"companyId": "abc123"`)?

3. Can **Company A's surveyors see or link Company B's customers**? This must be a hard no — customer data must be isolated per franchisee.

---

### Question 3 — What fields does a customer record require?

For the frontend to build a correct import template (CSV headers, JSON schema), please confirm the full customer schema:

| Field | Required? | Type | Notes |
|---|---|---|---|
| `name` / `customerName` | ✅ Required | string | Which field name does the backend accept? |
| `phone` / `phoneNumber` | Optional | string | Which field name? |
| `email` | Optional | string | |
| `address` | Optional | string | Physical address of the customer's premises |
| `propertyType` | Optional | string | `Residential` / `Commercial` / `Industrial` / `Mixed-Use` |
| `lotCode` | Optional | string | Which lot the customer belongs to |
| `companyId` | Required on import? | string | Or inferred from auth token? |
| `customerId` | Optional | string | External reference ID (e.g. from franchisee's own system) |

---

### Question 4 — What happens to duplicate customers on import?

If a franchisee imports a customer that already exists (same name + phone, or same external `customerId`):

- Does the backend **reject** the duplicate with an error?
- Does it **skip** the duplicate silently?
- Does it **upsert** (update the existing record)?

The frontend needs to know this to display the correct feedback to the franchisee after import.

---

## What the Frontend Will Build (Once Confirmed)

Once the backend confirms the import mechanism and data isolation model, the frontend will implement:

1. **A "Load Customers" screen** accessible before or during a session, where a franchisee admin can:
   - Upload a CSV file from their device
   - Preview the parsed rows (name, phone, address, lot code) before committing
   - Submit the batch and see a success/error summary (e.g. "47 imported, 3 skipped — duplicate phone number")

2. **Company-scoped search** — if the backend confirms that search is already scoped by `companyId` from the JWT token, no frontend change is needed. If it is currently global, the frontend will add a `companyId` filter param to the search call.

3. **Import status indicator** — a badge on the customer search screen showing "N customers loaded for [Lot Code]" so surveyors know whether their company's data has been imported before they start.

---

## Non-Breaking Requirement

Whatever import mechanism is implemented, the existing `GET /api/property-enumeration/customers?search=<query>` endpoint must continue to work exactly as it does today. The import is purely additive — it populates the database that the search already reads from.

---

*Please respond with a backend update document confirming the answers to the 4 questions above, or flag any that require architectural discussion.*
