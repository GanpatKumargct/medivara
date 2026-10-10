# MediVara DB studio (Prisma Studio, read-only)

Browse the MediVara PostgreSQL database at **http://localhost:5555**.

- Started by PM2 with the rest of the app (`pm2 start ecosystem.config.cjs` at the repo root),
  or by hand: `cd db-studio && npm ci && npm run studio`.
- Connects as `medivara_studio`, a **SELECT-only** Postgres role (see `.env.example`). Editing or
  deleting rows in Studio is refused by the database, on purpose: changes must go through the
  backend so access checks, review history and the audit log stay correct.
- `prisma/schema.prisma` is generated from the live database (`npm run pull`). Run it again
  after backend model changes. **Never** run `prisma migrate` or `prisma db push` here; the
  backend's SQLModel models own the schema.
- Data is synthetic. Studio listens on 127.0.0.1 only.

One-time setup of the read-only role (already done on this machine):

```sql
CREATE ROLE medivara_studio LOGIN PASSWORD 'medivara_studio_readonly';
GRANT CONNECT ON DATABASE medivara TO medivara_studio;
GRANT USAGE ON SCHEMA public TO medivara_studio;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO medivara_studio;
ALTER DEFAULT PRIVILEGES FOR ROLE medivara IN SCHEMA public GRANT SELECT ON TABLES TO medivara_studio;
```
(run with `docker exec -i medivara-postgres psql -U medivara -d medivara`)
