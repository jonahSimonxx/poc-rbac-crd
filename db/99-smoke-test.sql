-- ============================================================
--  99 - Prueba de humo del esquema
--  Ejecutar como crd_app. Termina en ROLLBACK: no deja datos.
--
--  Comprueba:
--    * La aplicacion puede insertar en todas las tablas.
--    * La cadena de auditoria se calcula y verifica.
--    * UPDATE / DELETE / TRUNCATE sobre auditoria estan bloqueados.
--    * DELETE sobre datos clinicos esta bloqueado.
--    * Un paciente no puede anularse sin motivo.
-- ============================================================

BEGIN;

DO $$
DECLARE
    v_user uuid;
    v_est  uuid;
    v_sit  uuid;
    v_pac  uuid;
    v_res  record;
BEGIN
    INSERT INTO usuario (email, nombre, password_hash)
    VALUES ('smoke@sim.local', 'Smoke Test', 'x')
    RETURNING id INTO v_user;

    INSERT INTO estudio (codigo, nombre, creado_por)
    VALUES ('SMOKE', 'Estudio de prueba', v_user)
    RETURNING id INTO v_est;

    INSERT INTO sitio (estudio_id, codigo, nombre)
    VALUES (v_est, 'S01', 'Sitio de prueba')
    RETURNING id INTO v_sit;

    INSERT INTO paciente (estudio_id, sitio_id, codigo, iniciales, edad, sexo, peso_kg)
    VALUES (v_est, v_sit, 'S01-001', 'ABC', 30, 'M', 70.5)
    RETURNING id INTO v_pac;

    INSERT INTO identidad_paciente (paciente_id, nombre, documento)
    VALUES (v_pac, 'Paciente Sintetico', '00000000');

    INSERT INTO crd (paciente_id, tipo, datos, creado_por)
    VALUES (v_pac, 'inclusion', '{"ok": true}'::jsonb, v_user);

    INSERT INTO dosis (paciente_id, numero_toma, lote, dosis_mg, via, creado_por)
    VALUES (v_pac, 1, 'LOTE-X', 60, 'SC', v_user);

    INSERT INTO evento_adverso (paciente_id, descripcion, gravedad, causalidad, creado_por)
    VALUES (v_pac, 'Nauseas leves', 'leve', 'posible', v_user);

    INSERT INTO auditoria (usuario_id, rol_codigo, estudio_id, entidad, entidad_id, accion, resultado)
    VALUES (v_user, 'medico-investigador', v_est, 'paciente', v_pac::text, 'create', 'permitido'),
           (v_user, 'medico-investigador', v_est, 'crd', 'x', 'sign', 'permitido');

    SELECT * INTO v_res FROM verificar_auditoria();
    RAISE NOTICE '[1] Insercion clinica: OK';
    RAISE NOTICE '[2] Cadena de auditoria: total=%, integra=%', v_res.total, v_res.integra;

    BEGIN
        UPDATE auditoria SET accion = 'hack' WHERE id = 1;
        RAISE NOTICE '[3] FALLO: UPDATE auditoria permitido';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '[3] OK: UPDATE auditoria bloqueado';
    END;

    BEGIN
        DELETE FROM auditoria WHERE id = 1;
        RAISE NOTICE '[4] FALLO: DELETE auditoria permitido';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '[4] OK: DELETE auditoria bloqueado';
    END;

    BEGIN
        TRUNCATE auditoria;
        RAISE NOTICE '[5] FALLO: TRUNCATE auditoria permitido';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '[5] OK: TRUNCATE auditoria bloqueado';
    END;

    BEGIN
        DELETE FROM paciente WHERE id = v_pac;
        RAISE NOTICE '[6] FALLO: DELETE paciente permitido';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '[6] OK: DELETE paciente bloqueado';
    END;

    BEGIN
        UPDATE paciente SET anulado = true WHERE id = v_pac;
        RAISE NOTICE '[7] FALLO: anular sin motivo permitido';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE '[7] OK: anular sin motivo bloqueado';
    END;
END
$$;

ROLLBACK;
