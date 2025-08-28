-- Base de datos para Sistema de Facturación Electrónica SRI Ecuador
-- Compatible con certificados UANATACA
-- Versión: 1.0.0

CREATE DATABASE IF NOT EXISTS sri_facturacion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sri_facturacion;

-- Tabla de organizaciones (multi-tenant)
CREATE TABLE organizations (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    ruc VARCHAR(13) UNIQUE NOT NULL,
    razon_social VARCHAR(300) NOT NULL,
    nombre_comercial VARCHAR(300),
    direccion_matriz VARCHAR(500) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(255),
    ambiente TINYINT DEFAULT 1 COMMENT '1: Pruebas, 2: Producción',
    tipo_emisor VARCHAR(50) DEFAULT 'NORMAL',
    obligado_contabilidad ENUM('SI', 'NO') DEFAULT 'SI',
    contribuyente_especial VARCHAR(10),
    contribuyente_rimpe BOOLEAN DEFAULT FALSE,
    agente_retencion BOOLEAN DEFAULT FALSE,
    regimen_microempresa BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_org_ruc (ruc),
    INDEX idx_org_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de establecimientos
CREATE TABLE establishments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36) NOT NULL,
    codigo VARCHAR(3) NOT NULL,
    nombre VARCHAR(300) NOT NULL,
    direccion VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_org_establishment (organization_id, codigo),
    INDEX idx_est_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de puntos de emisión
CREATE TABLE emission_points (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    establishment_id CHAR(36) NOT NULL,
    codigo VARCHAR(3) NOT NULL,
    descripcion VARCHAR(300),
    tipo_emision ENUM('NORMAL', 'CONTINGENCIA') DEFAULT 'NORMAL',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE,
    UNIQUE KEY unique_est_point (establishment_id, codigo),
    INDEX idx_point_est (establishment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de certificados digitales (encriptados)
CREATE TABLE certificates (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    certificate_data TEXT NOT NULL COMMENT 'Certificado P12 encriptado con AES-256',
    password_hash TEXT NOT NULL COMMENT 'Password encriptado',
    provider VARCHAR(50) DEFAULT 'UANATACA',
    serial_number VARCHAR(100),
    issuer TEXT,
    subject TEXT,
    valid_from DATETIME,
    valid_until DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    is_primary BOOLEAN DEFAULT FALSE,
    last_used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    INDEX idx_cert_org (organization_id),
    INDEX idx_cert_active (is_active),
    INDEX idx_cert_expiry (valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de secuenciales por tipo de documento
CREATE TABLE document_sequences (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36) NOT NULL,
    establishment_code VARCHAR(3) NOT NULL,
    emission_point_code VARCHAR(3) NOT NULL,
    document_type VARCHAR(2) NOT NULL COMMENT '01:Factura, 03:Liquidación, 04:NotaCrédito, 05:NotaDébito, 06:GuíaRemisión, 07:Retención',
    current_sequential INT UNSIGNED DEFAULT 0,
    min_sequential INT UNSIGNED DEFAULT 1,
    max_sequential INT UNSIGNED DEFAULT 999999999,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_sequence (organization_id, establishment_code, emission_point_code, document_type),
    INDEX idx_seq_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla principal de comprobantes
CREATE TABLE comprobantes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36) NOT NULL,
    tipo_comprobante VARCHAR(2) NOT NULL,
    establecimiento VARCHAR(3) NOT NULL,
    punto_emision VARCHAR(3) NOT NULL,
    secuencial VARCHAR(9) NOT NULL,
    clave_acceso VARCHAR(49) UNIQUE NOT NULL,
    numero_autorizacion VARCHAR(49),
    fecha_emision DATETIME NOT NULL,
    fecha_autorizacion DATETIME,
    estado ENUM('GENERADO', 'FIRMADO', 'ENVIADO', 'RECIBIDA', 'PPR', 'AUT', 'NAT', 'ERROR', 'DEVUELTA', 'ANULADO') NOT NULL DEFAULT 'GENERADO',
    ambiente TINYINT NOT NULL COMMENT '1: Pruebas, 2: Producción',
    tipo_emision TINYINT DEFAULT 1 COMMENT '1: Normal, 2: Contingencia',
    xml_original MEDIUMTEXT NOT NULL,
    xml_firmado MEDIUMTEXT,
    xml_autorizado MEDIUMTEXT,
    pdf_path VARCHAR(500),
    ride_generated BOOLEAN DEFAULT FALSE,
    
    -- Información del receptor
    identificacion_receptor VARCHAR(20) NOT NULL,
    razon_social_receptor VARCHAR(300) NOT NULL,
    email_receptor VARCHAR(500),
    
    -- Totales
    subtotal_iva_0 DECIMAL(14,2) DEFAULT 0,
    subtotal_iva DECIMAL(14,2) DEFAULT 0,
    total_iva DECIMAL(14,2) DEFAULT 0,
    total_descuento DECIMAL(14,2) DEFAULT 0,
    total_sin_impuestos DECIMAL(14,2) DEFAULT 0,
    importe_total DECIMAL(14,2) DEFAULT 0,
    
    -- Mensajes y respuestas SRI
    mensajes_sri JSON,
    informacion_adicional JSON,
    
    -- Control de reintentos
    intentos_envio INT DEFAULT 0,
    ultimo_intento_at TIMESTAMP NULL,
    
    -- Auditoría
    created_by CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    INDEX idx_comp_org (organization_id),
    INDEX idx_comp_clave (clave_acceso),
    INDEX idx_comp_fecha (fecha_emision),
    INDEX idx_comp_estado (estado),
    INDEX idx_comp_receptor (identificacion_receptor),
    INDEX idx_comp_tipo (tipo_comprobante),
    INDEX idx_comp_secuencial (establecimiento, punto_emision, secuencial)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de detalles de comprobantes
CREATE TABLE comprobante_detalles (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    comprobante_id CHAR(36) NOT NULL,
    codigo_principal VARCHAR(25),
    codigo_auxiliar VARCHAR(25),
    descripcion VARCHAR(1000) NOT NULL,
    cantidad DECIMAL(14,6) NOT NULL,
    precio_unitario DECIMAL(14,6) NOT NULL,
    descuento DECIMAL(14,2) DEFAULT 0,
    precio_total_sin_impuesto DECIMAL(14,2) NOT NULL,
    detalles_adicionales JSON,
    impuestos JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comprobante_id) REFERENCES comprobantes(id) ON DELETE CASCADE,
    INDEX idx_det_comp (comprobante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de usuarios del sistema
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(300) NOT NULL,
    role ENUM('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER') DEFAULT 'OPERATOR',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP NULL,
    password_changed_at TIMESTAMP NULL,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
    INDEX idx_user_org (organization_id),
    INDEX idx_user_email (email),
    INDEX idx_user_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de sesiones/tokens
CREATE TABLE user_sessions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    refresh_token_hash VARCHAR(255) UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    refresh_expires_at TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session_user (user_id),
    INDEX idx_session_token (token_hash),
    INDEX idx_session_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de logs de auditoría
CREATE TABLE audit_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    user_id CHAR(36),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(36),
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_org (organization_id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para cola de procesamiento (contingencia)
CREATE TABLE processing_queue (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36) NOT NULL,
    comprobante_id CHAR(36),
    priority INT DEFAULT 5,
    action VARCHAR(50) NOT NULL COMMENT 'SEND, AUTHORIZE, RETRY',
    payload JSON NOT NULL,
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMP NULL,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (comprobante_id) REFERENCES comprobantes(id) ON DELETE CASCADE,
    INDEX idx_queue_status (status),
    INDEX idx_queue_scheduled (scheduled_at),
    INDEX idx_queue_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de webhooks
CREATE TABLE webhooks (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36) NOT NULL,
    url VARCHAR(500) NOT NULL,
    events JSON COMMENT 'Array de eventos: ["comprobante.autorizado", "comprobante.rechazado", etc.]',
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP NULL,
    failure_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    INDEX idx_webhook_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de notificaciones
CREATE TABLE notifications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36) NOT NULL,
    user_id CHAR(36),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSON,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notif_org (organization_id),
    INDEX idx_notif_user (user_id),
    INDEX idx_notif_read (read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vistas útiles
CREATE VIEW v_comprobantes_resumen AS
SELECT 
    c.id,
    c.organization_id,
    o.ruc,
    o.razon_social,
    c.tipo_comprobante,
    c.clave_acceso,
    c.numero_autorizacion,
    c.fecha_emision,
    c.fecha_autorizacion,
    c.estado,
    c.identificacion_receptor,
    c.razon_social_receptor,
    c.importe_total,
    c.created_at
FROM comprobantes c
JOIN organizations o ON c.organization_id = o.id;

CREATE VIEW v_certificados_activos AS
SELECT 
    c.id,
    c.organization_id,
    o.ruc,
    o.razon_social,
    c.provider,
    c.valid_from,
    c.valid_until,
    DATEDIFF(c.valid_until, NOW()) AS dias_hasta_expiracion,
    c.is_active,
    c.is_primary
FROM certificates c
JOIN organizations o ON c.organization_id = o.id
WHERE c.is_active = TRUE AND c.valid_until > NOW();