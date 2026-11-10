# Preguntas para el tutor — modelo de roles del CRD

**Objetivo:** cerrar las decisiones que aún dependen del tutor antes de llevar el modelo a producción.
**Contexto:** el CRD se reconstruye desde cero sobre la infraestructura del SIM. El modelo de 3 roles, el ámbito por estudio y la auditoría ya están definidos en el ADR-001 y validados en una prueba de concepto.

---

## Si solo hay 15 minutos

1. ★ ¿Valida el modelo de **tres roles** (`sys-admin`, `jefe-estudio`, `medico-investigador`) o falta alguna función en la práctica?
2. ★ ¿El ámbito correcto es el **estudio** (no el sitio clínico)?
3. ★ ¿Quién debe **firmar** un CRD: solo el médico investigador, o también el jefe de estudio?
4. ★ ¿El **jefe de estudio** debe ver la identidad del paciente o solo el código?
5. ★ ¿Se necesitan `monitor` y `auditor` en la primera versión o se evalúan después?
6. ★ ¿Qué normativa aplica y qué **retención** exige la auditoría?
7. ★ ¿El backend objetivo es **Strapi 5.40 + Next.js 16**?
8. ★ ¿Quién aprueba la matriz de permisos y los cambios de rol?

---

## A. Modelo de roles

| # | Pregunta | Para qué |
|---|---|---|
| A1 ★ | ¿Los tres roles cubren las funciones reales del estudio? ¿Falta coordinador, monitor o auditor? | Validar el catálogo |
| A2 ★ | ¿Un usuario puede ser jefe en un estudio e investigador en otro? | Confirmar el modelo de asignación por estudio |
| A3 ★ | ¿Quién debe poder **crear un estudio** y quién confirmar la asignación del jefe? | Regla de no autoasignación |
| A4 | ¿Un investigador puede estar en varios estudios a la vez? | Casos de prueba y matriz |
| A5 | ¿Debe existir un rol de solo lectura para autoridades o patrocinador? | Evaluar `auditor` |
| A6 | ¿Quién cubre hoy la verificación de datos (monitor/CRA)? | Evaluar `monitor` |

## B. Ámbito y datos

| # | Pregunta | Para qué |
|---|---|---|
| B1 ★ | ¿Un paciente pertenece a un solo estudio? | Confirmar el ámbito |
| B2 ★ | ¿El sitio clínico debe limitar el acceso o es solo un atributo del paciente? | Evitar duplicar la matriz |
| B3 ★ | ¿El jefe de estudio debe ver la identidad del paciente? | Variante estricta disponible |
| B4 | ¿Los eventos adversos se comparten entre sitios del mismo estudio? | Lectura de seguridad |
| B5 | ¿Hay datos clínicos fuera del CRD (laboratorio, imágenes, consentimientos)? | Alcance real del control |
| B6 | ¿El sistema anterior tiene datos que migrar o se parte de cero? | Plan de migración |

## C. Firma, auditoría y cumplimiento

| # | Pregunta | Para qué |
|---|---|---|
| C1 ★ | ¿Quién firma y quién puede anular un CRD? | Matriz de permisos |
| C2 ★ | ¿La firma requiere reautenticación? | Firma electrónica 21 CFR Part 11 |
| C3 ★ | ¿Qué retención exige la pista de auditoría? | Diseño de retención |
| C4 ★ | ¿La auditoría clínica debe ser invisible para el `sys-admin`? | Separación de funciones |
| C5 | ¿Se exige un auditor independiente del estudio? | Evaluar `auditor` |
| C6 | ¿Hay SOPs de validación o criterios de aceptación formales? | Criterios de cierre |

## D. Plataforma y seguridad

| # | Pregunta | Para qué |
|---|---|---|
| D1 ★ | ¿El backend objetivo es Strapi 5.40 + Next.js 16? | Plan de integración |
| D2 ★ | ¿Hay IdP institucional (AD/LDAP/Entra ID/Keycloak) o MFA? | Fase de autenticación |
| D3 | ¿PostgreSQL 18 es la base definitiva? | Esquema y auditoría |
| D4 | ¿Quién administra las credenciales de base y la rotación de secretos? | Operación |
| D5 | ¿Hay entorno de staging con datos sintéticos? | Pruebas negativas |
| D6 | ¿Hay que integrarse con el sistema anterior durante una transición? | Compatibilidad |

## E. Aprobación y cierre

| # | Pregunta | Para qué |
|---|---|---|
| E1 ★ | ¿Quién aprueba el catálogo de roles y la matriz? | Cierre formal |
| E2 ★ | ¿Quién es el dueño funcional del sistema? | Aprobaciones |
| E3 | ¿Hay usuarios reales disponibles para el piloto? | Fase 8 |
| E4 | ¿Se espera una demostración del POC o solo la documentación? | Entregables |

---

## Cómo registrar las respuestas

Para cada pregunta, anotar una de estas tres cosas:

- **Respuesta concreta** (texto o tabla).
- **“Se decide en la fase X”** → dejar la decisión registrada en el ADR.
- **“No aplica / no existe”** → es un hallazgo, no una duda.

Evitar respuestas del tipo “creo que sí”: si no se puede verificar, queda como asunto abierto en el ADR-001 §7.

## Antes de terminar la reunión

- [ ] Confirmar el catálogo de tres roles.
- [ ] Confirmar el ámbito por estudio.
- [ ] Confirmar quién firma y quién ve la identidad.
- [ ] Confirmar normativa y retención.
- [ ] Acordar fecha para revisar el piloto.
