import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { 
  FacturaData, 
  NotaCreditoData, 
  ComprobanteRetencionData,
  InfoTributaria 
} from './xml.types';
import { ClaveAccesoService } from './clave-acceso.service';

export class XMLBuilderService {
  private readonly claveAccesoService: ClaveAccesoService;

  constructor() {
    this.claveAccesoService = new ClaveAccesoService();
  }

  /**
   * Construye XML para Factura según versión especificada (corregido según XML referencia SRI)
   */
  async buildFactura(data: FacturaData, version: string = '2.1.0'): Promise<string> {
    const claveAcceso = this.claveAccesoService.generate({
      fechaEmision: data.infoFactura.fechaEmision,
      tipoComprobante: '01',
      ruc: data.infoTributaria.ruc,
      ambiente: data.infoTributaria.ambiente,
      establecimiento: data.infoTributaria.estab,
      puntoEmision: data.infoTributaria.ptoEmi,
      secuencial: data.infoTributaria.secuencial,
      tipoEmision: data.infoTributaria.tipoEmision
    });

    data.infoTributaria.claveAcceso = claveAcceso;

    const doc = create({ version: '1.0', encoding: 'UTF-8' });
    
    // Namespaces obligatorios según XML de referencia SRI
    const factura = doc.ele('factura', {
      'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:noNamespaceSchemaLocation': `factura_V${version}.xsd`,
      'id': 'comprobante',
      'version': version
    });

    // Info Tributaria
    this.buildInfoTributaria(factura, data.infoTributaria);

    // Info Factura
    const infoFactura = factura.ele('infoFactura');
    infoFactura.ele('fechaEmision').txt(this.formatDate(data.infoFactura.fechaEmision));
    
    if (data.infoFactura.dirEstablecimiento) {
      infoFactura.ele('dirEstablecimiento').txt(data.infoFactura.dirEstablecimiento);
    }
    
    if (data.infoFactura.contribuyenteEspecial) {
      infoFactura.ele('contribuyenteEspecial').txt(data.infoFactura.contribuyenteEspecial);
    }
    
    infoFactura.ele('obligadoContabilidad').txt(data.infoFactura.obligadoContabilidad);
    
    if (data.infoFactura.comercioExterior) {
      infoFactura.ele('comercioExterior').txt(data.infoFactura.comercioExterior);
    }
    
    if (data.infoFactura.incoTermFactura) {
      infoFactura.ele('incoTermFactura').txt(data.infoFactura.incoTermFactura);
    }
    
    if (data.infoFactura.lugarIncoTerm) {
      infoFactura.ele('lugarIncoTerm').txt(data.infoFactura.lugarIncoTerm);
    }
    
    if (data.infoFactura.paisOrigen) {
      infoFactura.ele('paisOrigen').txt(data.infoFactura.paisOrigen);
    }
    
    if (data.infoFactura.puertoEmbarque) {
      infoFactura.ele('puertoEmbarque').txt(data.infoFactura.puertoEmbarque);
    }
    
    if (data.infoFactura.puertoDestino) {
      infoFactura.ele('puertoDestino').txt(data.infoFactura.puertoDestino);
    }
    
    if (data.infoFactura.paisDestino) {
      infoFactura.ele('paisDestino').txt(data.infoFactura.paisDestino);
    }
    
    if (data.infoFactura.paisAdquisicion) {
      infoFactura.ele('paisAdquisicion').txt(data.infoFactura.paisAdquisicion);
    }

    infoFactura.ele('tipoIdentificacionComprador').txt(data.infoFactura.tipoIdentificacionComprador);
    
    if (data.infoFactura.guiaRemision) {
      infoFactura.ele('guiaRemision').txt(data.infoFactura.guiaRemision);
    }
    
    infoFactura.ele('razonSocialComprador').txt(data.infoFactura.razonSocialComprador);
    infoFactura.ele('identificacionComprador').txt(data.infoFactura.identificacionComprador);
    
    if (data.infoFactura.direccionComprador) {
      infoFactura.ele('direccionComprador').txt(data.infoFactura.direccionComprador);
    }
    
    infoFactura.ele('totalSinImpuestos').txt(this.formatMonto(data.infoFactura.totalSinImpuestos));
    
    if (data.infoFactura.totalSubsidio) {
      infoFactura.ele('totalSubsidio').txt(this.formatDecimal(data.infoFactura.totalSubsidio));
    }
    
    if (data.infoFactura.incoTermTotalSinImpuestos) {
      infoFactura.ele('incoTermTotalSinImpuestos').txt(data.infoFactura.incoTermTotalSinImpuestos);
    }
    
    infoFactura.ele('totalDescuento').txt(this.formatDecimal(data.infoFactura.totalDescuento));

    // Total con Impuestos
    const totalConImpuestos = infoFactura.ele('totalConImpuestos');
    for (const impuesto of data.infoFactura.totalConImpuestos) {
      const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
      totalImpuesto.ele('codigo').txt(impuesto.codigo);
      totalImpuesto.ele('codigoPorcentaje').txt(impuesto.codigoPorcentaje);
      
      if (impuesto.descuentoAdicional) {
        totalImpuesto.ele('descuentoAdicional').txt(this.formatDecimal(impuesto.descuentoAdicional));
      }
      
      totalImpuesto.ele('baseImponible').txt(this.formatMonto(impuesto.baseImponible));
      
      if (impuesto.tarifa) {
        totalImpuesto.ele('tarifa').txt(this.formatTarifa(impuesto.tarifa));
      }
      
      totalImpuesto.ele('valor').txt(this.formatMonto(impuesto.valor));
      
      if (impuesto.valorDevolucionIva) {
        totalImpuesto.ele('valorDevolucionIva').txt(this.formatDecimal(impuesto.valorDevolucionIva));
      }
    }

    // Compensaciones (si existen)
    if (data.infoFactura.compensaciones) {
      const compensaciones = infoFactura.ele('compensaciones');
      for (const comp of data.infoFactura.compensaciones) {
        const compensacion = compensaciones.ele('compensacion');
        compensacion.ele('codigo').txt(comp.codigo);
        compensacion.ele('tarifa').txt(this.formatDecimal(comp.tarifa));
        compensacion.ele('valor').txt(this.formatDecimal(comp.valor));
      }
    }

    infoFactura.ele('propina').txt(this.formatDecimal(data.infoFactura.propina || 0));
    
    if (data.infoFactura.fleteInternacional) {
      infoFactura.ele('fleteInternacional').txt(this.formatDecimal(data.infoFactura.fleteInternacional));
    }
    
    if (data.infoFactura.seguroInternacional) {
      infoFactura.ele('seguroInternacional').txt(this.formatDecimal(data.infoFactura.seguroInternacional));
    }
    
    if (data.infoFactura.gastosAduaneros) {
      infoFactura.ele('gastosAduaneros').txt(this.formatDecimal(data.infoFactura.gastosAduaneros));
    }
    
    if (data.infoFactura.gastosTransporteOtros) {
      infoFactura.ele('gastosTransporteOtros').txt(this.formatDecimal(data.infoFactura.gastosTransporteOtros));
    }
    
    infoFactura.ele('importeTotal').txt(this.formatDecimal(data.infoFactura.importeTotal));
    
    if (data.infoFactura.moneda) {
      infoFactura.ele('moneda').txt(data.infoFactura.moneda);
    }

    if (data.infoFactura.placa) {
      infoFactura.ele('placa').txt(data.infoFactura.placa);
    }

    // Pagos (si existen)
    if (data.infoFactura.pagos && data.infoFactura.pagos.length > 0) {
      const pagos = infoFactura.ele('pagos');
      for (const pago of data.infoFactura.pagos) {
        const pagoElement = pagos.ele('pago');
        pagoElement.ele('formaPago').txt(pago.formaPago);
        pagoElement.ele('total').txt(this.formatMonto(pago.total));
        if (pago.plazo) {
          pagoElement.ele('plazo').txt(this.formatDecimal(pago.plazo));
        }
        if (pago.unidadTiempo) {
          pagoElement.ele('unidadTiempo').txt(pago.unidadTiempo);
        }
      }
    }

    if (data.infoFactura.valorRetIva) {
      infoFactura.ele('valorRetIva').txt(this.formatMonto(data.infoFactura.valorRetIva));
    }

    if (data.infoFactura.valorRetRenta) {
      infoFactura.ele('valorRetRenta').txt(this.formatMonto(data.infoFactura.valorRetRenta));
    }

    // Plazos (si existen)
    if (data.infoFactura.plazos) {
      const plazos = infoFactura.ele('plazos');
      for (const plazo of data.infoFactura.plazos) {
        const pagoElement = plazos.ele('plazo');
        pagoElement.ele('plazo').txt(plazo.plazo);
        pagoElement.ele('unidadTiempo').txt(plazo.unidadTiempo);
      }
    }

    // Detalles
    const detalles = factura.ele('detalles');
    for (const detalle of data.detalles) {
      const det = detalles.ele('detalle');
      
      if (detalle.codigoPrincipal) {
        det.ele('codigoPrincipal').txt(detalle.codigoPrincipal);
      }
      
      if (detalle.codigoAuxiliar) {
        det.ele('codigoAuxiliar').txt(detalle.codigoAuxiliar);
      }
      
      det.ele('descripcion').txt(detalle.descripcion);
      
      if (detalle.unidadMedida) {
        det.ele('unidadMedida').txt(detalle.unidadMedida);
      }
      
      det.ele('cantidad').txt(this.formatCantidad(detalle.cantidad));
      det.ele('precioUnitario').txt(this.formatPrecioUnitario(detalle.precioUnitario));
      
      if (detalle.precioSinSubsidio) {
        det.ele('precioSinSubsidio').txt(this.formatPrecioUnitario(detalle.precioSinSubsidio));
      }
      
      det.ele('descuento').txt(this.formatMonto(detalle.descuento || 0));
      det.ele('precioTotalSinImpuesto').txt(this.formatMonto(detalle.precioTotalSinImpuesto));

      // Detalles adicionales
      if (detalle.detallesAdicionales && detalle.detallesAdicionales.length > 0) {
        const detallesAdicionalesEle = det.ele('detallesAdicionales');
        for (const adicional of detalle.detallesAdicionales) {
          detallesAdicionalesEle.ele('detAdicional', {
            nombre: adicional.nombre,
            valor: adicional.valor
          });
        }
      }

      // Impuestos
      const impuestos = det.ele('impuestos');
      for (const impuesto of detalle.impuestos) {
        const imp = impuestos.ele('impuesto');
        imp.ele('codigo').txt(impuesto.codigo);
        imp.ele('codigoPorcentaje').txt(impuesto.codigoPorcentaje);
        imp.ele('tarifa').txt(this.formatTarifa(impuesto.tarifa));
        imp.ele('baseImponible').txt(this.formatMonto(impuesto.baseImponible));
        imp.ele('valor').txt(this.formatMonto(impuesto.valor));
      }
    }

    // Retenciones (si existen)
    if (data.retenciones && data.retenciones.length > 0) {
      const retenciones = factura.ele('retenciones');
      for (const retencion of data.retenciones) {
        const ret = retenciones.ele('retencion');
        ret.ele('codigo').txt(retencion.codigo);
        ret.ele('codigoPorcentaje').txt(retencion.codigoPorcentaje);
        ret.ele('tarifa').txt(this.formatTarifa(retencion.tarifa));
        ret.ele('valor').txt(this.formatMonto(retencion.valor));
      }
    }

    // Información adicional
    if (data.infoAdicional && data.infoAdicional.length > 0) {
      const infoAdicional = factura.ele('infoAdicional');
      for (const campo of data.infoAdicional) {
        infoAdicional.ele('campoAdicional', { nombre: campo.nombre }).txt(campo.valor);
      }
    }

    // Generar XML string
    const xml = doc.end({ prettyPrint: false });
    return xml;
  }

  /**
   * Construye XML para Nota de Crédito
   */
  async buildNotaCredito(data: NotaCreditoData, version: string = '1.1.0'): Promise<string> {
    const claveAcceso = this.claveAccesoService.generate({
      fechaEmision: data.infoNotaCredito.fechaEmision,
      tipoComprobante: '04',
      ruc: data.infoTributaria.ruc,
      ambiente: data.infoTributaria.ambiente,
      establecimiento: data.infoTributaria.estab,
      puntoEmision: data.infoTributaria.ptoEmi,
      secuencial: data.infoTributaria.secuencial,
      tipoEmision: data.infoTributaria.tipoEmision
    });

    data.infoTributaria.claveAcceso = claveAcceso;

    const doc = create({ version: '1.0', encoding: 'UTF-8' });
    
    // Namespaces obligatorios según XML de referencia SRI para Nota de Crédito
    const notaCredito = doc.ele('notaCredito', {
      'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:noNamespaceSchemaLocation': `NotaCredito_V${version}.xsd`,
      'id': 'comprobante',
      'version': version
    });

    // Info Tributaria
    this.buildInfoTributaria(notaCredito, data.infoTributaria);

    // Info Nota Crédito
    const infoNotaCredito = notaCredito.ele('infoNotaCredito');
    infoNotaCredito.ele('fechaEmision').txt(this.formatDate(data.infoNotaCredito.fechaEmision));
    
    if (data.infoNotaCredito.dirEstablecimiento) {
      infoNotaCredito.ele('dirEstablecimiento').txt(data.infoNotaCredito.dirEstablecimiento);
    }
    
    infoNotaCredito.ele('tipoIdentificacionComprador').txt(data.infoNotaCredito.tipoIdentificacionComprador);
    infoNotaCredito.ele('razonSocialComprador').txt(data.infoNotaCredito.razonSocialComprador);
    infoNotaCredito.ele('identificacionComprador').txt(data.infoNotaCredito.identificacionComprador);
    
    if (data.infoNotaCredito.contribuyenteEspecial) {
      infoNotaCredito.ele('contribuyenteEspecial').txt(data.infoNotaCredito.contribuyenteEspecial);
    }
    
    infoNotaCredito.ele('obligadoContabilidad').txt(data.infoNotaCredito.obligadoContabilidad);
    
    if (data.infoNotaCredito.rise) {
      infoNotaCredito.ele('rise').txt(data.infoNotaCredito.rise);
    }
    
    infoNotaCredito.ele('codDocModificado').txt(data.infoNotaCredito.codDocModificado);
    infoNotaCredito.ele('numDocModificado').txt(data.infoNotaCredito.numDocModificado);
    infoNotaCredito.ele('fechaEmisionDocSustento').txt(this.formatDate(data.infoNotaCredito.fechaEmisionDocSustento));
    infoNotaCredito.ele('totalSinImpuestos').txt(this.formatMonto(data.infoNotaCredito.totalSinImpuestos));
    infoNotaCredito.ele('valorModificacion').txt(this.formatMonto(data.infoNotaCredito.valorModificacion));
    
    if (data.infoNotaCredito.moneda) {
      infoNotaCredito.ele('moneda').txt(data.infoNotaCredito.moneda);
    }

    // Total con Impuestos
    const totalConImpuestos = infoNotaCredito.ele('totalConImpuestos');
    for (const impuesto of data.infoNotaCredito.totalConImpuestos) {
      const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
      totalImpuesto.ele('codigo').txt(impuesto.codigo);
      totalImpuesto.ele('codigoPorcentaje').txt(impuesto.codigoPorcentaje);
      totalImpuesto.ele('baseImponible').txt(this.formatMonto(impuesto.baseImponible));
      totalImpuesto.ele('valor').txt(this.formatMonto(impuesto.valor));
    }

    infoNotaCredito.ele('motivo').txt(data.infoNotaCredito.motivo);

    // Detalles
    const detalles = notaCredito.ele('detalles');
    for (const detalle of data.detalles) {
      const det = detalles.ele('detalle');
      
      if (detalle.codigoInterno) {
        det.ele('codigoInterno').txt(detalle.codigoInterno);
      }
      
      if (detalle.codigoAdicional) {
        det.ele('codigoAdicional').txt(detalle.codigoAdicional);
      }
      
      det.ele('descripcion').txt(detalle.descripcion);
      det.ele('cantidad').txt(this.formatCantidad(detalle.cantidad));
      det.ele('precioUnitario').txt(this.formatPrecioUnitario(detalle.precioUnitario));
      det.ele('descuento').txt(this.formatMonto(detalle.descuento || 0));
      det.ele('precioTotalSinImpuesto').txt(this.formatMonto(detalle.precioTotalSinImpuesto));

      // Impuestos
      const impuestos = det.ele('impuestos');
      for (const impuesto of detalle.impuestos) {
        const imp = impuestos.ele('impuesto');
        imp.ele('codigo').txt(impuesto.codigo);
        imp.ele('codigoPorcentaje').txt(impuesto.codigoPorcentaje);
        imp.ele('tarifa').txt(this.formatTarifa(impuesto.tarifa));
        imp.ele('baseImponible').txt(this.formatMonto(impuesto.baseImponible));
        imp.ele('valor').txt(this.formatMonto(impuesto.valor));
      }
    }

    // Información adicional
    if (data.infoAdicional && data.infoAdicional.length > 0) {
      const infoAdicional = notaCredito.ele('infoAdicional');
      for (const campo of data.infoAdicional) {
        infoAdicional.ele('campoAdicional', { nombre: campo.nombre }).txt(campo.valor);
      }
    }

    const xml = doc.end({ prettyPrint: false });
    return xml;
  }

  /**
   * Construye XML para Comprobante de Retención
   */
  async buildComprobanteRetencion(data: ComprobanteRetencionData, version: string = '1.0.0'): Promise<string> {
    const claveAcceso = this.claveAccesoService.generate({
      fechaEmision: data.infoCompRetencion.fechaEmision,
      tipoComprobante: '07',
      ruc: data.infoTributaria.ruc,
      ambiente: data.infoTributaria.ambiente,
      establecimiento: data.infoTributaria.estab,
      puntoEmision: data.infoTributaria.ptoEmi,
      secuencial: data.infoTributaria.secuencial,
      tipoEmision: data.infoTributaria.tipoEmision
    });

    data.infoTributaria.claveAcceso = claveAcceso;

    const doc = create({ version: '1.0', encoding: 'UTF-8', standalone: false });
    
    const comprobanteRetencion = doc.ele('comprobanteRetencion', {
      id: 'comprobante',
      version: version
    });

    // Info Tributaria
    this.buildInfoTributaria(comprobanteRetencion, data.infoTributaria);

    // Info Comprobante Retención
    const infoCompRetencion = comprobanteRetencion.ele('infoCompRetencion');
    infoCompRetencion.ele('fechaEmision').txt(this.formatDate(data.infoCompRetencion.fechaEmision));
    
    if (data.infoCompRetencion.dirEstablecimiento) {
      infoCompRetencion.ele('dirEstablecimiento').txt(data.infoCompRetencion.dirEstablecimiento);
    }
    
    if (data.infoCompRetencion.contribuyenteEspecial) {
      infoCompRetencion.ele('contribuyenteEspecial').txt(data.infoCompRetencion.contribuyenteEspecial);
    }
    
    infoCompRetencion.ele('obligadoContabilidad').txt(data.infoCompRetencion.obligadoContabilidad);
    infoCompRetencion.ele('tipoIdentificacionSujetoRetenido').txt(data.infoCompRetencion.tipoIdentificacionSujetoRetenido);
    infoCompRetencion.ele('razonSocialSujetoRetenido').txt(data.infoCompRetencion.razonSocialSujetoRetenido);
    infoCompRetencion.ele('identificacionSujetoRetenido').txt(data.infoCompRetencion.identificacionSujetoRetenido);
    infoCompRetencion.ele('periodoFiscal').txt(data.infoCompRetencion.periodoFiscal);

    // Impuestos
    const impuestos = comprobanteRetencion.ele('impuestos');
    for (const impuesto of data.impuestos) {
      const imp = impuestos.ele('impuesto');
      imp.ele('codigo').txt(impuesto.codigo);
      imp.ele('codigoRetencion').txt(impuesto.codigoRetencion);
      imp.ele('baseImponible').txt(this.formatMonto(impuesto.baseImponible));
      imp.ele('porcentajeRetener').txt(this.formatTarifa(impuesto.porcentajeRetener));
      imp.ele('valorRetenido').txt(this.formatMonto(impuesto.valorRetenido));
      imp.ele('codDocSustento').txt(impuesto.codDocSustento);
      
      if (impuesto.numDocSustento) {
        imp.ele('numDocSustento').txt(impuesto.numDocSustento);
      }
      
      imp.ele('fechaEmisionDocSustento').txt(this.formatDate(impuesto.fechaEmisionDocSustento));
    }

    // Información adicional
    if (data.infoAdicional && data.infoAdicional.length > 0) {
      const infoAdicional = comprobanteRetencion.ele('infoAdicional');
      for (const campo of data.infoAdicional) {
        infoAdicional.ele('campoAdicional', { nombre: campo.nombre }).txt(campo.valor);
      }
    }

    const xml = doc.end({ prettyPrint: false });
    return xml;
  }

  /**
   * Construye el nodo InfoTributaria común a todos los comprobantes
   */
  private buildInfoTributaria(parent: XMLBuilder, info: InfoTributaria): void {
    const infoTributaria = parent.ele('infoTributaria');
    
    infoTributaria.ele('ambiente').txt(info.ambiente.toString());
    infoTributaria.ele('tipoEmision').txt(info.tipoEmision.toString());
    infoTributaria.ele('razonSocial').txt(info.razonSocial);
    
    if (info.nombreComercial) {
      infoTributaria.ele('nombreComercial').txt(info.nombreComercial);
    }
    
    infoTributaria.ele('ruc').txt(info.ruc);
    infoTributaria.ele('claveAcceso').txt(info.claveAcceso!);
    infoTributaria.ele('codDoc').txt(info.codDoc);
    infoTributaria.ele('estab').txt(info.estab);
    infoTributaria.ele('ptoEmi').txt(info.ptoEmi);
    infoTributaria.ele('secuencial').txt(info.secuencial);
    infoTributaria.ele('dirMatriz').txt(info.dirMatriz);
    
    if (info.agenteRetencion) {
      infoTributaria.ele('agenteRetencion').txt(info.agenteRetencion);
    }
    
    if (info.contribuyenteRimpe) {
      infoTributaria.ele('contribuyenteRimpe').txt(info.contribuyenteRimpe);
    }
  }

  /**
   * Formatea una fecha al formato requerido por SRI (dd/mm/yyyy)
   */
  private formatDate(date: Date | string): string {
    let d: Date;
    
    if (typeof date === 'string') {
      // Si es string, intentar parsear diferentes formatos
      if (date.includes('/')) {
        // Formato dd/mm/yyyy
        const parts = date.split('/');
        if (parts.length === 3) {
          const dia = parseInt(parts[0]);
          const mes = parseInt(parts[1]) - 1; // Mes es 0-indexed
          const año = parseInt(parts[2]);
          d = new Date(año, mes, dia);
        } else {
          d = new Date(date);
        }
      } else {
        d = new Date(date);
      }
    } else {
      d = date;
    }
    
    // Verificar que la fecha es válida
    if (isNaN(d.getTime())) {
      throw new Error(`Fecha inválida en XMLBuilder: ${date}`);
    }
    
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Formatea cantidades con exactamente 6 decimales (según XML referencia SRI)
   */
  private formatCantidad(value: number): string {
    return value.toFixed(6);
  }

  /**
   * Formatea precios unitarios con exactamente 6 decimales (según XML referencia SRI)
   */
  private formatPrecioUnitario(value: number): string {
    return value.toFixed(6);
  }

  /**
   * Formatea montos/valores con exactamente 2 decimales (según XML referencia SRI)
   */
  private formatMonto(value: number): string {
    return value.toFixed(2);
  }

  /**
   * Formatea tarifas con exactamente 2 decimales (según XML referencia SRI)
   */
  private formatTarifa(value: number): string {
    return value.toFixed(2);
  }

  /**
   * Formatea un número decimal según especificaciones SRI (DEPRECATED - usar métodos específicos)
   */
  private formatDecimal(value: number, decimals: number = 2): string {
    return value.toFixed(decimals);
  }
}