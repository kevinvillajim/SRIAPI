/**
 * Configuración del emisor para facturación electrónica
 * Datos reales de BUSINESSCONNECT S.A.S.
 */

export interface EmisorConfig {
    ambiente: '1' | '2';
    tipoEmision: '1';
    ruc: string;
    razonSocial: string;
    nombreComercial: string;
    dirMatriz: string;
    dirEstablecimiento: string;
    contribuyenteEspecial: string | null;
    obligadoContabilidad: 'SI' | 'NO';
    regimenMicroempresas: boolean;
    agenteRetencion: string | null;
    establecimiento: string;
    puntoEmision: string;
}

export const emisorConfig: EmisorConfig = {
    // Ambiente
    ambiente: '1', // 1: Pruebas, 2: Producción
    tipoEmision: '1', // 1: Normal
    
    // Datos del emisor (BUSINESSCONNECT S.A.S.)
    ruc: '1793204144001',
    razonSocial: 'BUSINESSCONNECT S.A.S.',
    nombreComercial: 'BUSINESSCONNECT',
    dirMatriz: 'RAMIREZ DAVALOS Y AV. AMAZONAS EDIFICIO CENTRO AMAZONAS OF. 402',
    dirEstablecimiento: 'RAMIREZ DAVALOS Y AV. AMAZONAS EDIFICIO CENTRO AMAZONAS OF. 402',
    
    // Datos tributarios
    contribuyenteEspecial: null,
    obligadoContabilidad: 'SI',
    regimenMicroempresas: true, // CONTRIBUYENTE RÉGIMEN RIMPE
    agenteRetencion: null,
    
    // Punto de emisión
    establecimiento: '001',
    puntoEmision: '001'
};

/**
 * Configuración de tipos de identificación según SRI
 */
export const tiposIdentificacion = {
    '04': 'RUC',
    '05': 'CEDULA',
    '06': 'PASAPORTE',
    '07': 'CONSUMIDOR FINAL',
    '08': 'IDENTIFICACION DEL EXTERIOR'
};

/**
 * Configuración de impuestos
 */
export const impuestosConfig = {
    iva: {
        codigo: '2',
        porcentajes: {
            '0': { codigo: '0', tarifa: 0 },      // 0%
            '2': { codigo: '2', tarifa: 12 },     // 12% (IVA estándar)
            '3': { codigo: '3', tarifa: 14 },     // 14% (IVA especial)
            '4': { codigo: '4', tarifa: 15 },     // 15% (IVA nuevo)
            '6': { codigo: '6', tarifa: 0 },      // No objeto de impuesto
            '7': { codigo: '7', tarifa: 0 }       // Exento de IVA
        }
    },
    ice: {
        codigo: '3'
    },
    irbpnr: {
        codigo: '5'
    }
};

/**
 * Formas de pago según SRI
 */
export const formasPago = {
    '01': 'SIN UTILIZACION DEL SISTEMA FINANCIERO',
    '15': 'COMPENSACIÓN DE DEUDAS',
    '16': 'TARJETA DE DÉBITO',
    '17': 'DINERO ELECTRÓNICO',
    '18': 'TARJETA PREPAGO',
    '19': 'TARJETA DE CRÉDITO',
    '20': 'OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO',
    '21': 'ENDOSO DE TÍTULOS'
};

/**
 * Tipos de comprobantes
 */
export const tiposComprobantes = {
    '01': 'FACTURA',
    '03': 'LIQUIDACIÓN DE COMPRA DE BIENES Y PRESTACIÓN DE SERVICIOS',
    '04': 'NOTA DE CRÉDITO',
    '05': 'NOTA DE DÉBITO',
    '06': 'GUÍA DE REMISIÓN',
    '07': 'COMPROBANTE DE RETENCIÓN'
};

export default emisorConfig;