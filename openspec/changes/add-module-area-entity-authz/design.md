## Context

El diseño de autorización ya está aprobado. Este archivo lo transcribe para
el flujo de OpenSpec. No abre decisiones nuevas. Si algo de abajo contradice
el resumen aprobado, manda el resumen.

Ver `proposal.md` para el porqué. Ver `specs/authz/spec.md` para R1–R8.

## Goals / Non-Goals

**Goals:**

- Implementar el motor tal como está diseñado: grant completo, fail-closed,
  closure de áreas, restricciones genéricas, `can` y `scope` equivalentes,
  caché versionada, admin protegido.

**Non-Goals:**

- Multiperfil real, dimensiones distintas de `category`, extraer un servicio.
- Cola de jobs de producto. El contrato del job (recibe `user_id` y resuelve
  al ejecutarse) se demuestra en el test de invalidación, sin un worker.

## Decisions

Decisiones ya cerradas, no reabrirlas:

- Un usuario tiene un solo perfil. La evaluación es por grant completo
  (módulo ∧ área ∧ entidad) para poder OR-combinar grants después.
- Niveles `none < read < write`. `write` incluye crear, editar y eliminar.
- El organigrama es un árbol. Se guardan áreas raíz en `grant_areas`.
  `area_closure` expande descendientes con un JOIN, no con recursión por request.
- Cada recurso declara columna de área y una columna por dimensión.
- Restricciones de entidad son allow-list. Sin filas, acceso completo en esa
  dimensión. Solo se evalúan si ya hay acceso al módulo.
- La base está aislada por tenant: las tablas de authz no llevan `tenant_id`.
- Tablas: `profiles` (`name`, `is_admin`), `users.profile_id`,
  `module_grants` (`profile_id`, `module_key`, `level`, `area_restricted`,
  único por perfil y módulo), `grant_areas` (`grant_id`, `area_id`),
  `entity_restrictions` (`grant_id`, `resource_type`, `dimension`, `value_id`,
  índice `grant_id, resource_type, dimension`), `area_closure`
  (`ancestor_id`, `descendant_id`, `depth`).
- `module_key` es un string registrado en código.
- Admin: short-circuit de permiso. El último `is_admin` no se borra ni se
  degrada; validación transaccional con lock.
- Caché: clave `authz:{tenant}:v{version}:user:{id}`. Miss: perfiles, grants,
  áreas expandidas y restricciones. La versión vive solo en Redis, clave
  `authz:{tenant}:version`, incrementada con INCR en after-commit. No hay
  tabla ni columna en Postgres para ese contador. Claves huérfanas expiran por TTL.
- Demo: middleware Express lee `X-User-Id`, carga el usuario desde Postgres
  y lo deja en `req.user`. No hay autenticación real.
- Seed cerrado: módulos `assets`, `documents`, `complaints`, `vacations`,
  `payroll`. Árbol Gerencia General → Gerencia Comercial (Ventas Zona Norte,
  Ventas Zona Sur, Marketing) y Gerencia de Operaciones. Categorías de assets:
  Computadores, Teléfonos, Vehículos. Categorías de complaints: Acoso, Fraude,
  Discriminación. Perfiles como quedaron en la tarea 2.2.
- Contrato de equipos: declaran `module`, `area` y `dimensions`.
  `can(action, record)` y `scope(Model, action)` no divergen.

## Risks / Trade-offs

- [La versión de tenant solo está en Redis] → si Redis se vacía, la clave
  vuelve a arrancar y las entradas viejas dejan de coincidir con la versión
  nueva; el miss reconstruye los permisos desde Postgres.
- [Ventas Zona Norte no tiene subáreas en el árbol cerrado] → el alcance de
  Carolina se prueba sobre esa área. No se agregan nodos que no estén en el árbol.

## Open Questions

1. ¿El POC incluye crear o mover áreas (recálculo de `area_closure` por
   subárbol) o solo el árbol seedeado? No implementar movimiento de áreas
   hasta cerrar esto.
