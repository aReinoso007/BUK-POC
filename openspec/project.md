# POC Buk — autorización por módulo, área y entidad

Fuente de verdad del comportamiento: el diseño aprobado del caso.
`openspec/changes/add-module-area-entity-authz/` planifica la implementación.
Este archivo fija convenciones de trabajo. No cambia decisiones de arquitectura.

Si el diseño no especifica un detalle necesario para implementar (formato,
nombre de clave, tabla, árbol concreto), se pregunta antes de asumir.

## Stack

- Node.js + TypeScript
- PostgreSQL con Prisma (ORM y migraciones)
- Redis con `ioredis` (caché de permisos efectivos)
- Express solo como demo HTTP del módulo Activos (2–3 endpoints). El motor
  se llama en proceso (`can` / `scope`), no por HTTP.
- Jest, tests colocados junto al módulo que cubren
- Docker Compose: servicios `app`, `postgres`, `redis`

## Estructura de carpetas

```
prisma/schema.prisma
prisma/migrations/
prisma/seed.ts
src/db/                 cliente Prisma
src/cache/              cliente Redis
src/authz/              resolver, can, scope, admin, tests del motor
src/modules/assets/     recurso demo y su declaración authorizes
src/demo/               Express (monolito de mentira)
scripts/healthcheck.ts
docker-compose.yml
Dockerfile
.env.example
```

Agregar un módulo de negocio nuevo es registrar su `module_key` en código
y declarar el recurso. No es una migración.

## Migraciones

- Solo Prisma (`prisma/migrations`). No hay SQL de esquema suelto fuera de lo
  que Prisma genera, salvo que una migración de datos no quepa en el schema
  y se acuerde antes.
- La migración inicial crea únicamente las tablas del diseño: `profiles`,
  `module_grants`, `grant_areas`, `entity_restrictions`, `area_closure`,
  más `users.profile_id`. No se agregan tablas de authz que el diseño no nombre.

## Tests

- Viven junto al módulo (`src/authz/*.test.ts`, `src/modules/assets/*.test.ts`).
- Una tarea que toca lógica no se cierra sin un test que pasa.
- Los ejemplos del caso (Pedro, Carolina, Gerente General, analistas,
  Jefe de Gerencia Comercial, Jefe de TI, encargados de denuncias) son la
  suite de aceptación. Se usan tal cual el diseño, sin reinterpretar.

## Commits

- Una tarea de `tasks.md` = un commit. No se mezclan tareas.
- Asunto imperativo, en español, con el id de la tarea:
  `1.1 Scaffold del proyecto`
- No se hace commit de secretos (`.env` real, credenciales). `.env.example`
  sí puede ir, sin valores secretos.

## Reglas de trabajo

- Cada tarea deja algo que se puede correr: lógica con test en verde;
  infra con un comando concreto de comprobación.
- No se avanza a la siguiente fase sin confirmación de que la anterior
  quedó validada.
- No se reabre ni se cambia una decisión del diseño aprobado sin preguntar.
- Fuera de este POC: multiperfil real, dimensiones distintas de `category`,
  y extraer el motor a un servicio.
