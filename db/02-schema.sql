-- ============================================================
--  02 - Esquema del POC RBAC (CRD de farmacovigilancia)
--  Ejecutar como crd_owner sobre la base crd_rbac_poc
--
--  Decisiones reflejadas (ADR-001):
--    D3  Ambito por estudio; el sitio es un dato, no un ambito.
--    D4  Entidad asignacion: usuario + estudio + rol.
--    D5  Deny by default: sin asignacion activa no hay acceso.
--    D6  Identidad del paciente en tabla separada.
--    D7  Sin borrado clinico: se anula con motivo.
--    D10 Auditoria append-only, encadenada por hash.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Catalogo de roles (3 roles, codigo estable)
-- ------------------------------------------------------------
CREATE TABLE rol (
    codigo      text PRIMARY KEY,
    nombre      text NOT NULL,
    descripcion text
);

-- ------------------------------------------------------------
-- Usuarios
-- ------------------------------------------------------------
CREATE TABLE usuario (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL UNIQUE,
    nombre        text NOT NULL,
    password_hash text NOT NULL,
    activo        boolean NOT NULL DEFAULT true,
    creado_en     timestamptz NOT NULL DEFAULT now(),
    creado_por    uuid REFERENCES usuario(id)
);

-- ------------------------------------------------------------
-- Estudios y sitios
-- ------------------------------------------------------------
CREATE TABLE estudio (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo       text NOT NULL UNIQUE,
    nombre       text NOT NULL,
    patrocinador text,
    estado       text NOT NULL DEFAULT 'activo'
                 CHECK (estado IN ('activo', 'cerrado')),
    creado_en    timestamptz NOT NULL DEFAULT now(),
    creado_por   uuid REFERENCES usuario(id)
);

CREATE TABLE sitio (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id uuid NOT NULL REFERENCES estudio(id),
    codigo     text NOT NULL,
    nombre     text NOT NULL,
    activo     boolean NOT NULL DEFAULT true,
    UNIQUE (estudio_id, codigo),
    -- Permite que paciente garantice por FK que el sitio pertenece al estudio.
    UNIQUE (id, estudio_id)
);

-- ------------------------------------------------------------
-- Asignacion: usuario + estudio + rol (ADR-001 D3/D4)
--
--  estudio_id es NULL para el rol global (sys-admin). Un unico lugar
--  guarda los roles: la asignacion. Asi el motor no necesita una
--  segunda fuente de verdad para el ambito global.
-- ------------------------------------------------------------
CREATE TABLE asignacion (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL REFERENCES usuario(id),
    estudio_id uuid REFERENCES estudio(id),
    rol_codigo text NOT NULL REFERENCES rol(codigo),
    activa     boolean NOT NULL DEFAULT true,
    creada_por uuid REFERENCES usuario(id),
    creada_en  timestamptz NOT NULL DEFAULT now(),
    baja_en    timestamptz,
    -- Una asignacion activa no puede tener fecha de baja; una inactiva, si.
    CHECK ((activa AND baja_en IS NULL) OR (NOT activa)),
    -- Solo el rol global puede existir sin estudio.
    CHECK (estudio_id IS NOT NULL OR rol_codigo = 'sys-admin')
);

-- Un usuario no puede tener dos asignaciones activas en el mismo estudio (AC-08).
CREATE UNIQUE INDEX asignacion_una_activa_por_estudio
    ON asignacion (usuario_id, estudio_id)
    WHERE activa AND estudio_id IS NOT NULL;

-- Un usuario no puede acumular dos asignaciones globales activas.
CREATE UNIQUE INDEX asignacion_una_global_activa
    ON asignacion (usuario_id)
    WHERE activa AND estudio_id IS NULL;

-- ------------------------------------------------------------
-- Pacientes (datos clinicos, sin identidad personal)
-- ------------------------------------------------------------
CREATE TABLE paciente (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id       uuid NOT NULL REFERENCES estudio(id),
    sitio_id         uuid NOT NULL,
    codigo           text NOT NULL,
    iniciales        text NOT NULL,
    edad             smallint NOT NULL CHECK (edad BETWEEN 0 AND 120),
    sexo             char(1) NOT NULL CHECK (sexo IN ('M', 'F')),
    color_piel       text,
    peso_kg          numeric(5,1) CHECK (peso_kg > 0),
    antecedentes     text,
    diagnostico      text,
    anulado          boolean NOT NULL DEFAULT false,
    motivo_anulacion text,
    creado_por       uuid REFERENCES usuario(id),
    creado_en        timestamptz NOT NULL DEFAULT now(),
    actualizado_en   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (estudio_id, codigo),
    CONSTRAINT paciente_sitio_del_estudio
        FOREIGN KEY (sitio_id, estudio_id) REFERENCES sitio(id, estudio_id),
    -- Sin borrado clinico: anular exige motivo (ADR-001 D7).
    CONSTRAINT paciente_anulacion_con_motivo
        CHECK (NOT anulado OR motivo_anulacion IS NOT NULL)
);

-- ------------------------------------------------------------
-- Identidad del paciente (separada del CRD, ADR-001 D6)
-- ------------------------------------------------------------
CREATE TABLE identidad_paciente (
    paciente_id            uuid PRIMARY KEY REFERENCES paciente(id),
    nombre                 text NOT NULL,
    documento              text NOT NULL,
    telefono               text,
    direccion              text,
    consentimiento_firmado boolean NOT NULL DEFAULT false,
    consentimiento_fecha   date,
    creado_en              timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- CRD (cuaderno de recogida de datos)
-- ------------------------------------------------------------
CREATE TABLE crd (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id    uuid NOT NULL REFERENCES paciente(id),
    tipo           text NOT NULL CHECK (tipo IN (
                       'inclusion', 'evaluacion_inicial', 'evaluacion_intermedia',
                       'evaluacion_final', 'examen_fisico', 'laboratorio',
                       'tratamiento_concomitante', 'fallecimiento',
                       'interrupcion', 'imagenes')),
    visita         integer NOT NULL DEFAULT 1 CHECK (visita >= 1),
    datos          jsonb NOT NULL DEFAULT '{}'::jsonb,
    estado         text NOT NULL DEFAULT 'borrador'
                   CHECK (estado IN ('borrador', 'cerrado', 'firmado', 'anulado')),
    firmado_por    uuid REFERENCES usuario(id),
    firmado_en     timestamptz,
    creado_por     uuid REFERENCES usuario(id),
    creado_en      timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    UNIQUE (paciente_id, tipo, visita),
    -- Si hay firma registrada, debe tener fecha.
    CHECK (firmado_por IS NULL OR firmado_en IS NOT NULL),
    -- No se puede marcar como firmado sin firmante.
    CHECK (estado <> 'firmado' OR firmado_por IS NOT NULL)
);

-- ------------------------------------------------------------
-- Administracion de medicamento (una fila por toma, como el Excel)
-- ------------------------------------------------------------
CREATE TABLE dosis (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id uuid NOT NULL REFERENCES paciente(id),
    numero_toma integer NOT NULL CHECK (numero_toma >= 1),
    lote        text,
    dosis_mg    numeric(8,2) NOT NULL CHECK (dosis_mg > 0),
    via         text NOT NULL,
    fecha_hora  timestamptz,
    creado_por  uuid REFERENCES usuario(id),
    creado_en   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (paciente_id, numero_toma)
);

-- ------------------------------------------------------------
-- Eventos adversos
-- ------------------------------------------------------------
CREATE TABLE evento_adverso (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id  uuid NOT NULL REFERENCES paciente(id),
    descripcion  text NOT NULL,
    gravedad     text NOT NULL CHECK (gravedad IN ('leve', 'moderada', 'grave')),
    causalidad   text CHECK (causalidad IN (
                     'no_relacionada', 'posible', 'probable', 'definitiva')),
    desenlace    text,
    fecha_inicio date,
    fecha_fin    date,
    creado_por   uuid REFERENCES usuario(id),
    creado_en    timestamptz NOT NULL DEFAULT now(),
    CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

-- ------------------------------------------------------------
-- Auditoria (append-only, encadenada por hash)
-- ------------------------------------------------------------
CREATE TABLE auditoria (
    id          bigserial PRIMARY KEY,
    fecha       timestamptz NOT NULL DEFAULT now(),
    usuario_id  uuid REFERENCES usuario(id),
    rol_codigo  text,
    estudio_id  uuid REFERENCES estudio(id),   -- NULL = evento administrativo
    entidad     text NOT NULL,
    entidad_id  text NOT NULL,
    accion      text NOT NULL,
    resultado   text NOT NULL CHECK (resultado IN ('permitido', 'denegado')),
    detalle     jsonb NOT NULL DEFAULT '{}'::jsonb,
    hash_previo text NOT NULL,
    hash        text NOT NULL
);

-- ------------------------------------------------------------
-- Indices
-- ------------------------------------------------------------
CREATE INDEX idx_asignacion_usuario   ON asignacion (usuario_id) WHERE activa;
CREATE INDEX idx_paciente_estudio      ON paciente (estudio_id);
CREATE INDEX idx_crd_paciente          ON crd (paciente_id);
CREATE INDEX idx_dosis_paciente        ON dosis (paciente_id);
CREATE INDEX idx_evento_paciente       ON evento_adverso (paciente_id);
CREATE INDEX idx_auditoria_estudio     ON auditoria (estudio_id, fecha DESC);
CREATE INDEX idx_auditoria_usuario     ON auditoria (usuario_id, fecha DESC);

-- ------------------------------------------------------------
-- Funciones de mantenimiento
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION marcar_actualizado()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END
$$;

CREATE TRIGGER trg_paciente_actualizado
    BEFORE UPDATE ON paciente
    FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();

CREATE TRIGGER trg_crd_actualizado
    BEFORE UPDATE ON crd
    FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();

-- ------------------------------------------------------------
-- Integridad de la auditoria
-- ------------------------------------------------------------

-- Calcula el hash del registro a partir del anterior.
-- Serializa las inserciones con un advisory lock para que dos
-- escrituras simultaneas no generen dos ramas de la cadena.
CREATE OR REPLACE FUNCTION auditoria_encadenar()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_previo text;
BEGIN
    PERFORM pg_advisory_xact_lock(920260109);

    SELECT hash INTO v_previo FROM auditoria ORDER BY id DESC LIMIT 1;

    NEW.hash_previo := COALESCE(v_previo, 'GENESIS');
    NEW.hash := encode(digest(
        NEW.hash_previo || '|' ||
        to_char(NEW.fecha AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' ||
        COALESCE(NEW.usuario_id::text, '') || '|' ||
        COALESCE(NEW.rol_codigo, '') || '|' ||
        COALESCE(NEW.estudio_id::text, '') || '|' ||
        NEW.entidad || '|' ||
        NEW.entidad_id || '|' ||
        NEW.accion || '|' ||
        NEW.resultado || '|' ||
        NEW.detalle::text,
        'sha256'), 'hex');

    RETURN NEW;
END
$$;

CREATE TRIGGER trg_auditoria_encadenar
    BEFORE INSERT ON auditoria
    FOR EACH ROW EXECUTE FUNCTION auditoria_encadenar();

-- Impide cualquier modificacion de la auditoria (capa 2 de 3).
CREATE OR REPLACE FUNCTION auditoria_inmutable()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'Auditoria inmutable: % no permitido sobre %', TG_OP, TG_TABLE_NAME
        USING ERRCODE = '42501';
END
$$;

CREATE TRIGGER trg_auditoria_no_update_delete
    BEFORE UPDATE OR DELETE ON auditoria
    FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();

CREATE TRIGGER trg_auditoria_no_truncate
    BEFORE TRUNCATE ON auditoria
    FOR EACH STATEMENT EXECUTE FUNCTION auditoria_inmutable();

-- Recorre la cadena y devuelve el estado de integridad (AC-06).
CREATE OR REPLACE FUNCTION verificar_auditoria()
RETURNS TABLE (total bigint, integra boolean, primer_error bigint)
LANGUAGE plpgsql AS $$
DECLARE
    r              record;
    v_previo       text := 'GENESIS';
    v_calculado    text;
    v_total        bigint := 0;
BEGIN
    FOR r IN SELECT * FROM auditoria ORDER BY id LOOP
        v_total := v_total + 1;

        v_calculado := encode(digest(
            v_previo || '|' ||
            to_char(r.fecha AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' ||
            COALESCE(r.usuario_id::text, '') || '|' ||
            COALESCE(r.rol_codigo, '') || '|' ||
            COALESCE(r.estudio_id::text, '') || '|' ||
            r.entidad || '|' ||
            r.entidad_id || '|' ||
            r.accion || '|' ||
            r.resultado || '|' ||
            r.detalle::text,
            'sha256'), 'hex');

        IF r.hash_previo <> v_previo OR r.hash <> v_calculado THEN
            RETURN QUERY SELECT v_total, false, r.id;
            RETURN;
        END IF;

        v_previo := r.hash;
    END LOOP;

    RETURN QUERY SELECT v_total, true, NULL::bigint;
END
$$;

-- ------------------------------------------------------------
-- Catalogo de roles (ADR-001)
-- ------------------------------------------------------------
INSERT INTO rol (codigo, nombre, descripcion) VALUES
    ('sys-admin', 'Administrador del sistema',
     'Gestiona cuentas, asignaciones y catalogos. Sin acceso a datos clinicos.'),
    ('jefe-estudio', 'Jefe de estudio',
     'Dirige el estudio, asigna investigadores, supervisa y lee la auditoria clinica.'),
    ('medico-investigador', 'Medico investigador',
     'Carga pacientes, CRD, dosis y eventos adversos. Firma y cierra.');

COMMIT;
