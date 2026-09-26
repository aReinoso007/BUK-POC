## Context

Ver `proposal.md` para el porqué. El motor, el schema y la suite no cambian.
El runner de GitHub no tiene `.env` ni un Prisma Client generado.

## Goals / Non-Goals

**Goals:**

- Un workflow que falle en el primer paso rojo, en el orden del proposal.
- Postgres y Redis como services del job, en `localhost`.
- El `docker build` solo corre si typecheck, lint y tests ya pasaron.

**Non-Goals:**

- Deploy, publicar la imagen, cache de `npm`.
- Usar Docker Compose dentro del job para correr los tests.

## Decisions

- Un solo archivo, `.github/workflows/ci.yml`, un solo job. El `docker build`
  es el último paso de ese job, no un job aparte: si un paso anterior falla,
  GitHub Actions no sigue.
- Trigger: `push` en cualquier rama, a propósito, y `pull_request` sin
  filtro. El trabajo se valida al pushear la rama, aunque todavía no haya PR.
- Node 22 con `actions/setup-node`. Dependencias con `npm ci`, no `npm install`.
- `npx prisma generate` va justo después de `npm ci`. Sin eso, `typecheck` y
  el seed fallan en un runner limpio.
- Services, no Compose:
  - `postgres:16-alpine`, usuario `postgres`, password `postgres`, base
    `buk_authz`, puerto 5432, healthcheck `pg_isready`.
  - `redis:7-alpine`, puerto 6379, healthcheck `redis-cli ping`.
- Esas tres variables se declaran en el `env` del job desde el primer
  workflow, antes de que existan los services. La tarea de services solo
  agrega el bloque `services`; no mueve el `env`.
- Variables del job, apuntando a `localhost` (dentro del job los services no
  se llaman `postgres` ni `redis`):
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buk_authz`
  - `REDIS_URL=redis://localhost:6379`
  - `TENANT_ID=demo-tenant`
- Después de que los services responden, `npm run healthcheck` confirma
  Postgres y Redis antes de migrar.
- Luego `npx prisma migrate deploy`, `npm run db:seed` y `npm test`. El seed
  es obligatorio: los tests de aceptación y de supertest leen usuarios como
  Pedro y Carolina.
- `docker build -t buk-authz-poc .` no publica y no usa Compose. No consulta
  la base; `prisma generate` dentro de la imagen no necesita los services.

## Risks / Trade-offs

- [El job único deja los services encendidos durante el `docker build`] → el
  build no los usa. Separar el build en otro job no cambia el resultado y
  parte el "un solo job" de la fase 0.
- [Un push a una rama sin el workflow todavía no muestra CI] → el primer
  push que agrega el archivo es el que lo activa.

## Open Questions

Ninguna.
