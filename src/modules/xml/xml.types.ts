// Tipos comunes
export interface InfoTributaria {
  ambiente: number;
  tipoEmision: number;
  razonSocial: string;
  nombreComercial?: string;
  ruc: string;
  claveAcceso?: string;
  codDoc: string;
  estab: string;
  ptoEmi: string;
  secuencial: string;
  dirMatriz: string;
  agenteRetencion?: string;
  contribuyenteRimpe?: string;
}

export interface TotalImpuesto {
  codigo: string;
  codigoPorcentaje: string;
  descuentoAdicional?: number;
  baseImponible: number;
  tarifa?: number;
  valor: number;
  valorDevolucionIva?: number;
}

export interface Impuesto {
  codigo: string;
  codigoPorcentaje: string;
  tarifa: number;
  baseImponible: number;
  valor: number;
}

export interface DetalleAdicional {
  nombre: string;
  valor: string;
}

export interface CampoAdicional {
  nombre: string;
  valor: string;
}

// FACTURA
export interface FacturaData {
  infoTributaria: InfoTributaria;
  infoFactura: InfoFactura;
  detalles: DetalleFactura[];
  retenciones?: Retencion[];
  infoAdicional?: CampoAdicional[];
}

export interface InfoFactura {
  fechaEmision: Date | string;
  dirEstablecimiento?: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: string;
  comercioExterior?: string;
  incoTermFactura?: string;
  lugarIncoTerm?: string;
  paisOrigen?: string;
  puertoEmbarque?: string;
  puertoDestino?: string;
  paisDestino?: string;
  paisAdquisicion?: string;
  tipoIdentificacionComprador: string;
  guiaRemision?: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  direccionComprador?: string;
  totalSinImpuestos: number;
  totalSubsidio?: number;
  incoTermTotalSinImpuestos?: string;
  totalDescuento: number;
  totalConImpuestos: TotalImpuesto[];
  compensaciones?: Compensacion[];
  propina?: number;
  fleteInternacional?: number;
  seguroInternacional?: number;
  gastosAduaneros?: number;
  gastosTransporteOtros?: number;
  importeTotal: number;
  moneda?: string;
  placa?: string;
  pagos?: Pago[];
  plazos?: Plazo[];
  codDocReembolso?: string;
  totalComprobantesReembolso?: number;
  totalBaseImponibleReembolso?: number;
  totalImpuestoReembolso?: number;
  valorRetIva?: number;
  valorRetRenta?: number;
}

export interface Compensacion {
  codigo: string;
  tarifa: number;
  valor: number;
}

export interface Plazo {
  plazo: string;
  unidadTiempo: string;
}

export interface DetalleFactura {
  codigoPrincipal?: string;
  codigoAuxiliar?: string;
  descripcion: string;
  unidadMedida?: string;
  cantidad: number;
  precioUnitario: number;
  precioSinSubsidio?: number;
  descuento?: number;
  precioTotalSinImpuesto: number;
  detallesAdicionales?: DetalleAdicional[];
  impuestos: Impuesto[];
}

export interface Retencion {
  codigo: string;
  codigoPorcentaje: string;
  tarifa: number;
  valor: number;
}

// NOTA DE CRÉDITO
export interface NotaCreditoData {
  infoTributaria: InfoTributaria;
  infoNotaCredito: InfoNotaCredito;
  detalles: DetalleNotaCredito[];
  infoAdicional?: CampoAdicional[];
}

export interface InfoNotaCredito {
  fechaEmision: Date | string;
  dirEstablecimiento?: string;
  tipoIdentificacionComprador: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: string;
  rise?: string;
  codDocModificado: string;
  numDocModificado: string;
  fechaEmisionDocSustento: Date | string;
  totalSinImpuestos: number;
  valorModificacion: number;
  moneda?: string;
  totalConImpuestos: TotalImpuesto[];
  motivo: string;
}

export interface DetalleNotaCredito {
  codigoInterno?: string;
  codigoAdicional?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  precioTotalSinImpuesto: number;
  impuestos: Impuesto[];
}

// NOTA DE DÉBITO
export interface NotaDebitoData {
  infoTributaria: InfoTributaria;
  infoNotaDebito: InfoNotaDebito;
  motivos: MotivoNotaDebito[];
  infoAdicional?: CampoAdicional[];
}

export interface InfoNotaDebito {
  fechaEmision: Date | string;
  dirEstablecimiento?: string;
  tipoIdentificacionComprador: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: string;
  rise?: string;
  codDocModificado: string;
  numDocModificado: string;
  fechaEmisionDocSustento: Date | string;
  totalSinImpuestos: number;
  impuestos: ImpuestoNotaDebito[];
  valorTotal: number;
}

export interface ImpuestoNotaDebito {
  codigo: string;
  codigoPorcentaje: string;
  tarifa: number;
  baseImponible: number;
  valor: number;
}

export interface MotivoNotaDebito {
  razon: string;
  valor: number;
}

// COMPROBANTE DE RETENCIÓN
export interface ComprobanteRetencionData {
  infoTributaria: InfoTributaria;
  infoCompRetencion: InfoCompRetencion;
  impuestos: ImpuestoRetencion[];
  infoAdicional?: CampoAdicional[];
}

export interface InfoCompRetencion {
  fechaEmision: Date | string;
  dirEstablecimiento?: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: string;
  tipoIdentificacionSujetoRetenido: string;
  razonSocialSujetoRetenido: string;
  identificacionSujetoRetenido: string;
  periodoFiscal: string;
}

export interface ImpuestoRetencion {
  codigo: string;
  codigoRetencion: string;
  baseImponible: number;
  porcentajeRetener: number;
  valorRetenido: number;
  codDocSustento: string;
  numDocSustento?: string;
  fechaEmisionDocSustento: Date | string;
}

// GUÍA DE REMISIÓN
export interface GuiaRemisionData {
  infoTributaria: InfoTributaria;
  infoGuiaRemision: InfoGuiaRemision;
  destinatarios: Destinatario[];
  infoAdicional?: CampoAdicional[];
}

export interface InfoGuiaRemision {
  dirEstablecimiento?: string;
  dirPartida: string;
  razonSocialTransportista: string;
  tipoIdentificacionTransportista: string;
  rucTransportista: string;
  rise?: string;
  obligadoContabilidad?: string;
  contribuyenteEspecial?: string;
  fechaIniTransporte: Date | string;
  fechaFinTransporte: Date | string;
  placa: string;
}

export interface Destinatario {
  identificacionDestinatario: string;
  razonSocialDestinatario: string;
  dirDestinatario: string;
  motivoTraslado: string;
  docAduaneroUnico?: string;
  codEstabDestino?: string;
  ruta?: string;
  codDocSustento?: string;
  numDocSustento?: string;
  numAutDocSustento?: string;
  fechaEmisionDocSustento?: Date | string;
  detalles: DetalleGuiaRemision[];
}

export interface DetalleGuiaRemision {
  codigoInterno?: string;
  codigoAdicional?: string;
  descripcion: string;
  cantidad: number;
  detallesAdicionales?: DetalleAdicional[];
}

// LIQUIDACIÓN DE COMPRA
export interface LiquidacionCompraData {
  infoTributaria: InfoTributaria;
  infoLiquidacionCompra: InfoLiquidacionCompra;
  detalles: DetalleLiquidacionCompra[];
  infoAdicional?: CampoAdicional[];
}

export interface InfoLiquidacionCompra {
  fechaEmision: Date | string;
  dirEstablecimiento?: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: string;
  tipoIdentificacionProveedor: string;
  razonSocialProveedor: string;
  identificacionProveedor: string;
  direccionProveedor?: string;
  totalSinImpuestos: number;
  totalDescuento: number;
  totalConImpuestos: TotalImpuesto[];
  importeTotal: number;
  moneda?: string;
  pagos: Pago[];
}

export interface Pago {
  formaPago: string;
  total: number;
  plazo?: number;
  unidadTiempo?: string;
}

export interface DetalleLiquidacionCompra {
  codigoPrincipal?: string;
  codigoAuxiliar?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  precioTotalSinImpuesto: number;
  detallesAdicionales?: DetalleAdicional[];
  impuestos: Impuesto[];
}

// Respuestas del SRI
export interface RespuestaSRI {
  estado: string;
  comprobantes?: ComprobanteRespuesta[];
  autorizaciones?: Autorizacion[];
}

export interface ComprobanteRespuesta {
  claveAcceso: string;
  mensajes?: MensajeSRI[];
}

export interface MensajeSRI {
  identificador: string;
  mensaje: string;
  informacionAdicional?: string;
  tipo: string;
}

export interface Autorizacion {
  estado: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  ambiente?: string;
  comprobante?: string;
  mensajes?: MensajeSRI[];
}