import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TimeoutError } from 'rxjs';
import { API_TIMEOUT_MS, apiTimeoutInterceptor } from './api-timeout.interceptor';

describe('apiTimeoutInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiTimeoutInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => vi.useRealTimers());

  it('fails with a TimeoutError and cancels the request when the server never responds', () => {
    const error = vi.fn();
    http.get('/api/customers').subscribe({ error });
    const request = backend.expectOne('/api/customers');

    vi.advanceTimersByTime(API_TIMEOUT_MS - 1);
    expect(error).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(error).toHaveBeenCalledWith(expect.any(TimeoutError));
    expect(request.cancelled).toBe(true);
  });

  it('passes through responses that arrive in time', () => {
    const next = vi.fn();
    http.get('/api/customers').subscribe(next);

    vi.advanceTimersByTime(API_TIMEOUT_MS - 1);
    backend.expectOne('/api/customers').flush([]);

    expect(next).toHaveBeenCalledWith([]);
  });
});
