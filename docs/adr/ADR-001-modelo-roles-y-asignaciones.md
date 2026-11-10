# ADR-001 — Modelo de roles, ámbito por estudio y auditoría

**Estado:** Aceptado
**Fecha:** 2026-11-08
**Decisores:** Jonathan Simón (prácticas) · Tutor del proyecto (Leandro)
**Documentos relacionados:** [`roles-y-permisos.md`](../roles-y-permisos.md) · [`plan-implementacion-rbac.md`](../plan-implementacion-rbac.md) · [`preguntas-tutor.md`](../preguntas-tutor.md)

---

## 1. Contexto

El sistema CRD de farmacovigilancia se reconstruye **desde cero** sobre la infraestructura del SIM. No hay usuarios, roles ni datos que migrar: la instancia anterior pertenecía a otra organización y se abandona.

Eso invierte el problema. Ya no se trata de auditar permisos existentes, sino de **definir el modelo de acceso** de un sistema nuevo. Las decisiones tomadas en esa definición condicionan el esquema de base de datos, el código de autorización y la pista de auditoría, y son costosas de revertir después.

Restricciones y hechos que enmarcan la decisión:

| Hecho | Implicancia |
|---|---|
| El sistema se construye sobre Strapi 5.40 + Next.js 16 | El modelo debe poder expresarse en colecciones y middleware |
| No habrá despliegue en el corto plazo | Se prioriza claridad y demostrabilidad sobre operación |
| Un paciente pertenece a **un** estudio; dos medicamentos = dos estudios independientes | El ámbito natural es el estudio, no el sitio |
| El CRD separa intencionalmente los datos personales del paciente de los datos de recogida | El control de acceso debe reflejar esa separación |
| El rol principal es el **médico investigador** | Es el único que captura y firma datos clínicos |
| El volumen de roles debe mantenerse bajo | La matriz de permisos debe ser pequeña y verificable |

---

## 2. Decisión

Se adopta un modelo **RBAC con ámbito por estudio**, de tres roles, con separación estricta entre identidad del paciente y datos clínicos, y auditoría inmutable con lectura dividida entre dos roles.

### 2.1 Resumen de decisiones

| # | Decisión | Valor |
|---|---|---|
| D1 | Cantidad de roles | **3** |
| D2 | Roles | `sys-admin`, `jefe-estudio`, `medico-investigador` |
| D3 | Dimensión de ámbito | **Estudio** (el sitio es un dato, no un ámbito de permisos) |
| D4 | Modelo de asignación | Entidad `asignacion`: usuario + estudio + rol |
| D5 | Política por defecto | **Deny by default** |
| D6 | Identidad del paciente | Colección separada; visible solo para roles con acceso clínico al estudio |
| D7 | Borrado clínico | **Prohibido**; se anula con motivo y queda auditado |
| D8 | Auditoría clínica | La lee el `jefe-estudio` de su estudio |
| D9 | Auditoría administrativa | La lee el `sys-admin`; sin contenido clínico |
| D10 | Integridad de la auditoría | Append-only, hash encadenado, trigger en base |
| D11 | Motor de base de datos | **PostgreSQL 18** |
| D12 | Autorización por | Código estable del rol (`role.code`), nunca por nombre |

---

## 3. Detalle de la decisión

### 3.1 Roles

| Rol | Ámbito | Propósito |
|---|---|---|
| `sys-admin` | Global | Administrar cuentas, asignaciones y catálogos. Garantizar que el sistema tenga usuarios válidos y accesos correctos |
| `jefe-estudio` | Sus estudios | Dirigir el estudio: sitios, equipo investigador, supervisión del avance, auditoría clínica |
| `medico-investigador` | Sus estudios | Ejecutar el estudio: pacientes, CRD, dosis, eventos adversos, firma y cierre |

#### Capacidades

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

#### Reglas de separación de funciones

1. **Ningún rol puede hacer todo.** El administrador no toca clínica, el jefe no firma, el investigador no administra.
2. **Nadie se autoasigna.** Un `jefe-estudio` puede crear un estudio, pero la asignación de sí mismo como jefe la confirma el `sys-admin`. Lo mismo aplica a cualquier cambio del propio rol.
3. **Un usuario tiene una sola asignación activa por estudio.** No se acumulan roles en el mismo estudio; si se necesita otro rol, se reemplaza la asignación y queda auditado.
4. **La baja de una asignación surte efecto inmediato** en la siguiente petición, sin esperar a que expire la sesión.

### 3.2 Ámbito y asignación

El ámbito se resuelve **por estudio**. El sitio clínico (`HSA`, `HSB`, …) se conserva como atributo del paciente y del estudio, pero **no** como dimensión de permisos: agregarlo multiplicaría la matriz sin un caso de uso que lo justifique.

```sql
asignacion
├── id
├── usuario_id      → usuario
├── estudio_id      → estudio NULL   -- NULL = asignación global (sys-admin)
├── rol_id          → rol (código estable)
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
- El `sys-admin` no se asigna a un estudio: tiene una **asignación global** (`estudio_id NULL`). Así la tabla `asignacion` sigue siendo la única fuente de verdad de los roles y el motor resuelve el ámbito global sin una regla especial de almacenamiento.
- El ámbito efectivo de una petición es la intersección entre el recurso solicitado y los estudios donde el usuario tiene asignación activa.

### 3.3 Separación identidad / CRD

La separación que el CRD busca desde su origen se convierte en una regla de acceso:

| Colección | Contenido | Quién lee | Quién escribe |
|---|---|---|---|
| `identidad-paciente` | Nombre, documento, contacto, consentimiento | `jefe-estudio` y `medico-investigador` del estudio | `medico-investigador` |
| `paciente` | Código (`HSA-001`), iniciales, edad, sexo, peso, diagnóstico | Ambos roles del estudio | `medico-investigador` |
| `crd` | Evaluación inicial, intermedia, final, examen físico, laboratorio | Ambos roles del estudio | `medico-investigador` |
| `dosis` | Número de toma, lote, dosis, vía | Ambos roles del estudio | `medico-investigador` |
| `evento-adverso` | Evento, gravedad, causalidad, desenlace | Ambos roles del estudio | `medico-investigador` |

El `sys-admin` **no** accede a ninguna de estas colecciones.

**Variante más estricta disponible:** retirar la lectura de `identidad-paciente` al `jefe-estudio`, dejándola solo en el médico. Queda registrada en §7 como asunto abierto.

### 3.4 Auditoría

Cada acción relevante genera un registro:

```sql
auditoria
├── id
├── fecha           timestamptz
├── usuario_id      → usuario
├── rol_code        text
├── estudio_id      → estudio NULL   -- NULL = evento administrativo
├── entidad         text             -- paciente, crd, dosis, evento-adverso, usuario, asignacion
├── entidad_id      text
├── accion          text             -- create, update, sign, annul, read, login, denied
├── resultado       text             -- permitido | denegado
├── detalle         jsonb            -- sólo metadatos y valores modificados, nunca datos completos
├── hash_previo     text
└── hash            text
```

**Lectura dividida por ámbito, no por rol:**

| Rol | Alcance de lectura |
|---|---|
| `jefe-estudio` | Registros con `estudio_id` en sus estudios, incluidos los eventos administrativos que los afectan (asignaciones, bajas) |
| `sys-admin` | Registros con `estudio_id IS NULL` y acciones de autenticación o administración |

**Inmutabilidad.** Tres capas independientes:

1. `REVOKE UPDATE, DELETE` sobre la tabla para el usuario de aplicación.
2. Trigger `BEFORE UPDATE OR DELETE` que lanza excepción.
3. Encadenamiento por hash: `hash = sha256(hash_previo ‖ contenido)`. Cualquier alteración por fuera de la aplicación rompe la cadena y es detectable.

**Por qué la auditoría clínica no la lee el `sys-admin`:** un registro de auditoría incluye el paciente y el valor modificado (*"cambió la dosis de HSA-001 de 60 a 80 mg"*). Darle lectura equivale a darle acceso clínico indirecto, y además concentraría en un solo rol la capacidad de actuar y de vigilar.

### 3.5 Persistencia

PostgreSQL 18, esquema versionado en archivos `.sql`. Sin ORM: las restricciones, el trigger de auditoría y los índices se expresan directamente en el motor. El acceso desde la aplicación se hace con `pg`.

---

## 4. Consecuencias

### 4.1 Positivas

- **Matriz pequeña y verificable:** 3 roles × 35 permisos son 105 celdas, comprobables a mano y automatizables por completo.
- **Ámbito explícito:** un usuario solo ve los estudios donde tiene asignación activa; no hay accesos implícitos.
- **La separación identidad/CRD deja de ser una intención y pasa a ser una restricción técnica.**
- **La auditoría es evidencia, no un log:** append-only y encadenada, resiste la pregunta *"¿quién cambió esto?"* en una inspección.
- **El administrador no puede leer datos de pacientes**, ni directamente ni por la vía de la auditoría.

### 4.2 Negativas y costos

- **Sin verificación independiente.** No existe un rol que controle los datos sin participar del estudio. La verificación recae sobre el `jefe-estudio`, que pertenece al mismo estudio que supervisa.
- **Sin auditor externo.** Quien audita el sistema es el mismo administrador que lo opera, salvo en el ámbito clínico.
- **El `jefe-estudio` acumula funciones:** gestión, supervisión y auditoría en la misma persona.
- **Menos granularidad:** no se distingue investigador principal de subinvestigador; la firma no está restringida a una sola persona por estudio.

Estas limitaciones son **conscientes** y se aceptan para la primera versión. Se registrarán como tema a consultar con el tutor cuando el modelo esté implementado (§7).

### 4.3 Mitigaciones

| Limitación | Mitigación en v1 |
|---|---|
| Jefe que supervisa y audita | La auditoría es inmutable: puede leer, no puede alterar |
| Sin verificador independiente | Se documenta la limitación; si el tutor lo requiere, se agrega `monitor` sin cambiar el modelo, solo la matriz |
| Jefe con demasiadas funciones | Sus capacidades clínicas son de **solo lectura** |
| Sin distinción PI / subinvestigador | Se puede incorporar como atributo del rol, no como rol nuevo |

---

## 5. Alternativas consideradas

| Alternativa | Por qué se descartó |
|---|---|
| **9 roles** (modelo inicial propuesto) | Sobredimensionado para una v1 sin despliegue. Cada rol extra multiplica la matriz y los casos de prueba, sin un usuario real que lo ejerza |
| **Rol global por usuario**, sin entidad `asignacion` | Un usuario en dos estudios obtendría acceso a ambos con el mismo rol, sin forma de limitarlo. No permite que alguien sea jefe en un estudio e investigador en otro |
| **Ámbito por sitio clínico** | Un paciente pertenece a un estudio; el sitio es un dato del paciente. Agregar el sitio como dimensión duplica la matriz sin caso de uso |
| **Auditoría visible para el `sys-admin`** | Filtra datos clínicos a través del registro de cambios y rompe la separación de funciones |
| **SQLite** | No permite demostrar las garantías de integridad ni el trigger de inmutabilidad con el mismo rigor. PostgreSQL ya está instalado |
| **`monitor` y `auditor` en v1** | No hay usuarios que los ejerzan y agrandan la matriz. Se evalúan con el tutor al cierre |
| **Payload CMS** | Fue un estudio de tecnología, no una decisión de migración. El objetivo es Strapi 5 + Next 16 |

---

## 6. Cumplimiento normativo

| Requisito | Cómo lo cubre la decisión |
|---|---|
| **21 CFR Part 11 §11.10(d)** — limitación de acceso | Deny by default + asignación explícita por estudio |
| **21 CFR Part 11 §11.10(e)** — pistas de auditoría | Tabla append-only, encadenada, con usuario, fecha, acción y resultado |
| **21 CFR Part 11 §11.10(g)** — comprobación de autoridad | Capa única de autorización (`can()`) sobre cada operación |
| **ALCOA+** — atribuible, contemporáneo, original, exacto | Cada registro lleva autor, marca de tiempo y no se sobrescribe: se anula con motivo |
| **ISO/IEC 27001 A.9** — control de acceso | Roles definidos, mínimo privilegio, revisión de asignaciones |
| **Segregación de funciones** | Ningún rol captura, aprueba y audita a la vez |

---

## 7. Asuntos abiertos

| # | Asunto | Estado |
|---|---|---|
| 1 | ¿Se incorporan `monitor` y `auditor`? | Se consulta al tutor al finalizar el sistema de roles |
| 2 | ¿El `jefe-estudio` debe ver la identidad del paciente o solo el código? | Variante estricta disponible; se decide con el tutor |
| 3 | Política de contraseñas y segundo factor | Fuera del alcance del POC |
| 4 | Retención de la auditoría | Pendiente de requisito normativo del SIM |
| 5 | Firma electrónica formal (con reautenticación) | El POC registra firma con usuario y sesión; la reautenticación se evalúa después |

---

## 8. Criterios de aceptación

| # | Criterio | Verificación |
|---|---|---|
| AC-01 | Ningún rol puede ejecutar todas las acciones de la matriz | Revisión de la matriz |
| AC-02 | Un investigador no puede leer datos de un estudio al que no está asignado | Prueba negativa ⇒ 403 + registro de acceso denegado |
| AC-03 | El `jefe-estudio` no puede crear, editar ni firmar registros clínicos | Prueba negativa |
| AC-04 | El `sys-admin` no puede leer pacientes, CRD ni auditoría clínica | Prueba negativa |
| AC-05 | Ningún rol puede modificar ni borrar un registro de auditoría | `UPDATE`/`DELETE` ⇒ excepción de base |
| AC-06 | Una alteración manual de la auditoría rompe la cadena y se detecta | Prueba de verificación de integridad |
| AC-07 | Dar de baja una asignación revoca el acceso en la siguiente petición | Prueba de sesión activa |
| AC-08 | Un usuario no puede tener dos asignaciones activas en el mismo estudio | Restricción `UNIQUE` en base |

---

## 9. Referencias

- `Informe_Tecnico_Migracion_Backend_Farmacovigilancia_Jonathan_Simón.docx` — descripción del sistema CRD.
- [`roles-y-permisos.md`](../roles-y-permisos.md) — catálogo de roles y matriz de permisos.
- [`plan-implementacion-rbac.md`](../plan-implementacion-rbac.md) — fases, diseño técnico y pruebas.
- 21 CFR Part 11 — Electronic Records; Electronic Signatures.
- ALCOA+ — Principles of Data Integrity.
- ISO/IEC 27001:2022, Anexo A.9 — Control de acceso.
