import * as fs from 'fs';
import * as path from 'path';
import { DOMParser } from '@xmldom/xmldom';
import { ValidationResult } from './xsd-validator.service';

export interface ComparisonResult extends ValidationResult {
  differences: StructureDifference[];
  matchPercentage: number;
}

export interface StructureDifference {
  type: 'missing' | 'extra' | 'different_value' | 'wrong_order' | 'wrong_format';
  element: string;
  expected?: string;
  actual?: string;
  path: string;
}

/**
 * Servicio de validación contra XMLs de referencia del SRI
 */
export class ReferenceValidatorService {
  private readonly referenceXmlPath: string;
  
  constructor(referenceXmlPath?: string) {
    this.referenceXmlPath = referenceXmlPath || path.join(process.cwd(), 'xsd');
  }

  /**
   * Compara un XML generado contra el XML de referencia del SRI
   */
  async compareWithReference(
    generatedXml: string,
    documentType: 'factura' | 'notaCredito',
    version: string = '2.1.0'
  ): Promise<ComparisonResult> {
    const result: ComparisonResult = {
      isValid: true,
      errors: [],
      warnings: [],
      differences: [],
      matchPercentage: 0
    };

    try {
      // Cargar XML de referencia
      const referenceXml = await this.loadReferenceXML(documentType, version);
      
      if (!referenceXml) {
        result.errors.push(`No se pudo cargar XML de referencia para ${documentType} v${version}`);
        result.isValid = false;
        return result;
      }

      // Parsear ambos XMLs
      const parser = new DOMParser();
      const referenceDoc = parser.parseFromString(referenceXml, 'text/xml');
      const generatedDoc = parser.parseFromString(generatedXml, 'text/xml');

      // Comparar estructura general
      await this.compareDocumentStructure(referenceDoc, generatedDoc, result);

      // Comparar formatos específicos
      await this.compareFormats(referenceDoc, generatedDoc, result);

      // Comparar orden de elementos
      await this.compareElementOrder(referenceDoc, generatedDoc, result);

      // Comparar atributos y namespaces
      await this.compareAttributes(referenceDoc, generatedDoc, result);

      // Calcular porcentaje de coincidencia
      result.matchPercentage = this.calculateMatchPercentage(result.differences);

      if (result.differences.length > 0) {
        result.isValid = false;
      }

    } catch (error: any) {
      result.errors.push(`Error comparando con referencia: ${error.message}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Carga el XML de referencia según tipo y versión
   */
  private async loadReferenceXML(
    documentType: 'factura' | 'notaCredito',
    version: string
  ): Promise<string | null> {
    try {
      let filename: string;
      
      switch (documentType) {
        case 'factura':
          filename = `factura_V${version}.xml`;
          break;
        case 'notaCredito':
          filename = `NotaCredito_V${version}.xml`;
          break;
        default:
          throw new Error(`Tipo de documento no soportado: ${documentType}`);
      }

      const filePath = path.join(this.referenceXmlPath, filename);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo de referencia no encontrado: ${filePath}`);
      }

      return fs.readFileSync(filePath, 'utf-8');
      
    } catch (error: any) {
      console.error(`Error cargando XML de referencia: ${error.message}`);
      return null;
    }
  }

  /**
   * Compara la estructura general de los documentos
   */
  private async compareDocumentStructure(
    reference: Document,
    generated: Document,
    result: ComparisonResult
  ): Promise<void> {
    // Comparar elemento raíz
    const refRoot = reference.documentElement;
    const genRoot = generated.documentElement;

    if (refRoot.tagName !== genRoot.tagName) {
      result.differences.push({
        type: 'different_value',
        element: 'root',
        expected: refRoot.tagName,
        actual: genRoot.tagName,
        path: '/'
      });
    }

    // Comparar elementos principales
    const refChildren = this.getDirectChildren(refRoot);
    const genChildren = this.getDirectChildren(genRoot);

    this.compareElementLists(refChildren, genChildren, '/', result);
  }

  /**
   * Compara listas de elementos
   */
  private compareElementLists(
    reference: Element[],
    generated: Element[],
    parentPath: string,
    result: ComparisonResult
  ): void {
    const refMap = new Map<string, Element[]>();
    const genMap = new Map<string, Element[]>();

    // Agrupar elementos por nombre de tag
    reference.forEach(el => {
      const tagName = el.tagName;
      if (!refMap.has(tagName)) {
        refMap.set(tagName, []);
      }
      refMap.get(tagName)!.push(el);
    });

    generated.forEach(el => {
      const tagName = el.tagName;
      if (!genMap.has(tagName)) {
        genMap.set(tagName, []);
      }
      genMap.get(tagName)!.push(el);
    });

    // Buscar elementos faltantes
    for (const [tagName, refElements] of refMap) {
      const genElements = genMap.get(tagName) || [];
      
      if (genElements.length === 0) {
        // Solo reportar como faltante si NO es un elemento opcional del SRI
        if (!this.isOptionalSRIElement(tagName)) {
          result.differences.push({
            type: 'missing',
            element: tagName,
            path: `${parentPath}${tagName}`
          });
        }
      } else if (genElements.length !== refElements.length) {
        result.differences.push({
          type: 'different_value',
          element: tagName,
          expected: `${refElements.length} elementos`,
          actual: `${genElements.length} elementos`,
          path: `${parentPath}${tagName}`
        });
      } else {
        // Comparar contenido de elementos del mismo tipo
        for (let i = 0; i < refElements.length; i++) {
          this.compareElements(
            refElements[i], 
            genElements[i], 
            `${parentPath}${tagName}[${i}]/`, 
            result
          );
        }
      }
    }

    // Buscar elementos extra
    for (const [tagName, genElements] of genMap) {
      if (!refMap.has(tagName)) {
        result.differences.push({
          type: 'extra',
          element: tagName,
          path: `${parentPath}${tagName}`
        });
      }
    }
  }

  /**
   * Compara dos elementos específicos
   */
  private compareElements(
    reference: Element,
    generated: Element,
    path: string,
    result: ComparisonResult
  ): void {
    // Comparar contenido de texto
    const refText = this.getTextContent(reference);
    const genText = this.getTextContent(generated);

    if (refText !== genText && refText && genText) {
      // Solo reportar diferencias en contenido real, no en placeholders
      if (!this.isPlaceholderValue(refText) && !this.isPlaceholderValue(genText)) {
        result.differences.push({
          type: 'different_value',
          element: reference.tagName,
          expected: refText,
          actual: genText,
          path: path
        });
      }
    }

    // Comparar atributos
    this.compareElementAttributes(reference, generated, path, result);

    // Comparar elementos hijos
    const refChildren = this.getDirectChildren(reference);
    const genChildren = this.getDirectChildren(generated);

    if (refChildren.length > 0 || genChildren.length > 0) {
      this.compareElementLists(refChildren, genChildren, path, result);
    }
  }

  /**
   * Compara formatos específicos según XML de referencia
   */
  private async compareFormats(
    reference: Document,
    generated: Document,
    result: ComparisonResult
  ): Promise<void> {
    // Validar formatos de decimales según referencia
    this.validateDecimalFormatsAgainstReference(reference, generated, result);
    
    // Validar formatos de fechas
    this.validateDateFormatsAgainstReference(reference, generated, result);
  }

  /**
   * Valida formatos de decimales contra referencia
   */
  private validateDecimalFormatsAgainstReference(
    reference: Document,
    generated: Document,
    result: ComparisonResult
  ): void {
    // Obtener elementos con decimales del XML de referencia
    const decimalElements = ['cantidad', 'precioUnitario', 'baseImponible', 'valor', 'tarifa'];
    
    for (const elementName of decimalElements) {
      const refElements = reference.getElementsByTagName(elementName);
      const genElements = generated.getElementsByTagName(elementName);
      
      for (let i = 0; i < Math.min(refElements.length, genElements.length); i++) {
        const refValue = refElements[i].textContent || '';
        const genValue = genElements[i].textContent || '';
        
        // Comparar formato de decimales
        if (refValue && genValue && !this.isPlaceholderValue(refValue)) {
          const refDecimals = this.getDecimalPlaces(refValue);
          const genDecimals = this.getDecimalPlaces(genValue);
          
          if (refDecimals !== genDecimals) {
            result.differences.push({
              type: 'wrong_format',
              element: elementName,
              expected: `${refDecimals} decimales`,
              actual: `${genDecimals} decimales`,
              path: `/${elementName}[${i}]`
            });
          }
        }
      }
    }
  }

  /**
   * Valida formatos de fechas contra referencia
   */
  private validateDateFormatsAgainstReference(
    reference: Document,
    generated: Document,
    result: ComparisonResult
  ): void {
    const dateElements = ['fechaEmision', 'fechaEmisionDocSustento', 'fechaIniTransporte', 'fechaFinTransporte'];
    
    for (const elementName of dateElements) {
      const refElements = reference.getElementsByTagName(elementName);
      const genElements = generated.getElementsByTagName(elementName);
      
      for (let i = 0; i < Math.min(refElements.length, genElements.length); i++) {
        const refValue = refElements[i].textContent || '';
        const genValue = genElements[i].textContent || '';
        
        if (refValue && genValue && !this.isPlaceholderValue(refValue)) {
          // Validar formato dd/mm/yyyy
          const datePattern = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/20[0-9][0-9]$/;
          
          if (!datePattern.test(genValue)) {
            result.differences.push({
              type: 'wrong_format',
              element: elementName,
              expected: 'dd/mm/yyyy',
              actual: genValue,
              path: `/${elementName}[${i}]`
            });
          }
        }
      }
    }
  }

  /**
   * Compara orden de elementos
   */
  private async compareElementOrder(
    reference: Document,
    generated: Document,
    result: ComparisonResult
  ): Promise<void> {
    const refRoot = reference.documentElement;
    const genRoot = generated.documentElement;

    const refOrder = this.getDirectChildren(refRoot).map(el => el.tagName);
    const genOrder = this.getDirectChildren(genRoot).map(el => el.tagName);

    // Comparar orden solo de elementos que existen en ambos
    const commonElements = refOrder.filter(tag => genOrder.includes(tag));
    
    let refIndex = 0;
    let genIndex = 0;
    
    for (const commonElement of commonElements) {
      // Encontrar posición en referencia
      while (refIndex < refOrder.length && refOrder[refIndex] !== commonElement) {
        refIndex++;
      }
      
      // Encontrar posición en generado
      while (genIndex < genOrder.length && genOrder[genIndex] !== commonElement) {
        genIndex++;
      }
      
      // Si hay elementos entre medias que no deberían estar ahí
      const refBetween = refOrder.slice(refIndex + 1);
      const genBetween = genOrder.slice(genIndex + 1);
      
      // Buscar siguiente elemento común
      const nextCommonIndex = commonElements.indexOf(commonElement) + 1;
      if (nextCommonIndex < commonElements.length) {
        const nextCommon = commonElements[nextCommonIndex];
        
        const refNextIndex = refOrder.indexOf(nextCommon, refIndex + 1);
        const genNextIndex = genOrder.indexOf(nextCommon, genIndex + 1);
        
        if (refNextIndex !== -1 && genNextIndex !== -1) {
          const refBetweenNext = refOrder.slice(refIndex + 1, refNextIndex);
          const genBetweenNext = genOrder.slice(genIndex + 1, genNextIndex);
          
          if (JSON.stringify(refBetweenNext) !== JSON.stringify(genBetweenNext)) {
            result.differences.push({
              type: 'wrong_order',
              element: `elementos entre ${commonElement} y ${nextCommon}`,
              expected: refBetweenNext.join(', '),
              actual: genBetweenNext.join(', '),
              path: `/orden`
            });
          }
        }
      }
      
      refIndex++;
      genIndex++;
    }
  }

  /**
   * Compara atributos de elementos
   */
  private compareElementAttributes(
    reference: Element,
    generated: Element,
    path: string,
    result: ComparisonResult
  ): void {
    // Obtener todos los atributos
    const refAttrs = this.getElementAttributes(reference);
    const genAttrs = this.getElementAttributes(generated);

    // Comparar atributos de referencia
    for (const [name, refValue] of refAttrs) {
      const genValue = genAttrs.get(name);
      
      if (!genValue) {
        result.differences.push({
          type: 'missing',
          element: `atributo ${name}`,
          path: `${path}@${name}`
        });
      } else if (refValue !== genValue && !this.isPlaceholderValue(refValue)) {
        result.differences.push({
          type: 'different_value',
          element: `atributo ${name}`,
          expected: refValue,
          actual: genValue,
          path: `${path}@${name}`
        });
      }
    }

    // Buscar atributos extra
    for (const [name, genValue] of genAttrs) {
      if (!refAttrs.has(name)) {
        result.differences.push({
          type: 'extra',
          element: `atributo ${name}`,
          path: `${path}@${name}`
        });
      }
    }
  }

  /**
   * Compara atributos del documento
   */
  private async compareAttributes(
    reference: Document,
    generated: Document,
    result: ComparisonResult
  ): Promise<void> {
    const refRoot = reference.documentElement;
    const genRoot = generated.documentElement;

    this.compareElementAttributes(refRoot, genRoot, '/', result);
  }

  /**
   * Calcula el porcentaje de coincidencia
   */
  private calculateMatchPercentage(differences: StructureDifference[]): number {
    // Algoritmo simple: menos diferencias = mayor porcentaje
    const maxDifferences = 100; // Número máximo esperado de diferencias
    const percentage = Math.max(0, ((maxDifferences - differences.length) / maxDifferences) * 100);
    return Math.round(percentage * 100) / 100;
  }

  // Métodos auxiliares

  private getDirectChildren(element: Element): Element[] {
    const children: Element[] = [];
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType === 1) { // Element node
        children.push(node as Element);
      }
    }
    return children;
  }

  private getTextContent(element: Element): string {
    return (element.textContent || '').trim();
  }

  private isPlaceholderValue(value: string): boolean {
    // Detectar valores de placeholder del XML de referencia del SRI
    const placeholderPatterns = [
      /^(razonSocial|nombreComercial|dirMatriz|dirEstablecimiento)\d*$/,
      /^[0]+$/,  // Valores como 0000000000001, 000, 000000000
      /^(descripcion|concepto|motivo|contribuyente|lugarIncoTerm|puertoEmbarque|puertoDestino)\d*$/,
      /^version\d*$/,
      /^\d+\.\d+$/,  // Valores decimales genéricos como 50.00, 49.50
      /^01\/01\/2000$/,  // Fecha placeholder del SRI
      /^000-000-000000000$/,  // RUC placeholder
      /^(razonSocialComprador|identificacionCompr|direccionComprador)\d*$/,
      /^CONTRIBUYENTE RÉGIMEN RIMPE$/,  // Placeholder específico del SRI
      /^EXPORTADOR$/,  // Placeholder de comercio exterior
      /^[A-Z]$/,  // Letras solas como placeholders
      /^moneda\d*$/,
      /^placa\d*$/,
      /^unidadTiem.*$/
    ];
    
    return placeholderPatterns.some(pattern => pattern.test(value));
  }

  private getDecimalPlaces(value: string): number {
    const parts = value.split('.');
    return parts.length > 1 ? parts[1].length : 0;
  }

  private getElementAttributes(element: Element): Map<string, string> {
    const attrs = new Map<string, string>();
    
    if (element.attributes) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attrs.set(attr.name, attr.value);
      }
    }
    
    return attrs;
  }
}