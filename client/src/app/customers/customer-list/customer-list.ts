import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
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
import { Customer, CustomerSort, STATUS_LABELS, SortField } from '../customer.model';

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
  /** Field + direction pairs in plain language, so sorting is discoverable without clicking headers. */
  protected readonly sortOptions = [
    sortOption('Newest first', 'createdAt', 'desc'),
    sortOption('Oldest first', 'createdAt', 'asc'),
    sortOption('Name (A–Z)', 'name', 'asc'),
    sortOption('Name (Z–A)', 'name', 'desc'),
    sortOption('Email (A–Z)', 'email', 'asc'),
    sortOption('Email (Z–A)', 'email', 'desc'),
    sortOption('Status (A–Z)', 'status', 'asc'),
    sortOption('Status (Z–A)', 'status', 'desc'),
  ];

  /** Kept in sync with the table headers, which update the same store sort. */
  protected readonly sortKey = computed(() => sortKeyOf(this.store.sort()));

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

  protected onSortOptionChange(key: string): void {
    const option = this.sortOptions.find((o) => o.key === key);
    if (option) {
      this.store.setSort(option.sort);
    }
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

function sortKeyOf(sort: CustomerSort): string {
  return `${sort.field}:${sort.direction}`;
}

function sortOption(label: string, field: SortField, direction: CustomerSort['direction']) {
  const sort: CustomerSort = { field, direction };
  return { label, sort, key: sortKeyOf(sort) };
}
