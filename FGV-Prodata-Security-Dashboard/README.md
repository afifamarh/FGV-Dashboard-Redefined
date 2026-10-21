# FGV Prodata — Network & IT Security Dashboard

Security Hardening & Vulnerability Management Dashboard — a **front-end functional prototype (FYP)** for FGV Prodata Network & IT Security.

This project is the existing single-file prototype separated into HTML, CSS, JavaScript and vendor files so it can be developed in VS Code. The UI, calculations, sample data and behaviour are unchanged from the single-file version.

## Important notes

- **Prototype only.** No backend, no database, no real authentication. Everything runs in the browser.
- **All sample data is fictional** (DEMO- names, CVE-2099-* IDs, generic locations). Nothing is real FGV / FELDA data.
- Hardening controls are a **proposed sample baseline**, not confirmed FGV Prodata production policies.
- The SCCM "Out of Coverage" rule (external IP / 192.168.x.x) and the import CSV/Excel field names are prototype assumptions still to be confirmed.
- No `Math.random()` is used: sample data is deterministic and identical on every load.
- Imported files (CSV, Excel, PDF, TXT) are read **in the browser only**; nothing is uploaded.
- Data added or imported is kept in browser `localStorage` (this browser only). Preferences, profile, imported datasets and audit log persist there.

## Run it

1. Open the `FGV-Prodata-Security-Dashboard` folder in VS Code (**File → Open Folder**).
2. **Option A (recommended): Live Server.** Install the *Live Server* extension, right-click `index.html` → **Open with Live Server**.
3. **Option B:** open `index.html` directly in a modern browser (double-click). It works from disk too: no build step and no network requests are needed.

No Node.js, npm or build tools are required.

## Demo login (prototype only, not real authentication)

| Role | Username | Password |
|---|---|---|
| IT Security Admin | `admin` | `admin123` |
| FGV Management | `fgv` | `fgv123` |
| FELDA Management | `felda` | `felda123` |

"Forgot password → Reset password" really changes the demo password in this browser; the login card offers "Restore default demo password".

## Folder structure

```
FGV-Prodata-Security-Dashboard/
├── index.html            HTML structure only (login, sidebar, header, pages, modal/toast roots)
├── css/
│   └── style.css         All CSS: variables, light/dark theme, layout, components, responsive rules
├── js/                   Application code (plain scripts, loaded in the order listed below)
├── vendor/               Third-party libraries (local copies, no CDN)
│   ├── chart.js          Chart.js 4.4.1 (UMD build)
│   ├── xlsx.js           SheetJS 0.20.x (Excel .xlsx / .xls import)
│   ├── pdf.js            PDF.js 3.11 (PDF import)
│   └── pdf.worker.js     PDF.js worker source, stored as a string and started from a local blob: URL
└── README.md
```

### JavaScript files (in load order)

The scripts share one global scope (no modules), because `index.html` uses inline `onclick="..."` handlers. **The load order matters** — it follows the order of the original single file.

| File | Contents |
|---|---|
| `utilities.js` | Page-source snapshot, inline SVG icons, date / escape / storage helpers, badges, toast |
| `data.js` | Shared sample data: endpoints, vulnerabilities, hardening controls, security tools, notifications |
| `derived-data.js` | Endpoint attributes and every calculated value, incl. the SCCM single source of truth (`sccmSummary()`, `SCCM_LISTS`, `isOutOfCoverage()`) |
| `state.js` | Profile (persisted), preferences, UI filter state |
| `auth.js` | Login, logout, forgot / reset password, role-based access |
| `settings.js` | Theme and notification / KPI-card preferences |
| `profile.js` | Profile view / edit / reset |
| `navigation.js` | Sidebar routing (`goTo`), page switching, `refreshViews` |
| `charts.js` | Chart.js setup and theme-aware chart functions |
| `dashboard.js` | Dashboard KPIs, posture ring, tool cards, Patch Compliance view, **SCCM Patch Management page** |
| `security-tools.js` | Security tool pages / cards, **Microsoft Defender EDR page** |
| `endpoint-security.js` | Endpoint Security table, CRUD, detail view, configuration checklist, **Endpoint History** |
| `vulnerability.js` | Vulnerability Management |
| `security-hardening.js` | Security Hardening |
| `reports.js` | Reports view / generate / export |
| `exports.js` | CSV export, Copy / Download / Share prototype |
| `import-reports.js` | Import Reports: CSV / Excel / PDF / TXT readers, validation, preview, import history, imported-data store |
| `modals.js` | Generic open / close modal |
| `notifications.js` | Bell panel, read / unread, delete, filtering |
| `additions.js` | Requirement additions: Kaspersky page, Trend Micro / CRAM page, Audit Trail, Excel / PDF export, SCCM extra KPI cards |
| `refinements.js` | Trend Micro interactions, import management (delete imported data / history, restore previous) |
| `app.js` | Global search and filter listeners, app bootstrap and first render (**must load last**) |

Some features were added to the prototype as later "layers" that wrap earlier functions (for example `renderSccmPage`, `goTo`, `overrideDataset`). Those wrappers live in `additions.js` / `refinements.js` and must stay **after** the file that defines the original function.

## Libraries

- **Chart.js 4.4.1** — charts (`vendor/chart.js`)
- **SheetJS 0.20.x** — Excel `.xlsx` / `.xls` reading (`vendor/xlsx.js`)
- **PDF.js 3.11** — PDF reading (`vendor/pdf.js`, `vendor/pdf.worker.js`)
- **Inter** font is referenced by name and falls back to system fonts; there are no external requests.

## Known differences from the single-file version

- The in-app "Copy source code" / "Download HTML" action exports the page source of `index.html` only (a single self-contained file is no longer what the app is made of).
- The PDF.js library now loads at start-up from `vendor/pdf.js` instead of being evaluated only when a PDF is first imported.
