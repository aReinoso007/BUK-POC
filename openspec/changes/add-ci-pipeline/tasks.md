## 1. Fase 0 — Workflow mínimo

- [x] 1.1 Workflow mínimo: trigger en `push` y `pull_request`, un solo job, checkout + setup-node (versión 22) + `npm ci`. El `env` del job (no de un step) declara desde este commit `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buk_authz`, `REDIS_URL=redis://localhost:6379` y `TENANT_ID=demo-tenant`. Validación: el workflow muestra ese `env` a nivel de job y el paso `npm ci`. Las conexiones no se comprueban todavía.
- [x] 1.2 `npx prisma generate`, `npm run typecheck` y `npm run lint` como pasos siguientes. Validación: un typo introducido a propósito en un archivo `.ts` hace fallar el job en el paso de typecheck, no antes ni después.

## 2. Fase 1 — Postgres, Redis y la suite

- [x] 2.1 Agregar el bloque `services` de Postgres y Redis al job. El `env` del job no se mueve: ya apunta a `localhost` desde la 1.1. Validación: `npm run healthcheck` confirma que ambos responden antes de continuar.
- [x] 2.2 `npx prisma migrate deploy` y `npm run db:seed` contra esos services. Validación: una query de humo confirma que el seed corrió.
- [x] 2.3 `npm test` contra los services. Validación: el job es verde con los 33 tests, y si se rompe a propósito un test, el job falla ahí.

## 3. Fase 2 — Imagen

- [ ] 3.1 `docker build` de la imagen, como último paso del mismo job, solo si los anteriores pasaron. Validación: el job falla si el Dockerfile no compila, y no llega a este paso si typecheck, lint o test fallaron antes.

## 4. Fase 3 — README

- [ ] 4.1 README: una sección breve de CI (qué corre y dónde ver los resultados) y el badge de estado del workflow. Validación: la sección nombra el workflow y el badge apunta a ese archivo.
