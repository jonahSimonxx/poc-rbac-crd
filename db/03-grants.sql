-- ============================================================
--  03 - Privilegios de la aplicacion
--  Ejecutar como crd_owner sobre la base crd_rbac_poc
--
--  Reglas (ADR-001):
--    * Sin DELETE en ninguna tabla: el borrado clinico no existe,
--      se anula con un UPDATE y motivo.
--    * Sin UPDATE ni DELETE en auditoria: capa 1 de 3 de inmutabilidad.
--    * El catalogo de roles es de solo lectura para la aplicacion.
-- ============================================================

GRANT USAGE ON SCHEMA public TO crd_app;

-- Catalogo: solo lectura
GRANT SELECT ON rol TO crd_app;

-- Operacion normal
GRANT SELECT, INSERT, UPDATE ON
    usuario,
    estudio,
    sitio,
    asignacion,
    paciente,
    identidad_paciente,
    crd,
    dosis,
    evento_adverso
TO crd_app;

-- Auditoria: solo agregar y leer. Nunca modificar ni borrar.
GRANT SELECT, INSERT ON auditoria TO crd_app;
GRANT USAGE, SELECT ON SEQUENCE auditoria_id_seq TO crd_app;

-- Refuerzo explicito: quitar cualquier privilegio heredado.
REVOKE UPDATE, DELETE, TRUNCATE ON auditoria FROM crd_app;
REVOKE DELETE, TRUNCATE ON
    usuario, estudio, sitio, asignacion,
    paciente, identidad_paciente, crd, dosis, evento_adverso
FROM crd_app;

-- Funciones de integridad: la aplicacion solo necesita poder ejecutarlas.
REVOKE ALL ON FUNCTION auditoria_encadenar()      FROM PUBLIC;
REVOKE ALL ON FUNCTION auditoria_inmutable()      FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verificar_auditoria()   TO crd_app;
