import * as fs from 'fs';
import * as path from 'path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { FacturaData, NotaCreditoData } from '../xml/xml.types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface XSDValidationOptions {
  validatePatterns?: boolean;
  validateRanges?: boolean;
  validateConditionalFields?: boolean;
  strict?: boolean;
}

/**
 * Servicio de validación XSD estricta según esquemas oficiales SRI
 */
export class XSDValidatorService {
  private readonly xsdBasePath: string;
  
  constructor(xsdBasePath?: string) {
    this.xsdBasePath = xsdBasePath || path.join(process.cwd(), 'xsd');
  }

  /**
   * Valida una factura contra el esquema XSD correspondiente
   */
  async validateFactura(
    xml: string, 
    version: string = '2.1.0',
    options: XSDValidationOptions = {}
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Validar estructura básica XML
      const structureValidation = this.validateXMLStructure(xml, 'factura');
      if (!structureValidation.isValid) {
        result.errors.push(...structureValidation.errors);
        result.isValid = false;
      }

      // Validar patrones específicos según XSD
      if (options.validatePatterns !== false) {
        const patternValidation = this.validateFacturaPatterns(xml, version);
        result.errors.push(...patternValidation.errors);
        result.warnings.push(...patternValidation.warnings);
        if (!patternValidation.isValid) {
          result.isValid = false;
        }
      }

      // Validar rangos de valores
      if (options.validateRanges !== false) {
        const rangeValidation = this.validateFacturaRanges(xml);
        result.errors.push(...rangeValidation.errors);
        result.warnings.push(...rangeValidation.warnings);
        if (!rangeValidation.isValid) {
          result.isValid = false;
        }
      }

      // Validar campos condicionales
      if (options.validateConditionalFields !== false) {
        const conditionalValidation = this.validateFacturaConditionalFields(xml);
        result.errors.push(...conditionalValidation.errors);
        result.warnings.push(...conditionalValidation.warnings);
        if (!conditionalValidation.isValid) {
          result.isValid = false;
        }
      }

    } catch (error: any) {
      result.isValid = false;
      result.errors.push(`Error de validación XSD: ${error.message}`);
    }

    return result;
  }

  /**
   * Valida una nota de crédito contra el esquema XSD
   */
  async validateNotaCredito(
    xml: string, 
    version: string = '1.1.0',
    options: XSDValidationOptions = {}
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      const structureValidation = this.validateXMLStructure(xml, 'notaCredito');
      if (!structureValidation.isValid) {
        result.errors.push(...structureValidation.errors);
        result.isValid = false;
      }

      const patternValidation = this.validateNotaCreditoPatterns(xml, version);
      result.errors.push(...patternValidation.errors);
      result.warnings.push(...patternValidation.warnings);
      if (!patternValidation.isValid) {
        result.isValid = false;
      }

    } catch (error: any) {
      result.isValid = false;
      result.errors.push(`Error de validación XSD: ${error.message}`);
    }

    return result;
  }

  /**
   * Valida estructura básica del XML
   */
  private validateXMLStructure(xml: string, rootElement: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      const parser = new DOMParser({
        errorHandler: {
          warning: (msg) => result.warnings.push(`XML Warning: ${msg}`),
          error: (msg) => {
            result.errors.push(`XML Error: ${msg}`);
            result.isValid = false;
          },
          fatalError: (msg) => {
            result.errors.push(`XML Fatal Error: ${msg}`);
            result.isValid = false;
          }
        }
      });

      const doc = parser.parseFromString(xml, 'text/xml');
      
      // Validar elemento raíz
      if (!doc.documentElement || doc.documentElement.tagName !== rootElement) {
        result.errors.push(`Elemento raíz debe ser '${rootElement}'`);
        result.isValid = false;
      }

      // Validar namespaces obligatorios
      const requiredNamespaces = [
        'http://www.w3.org/2000/09/xmldsig#',
        'http://www.w3.org/2001/XMLSchema-instance'
      ];

      const xmlString = xml.toString();
      for (const ns of requiredNamespaces) {
        if (!xmlString.includes(ns)) {
          result.errors.push(`Namespace obligatorio faltante: ${ns}`);
          result.isValid = false;
        }
      }

      // Validar atributos obligatorios
      const root = doc.documentElement;
      if (!root.getAttribute('id') || root.getAttribute('id') !== 'comprobante') {
        result.errors.push("Atributo 'id' debe ser 'comprobante'");
        result.isValid = false;
      }

      if (!root.getAttribute('version')) {
        result.errors.push("Atributo 'version' es obligatorio");
        result.isValid = false;
      }

    } catch (error: any) {
      result.errors.push(`Error parseando XML: ${error.message}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Valida patrones específicos de factura según XSD
   */
  private validateFacturaPatterns(xml: string, version: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const patterns = {
      // Patrones según factura_V2.1.0.xsd
      ambiente: /^[1-2]{1}$/,
      tipoEmision: /^[12]{1}$/,
      numeroRuc: /^[0-9]{10}001$/,
      claveAcceso: /^[0-9]{49}$/,
      establecimiento: /^[0-9]{3}$/,
      puntoEmision: /^[0-9]{3}$/,
      secuencial: /^[0-9]{9}$/,
      fechaEmision: /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/20[0-9][0-9]$/,
      tipoIdentificacionComprador: /^[0][4-8]$/,
      obligadoContabilidad: /^(SI|NO)$/,
      codigoImpuesto: /^[235]$/,
      formaPago: /^([0][1-9]|[1][0-9]|[2][0-1])$/
    };

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      // Validar cada patrón
      for (const [field, pattern] of Object.entries(patterns)) {
        const elements = this.getElementsByTagNameRecursive(doc, field);
        
        for (const element of elements) {
          const value = element.textContent || '';
          if (value && !pattern.test(value)) {
            result.errors.push(
              `Campo '${field}' con valor '${value}' no cumple patrón XSD: ${pattern.toString()}`
            );
            result.isValid = false;
          }
        }
      }

      // Validaciones específicas adicionales
      this.validateDecimalFormats(doc, result);
      this.validateElementOrder(doc, result);

    } catch (error: any) {
      result.errors.push(`Error validando patrones: ${error.message}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Valida formatos de decimales según XML de referencia (VALIDACIÓN ESTRICTA)
   */
  private validateDecimalFormats(doc: Document, result: ValidationResult): void {
    // VALIDACIÓN ESTRICTA: Campos que deben tener exactamente 6 decimales
    const sixDecimalFields = ['cantidad', 'precioUnitario', 'precioSinSubsidio'];
    
    for (const field of sixDecimalFields) {
      const elements = this.getElementsByTagNameRecursive(doc, field);
      for (const element of elements) {
        const value = element.textContent || '';
        if (value) {
          // ESTRICTO: Debe ser número positivo con exactamente 6 decimales
          if (!/^\d+\.\d{6}$/.test(value)) {
            result.errors.push(
              `ERROR CRÍTICO: Campo '${field}' debe tener exactamente 6 decimales. Valor encontrado: '${value}' | Patrón requerido: 'NNNN.NNNNNN'`
            );
            result.isValid = false;
          }
          
          // ESTRICTO: No puede ser cero
          const numValue = parseFloat(value);
          if (numValue <= 0) {
            result.errors.push(
              `ERROR CRÍTICO: Campo '${field}' debe ser mayor a cero. Valor encontrado: ${value}`
            );
            result.isValid = false;
          }
        } else {
          result.errors.push(
            `ERROR CRÍTICO: Campo '${field}' es obligatorio y está vacío`
          );
          result.isValid = false;
        }
      }
    }

    // VALIDACIÓN ESTRICTA: Campos que deben tener exactamente 2 decimales
    const twoDecimalFields = [
      'totalSinImpuestos', 'totalDescuento', 'importeTotal', 'baseImponible', 
      'valor', 'descuento', 'precioTotalSinImpuesto', 'tarifa', 'propina'
    ];
    
    for (const field of twoDecimalFields) {
      const elements = this.getElementsByTagNameRecursive(doc, field);
      for (const element of elements) {
        const value = element.textContent || '';
        if (value) {
          // ESTRICTO: Debe ser número con exactamente 2 decimales
          if (!/^\d+\.\d{2}$/.test(value)) {
            result.errors.push(
              `ERROR CRÍTICO: Campo '${field}' debe tener exactamente 2 decimales. Valor encontrado: '${value}' | Patrón requerido: 'NNNN.NN'`
            );
            result.isValid = false;
          }
          
          // ESTRICTO: Validar rangos lógicos
          const numValue = parseFloat(value);
          if (field === 'tarifa' && (numValue < 0 || numValue > 100)) {
            result.errors.push(
              `ERROR CRÍTICO: Campo '${field}' debe estar entre 0 y 100. Valor encontrado: ${value}`
            );
            result.isValid = false;
          }
          
          if (['totalSinImpuestos', 'importeTotal', 'baseImponible', 'valor'].includes(field) && numValue < 0) {
            result.errors.push(
              `ERROR CRÍTICO: Campo '${field}' no puede ser negativo. Valor encontrado: ${value}`
            );
            result.isValid = false;
          }
        } else {
          result.errors.push(
            `ERROR CRÍTICO: Campo '${field}' es obligatorio y está vacío`
          );
          result.isValid = false;
        }
      }
    }

    // VALIDACIÓN ESTRICTA ADICIONAL: Coherencia matemática
    this.validateMathematicalCoherence(doc, result);
  }

  /**
   * Valida coherencia matemática entre campos (VALIDACIÓN ESTRICTA)
   */
  private validateMathematicalCoherence(doc: Document, result: ValidationResult): void {
    try {
      // Validar coherencia en detalles
      const detalles = doc.getElementsByTagName('detalle');
      for (let i = 0; i < detalles.length; i++) {
        const detalle = detalles[i];
        
        const cantidadEl = this.getElementByTagName(detalle, 'cantidad');
        const precioUnitEl = this.getElementByTagName(detalle, 'precioUnitario');
        const descuentoEl = this.getElementByTagName(detalle, 'descuento');
        const precioTotalEl = this.getElementByTagName(detalle, 'precioTotalSinImpuesto');
        
        if (cantidadEl && precioUnitEl && descuentoEl && precioTotalEl) {
          const cantidad = parseFloat(cantidadEl.textContent || '0');
          const precioUnit = parseFloat(precioUnitEl.textContent || '0');
          const descuento = parseFloat(descuentoEl.textContent || '0');
          const precioTotal = parseFloat(precioTotalEl.textContent || '0');
          
          // ESTRICTO: Validar cálculo matemático exacto
          const subtotal = cantidad * precioUnit;
          const expectedTotal = subtotal - descuento;
          const tolerance = 0.01; // Tolerancia de 1 centavo
          
          if (Math.abs(precioTotal - expectedTotal) > tolerance) {
            result.errors.push(
              `ERROR MATEMÁTICO CRÍTICO: Detalle ${i+1} - PrecioTotal incorrecto. ` +
              `Calculado: ${expectedTotal.toFixed(2)}, Encontrado: ${precioTotal.toFixed(2)}`
            );
            result.isValid = false;
          }
        }
      }
      
      // Validar totales de factura
      const totalSinImpEl = this.getElementByTagName(doc, 'totalSinImpuestos');
      const importeTotalEl = this.getElementByTagName(doc, 'importeTotal');
      
      if (totalSinImpEl && importeTotalEl) {
        const totalSinImp = parseFloat(totalSinImpEl.textContent || '0');
        const importeTotal = parseFloat(importeTotalEl.textContent || '0');
        
        // ESTRICTO: El importe total debe ser mayor al subtotal
        if (importeTotal < totalSinImp) {
          result.errors.push(
            `ERROR MATEMÁTICO CRÍTICO: ImporteTotal (${importeTotal}) no puede ser menor que TotalSinImpuestos (${totalSinImp})`
          );
          result.isValid = false;
        }
      }
      
    } catch (error: any) {
      result.errors.push(`ERROR VALIDANDO COHERENCIA MATEMÁTICA: ${error.message}`);
      result.isValid = false;
    }
  }

  /**
   * Valida orden de elementos según XML de referencia
   */
  private validateElementOrder(doc: Document, result: ValidationResult): void {
    const expectedOrder = [
      'infoTributaria',
      'infoFactura', 
      'detalles',
      'reembolsos',
      'retenciones',
      'infoSustitutivaGuiaRemision',
      'otrosRubrosTerceros',
      'tipoNegociable',
      'maquinaFiscal',
      'infoAdicional'
    ];

    const root = doc.documentElement;
    const children = Array.from(root.childNodes).filter(node => node.nodeType === 1) as Element[];
    
    let lastFoundIndex = -1;
    
    for (const child of children) {
      const tagName = child.tagName;
      const expectedIndex = expectedOrder.indexOf(tagName);
      
      if (expectedIndex !== -1) {
        if (expectedIndex < lastFoundIndex) {
          result.errors.push(
            `Elemento '${tagName}' está fuera de orden. Debe aparecer antes que elementos previos.`
          );
          result.isValid = false;
        }
        lastFoundIndex = expectedIndex;
      }
    }
  }

  /**
   * Valida rangos de valores según XSD
   */
  private validateFacturaRanges(xml: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    
    // Validar totalDigits para campos decimales (6 decimales para cantidad/precio, 2 para montos)
    const cantidadElements = doc.getElementsByTagName('cantidad');
    for (let i = 0; i < cantidadElements.length; i++) {
      const value = cantidadElements[i].textContent || '';
      if (value && !this.validateDecimalFormat(value, 14, 6)) {
        result.errors.push(`Cantidad debe tener máximo 14 dígitos y 6 decimales: ${value}`);
        result.isValid = false;
      }
    }
    
    const precioElements = doc.getElementsByTagName('precioUnitario');
    for (let i = 0; i < precioElements.length; i++) {
      const value = precioElements[i].textContent || '';
      if (value && !this.validateDecimalFormat(value, 14, 6)) {
        result.errors.push(`Precio unitario debe tener máximo 14 dígitos y 6 decimales: ${value}`);
        result.isValid = false;
      }
    }
    
    // Validar montos con 2 decimales
    const montoFields = ['totalSinImpuestos', 'totalDescuento', 'importeTotal', 'valor', 'baseImponible'];
    for (const fieldName of montoFields) {
      const elements = doc.getElementsByTagName(fieldName);
      for (let i = 0; i < elements.length; i++) {
        const value = elements[i].textContent || '';
        if (value && !this.validateDecimalFormat(value, 14, 2)) {
          result.errors.push(`${fieldName} debe tener máximo 14 dígitos y 2 decimales: ${value}`);
          result.isValid = false;
        }
      }
    }
    
    return result;
  }

  /**
   * Valida campos condicionales según reglas de negocio SRI
   */
  private validateFacturaConditionalFields(xml: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      // Validar campos condicionales específicos
      this.validateExportFields(doc, result);
      this.validateRetencionFields(doc, result);
      this.validateReembolsoFields(doc, result);

    } catch (error: any) {
      result.errors.push(`Error validando campos condicionales: ${error.message}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Valida campos específicos de exportación
   */
  private validateExportFields(doc: Document, result: ValidationResult): void {
    const comercioExterior = this.getElementByTagName(doc, 'comercioExterior');
    
    if (comercioExterior && comercioExterior.textContent === 'EXPORTADOR') {
      // Validar campos obligatorios para exportación
      const requiredExportFields = [
        'incoTermFactura', 'lugarIncoTerm', 'paisOrigen', 
        'puertoEmbarque', 'puertoDestino', 'paisDestino'
      ];
      
      for (const field of requiredExportFields) {
        const element = this.getElementByTagName(doc, field);
        if (!element || !element.textContent) {
          result.warnings.push(
            `Campo '${field}' recomendado para exportación no encontrado`
          );
        }
      }
    }
  }

  /**
   * Valida campos de retención
   */
  private validateRetencionFields(doc: Document, result: ValidationResult): void {
    const retenciones = this.getElementByTagName(doc, 'retenciones');
    
    if (retenciones) {
      const retencionElements = retenciones.getElementsByTagName('retencion');
      
      for (let i = 0; i < retencionElements.length; i++) {
        const retencion = retencionElements[i];
        const codigo = this.getElementByTagName(retencion, 'codigo');
        
        if (codigo && codigo.textContent !== '4') {
          result.errors.push(
            `Código de retención debe ser '4', encontrado: ${codigo.textContent}`
          );
          result.isValid = false;
        }
      }
    }
  }

  /**
   * Valida campos de reembolso
   */
  private validateReembolsoFields(doc: Document, result: ValidationResult): void {
    const reembolsos = this.getElementByTagName(doc, 'reembolsos');
    
    if (reembolsos) {
      // Validar que existan totales de reembolso en infoFactura
      const totalComprobantesReembolso = this.getElementByTagName(doc, 'totalComprobantesReembolso');
      const totalBaseImponibleReembolso = this.getElementByTagName(doc, 'totalBaseImponibleReembolso');
      const totalImpuestoReembolso = this.getElementByTagName(doc, 'totalImpuestoReembolso');
      
      if (!totalComprobantesReembolso || !totalBaseImponibleReembolso || !totalImpuestoReembolso) {
        result.errors.push(
          'Cuando existen reembolsos, los totales de reembolso son obligatorios en infoFactura'
        );
        result.isValid = false;
      }
    }
  }

  /**
   * Valida patrones de nota de crédito
   */
  private validateNotaCreditoPatterns(xml: string, version: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Implementar validaciones específicas para nota de crédito
    
    return result;
  }

  /**
   * Obtiene elementos por nombre de tag recursivamente
   */
  private getElementsByTagNameRecursive(element: Document | Element, tagName: string): Element[] {
    const elements: Element[] = [];
    const nodeList = element.getElementsByTagName(tagName);
    
    for (let i = 0; i < nodeList.length; i++) {
      elements.push(nodeList[i]);
    }
    
    return elements;
  }

  /**
   * Obtiene un elemento por nombre de tag (primer resultado)
   */
  private getElementByTagName(element: Document | Element, tagName: string): Element | null {
    const elements = element.getElementsByTagName(tagName);
    return elements.length > 0 ? elements[0] : null;
  }

  /**
   * Valida formato decimal según especificaciones XSD del SRI
   */
  private validateDecimalFormat(value: string, totalDigits: number, fractionDigits: number): boolean {
    if (!value || value.trim() === '') return false;
    
    // Verificar que sea un número válido
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return false;
    
    // Verificar dígitos totales y decimales
    const parts = value.split('.');
    const wholePart = parts[0];
    const decimalPart = parts[1] || '';
    
    // Total de dígitos no debe exceder totalDigits
    const totalDigitsInValue = wholePart.replace('-', '').length + decimalPart.length;
    if (totalDigitsInValue > totalDigits) return false;
    
    // Decimales no deben exceder fractionDigits
    if (decimalPart.length > fractionDigits) return false;
    
    return true;
  }
}