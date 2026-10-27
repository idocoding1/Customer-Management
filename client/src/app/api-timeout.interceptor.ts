import { HttpInterceptorFn } from '@angular/common/http';
import { timeout } from 'rxjs';

export const API_TIMEOUT_MS = 10_000;

export const apiTimeoutInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(timeout(API_TIMEOUT_MS));
