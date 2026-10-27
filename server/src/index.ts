import express, { type Request, type Response, type NextFunction } from 'express';
import {
  CUSTOMER_STATUSES,
  CustomerRepository,
  DuplicateEmailError,
  NotFoundError,
  type CustomerInput,
  type CustomerStatus,
  type SortDirection,
  type SortField,
} from './customer-repository.js';

const PORT = Number(process.env.PORT ?? 3000);
const DELAY_MS = Number(process.env.DELAY_MS ?? 0);

const SORT_FIELDS: SortField[] = ['name', 'email', 'status', 'createdAt'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const repo = new CustomerRepository();
const app = express();
app.use(express.json());

if (DELAY_MS > 0) {
  app.use((_req, _res, next) => setTimeout(next, DELAY_MS));
}

app.get('/api/customers', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const sort = SORT_FIELDS.includes(req.query.sort as SortField)
    ? (req.query.sort as SortField)
    : undefined;
  const dir: SortDirection = req.query.dir === 'asc' ? 'asc' : 'desc';
  const statuses =
    typeof req.query.status === 'string'
      ? (req.query.status.split(',').filter((s) => CUSTOMER_STATUSES.includes(s as CustomerStatus)) as CustomerStatus[])
      : [];
  console.log(
    `GET /api/customers q="${q ?? ''}" status=${statuses.join(',') || 'all'} sort=${sort ?? 'createdAt'} dir=${dir}`,
  );
  res.json(repo.list({ q, statuses, sort, dir }));
});

app.post('/api/customers', async (req, res, next) => {
  const input = parseInput(req, res);
  if (!input) return;
  try {
    res.status(201).json(await repo.create(input));
  } catch (err) {
    next(err);
  }
});

app.put('/api/customers/:id', async (req, res, next) => {
  const input = parseInput(req, res);
  if (!input) return;
  try {
    res.json(await repo.update(req.params.id, input));
  } catch (err) {
    next(err);
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof DuplicateEmailError) {
    res.status(409).json({ message: 'A customer with this email already exists.' });
  } else if (err instanceof NotFoundError) {
    res.status(404).json({ message: 'Customer not found.' });
  } else {
    console.error(err);
    res.status(500).json({ message: 'Unexpected server error.' });
  }
});

function parseInput(req: Request, res: Response): CustomerInput | null {
  const { name, email, status } = req.body ?? {};
  const errors: string[] = [];
  if (typeof name !== 'string' || !name.trim()) errors.push('name is required');
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) errors.push('a valid email is required');
  if (!CUSTOMER_STATUSES.includes(status)) errors.push(`status must be one of ${CUSTOMER_STATUSES.join(', ')}`);

  if (errors.length) {
    res.status(400).json({ message: errors.join('; ') });
    return null;
  }
  return { name: name.trim(), email: email.trim().toLowerCase(), status };
}

await repo.load();
app.listen(PORT, () => console.log(`Customer API listening on http://localhost:${PORT}`));
