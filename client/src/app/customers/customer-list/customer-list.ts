import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { map } from 'rxjs';
import {
  CustomerFormDialog,
  CustomerFormDialogData,
} from '../customer-form-dialog/customer-form-dialog';
import { CustomerStore } from '../customer-store';
import { Customer, STATUS_LABELS, SortField } from '../customer.model';

@Component({
  selector: 'app-customer-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './customer-list.html',
  styleUrl: './customer-list.scss',
})
export class CustomerList {
  protected readonly store = inject(CustomerStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Below 600px the table is swapped for a card list. */
  protected readonly isSmallScreen = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 599.98px)')
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  protected readonly columns = ['name', 'email', 'status', 'createdAt', 'actions'];
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly sortOptions: { field: SortField; label: string }[] = [
    { field: 'createdAt', label: 'Created' },
    { field: 'name', label: 'Name' },
    { field: 'email', label: 'Email' },
    { field: 'status', label: 'Status' },
  ];

  protected readonly searchText = signal('');

  /** mat-table row templates are untyped; this restores the Customer type in the template. */
  protected asCustomer(row: unknown): Customer {
    return row as Customer;
  }

  protected onSearch(term: string): void {
    this.searchText.set(term);
    this.store.setSearch(term);
  }

  protected clearSearch(): void {
    this.onSearch('');
  }

  protected onTableSort(sort: Sort): void {
    this.store.setSort({
      field: sort.active as SortField,
      direction: sort.direction === 'asc' ? 'asc' : 'desc',
    });
  }

  protected onSortFieldChange(field: SortField): void {
    this.store.setSort({ ...this.store.sort(), field });
  }

  protected toggleSortDirection(): void {
    const current = this.store.sort();
    this.store.setSort({ ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' });
  }

  protected openForm(customer?: Customer): void {
    const data: CustomerFormDialogData = { customer: customer ?? null };
    this.dialog
      .open(CustomerFormDialog, {
        data,
        width: 'min(480px, calc(100vw - 32px))',
        maxWidth: '100vw',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .subscribe((saved: Customer | undefined) => {
        if (saved) {
          this.snackBar.open(customer ? 'Customer updated' : 'Customer added', undefined, {
            duration: 3000,
          });
        }
      });
  }
}
