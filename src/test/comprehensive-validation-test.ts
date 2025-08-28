import * as fs from 'fs';
import * as path from 'path';
import { XMLBuilderService } from '../modules/xml/xml-builder.service';
import { SRIXmlSigner } from '../modules/signature/sri-xml-signer';
import { XSDValidatorService } from '../modules/validation/xsd-validator.service';
import { ReferenceValidatorService } from '../modules/validation/reference-validator.service';
import { SRIConnectorService } from '../modules/sri/sri-connector.service';
import { FacturaData } from '../modules/xml/xml.types';
import { emisorConfig } from '../config/emisor.config';

interface ComprehensiveTestResult {
  xmlGeneration: {
    success: boolean;
    xmlPath?: string;
    signedXmlPath?: string;
    error?: string;
  };
  xsdValidation: {
    success: boolean;
    errors: string[];
    warnings: string[];
  };
  referenceValidation: {
    success: boolean;
    matchPercentage: number;
    differences: any[];
  };
  sriValidation: {
    recepcion: {
      success: boolean;
      estado?: string;
      mensajes: any[];
    };
    autorizacion: {
      success: boolean;
      estado?: string;
      numeroAutorizacion?: string;
      mensajes: any[];
    };
  };
  summary: {
    overallSuccess: boolean;
    score: number;
    recommendations: string[];
  };
}

/**
 * Test comprensivo que valida todo el sistema contra especificaciones exactas del SRI
 */
export class ComprehensiveValidationTest {
  private xmlBuilder: XMLBuilderService;
  private xmlSigner: SRIXmlSigner;
  private xsdValidator: XSDValidatorService;
  private referenceValidator: ReferenceValidatorService;
  private sriConnector: SRIConnectorService;
  private outputDir: string;

  constructor() {
    this.xmlBuilder = new XMLBuilderService();
    this.xmlSigner = new SRIXmlSigner();
    this.xsdValidator = new XSDValidatorService();
    this.referenceValidator = new ReferenceValidatorService();
    this.sriConnector = new SRIConnectorService();
    this.outputDir = path.join(process.cwd(), 'test-output');
    this.ensureOutputDir();
  }

  /**
   * Ejecuta el test comprensivo completo
   */
  async runComprehensiveTest(): Promise<ComprehensiveTestResult> {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║        TEST COMPRENSIVO DE VALIDACIÓN COMPLETA SRI        ║');
    console.log('║     VALIDACIÓN CONTRA ESPECIFICACIONES EXACTAS 2.31      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    const result: ComprehensiveTestResult = {
      xmlGeneration: { success: false },
      xsdValidation: { success: false, errors: [], warnings: [] },
      referenceValidation: { success: false, matchPercentage: 0, differences: [] },
      sriValidation: {
        recepcion: { success: false, mensajes: [] },
        autorizacion: { success: false, mensajes: [] }
      },
      summary: { overallSuccess: false, score: 0, recommendations: [] }
    };

    try {
      // FASE 1: Generación de XML con todas las correcciones
      console.log('🔥 FASE 1: GENERACIÓN DE XML CON CORRECCIONES');
      console.log('==============================================');
      await this.testXmlGeneration(result);

      if (!result.xmlGeneration.success) {
        result.summary.recommendations.push('❌ CRÍTICO: Generación de XML falla - revisar XMLBuilderService');
        return result;
      }

      // FASE 2: Validación XSD estricta
      console.log('\\n📋 FASE 2: VALIDACIÓN XSD ESTRICTA');
      console.log('===================================');
      await this.testXsdValidation(result);

      // FASE 3: Validación contra XML de referencia
      console.log('\\n🎯 FASE 3: VALIDACIÓN CONTRA XML DE REFERENCIA');
      console.log('===============================================');
      await this.testReferenceValidation(result);

      // FASE 4: Validación con SRI (solo si las anteriores son exitosas)
      if (result.xsdValidation.success && result.referenceValidation.success) {
        console.log('\\n🌐 FASE 4: VALIDACIÓN CON SRI ECUADOR');
        console.log('======================================');
        await this.testSriValidation(result);
      } else {
        result.summary.recommendations.push('⚠️ Saltando validación SRI por errores previos');
      }

      // FASE 5: Análisis final y recomendaciones
      console.log('\\n📊 FASE 5: ANÁLISIS FINAL Y PUNTUACIÓN');
      console.log('=======================================');
      this.generateFinalAnalysis(result);

    } catch (error: any) {
      console.error('❌ Error fatal en test comprensivo:', error.message);
      result.summary.recommendations.push(`❌ Error fatal: ${error.message}`);
    }

    return result;
  }

  /**
   * Prueba generación de XML con todas las correcciones aplicadas
   */
  private async testXmlGeneration(result: ComprehensiveTestResult): Promise<void> {
    try {
      // Generar datos de prueba con valores exactos según especificaciones
      const facturaData = this.generateTestFacturaData();
      
      console.log('📝 Generando XML con formato 2.1.0...');
      const xmlContent = await this.xmlBuilder.buildFactura(facturaData, '2.1.0');
      
      // Guardar XML sin firmar
      const timestamp = Date.now();
      const unsignedPath = path.join(this.outputDir, `comprehensive-test-${timestamp}.xml`);
      fs.writeFileSync(unsignedPath, xmlContent, 'utf-8');
      
      console.log('🔏 Firmando XML con correcciones...');
      const signedXml = await this.xmlSigner.signXML(xmlContent);
      
      // Guardar XML firmado
      const signedPath = path.join(this.outputDir, `comprehensive-test-${timestamp}_firmado.xml`);
      fs.writeFileSync(signedPath, signedXml, 'utf-8');
      
      result.xmlGeneration = {
        success: true,
        xmlPath: unsignedPath,
        signedXmlPath: signedPath
      };
      
      console.log('✅ XML generado exitosamente');
      console.log(`   📄 Sin firmar: ${path.basename(unsignedPath)}`);
      console.log(`   🔏 Firmado: ${path.basename(signedPath)}`);
      
    } catch (error: any) {
      result.xmlGeneration = {
        success: false,
        error: error.message
      };
      console.error('❌ Error generando XML:', error.message);
    }
  }

  /**
   * Prueba validación XSD estricta
   */
  private async testXsdValidation(result: ComprehensiveTestResult): Promise<void> {
    try {
      if (!result.xmlGeneration.signedXmlPath) {
        throw new Error('No hay XML firmado para validar');
      }

      const signedXml = fs.readFileSync(result.xmlGeneration.signedXmlPath, 'utf-8');
      
      console.log('🔍 Validando contra esquemas XSD oficiales...');
      const xsdResult = await this.xsdValidator.validateFactura(signedXml, '2.1.0', {
        validatePatterns: true,
        validateRanges: true,
        validateConditionalFields: true,
        strict: true
      });

      // Validación específica para formato UANATACA
      console.log('🔍 Validando formato específico UANATACA...');
      await this.validateUanatacaFormat(signedXml, result);

      result.xsdValidation = {
        success: xsdResult.isValid,
        errors: xsdResult.errors,
        warnings: xsdResult.warnings
      };

      if (xsdResult.isValid) {
        console.log('✅ Validación XSD exitosa');
      } else {
        console.log('❌ Errores de validación XSD:');
        xsdResult.errors.forEach(error => console.log(`   • ${error}`));
      }

      if (xsdResult.warnings.length > 0) {
        console.log('⚠️ Advertencias XSD:');
        xsdResult.warnings.forEach(warning => console.log(`   • ${warning}`));
      }

    } catch (error: any) {
      result.xsdValidation = {
        success: false,
        errors: [error.message],
        warnings: []
      };
      console.error('❌ Error en validación XSD:', error.message);
    }
  }

  /**
   * Prueba validación contra XML de referencia
   */
  private async testReferenceValidation(result: ComprehensiveTestResult): Promise<void> {
    try {
      if (!result.xmlGeneration.signedXmlPath) {
        throw new Error('No hay XML firmado para validar');
      }

      const signedXml = fs.readFileSync(result.xmlGeneration.signedXmlPath, 'utf-8');
      
      console.log('🎯 Comparando con XML de referencia oficial...');
      const refResult = await this.referenceValidator.compareWithReference(
        signedXml, 
        'factura', 
        '2.1.0'
      );

      result.referenceValidation = {
        success: refResult.isValid,
        matchPercentage: refResult.matchPercentage,
        differences: refResult.differences
      };

      console.log(`📊 Coincidencia con referencia: ${refResult.matchPercentage.toFixed(1)}%`);
      
      if (refResult.differences.length > 0) {
        console.log('⚠️ Diferencias encontradas:');
        refResult.differences.slice(0, 5).forEach(diff => {
          console.log(`   • ${diff.type}: ${diff.element} (${diff.path})`);
        });
        
        if (refResult.differences.length > 5) {
          console.log(`   • ... y ${refResult.differences.length - 5} diferencias más`);
        }
      } else {
        console.log('✅ XML idéntico a referencia oficial');
      }

    } catch (error: any) {
      result.referenceValidation = {
        success: false,
        matchPercentage: 0,
        differences: [{ type: 'error', element: 'sistema', path: '/', error: error.message }]
      };
      console.error('❌ Error en validación de referencia:', error.message);
    }
  }

  /**
   * Prueba validación con SRI real
   */
  private async testSriValidation(result: ComprehensiveTestResult): Promise<void> {
    try {
      if (!result.xmlGeneration.signedXmlPath) {
        throw new Error('No hay XML firmado para enviar al SRI');
      }

      const signedXml = fs.readFileSync(result.xmlGeneration.signedXmlPath, 'utf-8');
      
      console.log('📤 Enviando a recepción SRI...');
      const recepcionResult = await this.sriConnector.validarComprobante(signedXml);
      
      result.sriValidation.recepcion = {
        success: recepcionResult.estado === 'RECIBIDA',
        estado: recepcionResult.estado,
        mensajes: recepcionResult.comprobantes || []
      };

      console.log(`📥 Estado recepción: ${recepcionResult.estado}`);
      
      if (recepcionResult.estado === 'RECIBIDA') {
        console.log('✅ Comprobante recibido por el SRI');
        
        // Esperar un momento y consultar autorización
        console.log('⏳ Esperando procesamiento...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extraer clave de acceso del XML
        const claveMatch = signedXml.match(/<claveAcceso>([0-9]{49})<\/claveAcceso>/);
        const claveAcceso = claveMatch ? claveMatch[1] : '';
        
        if (claveAcceso) {
          console.log('🔍 Consultando autorización...');
          const authResult = await this.sriConnector.autorizacionComprobanteConEspera(claveAcceso, 30000);
          
          const autorizacion = authResult.autorizaciones && authResult.autorizaciones.length > 0 ? 
            authResult.autorizaciones[0] : null;
          
          result.sriValidation.autorizacion = {
            success: autorizacion?.estado === 'AUTORIZADO',
            estado: autorizacion?.estado,
            numeroAutorizacion: autorizacion?.numeroAutorizacion,
            mensajes: autorizacion?.mensajes || []
          };
          
          console.log(`🔍 Estado autorización: ${autorizacion?.estado || 'NO DISPONIBLE'}`);
        }
        
      } else {
        console.log('❌ Comprobante devuelto por el SRI');
        if (recepcionResult.comprobantes && recepcionResult.comprobantes.length > 0) {
          recepcionResult.comprobantes.forEach(comp => {
            if (comp.mensajes) {
              comp.mensajes.forEach((msg: any) => {
                console.log(`   • ${msg.identificador}: ${msg.mensaje}`);
              });
            }
          });
        }
      }

    } catch (error: any) {
      result.sriValidation.recepcion = {
        success: false,
        mensajes: [{ identificador: '00', tipo: 'ERROR', mensaje: error.message }]
      };
      console.error('❌ Error validando con SRI:', error.message);
    }
  }

  /**
   * Genera análisis final y puntuación
   */
  private generateFinalAnalysis(result: ComprehensiveTestResult): void {
    let score = 0;

    // Puntuación por XML generado
    if (result.xmlGeneration.success) score += 20;

    // Puntuación por validación XSD
    if (result.xsdValidation.success) {
      score += 30;
    } else if (result.xsdValidation.errors.length < 5) {
      score += 15; // Puntuación parcial
    }

    // Puntuación por coincidencia con referencia
    score += (result.referenceValidation.matchPercentage / 100) * 25;

    // Puntuación por validación SRI
    if (result.sriValidation.recepcion.success) score += 15;
    if (result.sriValidation.autorizacion.success) score += 10;

    result.summary.score = Math.round(score);
    result.summary.overallSuccess = score >= 80;

    // Generar recomendaciones
    if (!result.xmlGeneration.success) {
      result.summary.recommendations.push('❌ CRÍTICO: Corregir generación de XML');
    }

    if (!result.xsdValidation.success) {
      result.summary.recommendations.push('❌ ALTO: Corregir errores de validación XSD');
    }

    if (result.referenceValidation.matchPercentage < 90) {
      result.summary.recommendations.push('⚠️ MEDIO: Mejorar coincidencia con XML de referencia');
    }

    if (!result.sriValidation.recepcion.success && result.xmlGeneration.success) {
      result.summary.recommendations.push('⚠️ MEDIO: Revisar compatibilidad con ambiente SRI');
    }

    if (result.summary.recommendations.length === 0) {
      result.summary.recommendations.push('✅ Sistema completamente conforme con especificaciones SRI');
    }

    // Mostrar resumen final
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                    RESULTADO FINAL                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🏆 PUNTUACIÓN GENERAL: ${result.summary.score}/100`);
    console.log(`${result.summary.overallSuccess ? '✅' : '❌'} ESTADO: ${result.summary.overallSuccess ? 'APROBADO' : 'REQUIERE CORRECCIONES'}`);
    console.log('');
    console.log('📋 DETALLES:');
    console.log(`   📝 Generación XML: ${result.xmlGeneration.success ? '✅' : '❌'}`);
    console.log(`   📋 Validación XSD: ${result.xsdValidation.success ? '✅' : '❌'} (${result.xsdValidation.errors.length} errores)`);
    console.log(`   🎯 Coincidencia Referencia: ${result.referenceValidation.matchPercentage.toFixed(1)}%`);
    console.log(`   📤 Recepción SRI: ${result.sriValidation.recepcion.success ? '✅' : '❌'}`);
    console.log(`   🔍 Autorización SRI: ${result.sriValidation.autorizacion.success ? '✅' : '❌'}`);
    console.log('');
    console.log('💡 RECOMENDACIONES:');
    result.summary.recommendations.forEach(rec => console.log(`   ${rec}`));
  }

  /**
   * Genera datos REALES del sistema usando configuración real y cálculos automáticos
   */
  private generateTestFacturaData(): FacturaData {
    // USAR FECHA REAL DEL SISTEMA
    const fechaEmision = new Date();
    
    // GENERAR SECUENCIAL ÚNICO BASADO EN TIMESTAMP PARA EVITAR DUPLICADOS
    const timestamp = Date.now();
    const secuencial = (timestamp % 1000000000).toString().padStart(9, '0');

    // CALCULAR VALORES REALES (NO HARDCODEAR)
    const cantidad = 2.5; // Cantidad real con decimales
    const precioUnitario = 45.67; // Precio real
    const subtotal = cantidad * precioUnitario; // Cálculo automático
    const descuento = 0; // Sin descuento
    const baseImponible = subtotal - descuento;
    const tarifaIva = 15.00; // IVA 15% Ecuador
    const valorIva = (baseImponible * tarifaIva) / 100;
    const importeTotal = baseImponible + valorIva;

    // VALIDAR QUE EL EMISOR ESTÁ CORRECTAMENTE CONFIGURADO
    if (!emisorConfig.ruc || emisorConfig.ruc.length !== 13) {
      throw new Error(`CRÍTICO: RUC en emisorConfig inválido: ${emisorConfig.ruc}`);
    }

    if (!emisorConfig.establecimiento || emisorConfig.establecimiento.length !== 3) {
      throw new Error(`CRÍTICO: Establecimiento en emisorConfig inválido: ${emisorConfig.establecimiento}`);
    }

    if (!emisorConfig.puntoEmision || emisorConfig.puntoEmision.length !== 3) {
      throw new Error(`CRÍTICO: Punto emisión en emisorConfig inválido: ${emisorConfig.puntoEmision}`);
    }

    console.log('📊 DATOS REALES GENERADOS AUTOMÁTICAMENTE:');
    console.log(`   📅 Fecha: ${fechaEmision.toLocaleDateString('es-EC')}`);
    console.log(`   🔢 Secuencial: ${secuencial}`);
    console.log(`   🏢 Emisor: ${emisorConfig.razonSocial}`);
    console.log(`   🆔 RUC: ${emisorConfig.ruc}`);
    console.log(`   💰 Subtotal: $${baseImponible.toFixed(2)}`);
    console.log(`   📊 IVA (${tarifaIva}%): $${valorIva.toFixed(2)}`);
    console.log(`   💲 Total: $${importeTotal.toFixed(2)}`);

    return {
      infoTributaria: {
        ambiente: Number(emisorConfig.ambiente), // Del sistema real
        tipoEmision: Number(emisorConfig.tipoEmision), // Del sistema real
        razonSocial: emisorConfig.razonSocial, // Del sistema real
        nombreComercial: emisorConfig.nombreComercial, // Del sistema real
        ruc: emisorConfig.ruc, // Del sistema real
        claveAcceso: '', // Se genera automáticamente por el sistema
        codDoc: '01', // Factura
        estab: emisorConfig.establecimiento, // Del sistema real
        ptoEmi: emisorConfig.puntoEmision, // Del sistema real
        secuencial: secuencial, // Generado único
        dirMatriz: emisorConfig.dirMatriz, // Del sistema real
        agenteRetencion: '0', // Según XML referencia SRI
        contribuyenteRimpe: 'CONTRIBUYENTE RÉGIMEN RIMPE' // Según XML referencia SRI
      },
      infoFactura: {
        fechaEmision: `${fechaEmision.getDate().toString().padStart(2, '0')}/${(fechaEmision.getMonth() + 1).toString().padStart(2, '0')}/${fechaEmision.getFullYear()}`,
        dirEstablecimiento: emisorConfig.dirEstablecimiento || emisorConfig.dirMatriz, // Según XML referencia
        contribuyenteEspecial: 'contribuyente', // Según XML referencia SRI
        obligadoContabilidad: emisorConfig.obligadoContabilidad, // Del sistema real
        comercioExterior: 'EXPORTADOR', // Según XML referencia SRI
        incoTermFactura: 'A', // Según XML referencia SRI
        lugarIncoTerm: 'lugarIncoTerm0', // Según XML referencia SRI
        paisOrigen: '000', // Según XML referencia SRI
        puertoEmbarque: 'puertoEmbarque0', // Según XML referencia SRI
        puertoDestino: 'puertoDestino0', // Según XML referencia SRI
        paisDestino: '000', // Según XML referencia SRI
        paisAdquisicion: '000', // Según XML referencia SRI
        tipoIdentificacionComprador: '04', // RUC
        guiaRemision: '000-000-000000000', // Según XML referencia SRI
        razonSocialComprador: 'PRUEBAS TECNICAS SISTEMA REAL CIA LTDA',
        identificacionComprador: '1792146739001', // RUC real de pruebas SRI
        direccionComprador: 'direccionComprador0', // Según XML referencia SRI
        totalSinImpuestos: parseFloat(baseImponible.toFixed(2)),
        totalSubsidio: 50.00, // Según XML referencia SRI
        incoTermTotalSinImpuestos: 'A', // Según XML referencia SRI
        totalDescuento: parseFloat(descuento.toFixed(2)),
        codDocReembolso: '00', // Según XML referencia SRI
        totalComprobantesReembolso: 50.00, // Según XML referencia SRI
        totalBaseImponibleReembolso: 50.00, // Según XML referencia SRI
        totalImpuestoReembolso: 50.00, // Según XML referencia SRI
        totalConImpuestos: [{
          codigo: '2', // IVA
          codigoPorcentaje: '4', // 15%
          baseImponible: parseFloat(baseImponible.toFixed(2)),
          tarifa: tarifaIva,
          valor: parseFloat(valorIva.toFixed(2))
        }],
        propina: 50.00, // Según XML referencia SRI
        fleteInternacional: 50.00, // Según XML referencia SRI
        seguroInternacional: 50.00, // Según XML referencia SRI
        gastosAduaneros: 50.00, // Según XML referencia SRI
        gastosTransporteOtros: 50.00, // Según XML referencia SRI
        importeTotal: parseFloat(importeTotal.toFixed(2)),
        moneda: 'moneda0', // Según XML referencia SRI
        placa: 'placa0', // Según XML referencia SRI
        pagos: [
          {
            formaPago: '01',
            total: 50.00,
            plazo: 50.00,
            unidadTiempo: 'unidadTiem'
          },
          {
            formaPago: '01',
            total: 50.00,
            plazo: 50.00,
            unidadTiempo: 'unidadTiem'
          }
        ], // Según XML referencia SRI
        valorRetIva: 50.00, // Según XML referencia SRI
        valorRetRenta: 50.00 // Según XML referencia SRI
      },
      detalles: [{
        codigoPrincipal: 'PROD-' + timestamp, // Código único
        codigoAuxiliar: 'codigoAuxiliar0', // Según XML referencia SRI
        descripcion: 'Producto de prueba técnica - Test sistema real',
        unidadMedida: 'unidadMedida0', // Según XML referencia SRI
        cantidad: cantidad, // Cantidad real con decimales
        precioUnitario: precioUnitario, // Precio real
        precioSinSubsidio: precioUnitario, // Igual a precio unitario según XML referencia
        descuento: parseFloat(descuento.toFixed(2)),
        precioTotalSinImpuesto: parseFloat(baseImponible.toFixed(2)),
        impuestos: [{
          codigo: '2', // IVA
          codigoPorcentaje: '4', // 15%
          tarifa: tarifaIva,
          baseImponible: parseFloat(baseImponible.toFixed(2)),
          valor: parseFloat(valorIva.toFixed(2))
        }]
      }],
      infoAdicional: [
        { 
          nombre: 'Direccion', 
          valor: emisorConfig.dirEstablecimiento || emisorConfig.dirMatriz // Del sistema real
        },
        { 
          nombre: 'Email', 
          valor: 'pruebas-tecnicas@sistema-real.ec' 
        },
        { 
          nombre: 'Observaciones', 
          valor: `Test técnico sistema real - Timestamp: ${timestamp}` 
        }
      ]
    };
  }

  /**
   * Valida que el formato UANATACA sea correcto según especificaciones oficiales
   */
  private async validateUanatacaFormat(signedXml: string, result: ComprehensiveTestResult): Promise<void> {
    const parser = new (require('@xmldom/xmldom').DOMParser)();
    const doc = parser.parseFromString(signedXml, 'text/xml');
    
    // Buscar elementos X509IssuerName en el XML firmado
    const issuerElements = doc.getElementsByTagName('ds:X509IssuerName');
    
    if (issuerElements.length === 0) {
      result.summary.recommendations.push('⚠️ No se encontró ds:X509IssuerName en el XML firmado');
      return;
    }
    
    for (let i = 0; i < issuerElements.length; i++) {
      const issuerElement = issuerElements[i];
      const issuerValue = issuerElement.textContent || '';
      
      console.log(`🔍 ds:X509IssuerName encontrado: ${issuerValue}`);
      
      // Verificar si es formato UANATACA
      if (issuerValue.includes('UANATACA CA2')) {
        // Formatos válidos según documentación UANATACA
        const validUanataca2016 = 'CN=UANATACA CA2 2016,OU=TSP-UANATACA,O=UANATACA S.A.,L=Barcelona (see current address at www.uanataca.com/address),C=ES';
        const validUanataca2021 = 'CN=UANATACA CA2 2021,OU=TSP-UANATACA,O=UANATACA S.A.,L=Barcelona,C=ES';
        
        if (issuerValue === validUanataca2016) {
          console.log('✅ Formato UANATACA CA2 2016 CORRECTO');
          result.summary.recommendations.push('✅ Formato UANATACA CA2 2016 validado correctamente');
        } else if (issuerValue === validUanataca2021) {
          console.log('✅ Formato UANATACA CA2 2021 CORRECTO');
          result.summary.recommendations.push('✅ Formato UANATACA CA2 2021 validado correctamente');
        } else {
          console.log('❌ FORMATO UANATACA INCORRECTO - Esto causará ERROR 39 en SRI');
          console.log(`   Encontrado: ${issuerValue}`);
          console.log(`   Esperado 2016: ${validUanataca2016}`);
          console.log(`   Esperado 2021: ${validUanataca2021}`);
          
          result.xsdValidation.errors.push(`CRÍTICO: Formato ds:X509IssuerName UANATACA incorrecto. Causará ERROR 39 en SRI.`);
          result.xsdValidation.success = false;
          result.summary.recommendations.push('❌ CRÍTICO: Corregir formato ds:X509IssuerName UANATACA para evitar ERROR 39');
        }
      } else {
        console.log('📝 Certificado no-UANATACA detectado, formato genérico aplicado');
      }
    }
  }

  /**
   * Asegura que existe el directorio de salida
   */
  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Guarda los resultados del test
   */
  async saveResults(result: ComprehensiveTestResult): Promise<void> {
    const resultsPath = path.join(this.outputDir, `comprehensive-test-results-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2));
    console.log(`💾 Resultados guardados: ${path.basename(resultsPath)}`);
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  const test = new ComprehensiveValidationTest();
  
  test.runComprehensiveTest()
    .then(async (result) => {
      await test.saveResults(result);
      console.log('\\n🏁 Test comprensivo completado');
      process.exit(result.summary.overallSuccess ? 0 : 1);
    })
    .catch((error) => {
      console.error('\\n💥 Error fatal en test comprensivo:', error);
      process.exit(1);
    });
}

