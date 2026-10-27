import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TimeoutError } from 'rxjs';
import { CustomerStore } from '../customer-store';
import {
  CUSTOMER_STATUSES,
  Customer,
  CustomerInput,
  CustomerStatus,
  STATUS_LABELS,
} from '../customer.model';

// Same rule as the server: letters in any language, joined by spaces, hyphens or apostrophes.
const NAME_PATTERN = /^\s*\p{L}+(?:(?:\s+|['’-])\p{L}+)*\s*$/u;

export interface CustomerFormDialogData {
  customer: Customer | null;
}

@Component({
  selector: 'app-customer-form-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './customer-form-dialog.html',
  styleUrl: './customer-form-dialog.scss',
})
export class CustomerFormDialog {
  private readonly store = inject(CustomerStore);
  private readonly dialogRef = inject<MatDialogRef<CustomerFormDialog, Customer>>(MatDialogRef);
  protected readonly customer = inject<CustomerFormDialogData>(MAT_DIALOG_DATA).customer;

  protected readonly statuses = CUSTOMER_STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [
      this.customer?.name ?? '',
      [Validators.required, Validators.maxLength(100), Validators.pattern(NAME_PATTERN)],
    ],
    email: [this.customer?.email ?? '', [Validators.required, Validators.email]],
    status: [this.customer?.status ?? ('lead' as CustomerStatus), Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const input: CustomerInput = { ...raw, name: raw.name.trim(), email: raw.email.trim() };
    const request$ = this.customer
      ? this.store.update(this.customer.id, input)
      : this.store.create(input);

    this.saving.set(true);
    this.saveError.set(null);
    this.dialogRef.disableClose = true;

    request$.subscribe({
      next: (saved) => this.dialogRef.close(saved),
      error: (err: unknown) => {
        this.saving.set(false);
        this.dialogRef.disableClose = false;
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.form.controls.email.setErrors({ duplicate: true });
          this.form.controls.email.markAsTouched();
        } else if (err instanceof HttpErrorResponse && err.status === 400) {
          this.saveError.set(err.error?.message ?? 'Please check the form and try again.');
        } else if (err instanceof TimeoutError) {
          this.saveError.set(
            'The server took too long to respond, so the save may not have gone through. Please try again.',
          );
        } else {
          this.saveError.set("Couldn't save the customer. Please try again.");
        }
      },
    });
  }
}
