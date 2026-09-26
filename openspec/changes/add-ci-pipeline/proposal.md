## Why

El POC ya tiene la suite en verde en local, pero un push no la vuelve a
correr. Un runner limpio tampoco genera el Prisma Client con `npm install`,
el mismo hueco que apareció al seguir el README.

## What Changes

- Un workflow de GitHub Actions en cada push y pull request.
- Un solo job, en este orden, que se detiene en el primer paso que falla:
  `npm ci`, `npx prisma generate`, `npm run typecheck`, `npm run lint`,
  Postgres y Redis como services del job, `npx prisma migrate deploy`,
  `npm run db:seed`, `npm test`, y al final `docker build` de la imagen.
- Una sección breve de CI en el README.

## Capabilities

### New Capabilities

- Ninguna. El pipeline no cambia el comportamiento del motor.

### Modified Capabilities

- Ninguna.

## Impact

- Archivo nuevo de workflow y un párrafo en el README.
- El job usa Postgres 16 y Redis 7 efímeros, con las credenciales de
  `docker-compose.yml`, accesibles por `localhost`.
- `TENANT_ID` del job es `demo-tenant`, el mismo valor de `.env.example`.

## Non-goals

- Deploy de la app o de la base.
- Publicar la imagen en un registry.
- Cache de dependencias.
- Construir la imagen de la app para correr los tests. El `docker build`
  final solo comprueba que el Dockerfile compila, sin Compose.
- Multiperfil real, dimensiones distintas de `category`, y extraer el
  motor a un servicio. Este change no los toca.
