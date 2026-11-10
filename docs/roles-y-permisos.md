# Roles y permisos del sistema CRD de farmacovigilancia

**Versión:** 2.0
**Fecha:** 2026-11-09
**Autor:** Documentación técnica de prácticas
**Estado:** Modelo adoptado (ADR-001) e implementado como prueba de concepto
**Sistemas de referencia:** Strapi 5.40 + Next.js 16 (objetivo) · POC sobre Next.js 16 + PostgreSQL 18
**Documento relacionado:** [`adr/ADR-001-modelo-roles-y-asignaciones.md`](./adr/ADR-001-modelo-roles-y-asignaciones.md)

> **Versión corta para revisión:** [`roles-y-permisos-revision.md`](./roles-y-permisos-revision.md) — 5 decisiones a validar, matriz y reglas clave en 6 páginas.

---

## 1. Objetivo y alcance

Este documento define **quién puede hacer qué** en el sistema CRD de farmacovigilancia que se construye desde cero sobre la infraestructura del SIM.

El alcance cubre:

- El catálogo de roles y el significado de cada uno.
- La matriz de permisos, expresada como pares `recurso:acción`.
- Las reglas de ámbito: a qué estudios accede cada usuario.
- La separación entre la identidad del paciente y los datos de recogida.
- El modelo de auditoría y la segregación de funciones.
- Cómo se verifica cada regla.

**Fuera de alcance:** el diseño detallado del esquema de datos clínicos, la operación en producción y la validación formal de licencias.

> **Nota de vigencia.** Las secciones 2 a 4 describen el sistema anterior (instancia ICA) tal como lo documenta el informe técnico. Se conservan como **antecedente histórico** para justificar el rediseño; el sistema actual es el que se describe a partir de la sección 5. La instancia anterior se abandona: no hay usuarios, roles ni datos que migrar.

---

## 2. Contexto: por qué se rediseña el acceso

El sistema anterior resolvía la autorización en tres puntos distintos y de forma parcial:

```
Navegador
   │  cookie pv_session (JSON { jwt, user }, httpOnly, SIN firma)
   ▼
Next.js  ──►  Route Handler /api/strapi/[...path]
                 │  JWT de sesión  ó  STRAPI_API_TOKEN (fallback)
                 ▼
              Strapi 5.40  ──►  SQLite / PostgreSQL
                 │
                 └─ middleware is-site-scoped (solo crd, paciente, evento-adverso;
                                               solo find, findOne, create, update)
```

Consecuencias directas:

- El **punto de decisión real** estaba repartido entre el middleware de Next (comprobaba presencia de cookie), el proxy (podía usar un token de servicio) y un middleware de Strapi (aplicación parcial).
- No existía una **capa única de autorización** que decidiera `sujeto + acción + recurso + ámbito`.
- El rol se evaluaba por **nombre literal** (`"Admin"`, `"medico-investigador"`), no por código estable.
- El borrado físico y la publicación quedaban fuera del filtro.

---

## 3. Roles del sistema anterior (as-is)

### 3.1 Roles de API evidenciados

| Rol | Ámbito | Comportamiento observado | Riesgo |
|---|---|---|---|
| `Public` | Ninguno por defecto | Sin permisos conocidos; si se habilitó lectura clínica, hay fuga anónima | Alto si tiene permisos |
| `Authenticated` | Sin filtro | Atraviesa el filtro de sitio sin restricción | **Crítico** |
| `Admin` | Global | Opera sin filtro de sitio en `crd`, `paciente` y `evento-adverso` | Alto: rol global sin segregación |
| `medico-investigador` | Por sitio | Alcance aplicado solo en `find`, `findOne`, `create`, `update` de 3 colecciones; **no** en `delete` | Alto |

> Los nombres `Admin` y `medico-investigador` son nombres visibles: renombrar un rol en el panel rompía el control de acceso (*fail-open*).

### 3.2 Cobertura real del middleware de sitio

| Colección | `find` | `findOne` | `create` | `update` | `delete` | `publish` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `crd` | Sí | Sí | Sí | Sí | **No** | **No** |
| `paciente` | Sí | Sí | Sí | Sí | **No** | **No** |
| `evento-adverso` | Sí | Sí | Sí | Sí | **No** | **No** |
| Resto de colecciones clínicas | No | No | No | No | No | No |

Lectura: un investigador podía leer y escribir cualquier registro de las nueve colecciones no cubiertas y, si el permiso estaba habilitado, **borrar** un CRD de otro sitio.

### 3.3 Funciones de dominio sin rol propio

El informe describe el requisito de control por rol y ámbito, pero no evidencia roles para monitor/CRA, coordinador de sitio, data manager, farmacovigilancia ni auditor. Esas funciones se ejercían con `Admin` o `medico-investigador`, lo que impedía la segregación.

---

## 4. Hallazgos que motivan el rediseño

| ID | Hallazgo | Severidad |
|---|---|---|
| AC-01 | El proxy podía operar con token de servicio sin sesión de usuario | Crítica |
| AC-02 | La cookie de sesión no estaba firmada ni cifrada | Crítica |
| AC-03 | El middleware de Next validaba presencia de cookie, no validez | Alta |
| AC-04 | El alcance por sitio solo cubría 3 colecciones × 4 operaciones | Crítica |
| AC-05 | `delete` y `publish`/`unpublish` quedaban fuera del alcance | Crítica |
| AC-06 | Autorización por nombre literal de rol ⇒ *fail-open* al renombrar | Alta |
| AC-07 | `authenticated` accedía sin filtro de sitio | Crítica |
| AC-08 | No había roles de dominio para monitor, coordinador, data manager, seguridad ni auditor | Alta |
| AC-09 | No había pista de auditoría de accesos, lecturas ni exportaciones | Alta |
| AC-10 | El panel de administración quedaba fuera del modelo de alcance | Alta |

El rediseño no replica el modelo anterior: **reduce** el catálogo a tres roles y traslada las garantías a la base de datos y a una única capa de decisión.

---

## 5. Principios del modelo adoptado

1. **Deny by default.** Sin rol o sin asignación activa no hay acceso, aunque la sesión sea válida.
2. **Una sola capa de decisión.** Toda operación clínica pasa por el motor `can(sujeto, permiso, recurso)`. Ni la interfaz ni el proxy deciden.
3. **RBAC con ámbito por estudio.** El rol define *qué acciones*; la asignación define *sobre qué estudios*.
4. **Autorización por código estable.** Se autoriza por `rol_codigo` (`sys-admin`, `jefe-estudio`, `medico-investigador`), nunca por nombre visible.
5. **Fail-closed.** Rol desconocido, ámbito ausente o recurso no encontrado ⇒ se deniega y se registra.
6. **Mínimo privilegio y segregación de funciones.** Quien administra no toca clínica; quien supervisa no captura; quien captura no audita.
7. **El borrado clínico no existe.** Se anula con motivo, autor y fecha; el registro se conserva.
8. **Trazabilidad inmutable.** Toda decisión relevante —permitida o denegada— se registra en una pista append-only encadenada por hash.
9. **La identidad del paciente es un dato aparte.** El código de paciente y la identidad personal se protegen por separado.

---

## 6. Catálogo de roles

El modelo tiene **tres roles**. La cantidad es una decisión explícita: cada rol adicional multiplica la matriz, los casos de prueba y el riesgo de configuraciones incoherentes.

| Código | Rol | Ámbito | Propósito |
|---|---|---|---|
| `sys-admin` | Administrador del sistema | Global | Administrar cuentas, asignaciones, estudios y catálogos. Garantizar que el sistema tenga usuarios válidos y accesos correctos |
| `jefe-estudio` | Jefe de estudio | Sus estudios | Dirigir el estudio: sitios, equipo investigador, supervisión del avance y auditoría clínica |
| `medico-investigador` | Médico investigador | Sus estudios | Ejecutar el estudio: pacientes, CRD, dosis, eventos adversos, firma y cierre |

### 6.1 Capacidades por rol

| Acción | `sys-admin` | `jefe-estudio` | `medico-investigador` |
|---|:---:|:---:|:---:|
| Crear / desactivar usuarios | ✔ | ✘ | ✘ |
| Asignar usuario a un estudio | ✔ | ✔ (sus estudios) | ✘ |
| Crear estudio | ✔ | ✔ | ✘ |
| Crear / editar sitios del estudio | ✘ | ✔ (sus estudios) | ✘ |
| Ver pacientes del estudio | ✘ | ✔ (sus estudios) | ✔ (sus estudios) |
| Crear / editar paciente | ✘ | ✘ | ✔ |
| Ver identidad del paciente | ✘ | ✔ (sus estudios) | ✔ (sus estudios) |
| Cargar / editar CRD, dosis | ✘ | ✘ | ✔ |
| Documentar evento adverso | ✘ | ✘ | ✔ |
| Firmar / cerrar CRD | ✘ | ✘ | ✔ |
| Anular un registro clínico | ✘ | ✘ | ✔ (con motivo) |
| Ver panel de avance del estudio | ✘ | ✔ (sus estudios) | ✔ (sus estudios) |
| Leer auditoría clínica | ✘ | ✔ (sus estudios) | ✘ |
| Leer auditoría administrativa | ✔ | ✘ | ✘ |
| Editar o borrar auditoría | ✘ | ✘ | ✘ |

### 6.2 Reglas de separación de funciones

1. **Ningún rol puede hacer todo.** El administrador no toca clínica, el jefe no firma, el investigador no administra.
2. **Nadie se autoasigna.** Un `jefe-estudio` puede crear un estudio, pero la asignación de sí mismo como jefe la confirma el `sys-admin`. Lo mismo aplica a cualquier cambio del propio rol.
3. **Una sola asignación activa por usuario y estudio.** No se acumulan roles en el mismo estudio; si se necesita otro rol, se reemplaza la asignación y queda auditado.
4. **La baja de una asignación surte efecto inmediato** en la siguiente petición, sin esperar a que expire la sesión.

---

## 7. Matriz de permisos

### 7.1 Catálogo de permisos

Los permisos se nombran `recurso:acción`. El catálogo completo tiene **35 permisos** agrupados en administración, trabajo clínico y supervisión.

Leyenda: ✔ concedido · ✘ denegado.

| Permiso | `sys-admin` | `jefe-estudio` | `medico-investigador` |
|---|:---:|:---:|:---:|
| `usuario:read` | ✔ | ✘ | ✘ |
| `usuario:create` | ✔ | ✘ | ✘ |
| `usuario:update` | ✔ | ✘ | ✘ |
| `usuario:deactivate` | ✔ | ✘ | ✘ |
| `estudio:read` | ✔ | ✔ | ✔ |
| `estudio:create` | ✔ | ✔ | ✘ |
| `estudio:update` | ✔ | ✔ | ✘ |
| `sitio:read` | ✔ | ✔ | ✔ |
| `sitio:create` | ✘ | ✔ | ✘ |
| `sitio:update` | ✘ | ✔ | ✘ |
| `asignacion:read` | ✔ | ✔ | ✘ |
| `asignacion:create` | ✔ | ✔ | ✘ |
| `asignacion:revoke` | ✔ | ✔ | ✘ |
| `auditoria_admin:read` | ✔ | ✘ | ✘ |
| `paciente:read` | ✘ | ✔ | ✔ |
| `paciente:create` | ✘ | ✘ | ✔ |
| `paciente:update` | ✘ | ✘ | ✔ |
| `paciente:annul` | ✘ | ✘ | ✔ |
| `identidad:read` | ✘ | ✔ | ✔ |
| `identidad:create` | ✘ | ✘ | ✔ |
| `identidad:update` | ✘ | ✘ | ✔ |
| `crd:read` | ✘ | ✔ | ✔ |
| `crd:create` | ✘ | ✘ | ✔ |
| `crd:update` | ✘ | ✘ | ✔ |
| `crd:sign` | ✘ | ✘ | ✔ |
| `crd:annul` | ✘ | ✘ | ✔ |
| `dosis:read` | ✘ | ✔ | ✔ |
| `dosis:create` | ✘ | ✘ | ✔ |
| `dosis:update` | ✘ | ✘ | ✔ |
| `dosis:annul` | ✘ | ✘ | ✔ |
| `evento:read` | ✘ | ✔ | ✔ |
| `evento:create` | ✘ | ✘ | ✔ |
| `evento:update` | ✘ | ✘ | ✔ |
| `auditoria_clinica:read` | ✘ | ✔ | ✘ |
| `exportacion:export` | ✘ | ✔ | ✘ |
| **Total** | **12** | **16** | **21** |

> El `sys-admin` no tiene ningún permiso clínico (`paciente`, `identidad`, `crd`, `dosis`, `evento`). Su acceso es de configuración.

### 7.2 Lectura de la matriz

- **`sys-admin`**: 12 permisos, todos administrativos. No ve pacientes ni auditoría clínica.
- **`jefe-estudio`**: 16 permisos. Lee toda la clínica de sus estudios y la audita, pero **no escribe** datos clínicos ni firma.
- **`medico-investigador`**: 21 permisos. Es el único que captura, firma y anula datos clínicos. No administra usuarios, asignaciones ni sitios.
- **Ningún rol** puede editar ni borrar auditoría; no es un permiso de la matriz, es una prohibición de base de datos.

### 7.3 Operaciones sensibles

| Operación | Quién | Condiciones |
|---|---|---|
| Anular paciente / CRD / dosis | `medico-investigador` | Motivo obligatorio + auditoría; nunca borrado físico |
| Firmar CRD | `medico-investigador` | El CRD debe estar en borrador; se registra usuario y fecha |
| Exportar datos | `jefe-estudio` | Autorización explícita y registro de exportación |
| Gestionar usuarios y asignaciones | `sys-admin`, `jefe-estudio` (sus estudios) | Sin autoasignación; doble control en cambios propios |
| Leer auditoría clínica | `jefe-estudio` | Solo registros de sus estudios; inmutable |
| Leer auditoría administrativa | `sys-admin` | Solo eventos sin estudio; sin contenido clínico |
| Verificar integridad de la auditoría | Cualquier rol con lectura | Recálculo de la cadena SHA-256 |

---

## 8. Reglas de ámbito y asignación

### 8.1 El estudio como dimensión

El ámbito se resuelve **por estudio**. El sitio clínico (`HSA`, `HSB`, …) se conserva como atributo del paciente, pero **no** como dimensión de permisos: un paciente pertenece a un estudio y el sitio no altera quién puede verlo. Agregarlo multiplicaría la matriz sin un caso de uso que lo justifique.

Dos medicamentos son **dos estudios independientes**; un usuario puede tener asignaciones distintas en cada uno.

### 8.2 Modelo de asignación

```sql
asignacion
├── id
├── usuario_id      → usuario
├── estudio_id      → estudio NULL   -- NULL = asignación global (sys-admin)
├── rol_codigo      → rol (código estable)
├── activa          boolean
├── creada_por      → usuario
├── creada_en       timestamptz
└── baja_en         timestamptz NULL

UNIQUE (usuario_id, estudio_id) WHERE activa AND estudio_id IS NOT NULL
UNIQUE (usuario_id)             WHERE activa AND estudio_id IS NULL
CHECK (estudio_id IS NOT NULL OR rol_codigo = 'sys-admin')
```

Reglas:

- Sin asignación activa ⇒ **sin acceso** al estudio, aunque el usuario exista y tenga sesión válida.
- El `sys-admin` no se asigna a un estudio: tiene una **asignación global** (`estudio_id NULL`). Así `asignacion` sigue siendo la única fuente de verdad de los roles y el motor resuelve el ámbito global sin una regla especial de almacenamiento.
- El ámbito efectivo de una petición es la intersección entre el recurso solicitado y los estudios donde el usuario tiene asignación activa.

### 8.3 Resolución de ámbito en el motor

El motor recibe el recurso con su `estudioId`:

| Situación | Decisión |
|---|---|
| Permiso no concedido al rol | Denegado |
| Recurso con `estudioId` fuera de las asignaciones | Denegado |
| Recurso sin `estudioId` y rol no global | Denegado (no se puede verificar el ámbito) |
| Recurso nuevo (`nuevo = true`) sin estudio | Se evalúa solo el permiso; el estudio se crea aquí |
| Rol global (`sys-admin`) | El permiso decide; el ámbito no aplica |
| Recurso inexistente | Denegado (no se revela si existe) |

> La regla `nuevo` permite que un `jefe-estudio` cree un estudio antes de tener una asignación sobre él. La asignación se confirma después con el `sys-admin`.

### 8.4 Separación identidad / CRD

| Colección | Contenido | Quién lee | Quién escribe |
|---|---|---|---|
| `identidad_paciente` | Nombre, documento, contacto, consentimiento | `jefe-estudio` y `medico-investigador` del estudio | `medico-investigador` |
| `paciente` | Código (`HSA-001`), iniciales, edad, sexo, peso, diagnóstico | Ambos roles del estudio | `medico-investigador` |
| `crd` | Evaluación inicial, intermedia, final, examen físico, laboratorio | Ambos roles del estudio | `medico-investigador` |
| `dosis` | Número de toma, lote, dosis, vía | Ambos roles del estudio | `medico-investigador` |
| `evento_adverso` | Evento, gravedad, causalidad, desenlace | Ambos roles del estudio | `medico-investigador` |

El `sys-admin` **no** accede a ninguna de estas colecciones.

**Variante más estricta disponible:** retirar la lectura de `identidad_paciente` al `jefe-estudio`, dejándola solo en el médico. Queda registrada en §11 como asunto abierto.

---

## 9. Auditoría

### 9.1 Estructura del registro

```sql
auditoria
├── id
├── fecha           timestamptz
├── usuario_id      → usuario
├── rol_codigo      text
├── estudio_id      → estudio NULL   -- NULL = evento administrativo
├── entidad         text             -- paciente, crd, dosis, evento_adverso, usuario, asignacion
├── entidad_id      text
├── accion          text             -- create, update, sign, annul, read, login, denied
├── resultado       text             -- permitido | denegado
├── detalle         jsonb            -- solo metadatos, nunca datos completos
├── hash_previo     text
└── hash            text
```

### 9.2 Lectura dividida por ámbito, no por rol

| Rol | Alcance de lectura |
|---|---|
| `jefe-estudio` | Registros con `estudio_id` en sus estudios, incluidos los eventos administrativos que los afectan (asignaciones, bajas) |
| `sys-admin` | Registros con `estudio_id IS NULL` y acciones de autenticación o administración |

**Por qué la auditoría clínica no la lee el `sys-admin`:** un registro de auditoría incluye el paciente y el valor modificado (*"cambió la dosis de HSA-001 de 60 a 80 mg"*). Darle lectura equivale a darle acceso clínico indirecto y concentraría en un solo rol la capacidad de actuar y de vigilar.

### 9.3 Inmutabilidad en tres capas

1. `REVOKE UPDATE, DELETE` sobre la tabla para el usuario de aplicación (`crd_app`).
2. Trigger `BEFORE UPDATE OR DELETE` que lanza una excepción (código `42501`).
3. Encadenamiento por hash: `hash = sha256(hash_previo ‖ contenido)`. Cualquier alteración por fuera de la aplicación rompe la cadena y es detectable con `verificar_auditoria()`.

La auditoría también está protegida contra `TRUNCATE` y su escritura usa un bloqueo de asesoramiento para serializar la cadena.

---

## 10. Sesión y autenticación en la prueba de concepto

| Control | Implementación |
|---|---|
| Cookie | `crd_sesion`, `HttpOnly`, `SameSite=Lax`, firmada con HMAC-SHA256 |
| Vigencia | 8 horas; se valida en cada petición |
| Revocación | La sesión se revalida contra la base: un usuario desactivado o una asignación dada de baja surten efecto en la siguiente petición |
| Contraseñas | `scrypt` con sal aleatoria; nunca se almacenan en claro |
| Decisiones denegadas | Se registran en auditoría con el `rol_codigo` del solicitante |

> La prueba de concepto no incluye MFA ni recuperación de cuenta; son parte del plan de producción (§11 y `plan-implementacion-rbac.md`).

---

## 11. Asuntos abiertos

| # | Asunto | Estado |
|---|---|---|
| 1 | ¿Se incorporan `monitor` y `auditor`? | Se consulta al tutor al finalizar el sistema de roles; el modelo puede crecer sin rediseñarse |
| 2 | ¿El `jefe-estudio` debe ver la identidad del paciente o solo el código? | Variante estricta disponible; se decide con el tutor |
| 3 | Política de contraseñas y segundo factor | Fuera del alcance del POC |
| 4 | Retención de la auditoría | Pendiente del requisito normativo del SIM |
| 5 | Firma electrónica formal (con reautenticación) | El POC registra firma con usuario y sesión; la reautenticación se evalúa después |

---

## 12. Verificación del modelo

El modelo no se valida por inspección visual: se ejecuta.

| Verificación | Herramienta | Resultado |
|---|---|---|
| Matriz de permisos por rol | `npm run matriz` | 35 permisos · 12 / 16 / 21 |
| Motor de política (permiso, ámbito, recurso nuevo, rol global) | `npm test` | 31 pruebas unitarias |
| Autorización de páginas por rol y estudio | Pruebas HTTP contra el servidor | 15 escenarios, 15 correctos |
| Acceso cruzado entre estudios | Prueba negativa con dos estudios | Denegado y auditado |
| Inmutabilidad de la auditoría | `UPDATE` / `DELETE` con el usuario de aplicación | Bloqueado con `42501` |
| Integridad de la cadena | `verificar_auditoria()` | `total=18`, `integra=true` tras el seed |
| Revocación inmediata | Sesión activa + asignación dada de baja | Redirección a `/login` en la siguiente petición |

Los criterios de aceptación formales están en el ADR-001 (§8, AC-01…AC-08).

---

## 13. Trazabilidad normativa

| Requisito | Cómo lo cubre el modelo |
|---|---|
| **21 CFR Part 11 §11.10(d)** — limitación de acceso | Deny by default + asignación explícita por estudio |
| **21 CFR Part 11 §11.10(e)** — pistas de auditoría | Tabla append-only, encadenada, con usuario, fecha, acción y resultado |
| **21 CFR Part 11 §11.10(g)** — comprobación de autoridad | Capa única de autorización sobre cada operación |
| **ALCOA+** — atribuible, contemporáneo, original, exacto | Cada registro lleva autor y marca de tiempo; no se sobrescribe, se anula con motivo |
| **ISO/IEC 27001 A.9** — control de acceso | Roles definidos, mínimo privilegio, revisión de asignaciones |
| **Segregación de funciones** | Ningún rol captura, aprueba y audita a la vez |

---

## Anexo A. Glosario

- **RBAC:** control de acceso basado en roles (qué acciones).
- **ABAC:** control de acceso basado en atributos (qué filas: estudio).
- **SoD:** segregación de funciones.
- **Deny by default:** ante la duda o el error, se deniega.
- **Fail-closed:** una excepción en la política produce denegación, no permiso.
- **ALCOA+:** atribuible, legible, contemporáneo, original, exacto (+ completo, consistente, duradero, disponible).
- **Pista de auditoría encadenada:** cada registro incluye el hash del anterior; alterar uno rompe la cadena.
