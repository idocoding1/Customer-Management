import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
export type SortField = 'name' | 'email' | 'status' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export class DuplicateEmailError extends Error {}
export class NotFoundError extends Error {}

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const dataFile = path.join(dataDir, 'customers.json');
const seedFile = path.join(dataDir, 'seed.json');

/**
 * File-backed customer storage. The whole list is kept in memory for reads and
 * written back to data/customers.json on every change. On first run the file is
 * created from seed.json, so the app always starts with data.
 */
export class CustomerRepository {
  private customers: Customer[] = [];
  // Serializes writes so two quick saves can't interleave and corrupt the file.
  private writeQueue: Promise<void> = Promise.resolve();

  async load(): Promise<void> {
    if (!existsSync(dataFile)) {
      await copyFile(seedFile, dataFile);
    }
    this.customers = JSON.parse(await readFile(dataFile, 'utf8')) as Customer[];
  }

  list(query: { q?: string; sort?: SortField; dir?: SortDirection }): Customer[] {
    const term = query.q?.trim().toLowerCase();
    const filtered = term
      ? this.customers.filter(
          (c) => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term),
        )
      : [...this.customers];

    const field = query.sort ?? 'createdAt';
    const factor = query.dir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => a[field].localeCompare(b[field]) * factor);
  }

  async create(input: CustomerInput): Promise<Customer> {
    this.assertEmailIsFree(input.email);
    const customer: Customer = { id: randomUUID(), ...input, createdAt: new Date().toISOString() };
    this.customers.push(customer);
    await this.persist();
    return customer;
  }

  async update(id: string, input: CustomerInput): Promise<Customer> {
    const index = this.customers.findIndex((c) => c.id === id);
    if (index === -1) throw new NotFoundError();
    this.assertEmailIsFree(input.email, id);
    const updated = { ...this.customers[index], ...input };
    this.customers[index] = updated;
    await this.persist();
    return updated;
  }

  private assertEmailIsFree(email: string, exceptId?: string): void {
    const taken = this.customers.some(
      (c) => c.id !== exceptId && c.email.toLowerCase() === email.toLowerCase(),
    );
    if (taken) throw new DuplicateEmailError();
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.customers, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      // Write to a temp file and rename, so a crash mid-write never leaves a half-written file.
      const tmp = `${dataFile}.tmp`;
      await writeFile(tmp, snapshot);
      await rename(tmp, dataFile);
    });
    return this.writeQueue;
  }
}
