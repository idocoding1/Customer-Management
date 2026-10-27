import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  Observable,
  Subject,
  TimeoutError,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { CustomerApiService } from './customer-api.service';
import { Customer, CustomerInput, CustomerSort, CustomerStatus } from './customer.model';

export const SEARCH_DEBOUNCE_MS = 300;

interface CustomerState {
  customers: Customer[];
  loading: boolean;
  /** True once the first request has completed (successfully or not). */
  loaded: boolean;
  error: string | null;
  /** The search term and status filter the current `customers` were fetched with. */
  search: string;
  statuses: CustomerStatus[];
}

/**
 * Holds the customer list and owns the search/sort -> API request pipeline.
 *
 * Search is debounced and de-duplicated so typing doesn't fire a request per keystroke,
 * and switchMap cancels any in-flight request when a newer query arrives, so stale
 * responses can never overwrite fresh results. Sort changes and refreshes are explicit
 * user actions, so they skip the debounce.
 */
@Injectable({ providedIn: 'root' })
export class CustomerStore {
  private readonly api = inject(CustomerApiService);

  private readonly searchInput$ = new Subject<string>();
  private readonly statuses$ = new BehaviorSubject<CustomerStatus[]>([]);
  private readonly sort$ = new BehaviorSubject<CustomerSort>({ field: 'createdAt', direction: 'desc' });
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  private readonly state = signal<CustomerState>({
    customers: [],
    loading: true,
    loaded: false,
    error: null,
    search: '',
    statuses: [],
  });

  readonly customers = computed(() => this.state().customers);
  readonly loading = computed(() => this.state().loading);
  readonly loaded = computed(() => this.state().loaded);
  readonly error = computed(() => this.state().error);
  readonly activeSearch = computed(() => this.state().search);
  readonly activeStatuses = computed(() => this.state().statuses);
  readonly statusFilter = signal<CustomerStatus[]>(this.statuses$.value);
  readonly sort = signal<CustomerSort>(this.sort$.value);

  constructor() {
    const search$ = this.searchInput$.pipe(
      map((term) => term.trim()),
      debounceTime(SEARCH_DEBOUNCE_MS),
      // startWith comes after the debounce so the initial load fires immediately.
      startWith(''),
      distinctUntilChanged(),
    );

    combineLatest([search$, this.statuses$, this.sort$, this.refresh$])
      .pipe(
        tap(() => this.state.update((s) => ({ ...s, loading: true, error: null }))),
        switchMap(([search, statuses, sort]) =>
          this.api.list({ search, statuses, sort }).pipe(
            map((customers) => ({ customers, search, statuses, error: null })),
            catchError((err: unknown) =>
              of({ customers: [], search, statuses, error: describeError(err) }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.state.set({ ...result, loading: false, loaded: true }));
  }

  setSearch(term: string): void {
    this.searchInput$.next(term);
  }

  /** Status chips are discrete clicks, so like sorting this applies immediately. */
  setStatusFilter(statuses: CustomerStatus[]): void {
    this.statusFilter.set(statuses);
    this.statuses$.next(statuses);
  }

  setSort(sort: CustomerSort): void {
    this.sort.set(sort);
    this.sort$.next(sort);
  }

  refresh(): void {
    this.refresh$.next();
  }

  create(input: CustomerInput): Observable<Customer> {
    return this.api.create(input).pipe(tap(() => this.refresh()));
  }

  update(id: string, input: CustomerInput): Observable<Customer> {
    return this.api.update(id, input).pipe(tap(() => this.refresh()));
  }
}

function describeError(err: unknown): string {
  if (err instanceof TimeoutError) {
    return 'The server took too long to respond. Please try again.';
  }
  if (err instanceof HttpErrorResponse && err.status === 0) {
    return "Can't reach the server. Check that the API is running and try again.";
  }
  return 'Something went wrong while loading customers.';
}
