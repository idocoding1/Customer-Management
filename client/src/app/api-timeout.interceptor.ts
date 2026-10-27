import { HttpInterceptorFn } from '@angular/common/http';
import { timeout } from 'rxjs';

export const API_TIMEOUT_MS = 10_000;

/**
 * Fails any request that gets no response within API_TIMEOUT_MS with an RxJS TimeoutError,
 * so a hung API surfaces as an error the UI can show instead of an endless spinner.
 * Unsubscribing on timeout also aborts the underlying fetch.
 */
export const apiTimeoutInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(timeout(API_TIMEOUT_MS));
