# Plan de implementación del acceso basado en roles (RBAC)

**Proyecto:** Sistema CRD de farmacovigilancia (Strapi 5.40 + Next.js 16)
**Versión:** 2.1
**Fecha:** 2026-11-10
**Periodo comprometido:** 1 semana (5 días hábiles) desde la revisión del tutor
**Documento base:** [`roles-y-permisos.md`](./roles-y-permisos.md) · [`adr/ADR-001-modelo-roles-y-asignaciones.md`](./adr/ADR-001-modelo-roles-y-asignaciones.md)
**Objetivo:** implementar control de acceso por roles y ámbito de estudio, con trazabilidad y segregación de funciones, sobre el sistema que se construye desde cero en la infraestructura del SIM.

---

## 1. Resumen ejecutivo

El sistema se reconstruye desde cero: no hay usuarios, roles ni datos que migrar. El problema ya no es auditar permisos heredados, sino **definir y hacer cumplir** el modelo de acceso de un sistema nuevo.

La propuesta es un modelo RBAC de **tres roles** —`sys-admin`, `jefe-estudio`, `medico-investigador`— con:

- **Ámbito por estudio** (no por sitio).
- **Deny by default** y autorización por código estable.
- **Una única capa de decisión** en el servidor.
- **Separación entre identidad del paciente y datos del CRD.**
- **Auditoría append-only encadenada por hash**, con lectura clínica para el jefe de estudio y administrativa para el `sys-admin`.

La lógica ya está implementada y probada en una **prueba de concepto** sobre Next.js 16 + PostgreSQL 18: motor de política, esquema, privilegios de base, auditoría y quince escenarios de autorización a nivel de página. Ese código sirve como referencia ejecutable para la implementación sobre Strapi.

**Esfuerzo comprometido:** **una semana (5 días hábiles) contada desde la revisión del tutor**. El trabajo estructural —motor, esquema, auditoría y pruebas— ya está resuelto en la prueba de concepto, así que la semana se dedica a cerrar las decisiones, aplicar lo que la revisión cambie, publicar el repositorio y dejar la demostración lista. La implementación completa en Strapi, estimada en 28–36 jornadas, queda como fase posterior y **no forma parte de este periodo**.

**Resultado esperado:** el tutor valida el modelo, el repositorio público muestra el sistema funcionando y la demostración recorre los casos de acceso permitido y denegado sin fallos.

---

## 2. Alcance, supuestos y dependencias

### 2.1 Dentro del alcance

- Catálogo de roles y permisos versionado en el repositorio.
- Motor de autorización y resolución de ámbito.
- Esquema de base de datos con restricciones, privilegios y auditoría.
- Aplicación de la política en todas las rutas clínicas y administrativas.
- Sesión firmada, revocación inmediata y pruebas negativas.
- Documentación, runbook y criterios de aceptación.

### 2.2 Fuera del alcance (por ahora)

- Despliegue en producción.
- MFA, recuperación de cuenta y firma electrónica con reautenticación.
- Integración con un IdP institucional.
- Migración de datos históricos (no existen).

### 2.3 Supuestos

| ID | Supuesto | Impacto si no se cumple |
|---|---|---|
| D-01 | El backend objetivo es Strapi 5.40 + Next.js 16 | El mapeo de §9 cambia, no el modelo |
| D-02 | PostgreSQL 18 es la base no efímera | Sin transacciones ACID ni auditoría robusta |
| D-03 | Se aprueba el catálogo de 3 roles | La matriz queda provisional |
| D-04 | Existe entorno de staging con datos sintéticos | No se pueden probar flujos negativos |
| D-05 | Se puede modificar el esquema de usuario y extender `users-permissions` | El ámbito por estudio no es viable |
| D-06 | El tutor valida la interpretación de "ámbito por estudio" | Riesgo de retrabajo en el esquema |

> **Sobre Payload CMS:** fue un estudio de tecnología, no una decisión de migración. Este plan no lo contempla como destino.

---

## 3. Principios de diseño (no negociables)

1. **Deny by default.** Sin rol o sin asignación activa ⇒ denegado.
2. **Punto único de decisión.** Toda lectura o escritura sensible pasa por el motor de política.
3. **Autorización por código, no por nombre visible.** `rol_codigo`, nunca el nombre del rol.
4. **El cliente no decide.** Ocultar un botón no es un control; el servidor vuelve a evaluar.
5. **Ámbito derivado del recurso.** El estudio de un hijo se obtiene del padre; nunca se confía en el valor enviado por el cliente.
6. **Sin borrado clínico.** Solo anulación con motivo y auditoría.
7. **Fail-closed.** Una excepción en la política ⇒ denegar y registrar.
8. **Todo lo denegado y toda exportación se auditan.**
9. **Los roles y permisos viven en el repositorio**, no solo en el panel.
10. **La base impone lo que la aplicación no debe poder saltarse.** Privilegios separados y triggers.

---

## 4. Arquitectura objetivo

```
                        ┌──────────────────────────────┐
  Navegador ──cookie──► │ Next.js (BFF)                │
                        │  · sesión firmada (HMAC)     │
                        │  · revalida usuario y        │
                        │    asignaciones en cada req. │
                        │  · SIN fallback a token svc  │
                        └──────────────┬───────────────┘
                                       │  usuario autenticado
                                       ▼
                        ┌──────────────────────────────┐
                        │ API (Strapi 5)               │
                        │                              │
                        │  ┌────────────────────────┐  │
                        │  │ Motor de autorización  │  │
                        │  │ can(sujeto, permiso,   │  │
                        │  │     recurso)           │  │
                        │  │  ├─ catálogo de roles  │  │
                        │  │  ├─ matriz de permisos │  │
                        │  │  └─ resolución ámbito  │  │
                        │  └──────────┬─────────────┘  │
                        │             │ filtro/filtro  │
                        │  ┌──────────▼─────────────┐  │
                        │  │ Capa de acceso a datos │  │
                        │  └──────────┬─────────────┘  │
                        └─────────────┼────────────────┘
                                      ▼
                        ┌──────────────────────────────┐
                        │ PostgreSQL 18                │
                        │  · restricciones de ámbito   │
                        │  · privilegios separados     │
                        │  · auditoría append-only     │
                        └──────────────────────────────┘
```

**Regla de oro:** si una consulta clínica no pasa por el motor de autorización, es un defecto. Se detecta con revisión de código y con una prueba que enumere las rutas.

### 4.1 Modelo de decisión

```ts
type Accion = 'read' | 'create' | 'update' | 'annul' | 'sign' | 'export' | 'deactivate';

interface RecursoRef {
  tipo: 'paciente' | 'identidad' | 'crd' | 'dosis' | 'evento' | 'estudio' | 'asignacion' | 'usuario';
  id?: string;
  estudioId: string | null;
  nuevo?: boolean;          // alta antes de existir el recurso
}

interface Sujeto {
  usuarioId: string;
  rolCodigo: 'sys-admin' | 'jefe-estudio' | 'medico-investigador';
  estudios: string[];       // asignaciones activas; [] para el rol global
  global: boolean;
}

interface Decision {
  permitido: boolean;
  motivo: string;
}
```

### 4.2 Catálogo de permisos (fuente de verdad)

```ts
// src/core/catalog.ts
export const PERMISOS = [
  'usuario:read', 'usuario:create', 'usuario:update', 'usuario:deactivate',
  'estudio:read', 'estudio:create', 'estudio:update',
  'sitio:read', 'sitio:create', 'sitio:update',
  'asignacion:read', 'asignacion:create', 'asignacion:revoke',
  'auditoria_admin:read',
  'paciente:read', 'paciente:create', 'paciente:update', 'paciente:annul',
  'identidad:read', 'identidad:create', 'identidad:update',
  'crd:read', 'crd:create', 'crd:update', 'crd:sign', 'crd:annul',
  'dosis:read', 'dosis:create', 'dosis:update', 'dosis:annul',
  'evento:read', 'evento:create', 'evento:update',
  'auditoria_clinica:read', 'exportacion:export',
] as const;
```

La matriz rol → permisos está en `roles-y-permisos.md` §7. **No se edita en el panel de Strapi**: se versiona y se revisa por PR.

### 4.3 Aplicación de la decisión

```ts
// Toda operación sensible pasa por aquí
const decision = decidir(sesion, 'crd:sign', {
  tipo: 'crd',
  id: crdId,
  estudioId: ctx.estudio_id,
});

if (!decision.permitido) {
  await auditar(sesion, 'crd:sign', recurso, detalle, decision);
  redirect(mensaje(volver, 'error', 'No tienes permiso para firmar este formulario.'));
}
```

El filtro de ámbito se aplica **también en lectura**: la lista de pacientes se construye con `estudio_id = ANY(asignaciones)`. Nunca se filtra en el navegador.

---

## 5. Cronograma de una semana

El periodo comprometido es **una semana de cierre (5 días hábiles) contada desde la revisión del tutor**. El objetivo no es construir el motor —ya existe y está probado— sino cerrar el modelo, aplicar lo que la revisión cambie, publicar el código y dejar la demostración lista.

| Día | Objetivo | Tareas | Entregable |
|---|---|---|---|
| **1 (lun)** | Cerrar el modelo | Revisión con el tutor; decidir los cinco puntos de `roles-y-permisos-revision.md`; ajustar matriz y ADR | Acta de revisión y matriz congelada |
| **2 (mar)** | Aplicar los cambios | Actualizar catálogo, motor y pruebas según lo decidido; regenerar la matriz y el build | `npm test` en verde y matriz impresa |
| **3 (mié)** | Publicar | Repositorio público en GitHub, README, documentación enlazada y revisión de que no haya secretos | Enlace del repositorio |
| **4 (jue)** | Preparar la demostración | Datos sintéticos, guion de 10 minutos, casos permitidos y denegados, capturas | Guion y POC corriendo |
| **5 (vie)** | Ensayo y entrega | Ensayo completo, correcciones y entrega al tutor | Demostración y acta de cierre |

**Criterio de aceptación de la semana:** el tutor valida el modelo, el repositorio está publicado y la demostración recorre los casos de acceso sin fallos.

### 5.1 Qué no entra en la semana

- Integración con Strapi (fase posterior).
- MFA, recuperación de cuenta y firma con reautenticación.
- Despliegue en staging y piloto con usuarios reales.
- Migración de datos (no existen).

Si la revisión agrega un rol o cambia el ámbito, el día 2 absorbe el cambio. Si agrega varios roles nuevos o exige integrar Strapi en la misma semana, el compromiso de 5 días deja de ser realista y se replanifica con el tutor.

### 5.2 Ruta de referencia por fases (fase posterior)

Las fases que siguen describen la implementación completa —28–36 jornadas— si el proyecto continúa después de la semana de cierre. **No forman parte del periodo actual**; se conservan como diseño de referencia.

> Cada fase termina con un **criterio de aceptación verificable**. No se avanza sin cumplirlo.

### Fase 0 — Confirmación del modelo (2 días)

| # | Tarea | Entregable |
|---|---|---|
| 0.1 | Validar los 3 roles y la matriz con el tutor | Acta de validación |
| 0.2 | Confirmar que el ámbito es el estudio, no el sitio | Decisión registrada en el ADR |
| 0.3 | Confirmar el tratamiento de la identidad del paciente | Decisión registrada |
| 0.4 | Acordar normativa aplicable y retención | Requisitos de auditoría |

**Aceptación:** catálogo y matriz aprobados; asuntos abiertos del ADR §7 con decisión o fecha.

---

### Fase 1 — Identidad y sesión (3–4 días)

| # | Tarea | Detalle | Aceptación |
|---|---|---|---|
| 1.1 | Cookie de sesión firmada | HMAC-SHA256, `HttpOnly`, `SameSite=Lax`, 8 h | Cookie alterada ⇒ sesión inválida |
| 1.2 | Sin fallback a token de servicio | El proxy solo usa la identidad del usuario | Petición sin sesión ⇒ 401 |
| 1.3 | Contraseñas con `scrypt` | Sal aleatoria, parámetros versionados | Nunca se almacena en claro |
| 1.4 | Revalidación por petición | Cargar usuario y asignaciones activas desde la base | Usuario desactivado ⇒ sin acceso inmediato |
| 1.5 | Cierre de sesión real | Invalidar la cookie en servidor | Logout ⇒ siguiente petición redirige a login |

**Riesgo si se omite:** cualquier trabajo posterior se apoya en una identidad no confiable.

---

### Fase 2 — Motor de autorización (4–5 días)

| # | Tarea | Detalle |
|---|---|---|
| 2.1 | Crear el catálogo versionado | `PERMISOS` y `ROLES` en TypeScript |
| 2.2 | Implementar `can()` / `decidir()` | Permiso + recurso + ámbito |
| 2.3 | Resolver de ámbito | Asignaciones activas por usuario; rol global |
| 2.4 | Regla de recurso nuevo | Alta de estudio sin asignación previa |
| 2.5 | Registro de denegaciones | Toda decisión negativa deja rastro |
| 2.6 | Eliminar autorización por nombre | `grep` sin comparaciones de `role.name` |

**Aceptación:**

- Prueba unitaria por cada fila de la matriz.
- `grep -r "role.name"` no devuelve comparaciones de autorización.
- Un usuario sin asignación recibe denegación en todas las rutas clínicas.

> **Ya implementado en la POC:** `src/core/catalog.ts`, `policy.ts`, `scope.ts`, `auditoria.ts`; 31 pruebas en `npm test`.

---

### Fase 3 — Esquema y privilegios (3–4 días)

| # | Tarea | Detalle |
|---|---|---|
| 3.1 | Tablas de dominio | `usuario`, `estudio`, `sitio`, `asignacion`, `paciente`, `identidad_paciente`, `crd`, `dosis`, `evento_adverso` |
| 3.2 | Restricciones de ámbito | Una asignación activa por estudio; global única para `sys-admin` |
| 3.3 | FK compuesta paciente–sitio | El sitio debe pertenecer al estudio |
| 3.4 | Roles de base separados | `crd_owner` (migraciones) y `crd_app` (runtime) |
| 3.5 | Privilegios mínimos | `crd_app` sin `DELETE`; sin `UPDATE`/`DELETE` en auditoría |
| 3.6 | Datos sintéticos | Seed determinista con 2 estudios y 50 pacientes |

**Aceptación:** `DELETE` bloqueado en todas las tablas; `UPDATE`/`DELETE` de auditoría bloqueado; el seed es idempotente.

> **Ya implementado en la POC:** `db/01`–`db/04`, migración `db/05`, y prueba de humo.

---

### Fase 4 — Enforcement en todas las rutas (5–7 días)

| # | Tarea | Detalle |
|---|---|---|
| 4.1 | Interceptar todas las rutas clínicas | Pacientes, identidad, CRD, dosis, eventos |
| 4.2 | Cubrir anulación y firma | No solo CRUD; también `sign` y `annul` |
| 4.3 | Aplicar filtro en lectura | Listados y detalle; sin filtrar en el cliente |
| 4.4 | Derivar el ámbito en hijos | El estudio se toma del padre |
| 4.5 | Bloquear escritura cruzada | Rechazar un `id` fuera de ámbito aunque se conozca |
| 4.6 | Proteger administración | Usuarios, asignaciones, estudios y auditoría |
| 4.7 | Endurecer exportaciones | Permiso dedicado y registro obligatorio |

**Aceptación:**

- Matriz de pruebas negativas por rol × recurso × operación.
- Cero accesos fuera de ámbito con dos estudios.
- Anulación auditada y sin borrado físico.

> **Parcialmente implementado en la POC:** 15 escenarios HTTP a nivel de página y flujo completo de alta, firma y anulación.

---

### Fase 5 — Auditoría inmutable (3–4 días)

| # | Tarea | Detalle |
|---|---|---|
| 5.1 | Tabla `auditoria` append-only | Usuario, rol, estudio, entidad, acción, resultado, detalle |
| 5.2 | Encadenamiento por hash | `hash = sha256(hash_previo ‖ contenido)` |
| 5.3 | Trigger de inmutabilidad | Excepción ante `UPDATE`/`DELETE` |
| 5.4 | Serialización de escritura | Bloqueo de asesoramiento para evitar carreras |
| 5.5 | Verificación de integridad | Función `verificar_auditoria()` |
| 5.6 | Consulta por ámbito | Clínica para el jefe; administrativa para el `sys-admin` |

**Aceptación:** la aplicación no puede alterar la auditoría; una modificación manual rompe la cadena; la consulta respeta el ámbito.

> **Ya implementado en la POC:** `auditoria_encadenar()`, `auditoria_inmutable()`, `verificar_auditoria()`; cadena verificada con `total=18, integra=true`.

---

### Fase 6 — Integración con Strapi (4–5 días)

| # | Tarea | Detalle |
|---|---|---|
| 6.1 | Relación usuario–asignaciones | Extender `users-permissions` o colección propia |
| 6.2 | Middleware global de autorización | Mapear ruta/método a permiso y recurso |
| 6.3 | Filtros de ámbito en la capa de datos | `estudio_id = ANY(asignaciones)` |
| 6.4 | Retirar permisos de `Public`/`Authenticated` | Sin acceso clínico por defecto |
| 6.5 | Catálogo como fuente de verdad | El panel refleja, no decide |
| 6.6 | Migración de roles | Ninguna: el sistema es nuevo |

**Aceptación:** renombrar un rol en el panel no cambia el acceso; el catálogo del repositorio manda.

---

### Fase 7 — Pruebas, CI y documentación (4–5 días)

| # | Tarea | Detalle |
|---|---|---|
| 7.1 | Pruebas unitarias del motor | Tabla de decisión completa |
| 7.2 | Pruebas de integración | Dos estudios, tres roles |
| 7.3 | Pruebas HTTP de páginas y acciones | Formularios reales, no solo funciones |
| 7.4 | CI obligatorio | Lint + tests + build en cada PR |
| 7.5 | Runbook | Alta/baja de usuario, incidente de acceso, verificación de auditoría |
| 7.6 | Documentación | Enlazar roles, ADR y plan |

**Aceptación:** pipeline verde; ninguna ruta clínica sin prueba; runbook revisado.

---

### Fase 8 — Piloto y cierre (2–3 días)

| # | Tarea | Detalle |
|---|---|---|
| 8.1 | Desplegar en staging con datos sintéticos | Validación con usuarios por rol |
| 8.2 | Piloto en un estudio | Feature flag por estudio |
| 8.3 | Monitoreo | Alertas por denegaciones anómalas y exportaciones |
| 8.4 | Capacitación | Guía por rol |
| 8.5 | Revisión post-implementación | Lecciones y backlog residual |

**Aceptación:** dos semanas de piloto sin incidentes de acceso; acta de cierre y matriz firmada.

---

## 6. Backlog priorizado

> El backlog P0/P1/P2 corresponde a la **fase posterior**. Durante la semana de cierre solo aplican las tareas del cronograma (§5) y, como máximo, los ajustes de la fila P0 que la revisión del tutor active.

### P0 — Bloqueantes (no lanzar sin esto)

| ID | Tarea | Fase | Est. |
|---|---|---|---|
| P0-01 | Cookie firmada y sin token de servicio | 1 | 1 d |
| P0-02 | Revalidación de usuario y asignaciones por petición | 1 | 1 d |
| P0-03 | Catálogo y motor de autorización | 2 | 3 d |
| P0-04 | Eliminar autorización por nombre de rol | 2 | 0,5 d |
| P0-05 | Esquema con restricciones de ámbito | 3 | 2 d |
| P0-06 | Privilegios separados y `DELETE` bloqueado | 3 | 1 d |
| P0-07 | Filtro de ámbito en todas las lecturas y escrituras | 4 | 4 d |
| P0-08 | Anulación con motivo en lugar de borrado | 4 | 1 d |

### P1 — Necesarios para producción regulada

| ID | Tarea | Fase | Est. |
|---|---|---|---|
| P1-01 | Auditoría append-only encadenada | 5 | 2 d |
| P1-02 | Consulta de auditoría por ámbito | 5 | 1 d |
| P1-03 | Integración con Strapi y retirada de permisos por defecto | 6 | 3 d |
| P1-04 | Exportaciones con permiso y registro | 4 | 1 d |
| P1-05 | Pruebas negativas automatizadas en CI | 7 | 3 d |
| P1-06 | MFA en IdP | futuro | 2 d |
| P1-07 | Firma electrónica con reautenticación | futuro | 2 d |

### P2 — Mejora continua

| ID | Tarea | Est. |
|---|---|---|
| P2-01 | Alertas de denegaciones anómalas | 1 d |
| P2-02 | Panel de consulta de auditoría para el jefe | 2 d |
| P2-03 | Revisión trimestral de asignaciones | recurrente |
| P2-04 | Evaluación de `monitor` / `auditor` con el tutor | 1 d |

---

## 7. Diseño técnico de referencia

### 7.1 Resolución del sujeto

```ts
async function cargarSesion(usuarioId: string) {
  const usuario = await pool.query(
    `SELECT id, email, nombre, activo FROM usuario WHERE id = $1`,
    [usuarioId],
  );
  if (!usuario.rows[0]?.activo) return null;

  const asignaciones = await pool.query(
    `SELECT rol_codigo, estudio_id
     FROM asignacion
     WHERE usuario_id = $1 AND activa`,
    [usuarioId],
  );

  const global = asignaciones.rows.some((a) => a.rol_codigo === 'sys-admin' && a.estudio_id === null);
  const estudios = asignaciones.rows.map((a) => a.estudio_id).filter(Boolean);

  return {
    usuario: usuario.rows[0],
    rolCodigo: asignaciones.rows[0]?.rol_codigo ?? null,
    estudios,
    global,
  };
}
```

> En la POC un usuario tiene un rol por estudio; el rol efectivo de la sesión es el de la asignación. Si un usuario tuviera roles distintos en estudios distintos, el motor debe resolver el rol **por recurso**, no por sesión. Esa variante no está implementada.

### 7.2 `decidir()` (pseudocódigo)

```ts
function decidir(sesion, permiso, recurso) {
  if (!sesion?.rolCodigo) return deny('sin rol de dominio');

  const rol = ROLES[sesion.rolCodigo];
  if (!rol || !rol.permisos.includes(permiso)) return deny('permiso no concedido');

  if (rol.global) return allow('rol global');

  if (recurso.estudioId === null) {
    if (recurso.nuevo) return allow('alta de estudio');
    return deny('recurso sin ámbito');
  }

  if (!sesion.estudios.includes(recurso.estudioId)) {
    return deny('fuera del ámbito asignado');
  }

  return allow('permitido');
}
```

### 7.3 Middleware de Next (BFF)

```ts
export function middleware(req: NextRequest) {
  const sesion = leerCookieFirmada(req);
  if (!sesion) return NextResponse.redirect(new URL('/login', req.url));

  // La autorización fina no se hace aquí: la hace el servidor de aplicación.
  return NextResponse.next();
}
```

### 7.4 Mapeo a Strapi 5

| Concepto | POC (Next + SQL) | Strapi 5 |
|---|---|---|
| Rol | `rol_codigo` en `asignacion` | `up_roles.code` o colección `rol` |
| Permiso | Catálogo TypeScript | Catálogo TypeScript + middleware; el panel no decide |
| Ámbito | `estudio_id` en `asignacion` | Relación `usuario ↔ estudio` con rol |
| Filtro | SQL con `ANY($estudios)` | `where: { estudio: { id: { $in } } }` |
| Anulación | `UPDATE ... SET anulado` | Campo `anulado` + endpoint `/void` |
| Auditoría | Tabla + triggers | Tabla externa o colección con hooks; preferible tabla y triggers |
| Sesión | Cookie HMAC | Cookie HMAC en el BFF; Strapi no emite la sesión al navegador |

> La auditoría y los privilegios se mantienen en PostgreSQL: un CMS no debe ser la única garantía de inmutabilidad.

---

## 8. Estrategia de pruebas

### 8.1 Pruebas unitarias del motor

Una prueba por cada fila de la matriz (35 permisos × 3 roles), más:

- Recurso fuera de ámbito ⇒ denegado.
- Recurso sin estudio y rol no global ⇒ denegado.
- Recurso nuevo sin estudio ⇒ permitido si el rol tiene el permiso.
- Rol global ⇒ permitido sin ámbito.
- Rol desconocido ⇒ denegado.

**Estado en la POC:** 31 pruebas, todas correctas.

### 8.2 Pruebas de integración y HTTP

| Escenario | Resultado esperado |
|---|---|
| Investigador de ENOXA lee paciente de GRANI | Denegado + auditoría |
| Jefe de ENOXA intenta firmar un CRD | Denegado |
| `sys-admin` intenta leer pacientes | Denegado |
| `sys-admin` intenta leer auditoría clínica | Denegado |
| Jefe intenta asignarse a sí mismo | Denegado |
| Asignación dada de baja con sesión activa | Sin acceso en la siguiente petición |
| Usuario desactivado con sesión activa | Redirección a login |
| `UPDATE` / `DELETE` de auditoría con `crd_app` | Error `42501` |
| Renombrar un rol | El acceso no cambia |

**Estado en la POC:** 15 escenarios HTTP, todos correctos; prueba de privilegios de base, 5/5.

### 8.3 Pruebas de tabla

```ts
for (const [rol, def] of Object.entries(ROLES)) {
  for (const permiso of PERMISOS) {
    test(`${rol} ${permiso}`, () => {
      const esperado = def.permisos.includes(permiso);
      expect(can(fixture(rol), permiso, recursoEnAmbito)).toBe(esperado);
    });
  }
}
```

---

## 9. Despliegue y compatibilidad

1. **Feature flag por estudio** (`rbac_enforced`). Permite activar el modelo sin bloquear a todos los usuarios.
2. **Modo observación** (una semana): se evalúa y registra la decisión, pero no se bloquea. Detecta asignaciones mal configuradas.
3. **Activación progresiva:** lectura, luego escritura, luego firma/anulación.
4. **Plan de reversión:** el flag vuelve al comportamiento anterior; el esquema es aditivo.
5. **Comunicación:** aviso a usuarios sobre roles y ámbitos; ventana de soporte.

No hay migración de datos: el sistema es nuevo. La compatibilidad se limita a la convivencia temporal con el sistema anterior, si la hubiera.

---

## 10. Riesgos y mitigaciones

| ID | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R-01 | El tutor espera un modelo de más roles | Media | Medio | Fase 0 de validación; el modelo crece sin rediseño |
| R-02 | El panel de Strapi se convierte en vía de bypass | Media | Alto | Catálogo en código; permisos por defecto retirados; auditoría |
| R-03 | El equipo autoriza por nombre de rol en código nuevo | Media | Alto | Lint + revisión de PR + prueba de renombrado |
| R-04 | El ámbito por estudio no cubre un requisito por sitio | Media | Medio | Documentado como asunto abierto; el sitio es un atributo |
| R-05 | La auditoría se degrada por escrituras concurrentes | Baja | Alto | Bloqueo de asesoramiento + hash chain + verificación |
| R-06 | Sin MFA, una credencial comprometida accede como el usuario | Media | Medio | Fase futura; contraseñas `scrypt` y sesión corta |
| R-07 | El `jefe-estudio` acumula supervisión y auditoría | Alta | Medio | Auditoría inmutable; evaluar `auditor` con el tutor |
| R-08 | Datos sintéticos no representan el volumen real | Media | Bajo | Seed parametrizable; pruebas de carga futuras |

---

## 11. Métricas de éxito

| Métrica | Línea base | Objetivo |
|---|---|---|
| Rutas clínicas sin política | Desconocido | 0 |
| Comparaciones de autorización por nombre | ≥ 2 | 0 |
| Accesos fuera de ámbito en pruebas | — | 0 |
| Tablas con `DELETE` permitido a la aplicación | 11 | 0 |
| Operaciones auditadas | 0 | 100 % de escrituras, denegaciones y exportaciones |
| Cobertura de la matriz | 0 % | 100 % de las 35 filas |
| Roles de dominio | 4 (incl. `authenticated`) | 3 |
| Tiempo de alta/baja de usuario | Manual | Procedimiento auditado < 1 día |

---

## 12. Checklist de definición de terminado (DoD)

Para la **semana de cierre**, el DoD se limita a cuatro puntos:

- [ ] Modelo validado por el tutor y matriz congelada.
- [ ] Repositorio público con el código y la documentación.
- [ ] Demostración de acceso permitido y denegado sin fallos.
- [ ] Acta de cierre firmada.

El checklist completo que sigue aplica a la **fase posterior** (implementación en Strapi).

- [ ] Catálogo de roles aprobado y versionado.
- [ ] El motor es el único punto de decisión; no hay lógica de autorización en controladores ni en la UI.
- [ ] Todas las operaciones clínicas tienen lectura, escritura, firma y anulación con ámbito.
- [ ] `DELETE` físico bloqueado; anulación con motivo y auditoría.
- [ ] `Public` y `Authenticated` sin permisos clínicos.
- [ ] Cookie firmada, revalidación por petición y sin fallback a token de servicio.
- [ ] Auditoría inmutable, encadenada y verificable.
- [ ] Matriz de pruebas negativas en CI.
- [ ] Runbook de alta/baja de usuario e incidentes.
- [ ] Piloto sin incidentes y acta de cierre.

---

## Anexo A. Cronograma

**Semana de cierre (comprometida):**

```
Día 1  Cierre del modelo con el tutor       → matriz congelada
Día 2  Ajustes de código, matriz y pruebas  → npm test verde
Día 3  Repositorio público y documentación  → enlace de GitHub
Día 4  Datos y guion de demostración        → POC corriendo
Día 5  Ensayo, correcciones y entrega       → acta de cierre
```

**Ruta completa (fase posterior, 28–36 jornadas):**

```
Fase 0  Confirmación del modelo           (2 d)
Fase 1  Identidad y sesión                (3–4 d)  ◄── no negociable
Fase 2  Motor de autorización             (4–5 d)
Fase 3  Esquema y privilegios             (3–4 d)
Fase 4  Enforcement total                 (5–7 d)
Fase 5  Auditoría inmutable               (3–4 d)
Fase 6  Integración con Strapi            (4–5 d)
Fase 7  Pruebas, CI y documentación       (4–5 d)
Fase 8  Piloto y cierre                   (2–3 d)
                                          ─────────
                                          28–36 d
```

Las fases 3 y 5 pueden ejecutarse en paralelo con la 4 si hay más de una persona; la 6 depende de la 2; la 7 acompaña a todas. En la semana de cierre, las fases 0, 1, 2, 3 y 5 ya están cubiertas por la prueba de concepto.

## Anexo B. Relación con los hallazgos del informe

| Hallazgo | Fase que lo cierra |
|---|---|
| AC-01 — proxy con token de servicio | 1.2 |
| AC-02 — cookie sin firma | 1.1 |
| AC-03 — middleware valida presencia | 1.1, 1.4 |
| AC-04 — alcance parcial | 2, 4 |
| AC-05 — `delete` y `publish` fuera | 3, 4 |
| AC-06 — autorización por nombre | 2.6 |
| AC-07 — `authenticated` sin filtro | 2, 6.4 |
| AC-08 — sin roles de dominio | 0, 2 |
| AC-09 — sin auditoría | 5 |
| AC-10 — panel fuera del alcance | 6.2, 6.5 |

## Anexo C. Relación con la prueba de concepto

| Componente | Ubicación en la POC | Estado |
|---|---|---|
| Catálogo y matriz | `src/core/catalog.ts` | Implementado |
| Motor de decisión | `src/core/policy.ts` | Implementado |
| Resolución de ámbito | `src/core/scope.ts` | Implementado |
| Auditoría | `src/core/auditoria.ts`, `lib/audit.ts` | Implementado |
| Esquema y privilegios | `db/02-schema.sql`, `db/03-grants.sql` | Implementado |
| Seed sintético | `db/seed/generate-seed.mjs`, `db/04-seed.sql` | Implementado |
| Aplicación de la política | `app/(app)/*/actions.ts`, `lib/guard.ts` | Implementado |
| Pruebas unitarias | `test/*.test.ts` | 31/31 |
| Matriz imprimible | `src/cli/matriz.ts` | 35 permisos |
