## Context

Ver `proposal.md` para el porqué. El motor, AdminService, el schema y
R1–R8 no cambian. La demo ya tiene `X-User-Id`, `GET /demo/session` y
la pantalla de Activos.

## Goals / Non-Goals

**Goals:**

- Superficie HTTP y UI que llama a AdminService, `Authz.can` /
  `Authz.scope` y `resolveCachedPermissions` tal como existen.
- Poder mostrar en vivo MISS → HIT → MISS (tras un PATCH de grant),
  el 409 del último admin y el `where` de `scope`.

**Non-Goals:**

- Nuevas reglas de evaluación, otra clave de Redis, o un `if
  (profile.isAdmin)` al margen de Authz.
- Autenticación real o ABM de áreas.

## Decisions

- **403 de `/admin/*` con `Authz.can`.** Las tres rutas corren dentro
  de `Authz.withUser` y piden
  `Authz.can("write", withResource({ module: "admin", area: "ownerAreaId", dimensions: {} }, { ownerAreaId: null }))`.
  El módulo `admin` no está en ningún grant del seed. El no-admin
  cae en fail-closed (nivel none). El único camino a true es el
  bypass de `isAdmin` que `Authz.can` ya tiene. No hay un
  `if (profile.isAdmin)` fuera del motor. Alternativa descartada:
  leer `users.profile.is_admin` en el handler.
- **`/debug/*` abierto.** Basta un `X-User-Id` válido. El badge y el
  `where` se miran con la cuenta elegida en el selector, no con el
  admin. Alternativa descartada: protegerlos con `is_admin`.
- **`resolvePermissionsWithSource`.** Mira la clave actual; si hay
  valor, `{ source: "redis" }`. Si no, llama a
  `resolveCachedPermissions` y responde `{ source: "postgres" }`.
  No se toca la firma de la función que usan `can` y `scope`.
- **Orden al cambiar de cuenta.** Primero
  `GET /debug/permissions/:userId`, después sesión y
  `GET /debug/scope`. Si la sesión corre antes, llena Redis y el
  badge nunca muestra MISS. Volver a pulsar la misma cuenta dispara
  el probe otra vez (el segundo es HIT).
- **`PATCH /admin/grants` usa `adminService.updateGrantFull`.** Un
  método nuevo recibe `profileId`, `moduleKey` y las claves
  opcionales (`level`, `areaRestricted`, `areaIds`,
  `restrictions`). Fusiona con el grant actual y aplica los tres
  writes dentro de una sola `prisma.$transaction`, con un solo
  INCR al final vía `commitThenBump`.
  `setModuleGrant`, `setGrantAreas` y `setEntityRestrictions`
  siguen igual para quien los llame por separado. El handler no
  los encadena. La UI manda el grant completo al Guardar.
- **409.** Si `updateProfile` lanza `LastAdminError`, el endpoint
  responde 409 `{ "error": "no se puede dejar el tenant sin administrador" }`.
  No se edita la clase.
- **`GET /admin/profiles`.** Cada perfil trae sus usuarios (id y
  nombre) y los grants con `areaIds` y categorías ya resueltos a
  nombre. El panel no arma el join.
- **`GET /debug/scope`.** En esta demo, `module=assets` y
  `action=read|write`. Otro módulo o acción, 400. El `where` se
  devuelve tal cual lo arma `Authz.scope`.
- **Pestaña Admin.** Las mutaciones van con el `X-User-Id` del
  Gerente General. El badge HIT/MISS usa el `userId` de la cuenta
  del selector. El proxy de Vite agrega `/admin` y `/debug`.

## Risks / Trade-offs

- [`GET /demo/session` adelanta el probe] → el orden de fetch de
  arriba. Sin eso, la sustentación solo ve HIT.
- [Un admin podría crear un grant del módulo del recurso-guardián]
  → ese módulo no está en los cinco de la UI. Nadie lo asigna en
  la demo.
- [El PATCH de grants en tests ensucia el seed] → el test de
  invalidación restaura el grant o usa un perfil auxiliar y lo
  borra.

## Open Questions

Ninguna.
