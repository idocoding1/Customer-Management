# Customer Management

My solution for the Angular home assignment. It's a small app for managing customers: you can see the list, search it, filter by status, sort it, and add or edit customers. It works on desktop and on phones.

The client is Angular 22 with Angular Material. I also built the optional backend, a small Express API that saves the customers to a JSON file.

## How to run it

You need Node.js 20.19 or newer (I used Node 22) and npm.

```bash
npm install
npm start
```

`npm install` in the root also installs the server and client dependencies. `npm start` runs the API on port 3000 and the Angular app on port 4200 together. Then open http://localhost:4200.

Other scripts:

| Script | What it does |
|---|---|
| `npm run start:slow` | Same as `npm start`, but the API waits 800 ms before every response. Good for seeing the loading state and how old requests get cancelled. |
| `npm test` | Runs the client unit tests once (Vitest). |
| `npm run reset-data` | Deletes the data file, so the next start goes back to the sample data. |

### Where the data comes from

The customers are saved in `server/data/customers.json`. That file doesn't exist in the repo. On the first start the server creates it from `server/data/seed.json`, which has 25 sample customers. After that, every add or edit is written to the file, so nothing is lost when the server restarts.

The Angular dev server forwards `/api` calls to `http://localhost:3000` (see `client/proxy.conf.json`), so there's no CORS setup. To run the API on another port, use `PORT=4000 npm --prefix server start` and change the proxy target.

### API

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/customers?q=&status=&sort=&dir=` | `q` searches name and email, ignoring case. `status` is a comma-separated list like `active,lead`; leave it out to get all statuses. `sort` is `name`, `email`, `status` or `createdAt` (default). `dir` is `asc` or `desc` (default). |
| `POST` | `/api/customers` | Body is `{ name, email, status }`. The server sets `id` and `createdAt`. Returns `201`. |
| `PUT` | `/api/customers/:id` | Body is `{ name, email, status }`. |

Bad input returns `400`, an email that's already used returns `409`, and an unknown id returns `404`. All errors come back as `{ message }`.

## Project structure

```
customer-management/
├── package.json                  # root scripts
├── server/
│   ├── data/seed.json            # sample data
│   └── src/
│       ├── index.ts              # routes and input validation
│       └── customer-repository.ts# file storage, search, filter, sort
└── client/src/app/
    ├── app.config.ts
    ├── api-timeout.interceptor.ts# 10 second limit on API calls
    └── customers/
        ├── customer.model.ts
        ├── customer-api.service.ts
        ├── customer-store.ts            # state and the search/sort/filter logic
        ├── customer-list/               # the main page
        └── customer-form-dialog/        # add and edit form
```

## Main decisions

**Keeping it simple.** It's one screen, so I kept everything in one `customers` folder with three parts. `CustomerApiService` only makes HTTP calls. `CustomerStore` holds the state and decides when to call the API. The components show the data and pass user actions to the store. I didn't use NgRx or add shared/core folders, because for an app this size they'd be extra code without much benefit.

**Signals and RxJS.** The store exposes its state as signals (`customers`, `loading`, `error` and so on), and the templates read them directly. I used RxJS only for the request flow, where it really helps: debounce, combining the inputs, and cancelling requests. The app runs without zone.js, which is the default in Angular 22.

**Search that doesn't overload the API.** This was the product requirement, and it's handled in `customer-store.ts`:

```
search input → trim → debounceTime(300ms) → distinctUntilChanged ┐
status filter (immediate) ───────────────────────────────────────┤
sort changes (immediate) ────────────────────────────────────────┼→ combineLatest → switchMap(GET /api/customers)
refresh / after save (immediate) ────────────────────────────────┘
```

- The 300 ms debounce means typing "cohen" sends one request, not five. It still feels instant.
- After trimming, `distinctUntilChanged` skips the request if the text didn't really change, for example extra spaces, or typing a letter and deleting it.
- `switchMap` cancels the previous request when a new one starts, so a slow old response can never replace newer results.
- The status filter, sort, retry and the refresh after saving don't wait for the debounce. They're single clicks, so there's no reason to delay them.
- While a request is running, the old results stay on screen with a thin progress bar on top, so the list doesn't flash empty while you type.
- The search runs on the server, so the client never needs to load every customer. That keeps working when there's more data, and paging can be added to the same endpoint later.

You can see it working in the Network tab, or in the server log, which prints one line per request.

**Data ready when the app starts.** I create the store in `provideAppInitializer`, so the first request goes out during bootstrap, before the list page is drawn. I don't make bootstrap wait for it, though. If the API is down, the app still opens and shows an error with a Retry button instead of a blank page.

**Empty and error states.** I show something different for each case:
- Loading
- No customers at all, with an "Add your first customer" button
- No results for the search or status filter. The message says what was searched, for example *No Inactive or Lead customers match "noah"*, with a button to clear everything.
- The list failed to load, with a message that says whether the server is unreachable or just too slow, and a Retry button

When a save fails, the error shows inside the dialog, so nothing the user typed is lost. If the email is already used, the error appears on the email field.

**Timeout.** All API calls go through an interceptor that gives up after 10 seconds. Without it, if the API hangs, the Save button just spins forever. Now the user gets *"The server took too long to respond"* and can try again. For saves, the message says the save *may* not have gone through, because the server can still finish a request after the browser has given up on it.

**Status is a filter, not a sort.** At first status was one of the sort options, but sorting statuses A to Z isn't useful. What you actually want is to see only certain statuses. So there's a row of Active / Inactive / Lead chips where you can pick one or more, and the filtering happens on the server together with the search. With nothing picked you see everyone, and "Show all" clears the selection.

**A visible sort control.** At first you could only sort by clicking the column headers, and that's hard to discover. So I added a "Sort by" dropdown next to the search box with clear options like "Newest first" and "Name (A–Z)". The headers still work too, and both use the same state, so they always match. On phones, where there are no headers, the dropdown is the only way to sort.

**Small screens.** Under 600px (checked with CDK `BreakpointObserver`) the table turns into a list of cards, the search, sort and filter controls stack, and the dialog takes the full width minus a 16px margin.

**Backend.** Express with a small repository class. The data is kept in memory for reads and written to `customers.json` after every change. Writes are queued and go to a temp file first, which is then renamed. That way two quick saves can't mix together, and a crash can't leave a half-written file. The server also validates the input itself instead of trusting the client.

## Tests

`npm test` runs 16 unit tests (Vitest, the default test runner in Angular 22).

- **`customer-store.spec.ts`** covers the search requirement:
  - The data loads right away on start.
  - Fast typing sends only one request.
  - Typing only spaces doesn't send a request.
  - An old request is cancelled when a new one starts, and its response is ignored.
  - Sort and the status filter don't wait for the debounce, and the filter is combined with the current search.
  - Errors show up (with a specific message for timeouts), and Retry recovers.
- **`api-timeout.interceptor.spec.ts`:** a request with no answer fails after 10 seconds and gets cancelled, and a response that arrives in time goes through normally.
- **`customer-form-dialog.spec.ts`:**
  - Required fields and email format are validated.
  - Values are trimmed when creating.
  - Edit mode fills in the form and calls update.
  - A `409` from the server shows on the email field and the dialog stays open.
  - A timeout shows a message, keeps the dialog open and lets you save again.

What I'd test next:
1. The list component: each empty or error state shows the right message and button, and the table switches to cards on small screens.
2. The API with supertest: validation, duplicate email, search, filter, sort, and that changes are saved to the file.
3. A few Playwright tests for the main flows (search, filter, add, edit, sort) on desktop and mobile sizes, plus an accessibility check with axe.

## Known limitations and what I'd do with more time

- **No paging.** The API returns every match. With more than a few hundred customers I'd add server-side paging (`page` and `pageSize`, plus a total count) with `mat-paginator`, or infinite scroll on mobile.
- **No delete.** It wasn't required. I'd add it with a confirmation and an undo option in the snackbar.
- **Search, filter and sort aren't in the URL.** Refreshing the page resets them, and you can't share a link to a filtered list. I'd sync them to query parameters.
- **The file storage is for one server process.** That's fine here, but there's no locking if several servers write to the file. Next step would be SQLite or Postgres behind the same repository class.
- **A timed-out save might still have been saved.** If that happens with a new customer, retrying will say the email already exists. Sending a unique key with each create would make retries safe.
- **No conflict check.** If two people edit the same customer, the last save wins. An `updatedAt` or version check would fix that.
- **No login or permissions.**
- **English only.** Dates use the browser's locale, and there's no translation setup.
- **Small things:** the status colors are hard-coded instead of coming from the Material theme. The bundle is about 690 kB before compression because of Material; lazy-loading the dialog would make it smaller.

## AI usage

**Tool:** Claude Code.

- **Planning:** I designed how the app should behave: how search, sort, and adding and editing customers should work. Claude then proposed a code structure to implement that, which I reviewed and approved before any code was written.
- **Implementation:** once the plan was settled, I used Claude to scaffold the Angular and Express projects, write a first version of the components, store, server and tests, and check the app in a browser at desktop and mobile sizes. I reviewed and adjusted the code as it went in.

**What I changed or rejected:**
- **Storage:** the first plan kept the customers in memory only, so everything reset when the server restarted. I changed it to file-based storage, so added and edited customers stay.
- **Sorting:** sorting only worked by clicking the column headers, which isn't obvious to a user. I asked for a visible "Sort by" control.
- **Status:** it was offered as a sort option (A to Z). I rejected that, since sorting statuses alphabetically doesn't help anyone, and asked for a status filter where you pick which statuses to see.
- **Timeout:** while testing, I noticed a save that felt slow. It turned out the API had hung for a moment during development, and the Save button would have kept spinning with no limit. I asked for a 10-second timeout with a clear error message.
- **Comments:** I asked to remove the comments that only repeated what the code says, and kept the ones that explain a decision.

I've gone through all the code and run it, and I can explain or change any part of it.
