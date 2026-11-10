# Roles y permisos del CRD — versión para revisión

**Sistema:** CRD de farmacovigilancia sobre la infraestructura del SIM · Strapi 5 + Next.js 16
**Versión:** 2.1 · **Fecha:** 2026-11-10 · **Estado:** propuesta validada en prueba de concepto
**Plan:** una semana (5 días hábiles) desde esta revisión
**Documento completo:** [`roles-y-permisos.md`](./roles-y-permisos.md) · **Decisión:** [`adr/ADR-001`](./adr/ADR-001-modelo-roles-y-asignaciones.md)

---

## 1. Qué necesito que revises

Cinco decisiones. Cada una trae una propuesta y el efecto de cambiarla. Con la revisión cerrada, el cierre del sistema de roles se compromete **en una semana**.

| # | Decisión | Propuesta | Si se cambia |
|---|---|---|---|
| 1 | ¿Alcanzan **tres roles** (`sys-admin`, `jefe-estudio`, `medico-investigador`)? | Sí, para la primera versión | Agregar un rol cuesta ~2 jornadas y ~8 pruebas; el modelo lo admite sin rediseño |
| 2 | ¿El ámbito de acceso es el **estudio** o el **sitio clínico**? | Estudio. El sitio queda como atributo del paciente | Bajar a sitio duplica las asignaciones y la matriz |
| 3 | ¿Quién **firma** un CRD? | Solo el médico investigador | Si firma también el jefe, se pierde la separación captura/supervisión |
| 4 | ¿El **jefe de estudio** ve la identidad del paciente? | Sí, dentro de sus estudios | Variante estricta lista: solo el médico la ve |
| 5 | ¿**`monitor` y `auditor`** entran ahora? | No; se evalúan después del piloto | Se pueden añadir como roles de solo lectura sin tocar el esquema |

Pendiente aparte, no bloquea el modelo: **normativa aplicable y retención de la auditoría**.

---

## 2. El modelo en una página

**Tres roles, ámbito por estudio, deny by default.** Sin asignación activa no hay acceso, aunque la sesión sea válida.

| Código | Rol | Ámbito | Para qué |
|---|---|---|---|
| `sys-admin` | Administrador del sistema | Global | Cuentas, asignaciones, estudios y catálogos. **No toca datos clínicos** |
| `jefe-estudio` | Jefe de estudio | Sus estudios | Sitios, equipo, supervisión del avance y auditoría clínica. **No captura ni firma** |
| `medico-investigador` | Médico investigador | Sus estudios | Pacientes, CRD, dosis, eventos adversos, firma y anulación |

Reglas de separación:

- **Ningún rol hace todo:** quien administra no ve clínica; quien supervisa no captura; quien captura no audita.
- **Nadie se autoasigna:** un jefe puede crear un estudio, pero el `sys-admin` confirma su asignación.
- **Una asignación activa por usuario y estudio.** Cambiar de rol reemplaza la asignación y queda auditado.
- **La baja surte efecto en la siguiente petición**, sin esperar a que expire la sesión.

Por qué tres y no más: cada rol extra multiplica la matriz, las pruebas y el riesgo de configuraciones incoherentes. Las funciones de monitor, coordinador o auditor se evaluarán con uso real, no por anticipado.

---

## 3. Matriz de permisos

Los permisos se nombran `recurso:acción`. **Todo lo que no está concedido se deniega.**

### Administración

| Permiso | `sys-admin` | `jefe-estudio` | `medico-investigador` |
|---|:---:|:---:|:---:|
| `usuario:read` / `create` / `update` / `deactivate` | ✔ | ✘ | ✘ |
| `estudio:read` | ✔ | ✔ | ✔ |
| `estudio:create` / `update` | ✔ | ✔ | ✘ |
| `sitio:read` | ✔ | ✔ | ✔ |
| `sitio:create` / `update` | ✘ | ✔ | ✘ |
| `asignacion:read` / `create` / `revoke` | ✔ | ✔ | ✘ |
| `auditoria_admin:read` | ✔ | ✘ | ✘ |

### Trabajo clínico

| Permiso | `sys-admin` | `jefe-estudio` | `medico-investigador` |
|---|:---:|:---:|:---:|
| `paciente:read` | ✘ | ✔ | ✔ |
| `paciente:create` / `update` / `annul` | ✘ | ✘ | ✔ |
| `identidad:read` | ✘ | ✔ | ✔ |
| `identidad:create` / `update` | ✘ | ✘ | ✔ |
| `crd:read` | ✘ | ✔ | ✔ |
| `crd:create` / `update` / `sign` / `annul` | ✘ | ✘ | ✔ |
| `dosis:read` | ✘ | ✔ | ✔ |
| `dosis:create` / `update` / `annul` | ✘ | ✘ | ✔ |
| `evento:read` | ✘ | ✔ | ✔ |
| `evento:create` / `update` | ✘ | ✘ | ✔ |

### Supervisión

| Permiso | `sys-admin` | `jefe-estudio` | `medico-investigador` |
|---|:---:|:---:|:---:|
| `auditoria_clinica:read` | ✘ | ✔ | ✘ |
| `exportacion:export` | ✘ | ✔ | ✘ |

| Rol | Permisos | Lectura |
|---|:---:|---|
| `sys-admin` | **12** | Solo administración |
| `jefe-estudio` | **16** | Toda la clínica de sus estudios, sin escribir |
| `medico-investigador` | **21** | Toda la clínica de sus estudios, con escritura y firma |

Ningún rol puede editar ni borrar la auditoría: no es un permiso de la matriz, es una prohibición de base de datos.

---

## 4. Reglas que la matriz no muestra

**Ámbito.** El paciente pertenece a un estudio; el sitio (`HSA`, `HSB`) es un atributo y no cambia quién lo ve. Dos medicamentos son dos estudios independientes.

**Asignación.** `asignacion(usuario, estudio, rol, activa)`. El `sys-admin` tiene una asignación global (`estudio_id NULL`), de modo que la tabla de asignaciones sigue siendo la única fuente de verdad de los roles.

**Sin borrado clínico.** Se anula con motivo, autor y fecha; el registro se conserva. Si un CRD tiene un error, queda el original anulado y el nuevo.

**Auditoría en tres capas.** La aplicación no puede modificarla: privilegios de base revocados, trigger que lanza error y cadena SHA-256 que detecta cualquier alteración externa. Toda decisión —permitida o denegada— se registra.

**Lectura de auditoría dividida.** El jefe lee la auditoría clínica de sus estudios; el `sys-admin` solo los eventos administrativos. Motivo: un registro clínico incluye paciente y valores, así que dárselo al administrador equivaldría a darle acceso clínico indirecto.

**Identidad separada.** Nombre, documento y contacto viven en `identidad_paciente`, aparte del código de paciente y de los datos del CRD.

---

## 5. Qué ya está probado

Se implementó una prueba de concepto ejecutable sobre Next.js 16 + PostgreSQL 18 (no es el sistema final; sirve para validar las decisiones antes de Strapi).

**Repositorio público:** <https://github.com/jonahSimonxx/poc-rbac-crd> — código, esquema, datos sintéticos y esta documentación.

| Verificación | Resultado |
|---|---|
| Motor de autorización (permiso, ámbito, rol global, recurso nuevo) | 31 pruebas, 31 correctas |
| Escenarios de acceso por rol y estudio (HTTP) | 15 escenarios, 15 correctos |
| Acceso cruzado entre dos estudios | Denegado y auditado |
| Anulación de auditoría con el usuario de aplicación | Bloqueado (`42501`) |
| Integridad de la cadena de auditoría | Válida |
| Revocación de acceso con sesión activa | Efectiva en la siguiente petición |

Datos sintéticos: 2 estudios, 5 sitios, 50 pacientes, 79 CRD. Del Excel original solo se reutiliza la estructura; los valores son inventados.

---

## 6. Lo que queda abierto

| Asunto | Cuándo se decide |
|---|---|
| Incorporar `monitor` / `auditor` | Después del piloto, con uso real |
| Identidad del paciente para el jefe | En esta revisión (propuesta: sí, con ámbito) |
| Retención de la auditoría | Cuando se confirme la normativa del SIM |
| MFA y recuperación de cuenta | Antes de producción; fuera del alcance del POC |
| Firma electrónica con reautenticación | Antes de producción; el POC registra usuario y fecha |

---

## Anexo. Del sistema anterior al propuesto

| Sistema anterior (según el informe) | Propuesta |
|---|---|
| Autorización repartida en tres puntos (Next, proxy, Strapi) | Una sola capa de decisión en el servidor |
| Roles evaluados por nombre visible ⇒ *fail-open* al renombrar | Autorización por código estable |
| Ámbito por sitio, solo en 3 colecciones y 4 operaciones | Ámbito por estudio, en todas las operaciones |
| `delete` y `publish` fuera del control | Sin borrado; anulación con motivo |
| Sin pista de auditoría | Auditoría append-only encadenada |
| Cualquier rol no previsto pasaba sin filtro | Deny by default |

Los hallazgos completos (AC-01…AC-10) y el plan de implementación están en los documentos de referencia.
