import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, TimeoutError, throwError } from 'rxjs';
import { CustomerApiService } from './customer-api.service';
import { CustomerStore, SEARCH_DEBOUNCE_MS } from './customer-store';
import { Customer } from './customer.model';

const noa: Customer = {
  id: '1',
  name: 'Noa Levi',
  email: 'noa@example.com',
  status: 'active',
  createdAt: '2025-01-06T09:30:00.000Z',
};

describe('CustomerStore', () => {
  // Each list() call returns its own Subject so tests control when (and whether) it responds.
  let responses: Subject<Customer[]>[];
  let api: { list: ReturnType<typeof vi.fn> };

  function setup(): CustomerStore {
    TestBed.configureTestingModule({ providers: [{ provide: CustomerApiService, useValue: api }] });
    return TestBed.inject(CustomerStore);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    responses = [];
    api = {
      list: vi.fn(() => {
        const response = new Subject<Customer[]>();
        responses.push(response);
        return response;
      }),
    };
  });

  afterEach(() => vi.useRealTimers());

  it('loads customers immediately on start', () => {
    const store = setup();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.loading()).toBe(true);

    responses[0].next([noa]);

    expect(store.customers()).toEqual([noa]);
    expect(store.loading()).toBe(false);
  });

  it('debounces typing into a single request', () => {
    const store = setup();
    api.list.mockClear();

    for (const term of ['n', 'no', 'noa']) {
      store.setSearch(term);
      vi.advanceTimersByTime(100);
    }
    expect(api.list).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.list).toHaveBeenCalledWith({
      search: 'noa',
      statuses: [],
      sort: { field: 'createdAt', direction: 'desc' },
    });
  });

  it('skips the request when the trimmed term did not change', () => {
    const store = setup();
    api.list.mockClear();

    store.setSearch('   ');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

    expect(api.list).not.toHaveBeenCalled();
  });

  it('ignores a stale response once a newer query has started', () => {
    const store = setup();
    store.setSearch('old');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    store.setSearch('new');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

    const [, oldResponse, newResponse] = responses;
    expect(oldResponse.observed).toBe(false); // switchMap unsubscribed, cancelling the HTTP call
    newResponse.next([noa]);

    expect(store.customers()).toEqual([noa]);
    expect(store.activeSearch()).toBe('new');
  });

  it('applies sort changes without waiting for the debounce', () => {
    const store = setup();
    api.list.mockClear();

    store.setSort({ field: 'name', direction: 'asc' });

    expect(api.list).toHaveBeenCalledWith({
      search: '',
      statuses: [],
      sort: { field: 'name', direction: 'asc' },
    });
  });

  it('applies the status filter immediately and combines it with search', () => {
    const store = setup();
    store.setSearch('noa');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    api.list.mockClear();

    store.setStatusFilter(['active', 'lead']);

    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.list).toHaveBeenCalledWith({
      search: 'noa',
      statuses: ['active', 'lead'],
      sort: { field: 'createdAt', direction: 'desc' },
    });
    responses.at(-1)!.next([]);
    expect(store.activeStatuses()).toEqual(['active', 'lead']);
  });

  it('shows a specific message when the request times out', () => {
    api.list.mockReturnValueOnce(throwError(() => new TimeoutError()));
    const store = setup();

    expect(store.error()).toBe('The server took too long to respond. Please try again.');
    expect(store.loading()).toBe(false);
  });

  it('exposes an error and recovers on retry', () => {
    api.list.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    const store = setup();

    expect(store.error()).toContain("Can't reach the server");
    expect(store.loading()).toBe(false);

    store.refresh();
    responses[0].next([noa]);

    expect(store.error()).toBeNull();
    expect(store.customers()).toEqual([noa]);
  });
});
