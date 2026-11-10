-- ============================================================
--  POC RBAC - CRD de farmacovigilancia
--  Bootstrap: crea el rol de aplicacion y la base de datos
-- ============================================================
--  Ejecutar UNA sola vez, conectado como superusuario (postgres),
--  desde pgAdmin (Query Tool) o psql.
--
--  Este script NO crea tablas. Solo prepara el entorno para que
--  la aplicacion pueda conectarse con un usuario sin privilegios
--  de superusuario.
-- ============================================================

CREATE ROLE crd_app LOGIN PASSWORD 'crd_app_dev_2026';

CREATE DATABASE crd_rbac_poc
    OWNER crd_app
    ENCODING 'UTF8'
    TEMPLATE template0;

-- El rol de aplicacion no debe poder crear bases ni roles.
ALTER ROLE crd_app NOCREATEDB NOCREATEROLE NOSUPERUSER;

-- Verificacion
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname = 'crd_app';
