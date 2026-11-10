# POC RBAC — CRD de farmacovigilancia

Prueba de concepto ejecutable del modelo de acceso definido en el
[ADR-001](docs/adr/ADR-001-modelo-roles-y-asignaciones.md):
tres roles, ámbito por estudio, separación identidad/CRD y auditoría inmutable.

No es el sistema final. Sirve para **demostrar y probar** las decisiones antes de
trasladarlas a Strapi 5 + Next.js 16.

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/roles-y-permisos-revision.md`](docs/roles-y-permisos-revision.md) | Versión corta para el tutor: 5 decisiones, roles, matriz y reglas |
| [`docs/roles-y-permisos.md`](docs/roles-y-permisos.md) | Documento completo: catálogo de roles, 35 permisos y reglas de ámbito |
| [`docs/adr/ADR-001-modelo-roles-y-asignaciones.md`](docs/adr/ADR-001-modelo-roles-y-asignaciones.md) | Decisión de arquitectura y criterios de aceptación |
| [`docs/plan-implementacion-rbac.md`](docs/plan-implementacion-rbac.md) | Cronograma de una semana y ruta completa de referencia |
| [`docs/preguntas-tutor.md`](docs/preguntas-tutor.md) | Decisiones pendientes con el tutor |
| [`docs/diagramas/`](docs/diagramas/) | Diagramas UML: casos de uso, modelo de datos, secuencia, estados y actividad |
| [`docs/capturas/`](docs/capturas/) | Capturas de la POC en ejecución |

## Capturas de pantalla

Todas las capturas están en [`docs/capturas/`](docs/capturas/). Estas tres
resumen el modelo:

| Panel del administrador | Paciente, identidad y CRD | Acceso cruzado denegado |
|---|---|---|
| ![Panel del administrador](docs/capturas/02-panel-administrador.png) | ![Detalle del paciente](docs/capturas/08-paciente-detalle.png) | ![Acceso denegado](docs/capturas/11-acceso-cruzado-denegado.png) |
| Sin datos clínicos | Identidad separada del cuaderno | El intento queda auditado |

## Diagramas UML

Los diagramas y sus fuentes están en [`docs/diagramas/`](docs/diagramas/).

| Casos de uso por rol | Modelo de datos |
|---|---|
| ![Casos de uso](docs/diagramas/casos-de-uso.png) | ![Modelo de datos](docs/diagramas/modelo-datos.png) |
| Qué puede hacer cada rol | Asignación como fuente de verdad de roles |

También hay diagramas de **secuencia** (autorización de una petición),
**estados** (ciclo de vida de un CRD) y **actividad** (alta, cambio y baja de
una asignación).

## Stack

- **Next.js 16.4** (App Router) + React 19
- **PostgreSQL 18** con SQL directo (sin ORM) y el driver `pg`
- TypeScript 5.9
- CSS propio (sin Tailwind)

## Requisitos

- Node.js 22+
- PostgreSQL 18 local
- `psql` en `C:\Program Files\PostgreSQL\18\bin\psql.exe` (no está en el PATH)

## Puesta en marcha

### 1. Base de datos

Crear la base y los dos roles una sola vez (como superusuario):

```sql
CREATE DATABASE crd_rbac_poc;
CREATE ROLE crd_owner LOGIN PASSWORD 'crd_owner_dev_2026';
CREATE ROLE crd_app   LOGIN PASSWORD 'crd_app_dev_2026';
ALTER DATABASE crd_rbac_poc OWNER TO crd_owner;
```

Aplicar roles, esquema, privilegios y datos sintéticos:

```powershell
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$env:PGCLIENTENCODING = 'UTF8'

$env:PGPASSWORD = '1234'            # superusuario postgres
& $psql -h localhost -U postgres -d crd_rbac_poc -f db\01-roles-y-extensiones.sql

$env:PGPASSWORD = 'crd_owner_dev_2026'
& $psql -h localhost -U crd_owner -d crd_rbac_poc -f db\02-schema.sql
& $psql -h localhost -U crd_owner -d crd_rbac_poc -f db\03-grants.sql
& $psql -h localhost -U crd_owner -d crd_rbac_poc -f db\04-seed.sql
```

Detalle y recreación desde cero: [`db/README.md`](./db/README.md).

### 2. Variables de entorno

Copiar `.env.example` a `.env.local`:

```ini
DATABASE_URL=postgresql://crd_app:crd_app_dev_2026@localhost:5432/crd_rbac_poc
SESSION_SECRET=<48 bytes en hexadecimal>
```

### 3. Ejecutar

```powershell
npm install
npm run dev            # http://localhost:3000
```

Para una demostración estable, compilar y arrancar el build de producción:

```powershell
npm run build
npm start -- -p 3100   # http://localhost:3100
```

> **Importante — webpack obligatorio en este equipo.** Turbopack falla porque el
> binario nativo `next-swc.win32-x64-msvc.node` está corrupto. Los scripts `dev`
> y `build` ya incluyen `--webpack`. No usar `next dev` ni `next build` sin ese flag.

## Usuarios de prueba

Contraseña para todos: `Demo2026!`

| Usuario | Rol | Estudio |
|---|---|---|
| `admin@sim.local` | `sys-admin` | Global |
| `jefe.enoxa@sim.local` | `jefe-estudio` | ENOXA |
| `jefe.grani@sim.local` | `jefe-estudio` | GRANI |
| `inv.enoxa.hsa@sim.local` | `medico-investigador` | ENOXA |
| `inv.enoxa.hsb@sim.local` | `medico-investigador` | ENOXA |
| `inv.grani.hga@sim.local` | `medico-investigador` | GRANI |

Datos sintéticos: 2 estudios, 5 sitios, 50 pacientes, 79 CRD, 347 dosis y
14 eventos adversos. Del Excel original solo se reutiliza la **estructura**;
los valores son inventados.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (webpack) |
| `npm run build` | Build de producción (webpack) |
| `npm start` | Sirve el build |
| `npm test` | 31 pruebas del motor de política, ámbito y auditoría |
| `npm run matriz` | Imprime la matriz de 35 permisos por rol |
| `npm run seed` | Regenera `db/04-seed.sql` |
| `node scripts/capturas.mjs` | Regenera las capturas de `docs/capturas/` con Microsoft Edge |

## Estructura

```
app/            Rutas y server actions (panel, pacientes, estudios, usuarios, asignaciones, auditoría)
components/     Componentes de interfaz
lib/            Sesión, guardia de autorización, consultas y auditoría
src/core/       Catálogo, motor de política, ámbito y auditoría (independiente de Next)
src/cli/        Matriz imprimible
test/           Pruebas unitarias
db/             Roles, esquema, privilegios y seed
scripts/        Capturas de pantalla de la POC
docs/           Documentación, diagramas UML y capturas
```

> Las contraseñas de base y de los usuarios demo son **credenciales locales de
> demostración**, no secretos de producción. El archivo `.env.local` no se versiona.

## Qué demuestra

- **Deny by default** y autorización por `rol_codigo` estable.
- **Ámbito por estudio**: un investigador de un estudio no ve ni escribe en otro.
- **Separación de funciones**: el administrador no accede a datos clínicos; el
  jefe supervisa y audita, pero no firma; el médico captura, firma y anula.
- **Asignación global** del `sys-admin` (`estudio_id NULL`) sin duplicar la
  fuente de verdad de roles.
- **Sin borrado clínico**: anulación con motivo. `crd_app` no tiene `DELETE`.
- **Auditoría inmutable**: privilegios + trigger + cadena SHA-256 verificable.
- **Revocación inmediata**: una asignación dada de baja corta el acceso en la
  siguiente petición.

## Verificación rápida

```powershell
npm test
npm run matriz
```

En la interfaz:

1. Entrar como `inv.grani.hga@sim.local` e intentar abrir un paciente de ENOXA
   (por URL): debe mostrarse "Acceso restringido".
2. Entrar como `admin@sim.local`: no hay acceso a pacientes y la auditoría es
   solo administrativa.
3. Entrar como `jefe.enoxa@sim.local`: ve la clínica de ENOXA y la auditoría
   clínica, pero no los botones de creación ni firma.
4. En `/auditoria`, usar "Verificar integridad": la cadena debe ser válida.
