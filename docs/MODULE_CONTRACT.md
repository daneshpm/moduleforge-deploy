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
4. Namespacing: permissions, published events and DB tables are prefixed with the module `id`, so modules cannot collide. The only exception is the small closed list of well-known platform events (`payment.received`, `payment.failed`), which any module may publish.

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
| `requires.hostServices[]` | string | no | Known: `auth.currentUser`, `db`, `notifications`, `storage`, `email`, `events`, `logger`, `config` (unknown = warning) |
| `events.publishes[]` | `<module_id_with_underscores>.<event>` (`^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$`) | no | Must start with the own module id with hyphens converted to underscores, then `.` (e.g. `payment-method` publishes `payment_method.added`). Exception: the **well-known platform events** `payment.received` and `payment.failed` (list in `definitions.wellKnownPlatformEvents` of the schema) may be published by any module, so a payment gateway can emit the event the invoice module consumes without importing it |
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
- **Not manifest v1 = legacy, not an error.** A `module.json` that neither declares `contractVersion: "1"` nor has the v1 identity fields `id` + `type` (e.g. the old `slug`/`technologies` shape) is treated as a legacy module: accepted with warnings (`legacy: no contract` plus a note), `contractVersion = null`. Only a `module.json` that declares v1 (or has `id` + `type`) and fails validation, or is not parseable JSON, is rejected (400).
- `POST /api/modules/upload` and `/github` return `contract` and `warnings` for pre-fill/preview and do not block.

## Persistence

On `Module` and `ModuleVersion`: `contractVersion`, `dependsOn`, `requiredEnv`, `hostServices`, `eventsPublished`, `eventsConsumed`, `permissions` (JSON strings). `moduleJson` stores the validated manifest.

## Dependency check

`GET /api/modules/:id/dependency-check?projectId=...` returns `{ ok, missing[], conflicts[], warnings[] }`.
Resolution (`server/src/services/dependencyResolver.ts`) uses semver: a dependency is *missing* if absent from the project, a *conflict* if the installed version is outside the range, or if an installed module requires a range the new module does not satisfy. The project import flows (`ingest-zip`, `ingest-github`, `ingest-marketplace`) return the same information as a non-blocking `warnings` array.

## Publishing, versions and slugs

- **`slug == id`**: when a valid v1 manifest exists, `Module.slug` is forced to the manifest `id` (the display name no longer matters). Publishing a second module with an id that is already taken returns `409` with a message pointing to `PUT /api/modules/<id>`. A manifest `version` is authoritative (the request-body `version` is only used for legacy archives).
- **New versions**: `PUT /api/modules/:id` (and `PATCH`) accepts `storagePath` (an archive from `/upload`) and optional `changelog`. The contract columns (`dependsOn`, `requiredEnv`, ..., `moduleJson`) are refreshed from the archive and a `ModuleVersion` row is created when the version is new. `Module.version` always tracks the highest published semver (publishing an older patch does not move it back). A manifest whose `id` belongs to a different module is a `409`; an invalid v1 manifest is a `400` and nothing is written.
- **Immutable versions**: re-publishing an existing version with identical content (hash over file paths + contents, ignoring zip metadata) is a no-op; with different content it is `409` - bump `version` in `module.json`.
- **GitHub `/sync`** applies the same rules to the downloaded archive (a v1 archive whose version did not change but whose content did is rejected with 409 and `githubSyncStatus = sync_failed`; archives without a v1 manifest just refresh the stored archive).
- `ModuleVersion.contentHash` stores the content hash.

## Install records and upgrades

Every import into a project (`ingest-zip`, `ingest-github`, `ingest-marketplace`) records on `ProjectModule`:

| Field | Meaning |
|---|---|
| `moduleVersion` | exact installed module version |
| `installedContractId` | manifest `id` at install time (null for legacy) |
| `pinnedRange` | semver range requested at install (marketplace `range`), e.g. `^1.0.0` |
| `installedAt` | install/upgrade time |
| `installedHash`, `installedFiles` | sha256 over, and per-file sha256 map of, the files written at install time (the local-edit baseline) |

**Marketplace install** (`POST /api/projects/:id/repository/modules/ingest-marketplace`): body `moduleId` plus optional `version` (exact, must be published, else 404) or `range` (highest satisfying published version, else 404). Neither: the latest published version.

**`GET /api/projects/:id/updates`** (project members) returns, per installed module: `installed`, `latest`, `latestSatisfyingPinnedRange` (highest version within `pinnedRange`, or within `^installed` when unpinned), `updateAvailable`, `breaking` (latest has a higher **major** than installed), `changelog` (of latest) and `changelogs` (each newer version with a changelog), plus `projectModuleId`, `moduleId`, `path`.

**`POST /api/projects/:id/modules/:pmId/upgrade`** body `{ toVersion?, dryRun?, force? }` (project owner, team owner/admin or accepted project admin only; others get 403). Default target is `latestSatisfyingPinnedRange`. Steps:

1. **Dependency resolution** against the other modules of the project (using the dependsOn of the *installed* version of each): a missing required dependency of the new version, a dependency outside its range, or an installed module whose range the new version does not satisfy blocks the upgrade with `409 { blocked: true, missing[], conflicts[], details[] }`. Optional dependencies only warn.
2. **Local edits**: the module directory is compared with `installedFiles`. Files edited locally that the new version also changes (or removes), and files deleted locally that the new version contains, are returned as `conflicts: [{ path, kind: modified|deleted|unknown-baseline }]` with `409` unless `force: true`. Files edited locally that the new version does not touch are kept (`files.preserved`). Installs from before this feature have no baseline (`unknown-baseline`) and need `force`.
3. **Apply** (not on `dryRun`): files dropped by the new version are removed, then the normal ingestion path writes the new files into the same destination and commits; `ProjectModule` version/baseline are updated; a `ModuleCommit` and a `ProjectActivity` (`module_upgraded`) entry are written. The response lists `files.added/changed/removed/preserved`.

`dryRun: true` returns the same plan (200, or the same 409 with details) and never writes files, commits or database rows.
