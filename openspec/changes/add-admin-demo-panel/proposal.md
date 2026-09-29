## Why

La pantalla de Permisos efectivos ya deja elegir las ocho cuentas y ver
Activos. En la sustentación no se ve lo que el motor ya hace por detrás:
si la resolución vino de Redis o de Postgres, que un PATCH de grant
invalida esa clave, que no se puede dejar el tenant sin admin, ni el
`where` que `Authz.scope` manda a Prisma. Esas piezas están en
AdminService, la caché y R1–R8; falta la superficie para mostrarlas
en vivo.

## What Changes

- Tres endpoints de administración, solo para el actor `is_admin`:
  `GET /admin/profiles`, `PATCH /admin/grants` y
  `PATCH /admin/profiles/:id`. Reusan AdminService.
  `PATCH /admin/grants` llama a `updateGrantFull` (un solo
  `commitThenBump`). El 403 de un no-admin sale de `Authz.can`
  contra el módulo `admin`, no de un `if` nuevo sobre la fila.
  Degradar al último admin responde 409 con el mensaje de
  `LastAdminError`, no un 500.
- Dos endpoints de debug, de solo lectura. Criterio: abiertos a
  cualquier `X-User-Id` válido. El HIT/MISS vive en el selector de
  cuentas y el `where` vive en Activos; los dos se usan con Pedro o
  Carolina, no solo con el Gerente General. `GET /admin/*` sigue
  siendo solo admin.
  - `GET /debug/permissions/:userId`: permisos efectivos más
    `source: "redis" | "postgres"`, vía
    `resolvePermissionsWithSource`. No cambia la firma ni el
    comportamiento de `resolveCachedPermissions`.
  - `GET /debug/scope?module=assets&action=read`: el `where` crudo
    de `Authz.scope` para el actor del header.
- Pestaña Admin en la app, aparte de Permisos efectivos: lista
  editable de grants, indicador HIT/MISS, botón Degradar que muestra
  el 409, y bajo Activos la nota del `where` del perfil actual.

## Capabilities

### New Capabilities

- Ninguna. No hay spec nuevo.

### Modified Capabilities

- Ninguna.

No se duplica R1–R8. El 403 de admin, el 409 del último admin, el
hit/miss y el `where` son HTTP y UI sobre comportamiento ya
especificado (R1, R7, R8). Un requisito "los endpoints de admin
solo los llama `is_admin`" no cambia el motor: es quién puede
invocar AdminService desde la demo. Este change pone
`skip_specs: true`, igual que `add-ci-pipeline`.

## Impact

- Demo Express: rutas `/admin/*` y `/debug/*`, más una variante de
  solo-lectura junto a la caché.
- Frontend en `web/`: pestaña Admin, badge HIT/MISS, nota de
  `scope` en Activos.
- Tests de supertest de esas rutas. Sin schema Prisma nuevo, sin
  Redis distinto, sin dependencias nuevas.

## Non-goals

- Autenticación real. Sigue `X-User-Id`.
- Gestión de áreas (crear, mover, recálculo de `area_closure`).
- Cualquier cambio a la lógica ya probada de Authz, Resolver o
  AdminService. Esta tarea solo los expone.
- Multiperfil real, dimensiones distintas de `category`, extraer el
  motor a un servicio.
