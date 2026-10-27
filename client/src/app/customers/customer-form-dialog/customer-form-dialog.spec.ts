import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TimeoutError, of, throwError } from 'rxjs';
import { CustomerStore } from '../customer-store';
import { Customer } from '../customer.model';
import { CustomerFormDialog, CustomerFormDialogData } from './customer-form-dialog';

const existing: Customer = {
  id: '7',
  name: 'Noa Levi',
  email: 'noa@example.com',
  status: 'active',
  createdAt: '2025-01-06T09:30:00.000Z',
};

describe('CustomerFormDialog', () => {
  let store: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean };

  async function render(data: CustomerFormDialogData) {
    TestBed.configureTestingModule({
      imports: [CustomerFormDialog],
      providers: [
        { provide: CustomerStore, useValue: store },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    const fixture = TestBed.createComponent(CustomerFormDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = (name: string) =>
      element.querySelector<HTMLInputElement>(`input[formcontrolname="${name}"]`)!;
    const type = (name: string, value: string) => {
      input(name).value = value;
      input(name).dispatchEvent(new Event('input'));
    };
    const submit = async () => {
      element.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { element, input, type, submit };
  }

  beforeEach(() => {
    store = { create: vi.fn(), update: vi.fn() };
    dialogRef = { close: vi.fn(), disableClose: false };
  });

  it('does not save and shows errors when required fields are empty', async () => {
    const { element, submit } = await render({ customer: null });

    await submit();

    expect(store.create).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Name is required.');
    expect(element.textContent).toContain('Email is required.');
  });

  it.each(['Dana2', 'Dana!', 'Dana_Levi', '-Dana'])('rejects the name "%s"', async (name) => {
    const { element, type, submit } = await render({ customer: null });
    type('name', name);
    type('email', 'dana@example.com');

    await submit();

    expect(store.create).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Name can only contain letters, spaces, hyphens and apostrophes.');
  });

  it.each(["Liam O'Brien", 'Shira Ben-David', 'נועה לוי'])('accepts the name "%s"', async (name) => {
    store.create.mockReturnValue(of(existing));
    const { type, submit } = await render({ customer: null });
    type('name', name);
    type('email', 'dana@example.com');

    await submit();

    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ name }));
  });

  it('rejects an invalid email', async () => {
    const { element, type, submit } = await render({ customer: null });
    type('name', 'Dana');
    type('email', 'not-an-email');

    await submit();

    expect(store.create).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Enter a valid email address.');
  });

  it('creates a customer with trimmed values and closes with the result', async () => {
    const created = { ...existing, id: '8', name: 'Dana' };
    store.create.mockReturnValue(of(created));
    const { type, submit } = await render({ customer: null });
    type('name', '  Dana  ');
    type('email', 'dana@example.com');

    await submit();

    expect(store.create).toHaveBeenCalledWith({ name: 'Dana', email: 'dana@example.com', status: 'lead' });
    expect(dialogRef.close).toHaveBeenCalledWith(created);
  });

  it('pre-fills the form in edit mode and saves via update', async () => {
    store.update.mockReturnValue(of(existing));
    const { element, input, submit } = await render({ customer: existing });

    expect(element.textContent).toContain('Edit customer');
    expect(input('name').value).toBe('Noa Levi');
    expect(input('email').value).toBe('noa@example.com');

    await submit();

    expect(store.update).toHaveBeenCalledWith('7', {
      name: 'Noa Levi',
      email: 'noa@example.com',
      status: 'active',
    });
  });

  it('shows a duplicate-email error from the server and keeps the dialog open', async () => {
    store.create.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const { element, type, submit } = await render({ customer: null });
    type('name', 'Dana');
    type('email', 'noa@example.com');

    await submit();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(element.textContent).toContain('A customer with this email already exists.');
  });

  it('shows a timeout message, keeps the dialog open and re-enables saving', async () => {
    store.create.mockReturnValue(throwError(() => new TimeoutError()));
    const { element, type, submit } = await render({ customer: null });
    type('name', 'Dana');
    type('email', 'dana@example.com');

    await submit();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(element.textContent).toContain('The server took too long to respond');
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });
});
