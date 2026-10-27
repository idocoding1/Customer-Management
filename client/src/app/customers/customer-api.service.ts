import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Customer, CustomerInput, CustomerQuery } from './customer.model';

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/customers';

  list({ search, statuses, sort }: CustomerQuery): Observable<Customer[]> {
    let params = new HttpParams().set('sort', sort.field).set('dir', sort.direction);
    if (search) {
      params = params.set('q', search);
    }
    if (statuses.length) {
      params = params.set('status', statuses.join(','));
    }
    return this.http.get<Customer[]>(this.baseUrl, { params });
  }

  create(input: CustomerInput): Observable<Customer> {
    return this.http.post<Customer>(this.baseUrl, input);
  }

  update(id: string, input: CustomerInput): Observable<Customer> {
    return this.http.put<Customer>(`${this.baseUrl}/${id}`, input);
  }
}
