import { Component } from '@angular/core';
import { CustomerList } from './customers/customer-list/customer-list';

@Component({
  selector: 'app-root',
  imports: [CustomerList],
  template: `<app-customer-list />`,
  styleUrl: './app.scss',
})
export class App {}
