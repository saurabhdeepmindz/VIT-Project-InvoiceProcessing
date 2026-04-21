# E2E Requirements Traceability Matrix (RTM)

Every Playwright spec below is tagged with the EPIC it belongs to, the user
story it verifies, the requirement IDs it exercises, and the backend +
frontend surfaces it traces to. The `EPIC-XXX-…` folders on disk mirror the
EPIC numbering in `README.md` and the LLD document.

> ` * ` next to EPIC-003 / EPIC-004 indicates a *lifecycle / observation*
> spec: those EPICs are headless server-side pipelines with no dedicated UI
> surface, so the E2E test asserts their outcomes through the downstream
> tracker. Functional coverage lives in backend Jest and Python pytest.

## Coverage overview

| EPIC       | User Story | Requirement(s)                    | Spec                                                |
| ---------- | ---------- | --------------------------------- | --------------------------------------------------- |
| EPIC-001   | US-001.1   | REQ-001.1, REQ-001.2, REQ-001.4   | `epic-001-auth/login.spec.ts`                       |
| EPIC-001   | US-001.2   | REQ-001.5–REQ-001.8               | `epic-001-auth/forgot-password.spec.ts`             |
| EPIC-001   | US-001.3   | REQ-001.9, REQ-001.10, REQ-001.11 | `epic-001-auth/rbac.spec.ts`                        |
| EPIC-002   | US-002.1   | REQ-002.1–REQ-002.4               | `epic-002-upload/csv-upload.spec.ts`                |
| EPIC-003 * | US-003.1   | REQ-003.1–REQ-003.4               | `epic-003-preprocessing/pipeline-lifecycle.spec.ts` |
| EPIC-004 * | US-004.1   | REQ-004.1–REQ-004.4               | `epic-004-eda/extraction-fields.spec.ts`            |
| EPIC-005   | US-005.1   | REQ-005.1–REQ-005.4               | `epic-005-tracker/tracker-list.spec.ts`             |
| EPIC-005   | US-005.2   | REQ-005.5–REQ-005.8               | `epic-005-tracker/tracker-detail.spec.ts`           |
| EPIC-006   | US-006.1   | REQ-006.1–REQ-006.4               | `epic-006-dashboard/dashboard.spec.ts`              |
| EPIC-007   | US-007.1   | REQ-007.1, REQ-007.3              | `epic-007-reports/reports.spec.ts`                  |

## Surfaces traced (backend + frontend symbols per spec)

* **`epic-001-auth/login.spec.ts`** — `auth.controller#login`, `auth.service#login`, `app/login/page.tsx`, `services/auth.api.ts#login`
* **`epic-001-auth/forgot-password.spec.ts`** — `auth.controller#requestReset`, `auth.service#requestPasswordReset`, `app/forgot-password/page.tsx`
* **`epic-001-auth/rbac.spec.ts`** — `JwtAuthGuard`, `RolesGuard`, client-side route guards
* **`epic-002-upload/csv-upload.spec.ts`** — `invoice.controller#uploadBatch`, `invoice.service#createBatch`, `app/upload/page.tsx`
* **`epic-003-preprocessing/pipeline-lifecycle.spec.ts`** — `preprocessing.scheduler`, `preprocessing.service`, `image-fetch.service`, `pdf-inspect.service`, `dlq.service`
* **`epic-004-eda/extraction-fields.spec.ts`** — `extraction_service.py`, LLM providers (stub / nano_banana / openai / anthropic), `eda.service.ts`, `csv-output.service.ts`, `app/tracker/[batchId]/page.tsx`
* **`epic-005-tracker/tracker-list.spec.ts`** — `tracker.controller#list`, `tracker.service#listFiles`, `app/tracker/page.tsx`
* **`epic-005-tracker/tracker-detail.spec.ts`** — `tracker.controller#detail`, `tracker.service#getDetail`, `app/tracker/[batchId]/page.tsx`
* **`epic-006-dashboard/dashboard.spec.ts`** — `dashboard.controller`, `dashboard.service`, `app/dashboard/page.tsx`
* **`epic-007-reports/reports.spec.ts`** — `reporting.controller`, `reporting.service`, `app/reports/page.tsx`

## Requirement catalogue (short form)

### EPIC-001 — Authentication & User Management

| ID          | Requirement                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------- |
| REQ-001.1   | Valid credentials return access + refresh tokens.                                             |
| REQ-001.2   | Invalid credentials surface a generic error without revealing which field failed.             |
| REQ-001.3   | Successful login lands on an authorised workspace route.                                      |
| REQ-001.4   | "Remember me" persists the email across sessions (not the password).                          |
| REQ-001.5   | `/forgot-password` accepts an email address.                                                  |
| REQ-001.6   | Reset response is enumeration-safe (same copy regardless of account existence).               |
| REQ-001.7   | In demo mode the reset URL is logged server-side for manual copy.                             |
| REQ-001.8   | "Back to sign in" link returns to `/login`.                                                   |
| REQ-001.9   | Unauthenticated access to protected routes redirects to `/login`.                             |
| REQ-001.10  | Sign-out clears session state and returns to `/login`.                                        |
| REQ-001.11  | Admin login reaches the admin-accessible workspace routes.                                    |

### EPIC-002 — Invoice Batch Management

| ID          | Requirement                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------- |
| REQ-002.1   | `/upload` presents a drop-zone and a native file chooser.                                     |
| REQ-002.2   | A valid CSV upload creates a new batch row (status = UPLOADED).                               |
| REQ-002.3   | Upload UI displays the success state with the new batch ID.                                   |
| REQ-002.4   | Recent-batches table includes the newly uploaded batch on refresh.                            |

### EPIC-003 — Preprocessing Pipeline *(observation spec)*

| ID          | Requirement                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------- |
| REQ-003.1   | Preprocessing runs asynchronously after upload.                                               |
| REQ-003.2   | Tracker exposes a `preprocessingStatus` badge per batch.                                      |
| REQ-003.3   | `batchStatus` transitions UPLOADED → PREPROCESSING → EDA_PROCESSING → DONE/PARTIAL/FAILED.    |
| REQ-003.4   | Permanently-failing records land in the DLQ and are visible in tracker detail.                |

### EPIC-004 — Automated Invoice Data Extraction *(observation spec)*

| ID          | Requirement                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------- |
| REQ-004.1   | Tracker detail exposes the 13 canonical fields per LLD §3.2 plus `llm_provider_used`.         |
| REQ-004.2   | Tracker surfaces an `edaStatus` badge per batch (EXTRACTED / PARTIAL / FAILED).               |
| REQ-004.3   | Batches with any successful extraction expose a numeric `avgConfidence` (0–100).              |
| REQ-004.4   | DONE batches expose a downloadable output CSV link.                                           |

### EPIC-005 — Processing Status Tracker

| ID          | Requirement                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------- |
| REQ-005.1   | `/tracker` renders a paginated list of batches.                                               |
| REQ-005.2   | Each row exposes batch id, file name, status, record counts.                                  |
| REQ-005.3   | Status column uses colour-coded badges per status enum.                                       |
| REQ-005.4   | Clicking a row navigates to `/tracker/{batchId}`.                                             |
| REQ-005.5   | Detail view loads a summary block (batch id, status, timings, counts, avg-confidence).        |
| REQ-005.6   | Per-record panel exposes the 13 extracted fields per LLD §3.2.                                |
| REQ-005.7   | Audit tail shows recent audit log entries for the batch.                                      |
| REQ-005.8   | DLQ section lists dead-lettered records for that batch.                                       |

### EPIC-006 — Operational Dashboard

| ID          | Requirement                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------- |
| REQ-006.1   | Metric tiles for total batches, total records, average confidence.                            |
| REQ-006.2   | Trend chart / series for the selected window.                                                 |
| REQ-006.3   | Top-errors panel lists the worst recent batches.                                              |
| REQ-006.4   | Date-range filter present with sensible defaults.                                             |

### EPIC-007 — Reporting Module

| ID          | Requirement                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------- |
| REQ-007.1   | `/reports` renders three report-type tabs: single-file, weekly, error.                        |
| REQ-007.2   | Single-file form accepts a batch ID and triggers generation.                                  |
| REQ-007.3   | History panel lists previously generated files.                                               |
| REQ-007.4   | Download action issues a signed-URL fetch.                                                    |
