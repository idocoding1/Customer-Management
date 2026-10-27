import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Customer, CustomerInput, CustomerSort } from './customer.model';

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/customers';

  list(search: string, sort: CustomerSort): Observable<Customer[]> {
    let params = new HttpParams().set('sort', sort.field).set('dir', sort.direction);
    if (search) {
      params = params.set('q', search);
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
