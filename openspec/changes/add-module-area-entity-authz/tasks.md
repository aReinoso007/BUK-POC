## 1. Fase 0 — Setup

- [x] 1.1 Scaffold del proyecto (estructura de carpetas de `openspec/project.md`, tsconfig, eslint, package.json, `.env.example`). Validación: `npm run typecheck` y `npm run lint` terminan en cero.
- [x] 1.2 `docker-compose.yml` con app, postgres y redis, y un Dockerfile multi-stage para la app. Validación: `docker compose config` es válido y `docker compose build app` termina bien.
- [x] 1.3 Conexión a Postgres y Redis verificable con un script de health-check. Validación: con los servicios levantados, el script sale 0 e imprime que ambas conexiones responden.

## 2. Fase 1 — Modelo de datos

- [x] 2.1 Schema de Prisma: `profiles`, `module_grants`, `grant_areas`, `entity_restrictions`, `area_closure`, y `users.profile_id`, con los campos e índices del diseño. No agregar tablas que el diseño no nombre. Validación: `prisma validate` y la migración aplican sobre Postgres limpio.
- [ ] 2.2 Migración inicial más seed, sin inventar áreas ni módulos fuera de esta lista. Árbol: Gerencia General → Gerencia Comercial (Ventas Zona Norte, Ventas Zona Sur, Marketing) y Gerencia de Operaciones. Módulos: `assets`, `documents`, `complaints`, `vacations`, `payroll`. Categorías de assets: Computadores, Teléfonos, Vehículos. Categorías de complaints: Acoso, Fraude, Discriminación. Un perfil por persona: Administrador (`is_admin`) asignado al Gerente General; Pedro con `documents:read` y `assets:write`, sin restricción de área ni de categoría; Carolina con `vacations:read` restringido a Ventas Zona Norte; Analista de Remuneraciones con `payroll:read`; Jefe de Gerencia Comercial con `assets:read` restringido a Gerencia Comercial; Jefe de TI con `assets:write`, sin restricción de área, categorías Computadores y Teléfonos; Encargado de Denuncias A con `complaints:write` en Acoso y Discriminación; Encargado de Denuncias B con `complaints:write` en Fraude. Incluir las filas de `area_closure` de ese árbol. Validación: el seed corre dos veces sin duplicar, y una consulta SQL muestra cada persona con su módulo, nivel, áreas raíz y categorías.

## 3. Fase 2 — Motor de evaluación (sin caché todavía)

- [ ] 3.1 Resolver: calcula los permisos efectivos de un usuario leyendo directo de Postgres (sin Redis). Validación: test que, para un usuario seedeado, arma el grant completo (nivel, áreas expandidas, restricciones) con las lecturas del diseño.
- [ ] 3.2 `Authz.can(action, record)` usando el Resolver, con la declaración de recurso del diseño (módulo, columna de área, dimensiones). El segundo chequeo del mismo request no vuelve a leer permisos. Validación: tests de la regla de evaluación (admin, nivel, área, allow-list) en verde.
- [ ] 3.3 `Authz.scope(Model, action)` generando el filtro Prisma `where` equivalente al predicado del diseño, las mismas condiciones que `can`. Validación: test donde un registro pasa `can` si y solo si el `where` de `scope` lo incluye.
- [ ] 3.4 Tests de aceptación que reproduzcan los ejemplos del caso. Incluyen, como mínimo: Pedro lee Documentos y escribe Activos de toda la empresa; Carolina ve Vacaciones solo de Ventas Zona Norte y sus subáreas, y no otros módulos; el Gerente General edita cualquier módulo; el Jefe de TI escribe Activos solo de Computadores y Teléfonos; un encargado de denuncias no ve la categoría del otro; un área fuera del alcance del jefe comercial (Gerencia de Operaciones) queda fuera. Validación: `npm test` en verde sobre esos casos.

## 4. Fase 3 — Caché

- [ ] 4.1 El Resolver usa Redis con la clave `authz:{tenant}:v{version}:user:{id}` y cae a Postgres en miss. Validación: test con miss (lee SQL y escribe la clave) y hit (no vuelve a leer SQL).
- [ ] 4.2 AdminService: cualquier escritura sobre profiles, module_grants, grant_areas, entity_restrictions o la asignación de perfil incrementa la versión del tenant al confirmarse. La versión vive solo en Redis, clave `authz:{tenant}:version`, con INCR. No hay tabla ni columna en Postgres para este contador. Validación: test de que, tras el commit, INCR cambió el valor usado en la clave de permisos.
- [ ] 4.3 Test de invalidación: se cambia un grant y el siguiente `can`, sin reiniciar el proceso, refleja el cambio. El mismo comportamiento vale para una resolución hecha con `user_id` en el momento de ejecutar, como haría un job. Validación: el test falla si el resultado sigue siendo el permiso viejo.

## 5. Fase 4 — Invariantes y reglas de negocio

- [ ] 5.1 Invariante de admin: no se puede borrar ni degradar el último perfil `is_admin`, con lock dentro de la transacción. Validación: test del último admin (rechazo) y test con otro admin presente (permiso).
- [ ] 5.2 Fail-closed: un usuario sin grant para un módulo obtiene siempre denegado en `can` y un alcance vacío en `scope`. Validación: test de ausencia de fila de grant.

## 6. Fase 5 — Demo API

- [ ] 6.1 Dos o tres endpoints Express del recurso Asset que usan el motor por dentro: `GET /assets` usa `scope`, `PATCH /assets/:id` usa `can`. Un middleware lee el header `X-User-Id`, busca ese usuario en Postgres y lo deja en `req.user`. Sin autenticación real. Validación: contra la app levantada, un usuario con escritura recibe 200 en el PATCH de un activo permitido y un usuario sin permiso recibe denegado; el GET no devuelve activos fuera del alcance.
- [ ] 6.2 Colección de Postman o Thunder Client, o un script curl, con los casos del documento. Validación: el script o la colección se ejecuta contra la demo y el resultado de cada caso coincide con el diseño.

## 7. Fase 6 — Documentación del POC

- [ ] 7.1 README con cómo levantar todo (`docker compose up`), cómo correr los tests, y una tabla corta requisito del caso (R1–R8) → dónde está implementado. Validación: un lector sigue el README y levanta la demo y la suite sin pasos que no estén escritos.
