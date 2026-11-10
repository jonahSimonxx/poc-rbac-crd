# Base de datos del POC

PostgreSQL 18 · base `crd_rbac_poc`

## Roles de base

| Rol | Uso | Privilegios |
|---|---|---|
| `crd_owner` | Migraciones | Dueño del esquema y de las tablas |
| `crd_app` | Aplicación | `SELECT/INSERT/UPDATE` en tablas clínicas; `SELECT/INSERT` en auditoría |

La separación es intencional. Un dueño de tabla puede re-otorgarse privilegios, así que la
aplicación nunca debe ser dueña: de ahí que la inmutabilidad de la auditoría se sostenga.

## Orden de ejecución

`psql` no está en el PATH; usar la ruta completa.

```powershell
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$env:PGCLIENTENCODING = "UTF8"

# 1. Roles y extensiones (superusuario)
$env:PGPASSWORD = "<clave de postgres>"
& $psql -U postgres -h localhost -d crd_rbac_poc -f db\01-roles-y-extensiones.sql

# 2. Esquema (dueño)
$env:PGPASSWORD = "crd_owner_dev_2026"
& $psql -U crd_owner -h localhost -d crd_rbac_poc -f db\02-schema.sql
& $psql -U crd_owner -h localhost -d crd_rbac_poc -f db\03-grants.sql

# 3. Prueba de humo (aplicación, no deja datos)
$env:PGPASSWORD = "crd_app_dev_2026"
& $psql -U crd_app -h localhost -d crd_rbac_poc -f db\99-smoke-test.sql
```

## Datos sintéticos

Se generan con un script determinista y se aplican como `crd_owner`:

```powershell
node db\seed\generate-seed.mjs
$env:PGPASSWORD = "crd_owner_dev_2026"
& $psql -U crd_owner -h localhost -d crd_rbac_poc -f db\04-seed.sql
```

Volumen: 6 usuarios, 2 estudios, 5 sitios, 6 asignaciones (incluida la global
del `sys-admin`), 50 pacientes, 79 formularios CRD, 347 dosis, 14 eventos
adversos y 18 registros de auditoría.

Del Excel de Enoxaparina se reutiliza **solo la estructura** (códigos `HSA-001`,
una fila por toma, columnas clínicas). Los valores son inventados.

### Usuarios de prueba

Contraseña para todos: `Demo2026!`

| Usuario | Rol | Estudio |
|---|---|---|
| `admin@sim.local` | `sys-admin` | — (global) |
| `jefe.enoxa@sim.local` | `jefe-estudio` | ENOXA |
| `jefe.grani@sim.local` | `jefe-estudio` | GRANI |
| `inv.enoxa.hsa@sim.local` | `medico-investigador` | ENOXA |
| `inv.enoxa.hsb@sim.local` | `medico-investigador` | ENOXA |
| `inv.grani.hga@sim.local` | `medico-investigador` | GRANI |

## Tablas

| Tabla | Contenido |
|---|---|
| `rol` | Catálogo de 3 roles (solo lectura para la aplicación) |
| `usuario` | Cuentas de acceso |
| `estudio` | Estudios de farmacovigilancia |
| `sitio` | Sitios de un estudio |
| `asignacion` | Usuario + estudio + rol (una activa por estudio) |
| `paciente` | Datos clínicos sin identidad personal |
| `identidad_paciente` | Nombre, documento, contacto, consentimiento |
| `crd` | Formularios del cuaderno de recogida |
| `dosis` | Una fila por toma |
| `evento_adverso` | Eventos adversos |
| `auditoria` | Pista append-only encadenada por hash |

## Reglas que impone la base, no la aplicación

- `DELETE` revocado en todas las tablas: el borrado clínico no existe.
- `paciente.anulado` exige `motivo_anulacion`.
- Una sola asignación activa por usuario y estudio (`UNIQUE` parcial).
- El sitio del paciente debe pertenecer a su estudio (FK compuesta).
- `auditoria` sin `UPDATE`/`DELETE`/`TRUNCATE`, con trigger que lanza excepción y
  cadena SHA-256 verificable con `verificar_auditoria()`.

## Recrear desde cero

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Ejecutar como `crd_owner` y repetir los pasos 1, 2 y 3. **Importante:** al
eliminar el esquema `public` también se elimina la extensión `pgcrypto`, que
provee `digest()` para la cadena de auditoría. El paso 1 la vuelve a crear.

Si solo se re-ejecuta el seed, no hace falta borrar el esquema.

> `05-migracion-asignacion-global.sql` fue una migración puntual sobre una base
> ya creada. El estado final está en `02-schema.sql`, así que una recreación
> desde cero **no** necesita ejecutarla.
