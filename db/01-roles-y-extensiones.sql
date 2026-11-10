-- ============================================================
--  01 - Roles de base de datos y extensiones
--  Ejecutar como SUPERUSUARIO (postgres) sobre la base crd_rbac_poc
--
--  Modelo de privilegios:
--    crd_owner  -> dueno del esquema. Solo lo usan las migraciones.
--    crd_app    -> usuario de la aplicacion. Sin UPDATE/DELETE en auditoria.
--
--  Esta separacion es lo que hace efectivo el REVOKE: un dueno de tabla
--  siempre puede re-otorgarse privilegios a si mismo, asi que la app
--  nunca debe ser duena de las tablas.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crd_owner') THEN
        CREATE ROLE crd_owner LOGIN PASSWORD 'crd_owner_dev_2026';
    END IF;
END
$$;

ALTER DATABASE crd_rbac_poc OWNER TO crd_owner;

-- pgcrypto provee digest() para el encadenamiento por hash de la auditoria.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

GRANT CONNECT ON DATABASE crd_rbac_poc TO crd_app;
