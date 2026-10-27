export const CUSTOMER_STATUSES = ['active', 'inactive', 'lead'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export interface Customer {
  id: string;
  name: string;
  email: string;
  status: CustomerStatus;
  /** ISO 8601 timestamp, set by the server. */
  createdAt: string;
}

export type CustomerInput = Pick<Customer, 'name' | 'email' | 'status'>;

export type SortField = 'name' | 'email' | 'status' | 'createdAt';

export interface CustomerSort {
  field: SortField;
  direction: 'asc' | 'desc';
}

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  lead: 'Lead',
};
