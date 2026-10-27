export const CUSTOMER_STATUSES = ['active', 'inactive', 'lead'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export interface Customer {
  id: string;
  name: string;
  email: string;
  status: CustomerStatus;
  createdAt: string;
}

export type CustomerInput = Pick<Customer, 'name' | 'email' | 'status'>;

export type SortField = 'name' | 'email' | 'createdAt';

export interface CustomerSort {
  field: SortField;
  direction: 'asc' | 'desc';
}

export interface CustomerQuery {
  search: string;
  statuses: CustomerStatus[];
  sort: CustomerSort;
}

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  lead: 'Lead',
};
