# POC de autorización Buk

[![CI](https://github.com/aReinoso007/BUK-POC/actions/workflows/ci.yml/badge.svg)](https://github.com/aReinoso007/BUK-POC/actions/workflows/ci.yml)

Motor in-process de autorización por módulo, área organizacional y tipo de entidad. La demo HTTP expone el recurso Activos.

Hace falta Node.js 22 y Docker.

## CI

Cada push y pull request corre el workflow de `.github/workflows/ci.yml`:
typecheck, lint, la suite completa contra Postgres y Redis efímeros, y un
build de la imagen Docker. Resultados en la pestaña Actions del repo.

## Levantar

```sh
cp .env.example .env
npm install
npx prisma generate
docker compose up --build -d
npx prisma migrate deploy
npm run db:seed
```

`docker compose up` deja Postgres en el puerto 5432, Redis en el 6379 y la demo en el 3000. El actor de cada request es el header `X-User-Id` con el id de un usuario del seed.

Comprobar las dos conexiones:

```sh
npm run healthcheck
```

Correr la suite:

```sh
npm test
```

Correr los casos de activos contra la demo:

```sh
sh scripts/demo-cases.sh
```

Una llamada de ese script, ya con los ids del seed, queda así:

```sh
curl -sS -X PATCH http://localhost:3000/assets/3 \
  -H "X-User-Id: 2" \
  -H "Content-Type: application/json" \
  -d '{"name":"Camioneta Operaciones"}'
```

El `2` es Pedro. El `3` es la camioneta de Gerencia de Operaciones, categoría Vehículos.

## Requisitos

| Requisito | Dónde |
| --- | --- |
| R1 Perfil administrador protegido | `src/authz/admin-service.ts` |
| R2 Nivel por módulo, fail-closed | `src/authz/authz.ts`, `src/authz/resolver.ts` |
| R3 Alcance de áreas con descendientes | `src/authz/resolver.ts`, `src/authz/authz.ts` |
| R4 Restricción de entidades | `src/authz/resolver.ts`, `src/authz/authz.ts` |
| R5 Acceso efectivo conjunto | `src/authz/authz.ts` |
| R6 Contrato declarativo in-process | `src/authz/authz.ts`, `src/modules/assets/asset.ts` |
| R7 Resolución por request y listado por predicado | `src/authz/authz.ts` |
| R8 El cambio se ve en el siguiente uso | `src/authz/admin-service.ts`, `src/authz/permissions-cache.ts` |
