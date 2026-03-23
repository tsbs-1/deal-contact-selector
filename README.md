# Deal Contact Selector App

A HubSpot private app that lets you do the following on Deal records:

- List contacts associated with companies linked to the Deal
- Exclude contacts already associated with the Deal
- Select unassociated contacts and bulk-associate them with the Deal

Built with UI Extensions, serverless functions, and the HubSpot CRM REST API.

---

## 1. Feature overview

### Where it appears

- Shows a **Deal Contact Selector** card on the Deal record tab in CRM

### What you can do

- Resolve companies linked to the Deal
- Load contacts linked to those companies
- Exclude contacts already directly associated with the Deal
- Search, filter, select, and bulk-associate

### Data loading approach

- Uses the CRM REST API (not GraphQL)
- Associations API (v4) is used with pagination to fetch all records

---

## 2. Architecture

### Frontend (UI Extension)

- `src/app/extensions/DealContactSelector.jsx`
  - Card UI built with HubSpot UI components
  - Calls serverless functions via `runServerlessFunction`

### Serverless functions

- `src/app/app.functions/deal-contact-data-fetcher.js`
  - Fetches Deal, Company, and Contact data from the CRM REST API
  - Determines associated vs. unassociated contacts and returns data for the UI

- `src/app/app.functions/associations-handler.js`
  - Associates selected contacts with the Deal

### Function registration

- `src/app/app.functions/serverless.json`
  - `deal-contact-data-fetcher`
  - `associations-handler`

---

## 3. APIs used (HubSpot CRM REST)

### Read

- `GET /crm/v3/objects/deals/{dealId}?properties=dealname`
- `GET /crm/v4/objects/deal/{dealId}/associations/company`
- `GET /crm/v4/objects/deal/{dealId}/associations/contact`
- `GET /crm/v4/objects/company/{companyId}/associations/contact`
- `POST /crm/v3/objects/companies/batch/read`
- `POST /crm/v3/objects/contacts/batch/read`

### Write

- `PUT /crm/v4/objects/deal/{dealId}/associations/default/contact/{contactId}`

---

## 4. Required scopes

Defined in `src/app/app.json`:

- `crm.objects.contacts.read`
- `crm.objects.contacts.write`
- `crm.objects.deals.read`
- `crm.objects.deals.write`
- `crm.objects.companies.read`

---

## 5. Setup

### Prerequisites

- A HubSpot account
- [HubSpot CLI](https://www.npmjs.com/package/@hubspot/cli) installed
- Logged in to the CLI (`hs auth`)

### Environment variables (serverless)

If you use a private app access token in serverless functions, configure the secret in HubSpot. This project references `PRIVATE_APP_ACCESS_TOKEN`.

---

## 6. Development commands

### Local development

```bash
hs project dev
```

### Upload and deploy

```bash
hs project upload
```

---

## 7. Key files

```text
.
├── hsproject.json
└── src/
    └── app/
        ├── app.json
        ├── extensions/
        │   ├── example-card.json
        │   └── DealContactSelector.jsx
        └── app.functions/
            ├── serverless.json
            ├── deal-contact-data-fetcher.js
            └── associations-handler.js
```

---

## 8. Common issues and fixes

### 1) Only some contacts are shown

- **Cause:** Associations not fully paginated
- **Fix:** Use the v4 associations API with `after` to fetch all pages

### 2) Broken layout / misaligned columns

- **Cause:** Custom CSS mimicking a table
- **Fix:** Use HubSpot’s standard `Table` components

### 3) 400 errors when associating

- **Cause:** Wrong association endpoint format
- **Fix:** Use the v4 default association endpoint

### 4) Insufficient scope errors

- **Cause:** Missing scopes in `app.json`
- **Fix:** Add the required scopes and redeploy

---

## 9. Notes

- Uses `platformVersion: 2025.1` (see `hsproject.json`)
- Follow HubSpot announcements and plan for future platform migrations

---

## 10. Naming

Renamed from the previous template name **Get started App** to:

- App name: **Deal Contact Selector App**

The `uid` was left unchanged to stay compatible with existing deployed assets.
