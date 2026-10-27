# Customer Management

A small customer management app. It's an Angular 22 client with Angular Material, backed by an Express API that stores customers in a JSON file.

You can list, search, sort, add and edit customers. The layout works on desktop and on phones.

## Getting started

Requirements: Node.js 20.19+ (developed on Node 22) and npm.

```bash
npm install     # installs root, server and client dependencies
npm start       # starts the API on :3000 and the Angular app on :4200
```

Then open http://localhost:4200.

| Script | What it does |
|---|---|
| `npm start` | Runs the API (`server/`) and the Angular dev server (`client/`) together. |
| `npm run start:slow` | Same, but every API response is delayed by 800 ms. Use it to see the loading state and request cancellation. |
| `npm test` | Runs the client unit tests once (Vitest). |
| `npm run reset-data` | Deletes the data file, so the next start reloads the seed data. |

### Data source

- Customers are stored in `server/data/customers.json`.
- On first start, the server creates that file from `server/data/seed.json` (25 sample customers).
- Every create or update is written back to the file, so changes survive restarts.
- The data file is git-ignored. `seed.json` is the committed starting point.
- The Angular dev server forwards `/api/*` to `http://localhost:3000` (`client/proxy.conf.json`), so no CORS setup is needed.
- To run the API on a different port: `PORT=4000 npm --prefix server start`, then update the proxy target.

### API

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/customers?q=&sort=&dir=` | `q` searches name and email, ignoring case. `sort` is one of `name`, `email`, `status`, `createdAt` (the default). `dir` is `asc` or `desc` (the default). |
| `POST` | `/api/customers` | Body: `{ name, email, status }`. The server sets `id` and `createdAt`. Returns `201`. |
| `PUT` | `/api/customers/:id` | Body: `{ name, email, status }`. |

Validation errors return `400`, a duplicate email returns `409` and an unknown id returns `404`, each with a `{ message }` body.

## Project structure

```
customer-management/
├── package.json                  # root scripts (concurrently)
├── server/
│   ├── data/seed.json            # initial data (customers.json is created at runtime)
│   └── src/
│       ├── index.ts              # Express routes + request validation
│       └── customer-repository.ts# file-backed storage, search, sort
└── client/src/app/
    ├── app.config.ts             # HttpClient + eager store initialisation
    └── customers/
        ├── customer.model.ts
        ├── customer-api.service.ts      # thin HttpClient wrapper
        ├── customer-store.ts            # state (signals) + search/sort request pipeline
        ├── customer-list/               # page: search, sort, table/cards, empty/error states
        └── customer-form-dialog/        # add + edit form (one component)
```

## Architecture and technical choices

**One feature folder, three layers.**
- `CustomerApiService` only makes HTTP calls.
- `CustomerStore` owns the state and the request logic.
- The components only render and forward user actions.

I didn't add NgRx, a shared or core library, or generic base classes. For one screen they'd add ceremony without making the code clearer.

**Signals for state, RxJS for the request pipeline.** The store exposes read-only signals (`customers`, `loading`, `loaded`, `error`, `activeSearch`, `sort`) that templates read directly. RxJS is used only where it's clearly the better tool: debouncing, combining inputs and cancelling requests. The app runs zoneless, the Angular 22 default.

**Search: responsive without overloading the API.** This was the product requirement. The pipeline in `customer-store.ts` works like this:

```
search input → trim → debounceTime(300ms) → distinctUntilChanged ┐
sort changes (immediate) ────────────────────────────────────────┼→ combineLatest → switchMap(GET /api/customers)
refresh / after save (immediate) ────────────────────────────────┘
```

- **Debounce (300 ms):** typing "cohen" sends one request, not five. 300 ms is short enough to feel instant and long enough to cover normal typing speed.
- **`distinctUntilChanged` after trimming:** adding spaces, or typing and deleting back to the same text, doesn't send a request.
- **`switchMap`:** when a new query starts, the unfinished HTTP request is cancelled. A slow, older response can't overwrite newer results.
- **Sort, retry and refresh after save skip the debounce,** because they're single deliberate actions.
- **The current results stay on screen while a request is running,** with a thin progress bar on top, so the list doesn't flash empty while you type.
- **Search runs on the server,** so the client never needs the full dataset. That keeps working as the data grows, and pagination can be added on the same endpoint.

You can see this in the browser's Network tab, or in the server log, which prints one line per request.

**Data available on startup.** `provideAppInitializer` creates the store during bootstrap, so the first request starts before the list component renders. Bootstrap doesn't wait for it, so if the API is down the app still loads and shows an error with a Retry button instead of a blank page.

**Empty and error states are handled separately:**
- Loading
- No customers at all (with an "Add your first customer" button)
- No matches for the search (shows the search term, with a "Clear search" button)
- Load error (a specific message when the server can't be reached, plus Retry)

Save errors stay inside the dialog, so the user doesn't lose what they typed. A duplicate email (`409`) is shown as an error on the email field.

**Sorting is easy to find.** A "Sort by" dropdown next to the search box offers plain-language options ("Newest first", "Name (A–Z)", and so on). It's always visible, so users don't need to know that column headers can be clicked. Clicking a header still sorts too, and both read and write the same store state, so they always match. On phones, where the cards have no headers, the dropdown is the only sort control.

**Responsive layout.** Below 600px (checked with CDK `BreakpointObserver`):
- The table is replaced by a card list.
- The dialog spans the screen width minus a 16px margin.

**Backend.** Express with a small repository class. Data is kept in memory for reads and written to `customers.json` on every change. Writes go through a queue and use write-to-temp-then-rename, so two quick saves can't corrupt the file. The server validates input itself rather than trusting the client.

## Tests

`npm test` runs 11 unit tests (Vitest, the Angular 22 default):

- **`customer-store.spec.ts`** (covers the search requirement):
  - Loads data immediately on start.
  - Fast typing produces exactly one request.
  - Whitespace-only changes don't send a request.
  - An older request is cancelled when a newer query starts, and its response is ignored.
  - Sorting skips the debounce.
  - The error state appears, and Retry recovers from it.
- **`customer-form-dialog.spec.ts`:**
  - Required and email validation.
  - Values are trimmed on create.
  - Edit mode pre-fills the form and calls update.
  - A `409` from the server is shown on the email field and the dialog stays open.

What I'd test next:
1. **List component tests:** each empty/error state renders the right message and button, and the table switches to cards at the breakpoint.
2. **API tests** for the server with supertest: validation, duplicate email, search and sort, and persistence to the file.
3. **A few Playwright end-to-end tests** of the main flows (search, add, edit, sort) on desktop and mobile viewports, including an accessibility check with axe.

## Known limitations and what I'd improve with more time

- **No pagination.** The API returns every match. Beyond a few hundred customers I'd add server-side paging (`page`/`pageSize`, plus a total count) with `mat-paginator` or infinite scroll on mobile.
- **No delete.** It isn't in the requirements. I'd add it with a confirmation step and an undo snackbar.
- **Search and sort aren't saved in the URL.** Refreshing the page resets them, and you can't share a link to a filtered list. I'd sync them to query parameters.
- **File storage is single-process.** It's fine for a demo, but there's no locking across multiple server instances. The next step would be SQLite or Postgres behind the same repository interface.
- **No editing conflicts are detected.** If two people edit the same customer, the last save wins. An `updatedAt` or version check would fix that.
- **No authentication or authorization.**
- **No i18n.** Dates use the browser's default locale, and the UI text is English only.
- **Small things:** status colors are hard-coded rather than taken from the Material theme. Material makes the bundle about 690 kB before compression, which could be reduced by lazy-loading the dialog.

## AI usage

<!-- TODO: review and rewrite this section in your own words before submitting. -->

- **Tools:** Claude Code (Claude Opus).
- **What I used it for:** reading the brief and drafting an implementation plan, which I reviewed and changed before any code was written. Also scaffolding the Angular and Express projects, writing a first version of the components, store, server and tests, and checking the app in a browser at desktop and mobile sizes.
- **What I changed or rejected:**
  - The AI's plan kept customers in memory only, so data reset on every server restart. I changed this to file-based storage (`server/data/customers.json`, created from a seed file), so added and edited customers survive restarts.
  - <!-- Add at least one example of your own from reviewing the code: something you questioned, simplified or changed. -->
- I've read and run all of the code, and I can explain or change any part of it.
