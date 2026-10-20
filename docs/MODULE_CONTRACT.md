# ModuleForge Module Contract (manifest v1)

Every reusable module ships a `module.json` at the root of its archive (or repo). The machine-readable
schema is [`shared/module.schema.json`](../shared/module.schema.json); validation lives in
`server/src/validator.ts`. This document is the human spec.

## Design rules

1. **Modules never import each other.** Cross-module needs go through exactly two channels:
   - **Host services** (`requires.hostServices`): capabilities the host app injects, e.g. `auth.currentUser`, `db`, `notifications`.
   - **Events** (`events.publishes` / `events.consumes`): named, namespaced messages delivered by the host event bus.
2. `dependsOn` declares that another module must be *present in the project* (so its events/services exist). It is never a code import.
3. Everything a module needs from the outside (env vars, DB tables, permissions) is declared, so it can be checked before import.
4. Namespacing: permissions, published events and DB tables are prefixed with the module `id`, so modules cannot collide.

## Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `contractVersion` | `"1"` | no | Defaults to `"1"` (warning if omitted) |
| `id` | slug `^[a-z0-9]+(-[a-z0-9]+)*$` | yes | Globally unique identity, used for namespacing |
| `name` | string | yes | |
| `version` | semver | yes | e.g. `1.2.0` |
| `description` | string | yes | |
| `type` | `backend` \| `frontend` \| `fullstack` | yes | |
| `category` | one of the seeded categories | yes | CRM, Accounting, Inventory, Payments, Authentication, Analytics, HR, E-commerce, Marketing, Productivity, Communication, Other (`server/src/seed.ts`) |
| `author`, `technologies[]` | | no | Metadata pre-fill |
| `dependsOn[]` | `{ id, versionRange, optional? }` | no | `versionRange` is a semver range; must be valid; no self/duplicate deps; `optional: true` marks a soft dependency |
| `provides.apiPrefix` | string | no | e.g. `/api/invoice` |
| `provides.routes[]` | `{ method, path, description?, permission? }` | no | |
| `provides.uiExports[]` | `{ name, kind?, path? }` | no | kind: component, page, hook, widget |
| `requires.env[]` | `{ name, description?, secret? }` | no | `name` is `UPPER_SNAKE`; no duplicates |
| `requires.database` | `{ tables[], prefix }` | no | Omit entirely when the module has no tables. prefix like `invoice_`; every table must start with it |
| `requires.hostServices[]` | string | no | Known: `auth.currentUser`, `db`, `notifications`, `storage`, `email`, `events`, `logger` (unknown = warning) |
| `events.publishes[]` | `<module_id_with_underscores>.<event>` (`^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$`) | no | Must start with the own module id with hyphens converted to underscores, then `.` (e.g. `payment-method` publishes `payment_method.added`) |
| `events.consumes[]` | `<module>.<event>` (same pattern) | no | Any valid event name; cross-module by design |
| `permissions[]` | `<module>.<resource>.<action>` | no | Must start with own `id.` |
| `runtime` | `{ frontendCommand, backendCommand, workingDir, ports{frontend,backend} }` | no | Commands may be a string or `null`, and `ports` may be omitted: library-style modules mounted into a host have no process. Maps to Module columns `frontendCommand`, `backendCommand`, `workingDir`, `frontendPort`, `backendPort` |
| `compatibility.moduleforge` | semver range | no | Warning if omitted |

Unknown top-level keys are rejected (typos should fail loudly).

## Example

```json
{
  "contractVersion": "1",
  "id": "invoice",
  "name": "Invoice",
  "version": "1.2.0",
  "description": "Create and send invoices",
  "type": "fullstack",
  "category": "Accounting",
  "dependsOn": [{ "id": "payment-method", "versionRange": "^1.0.0", "optional": false }],
  "provides": { "apiPrefix": "/api/invoice", "routes": [{ "method": "GET", "path": "/invoices", "permission": "invoice.invoice.read" }], "uiExports": [{ "name": "InvoiceList", "kind": "component" }] },
  "requires": {
    "env": [{ "name": "SMTP_URL", "description": "Mail server", "secret": true }],
    "database": { "tables": ["invoice_invoices"], "prefix": "invoice_" },
    "hostServices": ["auth.currentUser", "db", "notifications"]
  },
  "events": { "publishes": ["invoice.created"], "consumes": ["payment_method.added"] },
  "permissions": ["invoice.invoice.read", "invoice.invoice.create"],
  "runtime": { "frontendCommand": "npm run dev", "backendCommand": "npm start", "ports": { "frontend": 5173, "backend": 5000 } },
  "compatibility": { "moduleforge": ">=1.0.0" }
}
```

## Validation behaviour

- `module.json` found (root, or inside a single top-level folder as GitHub zips do): validated against the schema plus semantic checks (namespacing, semver ranges, table prefix, duplicates). Result: `{ errors: [{path, message}], warnings: [] }`.
- **Publish** (`POST /api/modules`) with an invalid `module.json` returns `400 { error, errors[], warnings[] }`.
- **No `module.json` (legacy mode)**: import still works, with warning `legacy: no contract` and `contractVersion = null`. The UI shows a "legacy module" badge.
- `POST /api/modules/upload` and `/github` return `contract` and `warnings` for pre-fill/preview and do not block.

## Persistence

On `Module` and `ModuleVersion`: `contractVersion`, `dependsOn`, `requiredEnv`, `hostServices`, `eventsPublished`, `eventsConsumed`, `permissions` (JSON strings). `moduleJson` stores the validated manifest.

## Dependency check

`GET /api/modules/:id/dependency-check?projectId=...` returns `{ ok, missing[], conflicts[], warnings[] }`.
Resolution (`server/src/services/dependencyResolver.ts`) uses semver: a dependency is *missing* if absent from the project, a *conflict* if the installed version is outside the range, or if an installed module requires a range the new module does not satisfy. The project import flows (`ingest-zip`, `ingest-github`, `ingest-marketplace`) return the same information as a non-blocking `warnings` array.
