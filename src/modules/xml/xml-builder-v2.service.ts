import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { 
  FacturaData, 
  NotaCreditoData,
  InfoTributaria
} from './xml.types';
import { ClaveAccesoService } from './clave-acceso.service';

/**
 * XMLBuilderService V2 - Genera XMLs con estructura exacta según referencia SRI
 * Incluye soporte para pagos y formato con indentación
 */
export class XMLBuilderServiceV2 {
  private readonly claveAccesoService: ClaveAccesoService;

  constructor() {
    this.claveAccesoService = new ClaveAccesoService();
  }

  /**
   * Construye XML para Factura según versión especificada
   * Formato con indentación y estructura completa
   */
  async buildFactura(data: FacturaData, version: string = '1.1.0'): Promise<string> {
    // Generar clave de acceso
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

    // Crear documento XML con configuración de formato
    const doc = create({ version: '1.0', encoding: 'UTF-8' });
    
    const factura = doc.ele('factura', {
      id: 'comprobante',
      version: version
    });

    // Info Tributaria
    const infoTributaria = factura.ele('infoTributaria');
    infoTributaria.ele('ambiente').txt(data.infoTributaria.ambiente.toString());
    infoTributaria.ele('tipoEmision').txt(data.infoTributaria.tipoEmision.toString());
    infoTributaria.ele('razonSocial').txt(data.infoTributaria.razonSocial);
    
    if (data.infoTributaria.nombreComercial) {
      infoTributaria.ele('nombreComercial').txt(data.infoTributaria.nombreComercial);
    }
    
    infoTributaria.ele('ruc').txt(data.infoTributaria.ruc);
    infoTributaria.ele('claveAcceso').txt(claveAcceso);
    infoTributaria.ele('codDoc').txt(data.infoTributaria.codDoc);
    infoTributaria.ele('estab').txt(data.infoTributaria.estab);
    infoTributaria.ele('ptoEmi').txt(data.infoTributaria.ptoEmi);
    infoTributaria.ele('secuencial').txt(data.infoTributaria.secuencial);
    infoTributaria.ele('dirMatriz').txt(data.infoTributaria.dirMatriz);
    
    if (data.infoTributaria.agenteRetencion) {
      infoTributaria.ele('agenteRetencion').txt(data.infoTributaria.agenteRetencion);
    }
    
    if (data.infoTributaria.contribuyenteRimpe) {
      infoTributaria.ele('contribuyenteRimpe').txt(data.infoTributaria.contribuyenteRimpe);
    }

    // Info Factura
    const infoFactura = factura.ele('infoFactura');
    infoFactura.ele('fechaEmision').txt(this.formatDate(data.infoFactura.fechaEmision));
    
    if (data.infoFactura.dirEstablecimiento) {
      infoFactura.ele('dirEstablecimiento').txt(data.infoFactura.dirEstablecimiento);
    }
    
    if (data.infoFactura.contribuyenteEspecial) {
      infoFactura.ele('contribuyenteEspecial').txt(data.infoFactura.contribuyenteEspecial);
    }
    
    // Campo obligadoContabilidad es opcional
    if (data.infoFactura.obligadoContabilidad) {
      infoFactura.ele('obligadoContabilidad').txt(data.infoFactura.obligadoContabilidad);
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
    
    infoFactura.ele('totalSinImpuestos').txt(this.formatDecimal(data.infoFactura.totalSinImpuestos));
    infoFactura.ele('totalDescuento').txt(this.formatDecimal(data.infoFactura.totalDescuento));

    // Total con Impuestos - Con estructura completa incluyendo tarifa
    const totalConImpuestos = infoFactura.ele('totalConImpuestos');
    for (const impuesto of data.infoFactura.totalConImpuestos) {
      const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
      totalImpuesto.ele('codigo').txt(impuesto.codigo);
      totalImpuesto.ele('codigoPorcentaje').txt(impuesto.codigoPorcentaje);
      totalImpuesto.ele('baseImponible').txt(this.formatDecimal(impuesto.baseImponible));
      
      // Incluir tarifa siempre
      if (impuesto.tarifa !== undefined) {
        totalImpuesto.ele('tarifa').txt(this.formatDecimal(impuesto.tarifa));
      } else {
        // Calcular tarifa basada en el código
        const tarifa = this.getTarifaPorCodigo(impuesto.codigoPorcentaje);
        totalImpuesto.ele('tarifa').txt(this.formatDecimal(tarifa));
      }
      
      totalImpuesto.ele('valor').txt(this.formatDecimal(impuesto.valor));
    }

    infoFactura.ele('propina').txt(this.formatDecimal(data.infoFactura.propina || 0));
    infoFactura.ele('importeTotal').txt(this.formatDecimal(data.infoFactura.importeTotal));
    infoFactura.ele('moneda').txt(data.infoFactura.moneda || 'DOLAR');

    // Pagos - Campo importante que estaba faltando
    if (data.infoFactura.plazos && data.infoFactura.plazos.length > 0) {
      const pagos = infoFactura.ele('pagos');
      for (const plazo of data.infoFactura.plazos) {
        const pago = pagos.ele('pago');
        pago.ele('formaPago').txt('01'); // Sin utilización del sistema financiero por defecto
        pago.ele('total').txt(this.formatDecimal(data.infoFactura.importeTotal));
        pago.ele('plazo').txt(plazo.plazo);
        pago.ele('unidadTiempo').txt(plazo.unidadTiempo);
      }
    } else {
      // Agregar pago por defecto si no existe
      const pagos = infoFactura.ele('pagos');
      const pago = pagos.ele('pago');
      pago.ele('formaPago').txt('01'); // Sin utilización del sistema financiero
      pago.ele('total').txt(this.formatDecimal(data.infoFactura.importeTotal));
      pago.ele('unidadTiempo').txt('dias');
    }

    // Detalles
    const detalles = factura.ele('detalles');
    for (const det of data.detalles) {
      const detalle = detalles.ele('detalle');
      
      if (det.codigoPrincipal) {
        detalle.ele('codigoPrincipal').txt(det.codigoPrincipal);
      }
      
      if (det.codigoAuxiliar) {
        detalle.ele('codigoAuxiliar').txt(det.codigoAuxiliar);
      }
      
      detalle.ele('descripcion').txt(det.descripcion);
      
      if (det.unidadMedida) {
        detalle.ele('unidadMedida').txt(det.unidadMedida);
      }
      
      detalle.ele('cantidad').txt(this.formatDecimal(det.cantidad, 6));
      detalle.ele('precioUnitario').txt(this.formatDecimal(det.precioUnitario, 6));
      detalle.ele('descuento').txt(this.formatDecimal(det.descuento || 0));
      detalle.ele('precioTotalSinImpuesto').txt(this.formatDecimal(det.precioTotalSinImpuesto));

      // Detalles adicionales
      if (det.detallesAdicionales && det.detallesAdicionales.length > 0) {
        const detallesAdicionales = detalle.ele('detallesAdicionales');
        for (const adicional of det.detallesAdicionales) {
          detallesAdicionales.ele('detAdicional', {
            nombre: adicional.nombre,
            valor: adicional.valor
          });
        }
      }

      // Impuestos con estructura completa
      const impuestos = detalle.ele('impuestos');
      for (const imp of det.impuestos) {
        const impuesto = impuestos.ele('impuesto');
        impuesto.ele('codigo').txt(imp.codigo);
        impuesto.ele('codigoPorcentaje').txt(imp.codigoPorcentaje);
        impuesto.ele('tarifa').txt(this.formatDecimal(imp.tarifa));
        impuesto.ele('baseImponible').txt(this.formatDecimal(imp.baseImponible));
        impuesto.ele('valor').txt(this.formatDecimal(imp.valor));
      }
    }

    // Información Adicional
    if (data.infoAdicional && data.infoAdicional.length > 0) {
      const infoAdicional = factura.ele('infoAdicional');
      for (const campo of data.infoAdicional) {
        infoAdicional.ele('campoAdicional', { nombre: campo.nombre }).txt(campo.valor);
      }
    }

    // Generar XML con formato (indentación)
    return doc.end({ 
      prettyPrint: true,
      indent: '  ',
      newline: '\n',
      width: 0
    });
  }

  /**
   * Formatea fecha al formato SRI DD/MM/YYYY
   */
  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Formatea decimal con el número de decimales especificado
   */
  private formatDecimal(value: number | undefined, decimals: number = 2): string {
    if (value === undefined || value === null) return '0.00';
    return value.toFixed(decimals);
  }

  /**
   * Obtiene la tarifa según el código de porcentaje
   */
  private getTarifaPorCodigo(codigoPorcentaje: string): number {
    const tarifas: { [key: string]: number } = {
      '0': 0,    // IVA 0%
      '2': 12,   // IVA 12%
      '3': 14,   // IVA 14%
      '4': 15,   // IVA 15%
      '6': 0,    // No objeto de impuesto
      '7': 0,    // Exento de IVA
      '8': 8     // IVA 8%
    };
    return tarifas[codigoPorcentaje] || 0;
  }

  /**
   * Construye XML para Nota de Crédito
   */
  async buildNotaCredito(data: NotaCreditoData, version: string = '1.1.0'): Promise<string> {
    // Generar clave de acceso
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
    
    const notaCredito = doc.ele('notaCredito', {
      id: 'comprobante',
      version: version
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
    
    infoNotaCredito.ele('codDocModificado').txt(data.infoNotaCredito.codDocModificado);
    infoNotaCredito.ele('numDocModificado').txt(data.infoNotaCredito.numDocModificado);
    infoNotaCredito.ele('fechaEmisionDocSustento').txt(this.formatDate(data.infoNotaCredito.fechaEmisionDocSustento));
    infoNotaCredito.ele('totalSinImpuestos').txt(this.formatDecimal(data.infoNotaCredito.totalSinImpuestos));
    infoNotaCredito.ele('valorModificacion').txt(this.formatDecimal(data.infoNotaCredito.valorModificacion));
    infoNotaCredito.ele('moneda').txt(data.infoNotaCredito.moneda || 'DOLAR');

    // Total con Impuestos
    const totalConImpuestos = infoNotaCredito.ele('totalConImpuestos');
    for (const impuesto of data.infoNotaCredito.totalConImpuestos) {
      const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
      totalImpuesto.ele('codigo').txt(impuesto.codigo);
      totalImpuesto.ele('codigoPorcentaje').txt(impuesto.codigoPorcentaje);
      totalImpuesto.ele('baseImponible').txt(this.formatDecimal(impuesto.baseImponible));
      
      if (impuesto.tarifa !== undefined) {
        totalImpuesto.ele('tarifa').txt(this.formatDecimal(impuesto.tarifa));
      } else {
        const tarifa = this.getTarifaPorCodigo(impuesto.codigoPorcentaje);
        totalImpuesto.ele('tarifa').txt(this.formatDecimal(tarifa));
      }
      
      totalImpuesto.ele('valor').txt(this.formatDecimal(impuesto.valor));
    }

    infoNotaCredito.ele('motivo').txt(data.infoNotaCredito.motivo);

    // Detalles
    const detalles = notaCredito.ele('detalles');
    for (const det of data.detalles) {
      const detalle = detalles.ele('detalle');
      
      if (det.codigoInterno) {
        detalle.ele('codigoInterno').txt(det.codigoInterno);
      }
      
      if (det.codigoAdicional) {
        detalle.ele('codigoAdicional').txt(det.codigoAdicional);
      }
      
      detalle.ele('descripcion').txt(det.descripcion);
      detalle.ele('cantidad').txt(this.formatDecimal(det.cantidad, 6));
      detalle.ele('precioUnitario').txt(this.formatDecimal(det.precioUnitario, 6));
      detalle.ele('descuento').txt(this.formatDecimal(det.descuento || 0));
      detalle.ele('precioTotalSinImpuesto').txt(this.formatDecimal(det.precioTotalSinImpuesto));

      // Impuestos
      const impuestos = detalle.ele('impuestos');
      for (const imp of det.impuestos) {
        const impuesto = impuestos.ele('impuesto');
        impuesto.ele('codigo').txt(imp.codigo);
        impuesto.ele('codigoPorcentaje').txt(imp.codigoPorcentaje);
        impuesto.ele('tarifa').txt(this.formatDecimal(imp.tarifa));
        impuesto.ele('baseImponible').txt(this.formatDecimal(imp.baseImponible));
        impuesto.ele('valor').txt(this.formatDecimal(imp.valor));
      }
    }

    // Información Adicional
    if (data.infoAdicional && data.infoAdicional.length > 0) {
      const infoAdicional = notaCredito.ele('infoAdicional');
      for (const campo of data.infoAdicional) {
        infoAdicional.ele('campoAdicional', { nombre: campo.nombre }).txt(campo.valor);
      }
    }

    return doc.end({ 
      prettyPrint: true,
      indent: '  ',
      newline: '\n',
      width: 0
    });
  }

  /**
   * Construye la sección InfoTributaria común a todos los documentos
   */
  private buildInfoTributaria(parent: XMLBuilder, data: InfoTributaria): void {
    const infoTributaria = parent.ele('infoTributaria');
    
    infoTributaria.ele('ambiente').txt(data.ambiente.toString());
    infoTributaria.ele('tipoEmision').txt(data.tipoEmision.toString());
    infoTributaria.ele('razonSocial').txt(data.razonSocial);
    
    if (data.nombreComercial) {
      infoTributaria.ele('nombreComercial').txt(data.nombreComercial);
    }
    
    infoTributaria.ele('ruc').txt(data.ruc);
    infoTributaria.ele('claveAcceso').txt(data.claveAcceso!);
    infoTributaria.ele('codDoc').txt(data.codDoc);
    infoTributaria.ele('estab').txt(data.estab);
    infoTributaria.ele('ptoEmi').txt(data.ptoEmi);
    infoTributaria.ele('secuencial').txt(data.secuencial);
    infoTributaria.ele('dirMatriz').txt(data.dirMatriz);
    
    if (data.agenteRetencion) {
      infoTributaria.ele('agenteRetencion').txt(data.agenteRetencion);
    }
    
    if (data.contribuyenteRimpe) {
      infoTributaria.ele('contribuyenteRimpe').txt(data.contribuyenteRimpe);
    }
  }
}