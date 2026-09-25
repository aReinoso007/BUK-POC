## Purpose

Autorizar el acceso a recursos de un tenant por módulo, área organizacional
y tipo de entidad, con un solo contrato que los equipos declaran y el motor
evalúa igual en el chequeo puntual y en el listado.

## ADDED Requirements

### Requirement: R1 — Perfil administrador protegido
Cada tenant SHALL poder configurar N perfiles y SHALL tener siempre al menos
un perfil administrador (`is_admin`). El sistema SHALL impedir borrar o
degradar ese perfil cuando sea el último administrador del tenant, de modo
que el tenant no quede sin admin. La comprobación SHALL hacerse de forma
atómica frente a carreras entre escrituras concurrentes.

#### Scenario: El tenant conserva un administrador
- **WHEN** se intenta borrar el único perfil `is_admin`, o quitarle la marca de administrador
- **THEN** la operación es rechazada y el perfil sigue siendo administrador

#### Scenario: Hay otro administrador
- **WHEN** existe al menos otro perfil `is_admin` y se borra o se degrada uno de ellos
- **THEN** la operación se permite y el tenant sigue teniendo un administrador

#### Scenario: El administrador ve y edita todo
- **WHEN** el usuario tiene el perfil administrador (Gerente General) y accede a cualquier módulo, área o entidad
- **THEN** el acceso de lectura y de escritura se permite

### Requirement: R2 — Nivel de acceso por módulo, fail-closed
El sistema SHALL conceder a cada perfil un nivel por módulo, ordenado
`none < read < write`. `write` SHALL incluir crear, editar y eliminar.
El sistema SHALL NOT ofrecer permisos más finos por acción. La ausencia de
configuración para un módulo SHALL equivaler a `none`. Un nivel menor que
el requerido SHALL denegar la operación.

#### Scenario: Sin grant el acceso se niega
- **WHEN** el perfil no tiene grant para el módulo del recurso
- **THEN** lectura y escritura se niegan

#### Scenario: Lectura no autoriza escritura
- **WHEN** el perfil tiene `read` en el módulo y se intenta crear, editar o eliminar
- **THEN** la operación se niega

#### Scenario: Escritura cubre el ciclo de vida
- **WHEN** el perfil tiene `write` en el módulo y el resto de restricciones se cumplen
- **THEN** crear, editar y eliminar se permiten

#### Scenario: Pedro en Documentos y en Activos
- **WHEN** Pedro lee un documento y escribe un activo, sin restricción de área
- **THEN** la lectura del documento se permite, la escritura del activo se permite, y ve activos de toda la empresa

#### Scenario: Analistas de remuneraciones no modifican
- **WHEN** un analista de remuneraciones, con `payroll:read`, intenta modificar en payroll
- **THEN** la modificación se niega

### Requirement: R3 — Alcance opcional de áreas, con descendientes
El sistema SHALL permitir restringir un grant a un conjunto de áreas.
El acceso a un área SHALL incluir a sus descendientes. Sin restricción de
área, el perfil SHALL conservar acceso a toda la empresa en los módulos
que ya tiene. Solo SHALL persistirse las áreas raíz del alcance.
Un registro sin área SHALL ser visible solo para un perfil sin restricción
de área; un perfil restringido SHALL NOT verlo. Un grant con
`area_restricted` en true y sin filas en `grant_areas` SHALL tener alcance
vacío, no el de toda la empresa.

#### Scenario: Sin restricción de área
- **WHEN** el grant del módulo no está restringido por área
- **THEN** el perfil alcanza registros de cualquier área de la empresa

#### Scenario: El subárbol entra en el alcance
- **WHEN** el grant está restringido a un área raíz y el registro pertenece a esa área o a una descendiente
- **THEN** el área del registro está dentro del alcance

#### Scenario: Un área fuera del alcance se niega
- **WHEN** el grant está restringido por área y el registro pertenece a un área que no es la raíz concedida ni su descendiente
- **THEN** el acceso se niega

#### Scenario: Carolina solo ve Vacaciones de Ventas Zona Norte
- **WHEN** Carolina consulta vacaciones de empleados de Ventas Zona Norte o de sus subáreas
- **THEN** esas vacaciones entran en su alcance y las de cualquier otra área no

#### Scenario: El jefe comercial no ve Operaciones
- **WHEN** el Jefe de Gerencia Comercial, con `assets:read` restringido a Gerencia Comercial, consulta activos de Ventas Zona Norte, Ventas Zona Sur o Marketing
- **THEN** esas áreas entran en su alcance y Gerencia de Operaciones no

#### Scenario: Registro sin área
- **WHEN** un registro no tiene `area_id`
- **THEN** solo un perfil sin restricción de área lo ve, y un perfil con restricción de área no lo ve

#### Scenario: Grant restringido sin áreas raíz
- **WHEN** `area_restricted` es true y no hay filas en `grant_areas`
- **THEN** el alcance de áreas es vacío y no equivale a toda la empresa

### Requirement: R4 — Restricción opcional de entidades, modelo genérico
El sistema SHALL permitir restringir un grant a una lista de valores
permitidos por dimensión. Sin restricciones cargadas para una dimensión,
el perfil SHALL conservar acceso completo en esa dimensión. Las
restricciones SHALL evaluarse solo si el perfil ya tiene acceso al módulo.
El modelo SHALL ser genérico por tipo de recurso, dimensión y valor, de
forma que una dimensión futura no exija migrar el esquema. En este POC la
única dimensión operativa SHALL ser `category`.

#### Scenario: Sin restricciones de entidad
- **WHEN** el grant del módulo no tiene restricciones para una dimensión
- **THEN** cualquier valor de esa dimensión sigue permitido

#### Scenario: Allow-list de categoría
- **WHEN** el grant restringe `category` a un conjunto de valores y el registro trae un valor de ese conjunto
- **THEN** la dimensión se considera satisfecha

#### Scenario: Valor fuera de la lista
- **WHEN** el grant restringe `category` y el valor del registro no está en la lista
- **THEN** el acceso se niega

#### Scenario: Jefe de TI solo en Computadores y Teléfonos
- **WHEN** el Jefe de TI escribe un activo de categoría Computadores o Teléfonos, sin restricción de área
- **THEN** la escritura se permite en cualquier área

#### Scenario: Jefe de TI no escribe otra categoría
- **WHEN** el Jefe de TI escribe un activo de categoría Vehículos
- **THEN** la escritura se niega

#### Scenario: Los encargados de denuncias no se ven entre sí
- **WHEN** el encargado A tiene `complaints:write` restringido a Acoso y Discriminación, y el encargado B tiene `complaints:write` restringido a Fraude
- **THEN** cada uno accede únicamente a las denuncias de sus categorías y no a las del otro

### Requirement: R5 — Acceso efectivo conjunto, las restricciones solo reducen
El acceso efectivo SHALL ser la conjunción de módulo, área y entidad.
El motor SHALL evaluar cada grant completo (las tres condiciones juntas).
Una restricción de área o de entidad SHALL poder reducir el acceso y SHALL
NOT ampliarlo a un módulo, un área o una entidad que el grant no concede.

#### Scenario: Falta una condición y se niega
- **WHEN** el módulo se concede pero el área o la entidad del registro queda fuera de la restricción
- **THEN** el acceso se niega

#### Scenario: Carolina no gana otros módulos por su área
- **WHEN** Carolina intenta acceder a un módulo distinto de Vacaciones, aunque el registro sea de Ventas Zona Norte
- **THEN** el acceso se niega

#### Scenario: Pedro no escribe documentos por tener escritura en Activos
- **WHEN** Pedro intenta escribir en Documentos teniendo solo lectura en ese módulo y escritura en Gestión de Activos
- **THEN** la escritura en Documentos se niega

### Requirement: R6 — Contrato declarativo in-process
El sistema SHALL exponer una API in-process de chequeo puntual y de
alcance de listado. Un equipo SHALL autorizar un recurso solo declarándolo
(módulo, columna de área y columnas de cada dimensión filtrable) y SHALL
NOT implementar lógica de autorización propia.

#### Scenario: El equipo solo declara el recurso
- **WHEN** un equipo registra un recurso con su módulo, su columna de área y el mapa de dimensiones
- **THEN** puede consultar si una acción está permitida sobre un registro y obtener el filtro de listado sin escribir reglas propias

#### Scenario: Chequeo y listado usan el mismo criterio
- **WHEN** se autoriza un registro suelto y se lista el mismo conjunto con la misma acción
- **THEN** el registro aparece en el listado si y solo si el chequeo puntual lo permite

### Requirement: R7 — Resolución por request y listados por predicado
El sistema SHALL resolver los permisos efectivos de un usuario una vez por
request. Un chequeo puntual posterior, dentro de esa resolución, SHALL ser
O(1) y SHALL NOT hacer I/O. Un listado SHALL filtrar con predicados sobre
las columnas de área y de dimensión del recurso, no trayendo la tabla
completa para filtrarla en memoria. La resolución SHALL seguir siendo
válida con 50.000 empleados y al menos 10.000 restricciones por tenant.

#### Scenario: El segundo chequeo no vuelve a leer permisos
- **WHEN** en el mismo request ya se resolvieron los permisos del usuario y se hace otro chequeo puntual
- **THEN** el chequeo no realiza una nueva lectura de permisos

#### Scenario: El listado no materializa la tabla
- **WHEN** se pide el alcance de listado de un recurso
- **THEN** el resultado es un filtro aplicable en la consulta sobre las columnas declaradas del recurso

### Requirement: R8 — Un cambio de permisos se ve en el siguiente uso
Un cambio de permisos SHALL ser visible en el siguiente request o job del
tenant. SHALL NOT quedar una ventana en la que ese request o job siga
usando permisos anteriores ya commiteados. Un job asíncrono SHALL recibir
el `user_id` y SHALL resolver los permisos al ejecutarse, no al encolarse.
Cualquier escritura de administración sobre perfiles, grants, áreas del
grant, restricciones de entidad o la asignación de perfil de un usuario
SHALL invalidar los permisos cacheados de ese tenant al confirmarse la
escritura.

#### Scenario: El request siguiente ve el grant nuevo
- **WHEN** se confirma un cambio de grant de un usuario y, sin reiniciar el proceso, se vuelve a evaluar una acción
- **THEN** el resultado corresponde a los permisos ya confirmados

#### Scenario: El job resuelve al ejecutarse
- **WHEN** los permisos cambian después de que un job fue encolado y el job se ejecuta con el `user_id`
- **THEN** la evaluación usa los permisos vigentes en la ejecución

#### Scenario: La caché vieja no sobrevive al commit
- **WHEN** se confirma una escritura de administración que altera permisos o la asignación de perfil
- **THEN** la resolución posterior no devuelve el conjunto de permisos anterior
