/**
 * Constantes de impuestos según las especificaciones del SRI Ecuador
 * Actualizado para incluir IVA 15% obligatorio desde 2025
 */

export const CODIGOS_IMPUESTOS = {
  IVA: '2',
  ICE: '3',
  IRBPNR: '5'
} as const;

/**
 * Códigos de porcentaje de IVA según el SRI
 * @see Manual técnico de comprobantes electrónicos
 */
export const CODIGOS_IVA = {
  '0': {
    codigo: '0',
    tarifa: 0,
    descripcion: 'IVA 0%'
  },
  '2': {
    codigo: '2',
    tarifa: 12,
    descripcion: 'IVA 12%'
  },
  '3': {
    codigo: '3',
    tarifa: 14,
    descripcion: 'IVA 14%'
  },
  '4': {
    codigo: '4',
    tarifa: 15,
    descripcion: 'IVA 15% (Obligatorio desde 2025)'
  },
  '6': {
    codigo: '6',
    tarifa: 0,
    descripcion: 'No objeto de impuesto'
  },
  '7': {
    codigo: '7',
    tarifa: 0,
    descripcion: 'Exento de IVA'
  },
  '8': {
    codigo: '8',
    tarifa: 8,
    descripcion: 'IVA 8%'
  }
} as const;

/**
 * Códigos de retención en la fuente de IVA
 */
export const CODIGOS_RETENCION_IVA = {
  '10': {
    codigo: '10',
    porcentaje: 10,
    descripcion: 'Retención IVA 10%'
  },
  '20': {
    codigo: '20',
    porcentaje: 20,
    descripcion: 'Retención IVA 20%'
  },
  '30': {
    codigo: '30',
    porcentaje: 30,
    descripcion: 'Retención IVA 30%'
  },
  '50': {
    codigo: '50',
    porcentaje: 50,
    descripcion: 'Retención IVA 50%'
  },
  '70': {
    codigo: '70',
    porcentaje: 70,
    descripcion: 'Retención IVA 70%'
  },
  '100': {
    codigo: '100',
    porcentaje: 100,
    descripcion: 'Retención IVA 100%'
  }
} as const;

/**
 * Códigos de retención en la fuente de Renta
 */
export const CODIGOS_RETENCION_RENTA = {
  '303': {
    codigo: '303',
    porcentaje: 1,
    descripcion: 'Honorarios profesionales'
  },
  '304': {
    codigo: '304',
    porcentaje: 1.75,
    descripcion: 'Servicios donde predomina el intelecto'
  },
  '307': {
    codigo: '307',
    porcentaje: 2,
    descripcion: 'Servicios donde predomina la mano de obra'
  },
  '308': {
    codigo: '308',
    porcentaje: 2,
    descripcion: 'Servicios entre sociedades'
  },
  '309': {
    codigo: '309',
    porcentaje: 1,
    descripcion: 'Servicios publicidad y comunicación'
  },
  '310': {
    codigo: '310',
    porcentaje: 1,
    descripcion: 'Transporte privado de pasajeros o servicio de carga'
  },
  '312': {
    codigo: '312',
    porcentaje: 1,
    descripcion: 'Transferencia de bienes muebles de naturaleza corporal'
  },
  '319': {
    codigo: '319',
    porcentaje: 1.75,
    descripcion: 'Arrendamiento mercantil'
  },
  '320': {
    codigo: '320',
    porcentaje: 8,
    descripcion: 'Arrendamiento bienes inmuebles'
  },
  '322': {
    codigo: '322',
    porcentaje: 1,
    descripcion: 'Seguros y reaseguros (primas y cesiones)'
  },
  '323': {
    codigo: '323',
    porcentaje: 2,
    descripcion: 'Rendimientos financieros'
  },
  '332': {
    codigo: '332',
    porcentaje: 0,
    descripcion: 'Otras compras de bienes y servicios no sujetas a retención'
  },
  '343': {
    codigo: '343',
    porcentaje: 2.75,
    descripcion: 'Aplicable a pagos a no residentes'
  }
} as const;

/**
 * Tipo de identificación según el SRI
 */
export const TIPOS_IDENTIFICACION = {
  '04': 'RUC',
  '05': 'CEDULA',
  '06': 'PASAPORTE',
  '07': 'CONSUMIDOR_FINAL',
  '08': 'IDENTIFICACION_EXTERIOR'
} as const;

/**
 * Tipos de documentos según el SRI
 */
export const TIPOS_DOCUMENTOS = {
  '01': 'FACTURA',
  '03': 'LIQUIDACION_COMPRA',
  '04': 'NOTA_CREDITO',
  '05': 'NOTA_DEBITO',
  '06': 'GUIA_REMISION',
  '07': 'COMPROBANTE_RETENCION'
} as const;

/**
 * Formas de pago según el SRI
 */
export const FORMAS_PAGO = {
  '01': 'SIN UTILIZACION DEL SISTEMA FINANCIERO',
  '15': 'COMPENSACIÓN DE DEUDAS',
  '16': 'TARJETA DE DÉBITO',
  '17': 'DINERO ELECTRÓNICO',
  '18': 'TARJETA PREPAGO',
  '19': 'TARJETA DE CRÉDITO',
  '20': 'OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO',
  '21': 'ENDOSO DE TÍTULOS'
} as const;

/**
 * Helper para obtener el código de IVA según la tarifa
 * Prioriza IVA 15% para el año 2025 en adelante
 */
export function getCodigoIVAPorTarifa(tarifa: number, fecha?: Date): string {
  const year = fecha ? fecha.getFullYear() : new Date().getFullYear();
  
  // A partir de 2025, usar IVA 15% como estándar
  if (year >= 2025 && (tarifa === 12 || tarifa === 15)) {
    return '4'; // IVA 15%
  }
  
  switch (tarifa) {
    case 0: return '0';
    case 8: return '8';
    case 12: return '2';
    case 14: return '3';
    case 15: return '4';
    default: return '2'; // Por defecto IVA 12%
  }
}

/**
 * Helper para calcular el valor del IVA
 * Considera IVA 15% para el año 2025 en adelante
 */
export function calcularIVA(baseImponible: number, codigoPorcentaje: string): number {
  const tarifaInfo = CODIGOS_IVA[codigoPorcentaje as keyof typeof CODIGOS_IVA];
  if (!tarifaInfo) {
    throw new Error(`Código de IVA no válido: ${codigoPorcentaje}`);
  }
  
  return Number((baseImponible * (tarifaInfo.tarifa / 100)).toFixed(2));
}

/**
 * Helper para validar si debe usar IVA 15%
 */
export function debeUsarIVA15(fecha?: Date): boolean {
  const year = fecha ? fecha.getFullYear() : new Date().getFullYear();
  return year >= 2025;
}