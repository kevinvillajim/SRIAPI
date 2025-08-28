import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';

/**
 * Interfaz para los datos de una factura
 */
export interface InvoiceData {
    // Info Tributaria
    ambiente: '1' | '2'; // 1: Pruebas, 2: Producción
    tipoEmision: '1'; // 1: Normal
    razonSocial: string;
    nombreComercial?: string;
    ruc: string;
    claveAcceso: string;
    codDoc: '01'; // 01: Factura
    estab: string; // 3 dígitos
    ptoEmi: string; // 3 dígitos
    secuencial: string; // 9 dígitos
    dirMatriz: string;
    
    // Info Factura
    fechaEmision: string; // DD/MM/YYYY
    obligadoContabilidad: 'SI' | 'NO';
    tipoIdentificacionComprador: string;
    razonSocialComprador: string;
    identificacionComprador: string;
    totalSinImpuestos: number;
    totalDescuento: number;
    totalConImpuestos: TotalImpuesto[];
    propina: number;
    importeTotal: number;
    moneda: string;
    pagos: Pago[];
    
    // Detalles
    detalles: Detalle[];
    
    // Info Adicional
    infoAdicional?: CampoAdicional[];
}

export interface TotalImpuesto {
    codigo: string;
    codigoPorcentaje: string;
    baseImponible: number;
    tarifa: number;
    valor: number;
}

export interface Pago {
    formaPago: string;
    total: number;
    plazo?: number;
    unidadTiempo?: string;
}

export interface Detalle {
    codigoPrincipal?: string;
    codigoAuxiliar?: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    precioTotalSinImpuesto: number;
    impuestos: DetalleImpuesto[];
}

export interface DetalleImpuesto {
    codigo: string;
    codigoPorcentaje: string;
    tarifa: number;
    baseImponible: number;
    valor: number;
}

export interface CampoAdicional {
    nombre: string;
    valor: string;
}

/**
 * Clase para construir XML de facturas según especificaciones del SRI Ecuador
 */
export class InvoiceXMLBuilder {
    
    /**
     * Construye el XML de una factura
     * @param data Datos de la factura
     * @returns XML string
     */
    public buildInvoiceXML(data: InvoiceData): string {
        const doc = create({ encoding: 'UTF-8' })
            .ele('factura', { 
                id: 'comprobante',
                version: '1.1.0' 
            });
        
        // Info Tributaria
        this.buildInfoTributaria(doc, data);
        
        // Info Factura
        this.buildInfoFactura(doc, data);
        
        // Detalles
        this.buildDetalles(doc, data.detalles);
        
        // Info Adicional
        if (data.infoAdicional && data.infoAdicional.length > 0) {
            this.buildInfoAdicional(doc, data.infoAdicional);
        }
        
        // Convertir a string con formato
        return doc.end({ prettyPrint: true });
    }
    
    /**
     * Construye la sección infoTributaria
     */
    private buildInfoTributaria(doc: XMLBuilder, data: InvoiceData): void {
        const infoTrib = doc.ele('infoTributaria');
        
        infoTrib.ele('ambiente').txt(data.ambiente);
        infoTrib.ele('tipoEmision').txt(data.tipoEmision);
        infoTrib.ele('razonSocial').txt(data.razonSocial);
        
        if (data.nombreComercial) {
            infoTrib.ele('nombreComercial').txt(data.nombreComercial);
        }
        
        infoTrib.ele('ruc').txt(data.ruc);
        infoTrib.ele('claveAcceso').txt(data.claveAcceso);
        infoTrib.ele('codDoc').txt(data.codDoc);
        infoTrib.ele('estab').txt(data.estab);
        infoTrib.ele('ptoEmi').txt(data.ptoEmi);
        infoTrib.ele('secuencial').txt(data.secuencial);
        infoTrib.ele('dirMatriz').txt(data.dirMatriz);
    }
    
    /**
     * Construye la sección infoFactura
     */
    private buildInfoFactura(doc: XMLBuilder, data: InvoiceData): void {
        const infoFact = doc.ele('infoFactura');
        
        infoFact.ele('fechaEmision').txt(data.fechaEmision);
        infoFact.ele('obligadoContabilidad').txt(data.obligadoContabilidad);
        infoFact.ele('tipoIdentificacionComprador').txt(data.tipoIdentificacionComprador);
        infoFact.ele('razonSocialComprador').txt(data.razonSocialComprador);
        infoFact.ele('identificacionComprador').txt(data.identificacionComprador);
        infoFact.ele('totalSinImpuestos').txt(this.formatNumber(data.totalSinImpuestos));
        infoFact.ele('totalDescuento').txt(this.formatNumber(data.totalDescuento));
        
        // Total con impuestos
        const totalConImp = infoFact.ele('totalConImpuestos');
        data.totalConImpuestos.forEach(impuesto => {
            const totalImp = totalConImp.ele('totalImpuesto');
            totalImp.ele('codigo').txt(impuesto.codigo);
            totalImp.ele('codigoPorcentaje').txt(impuesto.codigoPorcentaje);
            totalImp.ele('baseImponible').txt(this.formatNumber(impuesto.baseImponible));
            totalImp.ele('tarifa').txt(this.formatNumber(impuesto.tarifa));
            totalImp.ele('valor').txt(this.formatNumber(impuesto.valor));
        });
        
        infoFact.ele('propina').txt(this.formatNumber(data.propina));
        infoFact.ele('importeTotal').txt(this.formatNumber(data.importeTotal));
        infoFact.ele('moneda').txt(data.moneda);
        
        // Pagos
        const pagosEle = infoFact.ele('pagos');
        data.pagos.forEach(pago => {
            const pagoEle = pagosEle.ele('pago');
            pagoEle.ele('formaPago').txt(pago.formaPago);
            pagoEle.ele('total').txt(this.formatNumber(pago.total));
            if (pago.unidadTiempo) {
                pagoEle.ele('unidadTiempo').txt(pago.unidadTiempo);
            }
            if (pago.plazo) {
                pagoEle.ele('plazo').txt(pago.plazo.toString());
            }
        });
    }
    
    /**
     * Construye la sección detalles
     */
    private buildDetalles(doc: XMLBuilder, detalles: Detalle[]): void {
        const detallesEle = doc.ele('detalles');
        
        detalles.forEach(detalle => {
            const detalleEle = detallesEle.ele('detalle');
            
            if (detalle.codigoPrincipal) {
                detalleEle.ele('codigoPrincipal').txt(detalle.codigoPrincipal);
            }
            if (detalle.codigoAuxiliar) {
                detalleEle.ele('codigoAuxiliar').txt(detalle.codigoAuxiliar);
            }
            
            detalleEle.ele('descripcion').txt(detalle.descripcion);
            detalleEle.ele('cantidad').txt(this.formatNumber(detalle.cantidad, 6));
            detalleEle.ele('precioUnitario').txt(this.formatNumber(detalle.precioUnitario, 6));
            detalleEle.ele('descuento').txt(this.formatNumber(detalle.descuento));
            detalleEle.ele('precioTotalSinImpuesto').txt(this.formatNumber(detalle.precioTotalSinImpuesto));
            
            // Impuestos del detalle
            const impuestosEle = detalleEle.ele('impuestos');
            detalle.impuestos.forEach(impuesto => {
                const impuestoEle = impuestosEle.ele('impuesto');
                impuestoEle.ele('codigo').txt(impuesto.codigo);
                impuestoEle.ele('codigoPorcentaje').txt(impuesto.codigoPorcentaje);
                impuestoEle.ele('tarifa').txt(this.formatNumber(impuesto.tarifa));
                impuestoEle.ele('baseImponible').txt(this.formatNumber(impuesto.baseImponible));
                impuestoEle.ele('valor').txt(this.formatNumber(impuesto.valor));
            });
        });
    }
    
    /**
     * Construye la sección infoAdicional
     */
    private buildInfoAdicional(doc: XMLBuilder, campos: CampoAdicional[]): void {
        const infoAd = doc.ele('infoAdicional');
        
        campos.forEach(campo => {
            infoAd.ele('campoAdicional', { nombre: campo.nombre }).txt(campo.valor);
        });
    }
    
    /**
     * Formatea un número según requerimientos del SRI
     */
    private formatNumber(value: number, decimals: number = 2): string {
        return value.toFixed(decimals);
    }
    
    /**
     * Genera la clave de acceso según el algoritmo del SRI
     */
    public generateClaveAcceso(params: {
        fechaEmision: string; // DDMMYYYY
        tipoComprobante: string; // 01 para factura
        ruc: string;
        ambiente: string;
        serie: string; // estab + ptoEmi (6 dígitos)
        numeroComprobante: string; // 9 dígitos
        codigoNumerico?: string; // 8 dígitos
        tipoEmision: string;
    }): string {
        // Si no se proporciona código numérico, generar uno aleatorio
        const codigoNumerico = params.codigoNumerico || this.generateCodigoNumerico();
        
        // Construir la clave de 48 dígitos
        const clave48 = 
            params.fechaEmision + 
            params.tipoComprobante +
            params.ruc +
            params.ambiente +
            params.serie +
            params.numeroComprobante +
            codigoNumerico +
            params.tipoEmision;
        
        // Calcular dígito verificador usando módulo 11
        const digitoVerificador = this.calcularModulo11(clave48);
        
        return clave48 + digitoVerificador;
    }
    
    /**
     * Genera código numérico aleatorio de 8 dígitos
     */
    private generateCodigoNumerico(): string {
        return Math.floor(10000000 + Math.random() * 90000000).toString();
    }
    
    /**
     * Calcula el dígito verificador usando módulo 11
     */
    private calcularModulo11(numero: string): string {
        const factores = [2, 3, 4, 5, 6, 7];
        let suma = 0;
        let factorIndex = 0;
        
        // Recorrer de derecha a izquierda
        for (let i = numero.length - 1; i >= 0; i--) {
            suma += parseInt(numero[i]) * factores[factorIndex];
            factorIndex = (factorIndex + 1) % factores.length;
        }
        
        const modulo = suma % 11;
        const digitoVerificador = 11 - modulo;
        
        if (digitoVerificador === 11) return '0';
        if (digitoVerificador === 10) return '1';
        
        return digitoVerificador.toString();
    }
}