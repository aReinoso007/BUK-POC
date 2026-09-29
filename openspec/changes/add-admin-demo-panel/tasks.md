## 1. Fase 0 — Endpoints de admin

- [x] 1.1 `GET /admin/profiles`: lista los 8 perfiles del seed con grants (`module_key`, `level`, `areaRestricted`, áreas y categorías resueltas a nombre) y los usuarios de cada perfil. Protegido con `Authz.can` según `design.md`. Validación: `curl` con `X-User-Id` de un no-admin da 403; con el Gerente General da 200 y los 8 perfiles.
- [x] 1.2 `adminService.updateGrantFull` + `PATCH /admin/grants`: body `{ profileId, moduleKey, level?, areaRestricted?, areaIds?, restrictions? }`. El método nuevo aplica grant, áreas y restricciones dentro de una sola `prisma.$transaction` y un solo INCR vía `commitThenBump`. Los métodos individuales siguen existiendo; el endpoint no los encadena. Devuelve el grant actualizado. Validación: `curl` de un no-admin da 403; con el Gerente General cambia un grant del seed y el GET lo refleja. Un test fuerza un error después del segundo write dentro de esa transacción: ningún cambio persiste y la versión del tenant no sube.
- [x] 1.3 `PATCH /admin/profiles/:id`: body `{ isAdmin?: boolean }`. Llama a `adminService.updateProfile`. Si lanza `LastAdminError`, responde 409 `{ "error": "no se puede dejar el tenant sin administrador" }`. Validación: `curl` de un no-admin da 403; degradar al Gerente General (único admin del seed) da 409, no 500.

## 2. Fase 1 — Endpoints de debug

- [x] 2.1 `resolvePermissionsWithSource` (sin cambiar la firma de `resolveCachedPermissions`) y `GET /debug/permissions/:userId`. Abierto a cualquier `X-User-Id` válido. Validación: dos llamadas seguidas al mismo `userId` muestran `"postgres"` y luego `"redis"`.
- [x] 2.2 `GET /debug/scope?module=assets&action=read` (o `write`): devuelve el `where` crudo de `Authz.scope` para el actor del header. Validación: Carolina recibe un `where` que no matchea filas; el Jefe de Gerencia Comercial recibe el filtro de su subárbol.

## 3. Fase 2 — UI

- [x] 3.1 Pestaña Admin, aparte de Permisos efectivos: lista de perfiles y grants de `GET /admin/profiles`, editable (nivel, áreas, categorías) y Guardar que llama `PATCH /admin/grants` con el `X-User-Id` del Gerente General. Proxy de Vite para `/admin` y `/debug`. Validación: en el browser se ve la lista y un Guardar cambia un grant.
- [x] 3.2 Indicador HIT/MISS de `GET /debug/permissions/:userId`. Se pide **antes** de `/demo/session`. El click del selector siempre dispara el probe, también sobre la cuenta ya seleccionada (no depender de onChange). Tras Guardar en Admin el grant del perfil de la cuenta actual, se refetch el badge (no solo la lista). Validación en el browser: (1) primer select de un perfil en la sesión → badge `postgres`; (2) clic de nuevo en el mismo perfil, sin pasar por otro → badge `redis`; (3) Guardar un cambio de ese perfil en Admin → el badge se pide solo y vuelve a `postgres`.
- [x] 3.3 Botón Degradar junto al único perfil `is_admin` del seed. Llama `PATCH /admin/profiles/:id`. El 409 se muestra con el mensaje del body, no un error genérico de red. Validación: el botón falla en pantalla con "no se puede dejar el tenant sin administrador".
- [x] 3.4 En Activos, debajo del listado, la nota del `where` de `GET /debug/scope` para el perfil actual. Validación: al elegir Carolina y al Jefe de Gerencia Comercial el JSON de la nota cambia y coincide con el listado.

## 4. Fase 3 — Tests

- [x] 4.1 Tests de supertest de las rutas nuevas, reusando los helpers de usuario del seed: 403 para no-admin en `/admin/*`, 409 al degradar al último admin, y un end-to-end de invalidación (PATCH `/admin/grants` y después un cambio visible en `GET /assets`). El e2e restaura el grant o usa un perfil auxiliar. Validación: `npm test` en verde.
