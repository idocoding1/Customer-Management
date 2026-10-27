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
    // Create the store during bootstrap so the first customer request starts right away.
    // It isn't awaited: if the API is down the app still renders and shows an error state.
    provideAppInitializer(() => {
      inject(CustomerStore);
    }),
  ],
};
