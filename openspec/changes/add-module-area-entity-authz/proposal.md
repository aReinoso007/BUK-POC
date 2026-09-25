## Why

Hoy cada equipo tendría que inventar su propia autorización. El acceso
depende a la vez del módulo, del área del organigrama (con subáreas) y,
a veces, de un subconjunto de entidades. Sin un motor único, esas reglas
se duplican, divergen entre el chequeo puntual y el listado, y no escalan
a decenas de miles de empleados ni a miles de restricciones por tenant.

## What Changes

- Motor de autorización in-process: un perfil por usuario, grants por
  módulo (`none < read < write`), alcance opcional de áreas (la raíz se
  guarda y el subárbol se expande) y restricciones opcionales de entidad.
- Acceso efectivo = módulo ∧ área ∧ entidad, fail-closed. Las
  restricciones solo reducen.
- Contrato declarativo para los equipos: declaran el recurso; `can` y
  `scope` aplican los mismos predicados (el listado, en SQL).
- Caché de permisos efectivos por request, invalidada al commitear un
  cambio de admin mediante la versión del tenant.
- Perfil administrador protegido: no se puede dejar el tenant sin admin.
- Demo HTTP mínima de Activos que consume el motor, más seed y tests de
  los ejemplos del caso.

## Capabilities

### New Capabilities

- `authz`: autorización por módulo, área y entidad (requisitos R1–R8).

### Modified Capabilities

- Ninguna. No hay specs previas.

## Impact

- Código nuevo del POC: modelo Prisma, motor, caché Redis, invariante de
  admin, demo Express de Activos, seed y tests de aceptación.
- Dependencias: PostgreSQL, Redis, Prisma, ioredis, Express, Jest.
- Sin impacto en otros sistemas: el POC no extrae un servicio ni cambia
  el modelo para soportar multiperfil real.

## Non-goals

- Multiperfil real. El motor evalúa por grant completo para poder
  combinarse con OR más adelante; este POC sigue el supuesto de un solo
  perfil por usuario.
- Dimensiones de entidad distintas de `category`. El esquema genérico
  (`resource_type`, `dimension`, `value_id`) queda listo; no se implementa
  otra dimensión.
- Extraer la autorización a un servicio. Sigue siendo una API in-process
  dentro del monolito de mentira.
