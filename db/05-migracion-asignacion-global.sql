-- ============================================================
--  Migracion: asignacion global para sys-admin
--
--  El ADR define que el sys-admin tiene ambito global y no se
--  ciñe a un estudio. Para no crear una segunda fuente de verdad
--  de roles, su asignacion se guarda con estudio_id NULL.
--
--  Idempotente: se puede ejecutar mas de una vez.
-- ============================================================

BEGIN;

ALTER TABLE asignacion ALTER COLUMN estudio_id DROP NOT NULL;

ALTER TABLE asignacion DROP CONSTRAINT IF EXISTS asignacion_ambito_global;
ALTER TABLE asignacion
    ADD CONSTRAINT asignacion_ambito_global
    CHECK (estudio_id IS NOT NULL OR rol_codigo = 'sys-admin');

DROP INDEX IF EXISTS asignacion_una_activa_por_estudio;
CREATE UNIQUE INDEX asignacion_una_activa_por_estudio
    ON asignacion (usuario_id, estudio_id)
    WHERE activa AND estudio_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS asignacion_una_global_activa
    ON asignacion (usuario_id)
    WHERE activa AND estudio_id IS NULL;

-- Asignacion global del administrador de demostracion, si aun no existe.
INSERT INTO asignacion (usuario_id, estudio_id, rol_codigo, activa, creada_por)
SELECT u.id, NULL, 'sys-admin', true, u.id
FROM usuario u
WHERE lower(u.email) = 'admin@sim.local'
  AND NOT EXISTS (
      SELECT 1
      FROM asignacion a
      WHERE a.usuario_id = u.id
        AND a.activa
        AND a.estudio_id IS NULL
  );

COMMIT;
