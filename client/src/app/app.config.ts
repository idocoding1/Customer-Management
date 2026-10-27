import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { apiTimeoutInterceptor } from './api-timeout.interceptor';
import { CustomerStore } from './customers/customer-store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([apiTimeoutInterceptor])),
    // Starts the first load during bootstrap without awaiting it, so a down API can't block rendering.
    provideAppInitializer(() => {
      inject(CustomerStore);
    }),
  ],
};
