/**
 * EJEMPLO COMPLETO DE EMISIÓN DE FACTURA ELECTRÓNICA
 * Siguiendo el manual técnico del SRI Ecuador
 * 
 * Este ejemplo muestra el proceso completo paso a paso
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { XMLBuilderService } from '../src/modules/xml/xml-builder.service';
import { XAdESSignatureService } from '../src/modules/signature/xades.service';
import { SRIConnectorService } from '../src/modules/sri/sri-connector.service';
import { CertificateService } from '../src/modules/certificates/certificate.service';
import { FacturaData } from '../src/modules/xml/xml.types';
import { debeUsarIVA15, getCodigoIVAPorTarifa, calcularIVA } from '../src/modules/xml/tax-constants';

// Cargar variables de entorno
dotenv.config();

async function emitirFactura() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     EMISIÓN DE FACTURA ELECTRÓNICA - SRI ECUADOR          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // ============================================================
    // PASO 1: DATOS DEL EMISOR Y COMPROBANTE
    // ============================================================
    console.log('📋 PASO 1: Preparando datos del comprobante\n');
    
    // Determinar tarifa de IVA según el año
    const fechaEmision = new Date();
    const usarIVA15 = debeUsarIVA15(fechaEmision);
    const tarifaIVA = usarIVA15 ? 15 : 12;
    const codigoIVA = getCodigoIVAPorTarifa(tarifaIVA, fechaEmision);
    
    console.log(`✓ Usando IVA ${tarifaIVA}% (código: ${codigoIVA})${usarIVA15 ? ' - Obligatorio desde 2025' : ''}\n`);
    
    const facturaData: FacturaData = {
      infoTributaria: {
        ambiente: parseInt(process.env.SRI_AMBIENTE || '1'), // 1=Pruebas, 2=Producción
        tipoEmision: 1, // 1=Normal, 2=Contingencia
        razonSocial: 'EMPRESA DE PRUEBAS S.A.',
        nombreComercial: 'MI EMPRESA',
        ruc: '1234567890001', // RUC del emisor
        codDoc: '01', // 01 = Factura
        estab: '001', // Establecimiento
        ptoEmi: '001', // Punto de emisión
        secuencial: '000001234', // Secuencial (9 dígitos)
        dirMatriz: 'AV. PRINCIPAL 123 Y SECUNDARIA'
      },
      infoFactura: {
        fechaEmision: fechaEmision,
        dirEstablecimiento: 'AV. PRINCIPAL 123 Y SECUNDARIA',
        contribuyenteEspecial: '1234', // Si aplica
        obligadoContabilidad: 'SI',
        tipoIdentificacionComprador: '05', // 05=Cédula, 04=RUC, 06=Pasaporte, 07=Consumidor Final
        razonSocialComprador: 'JUAN PEREZ',
        identificacionComprador: '1712345678',
        direccionComprador: 'QUITO, ECUADOR',
        totalSinImpuestos: 100.00,
        totalDescuento: 5.00,
        totalConImpuestos: [
          {
            codigo: '2', // 2 = IVA
            codigoPorcentaje: codigoIVA,
            baseImponible: 95.00,
            valor: calcularIVA(95.00, codigoIVA)
          }
        ],
        propina: 0.00,
        importeTotal: 95.00 + calcularIVA(95.00, codigoIVA),
        moneda: 'DOLAR'
      },
      detalles: [
        {
          codigoPrincipal: 'PROD001',
          codigoAuxiliar: 'AUX001',
          descripcion: 'SERVICIO DE CONSULTORIA TECNICA',
          cantidad: 1,
          precioUnitario: 100.00,
          descuento: 5.00,
          precioTotalSinImpuesto: 95.00,
          detallesAdicionales: [
            {
              nombre: 'Marca',
              valor: 'GENERICO'
            }
          ],
          impuestos: [
            {
              codigo: '2',
              codigoPorcentaje: codigoIVA,
              tarifa: tarifaIVA,
              baseImponible: 95.00,
              valor: calcularIVA(95.00, codigoIVA)
            }
          ]
        }
      ],
      infoAdicional: [
        {
          nombre: 'Teléfono',
          valor: '0999999999'
        },
        {
          nombre: 'Email',
          valor: 'cliente@example.com'
        },
        {
          nombre: 'Observaciones',
          valor: 'Factura emitida mediante sistema electrónico'
        }
      ]
    };

    console.log(`✓ Tipo de comprobante: FACTURA`);
    console.log(`✓ RUC emisor: ${facturaData.infoTributaria.ruc}`);
    console.log(`✓ Establecimiento: ${facturaData.infoTributaria.estab}-${facturaData.infoTributaria.ptoEmi}`);
    console.log(`✓ Secuencial: ${facturaData.infoTributaria.secuencial}`);
    console.log(`✓ Cliente: ${facturaData.infoFactura.razonSocialComprador}`);
    console.log(`✓ Total: $${facturaData.infoFactura.importeTotal}\n`);

    // ============================================================
    // PASO 2: GENERAR XML Y CLAVE DE ACCESO
    // ============================================================
    console.log('🔑 PASO 2: Generando XML y clave de acceso\n');
    
    const xmlBuilder = new XMLBuilderService();
    const xmlOriginal = await xmlBuilder.buildFactura(facturaData, '1.1.0');
    
    // La clave de acceso se genera automáticamente dentro del buildFactura
    const claveAcceso = facturaData.infoTributaria.claveAcceso!;
    
    console.log(`✓ XML generado (versión 1.1.0)`);
    console.log(`✓ Clave de acceso: ${claveAcceso}`);
    console.log(`  Longitud: ${claveAcceso.length} dígitos`);
    
    // Desglose de la clave de acceso
    console.log('\n  Estructura de la clave:');
    console.log(`  - Fecha: ${claveAcceso.substring(0, 8)}`);
    console.log(`  - Tipo comprobante: ${claveAcceso.substring(8, 10)}`);
    console.log(`  - RUC: ${claveAcceso.substring(10, 23)}`);
    console.log(`  - Ambiente: ${claveAcceso.substring(23, 24)}`);
    console.log(`  - Serie: ${claveAcceso.substring(24, 30)}`);
    console.log(`  - Secuencial: ${claveAcceso.substring(30, 39)}`);
    console.log(`  - Código numérico: ${claveAcceso.substring(39, 47)}`);
    console.log(`  - Tipo emisión: ${claveAcceso.substring(47, 48)}`);
    console.log(`  - Dígito verificador: ${claveAcceso.substring(48, 49)}\n`);

    // ============================================================
    // PASO 3: CARGAR CERTIFICADO DIGITAL
    // ============================================================
    console.log('🔐 PASO 3: Cargando certificado digital\n');
    
    const certificatePath = process.env.CERTIFICATE_PATH;
    const certificatePassword = process.env.CERTIFICATE_PASSWORD;
    
    if (!certificatePath || !certificatePassword) {
      throw new Error('Configure CERTIFICATE_PATH y CERTIFICATE_PASSWORD en el archivo .env');
    }
    
    const certificateService = new CertificateService();
    const certificateBuffer = await fs.readFile(certificatePath);
    
    console.log(`✓ Leyendo certificado desde: ${certificatePath}`);
    
    const parseResult = await certificateService.parseP12(
      certificateBuffer,
      certificatePassword
    );
    
    console.log(`✓ Certificado parseado correctamente`);
    console.log(`  - Emisor: ${parseResult.info.issuer}`);
    console.log(`  - Titular: ${parseResult.info.subject}`);
    console.log(`  - Válido desde: ${parseResult.info.validFrom.toLocaleDateString()}`);
    console.log(`  - Válido hasta: ${parseResult.info.validUntil.toLocaleDateString()}`);
    console.log(`  - Es UANATACA: ${parseResult.isUANATACA ? 'Sí' : 'No'}\n`);

    // ============================================================
    // PASO 4: FIRMAR XML CON XAdES-BES
    // ============================================================
    console.log('✍️  PASO 4: Firmando documento con XAdES-BES\n');
    
    const signatureService = new XAdESSignatureService();
    const xmlFirmado = await signatureService.signXML(
      xmlOriginal,
      parseResult.certificate,
      parseResult.privateKey,
      { 
        algorithm: 'SHA1', // SRI requiere SHA1
        signatureType: 'ENVELOPED'
      }
    );
    
    console.log(`✓ Documento firmado correctamente`);
    console.log(`  - Algoritmo: SHA1withRSA`);
    console.log(`  - Tipo: ENVELOPED`);
    console.log(`  - Estándar: XAdES-BES v1.3.2\n`);
    
    // Guardar XML firmado localmente
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    const xmlFirmadoPath = path.join(outputDir, `${claveAcceso}_firmado.xml`);
    await fs.writeFile(xmlFirmadoPath, xmlFirmado, 'utf-8');
    console.log(`✓ XML firmado guardado en: ${xmlFirmadoPath}\n`);

    // ============================================================
    // PASO 5: ENVIAR AL SRI (RecepcionComprobantesOffline)
    // ============================================================
    console.log('📤 PASO 5: Enviando al SRI - Recepción\n');
    
    const sriConnector = new SRIConnectorService({
      ambiente: parseInt(process.env.SRI_AMBIENTE || '1'),
      timeout: 30000,
      maxRetries: 3
    });
    
    const urlRecepcion = process.env.SRI_AMBIENTE === '1' 
      ? 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline'
      : 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline';
    
    console.log(`✓ Ambiente: ${process.env.SRI_AMBIENTE === '1' ? 'PRUEBAS' : 'PRODUCCIÓN'}`);
    console.log(`✓ URL: ${urlRecepcion}`);
    console.log(`✓ Método: validarComprobante\n`);
    
    console.log('⏳ Enviando comprobante...\n');
    
    const respuestaRecepcion = await sriConnector.validarComprobante(xmlFirmado);
    
    console.log(`✓ Respuesta recibida: ${respuestaRecepcion.estado}\n`);
    
    if (respuestaRecepcion.estado === 'DEVUELTA') {
      console.error('❌ COMPROBANTE DEVUELTO\n');
      
      if (respuestaRecepcion.comprobantes[0]?.mensajes) {
        console.error('Errores reportados por el SRI:');
        respuestaRecepcion.comprobantes[0].mensajes.forEach(msg => {
          console.error(`\n  Código: ${msg.identificador}`);
          console.error(`  Mensaje: ${msg.mensaje}`);
          console.error(`  Tipo: ${msg.tipo}`);
          if (msg.informacionAdicional) {
            console.error(`  Info adicional: ${msg.informacionAdicional}`);
          }
        });
      }
      
      throw new Error('El comprobante fue rechazado por el SRI');
    }
    
    console.log('✅ COMPROBANTE RECIBIDO CORRECTAMENTE\n');

    // ============================================================
    // PASO 6: CONSULTAR AUTORIZACIÓN (AutorizacionComprobantesOffline)
    // ============================================================
    console.log('🔍 PASO 6: Consultando autorización\n');
    
    const urlAutorizacion = process.env.SRI_AMBIENTE === '1'
      ? 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline'
      : 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline';
    
    console.log(`✓ URL: ${urlAutorizacion}`);
    console.log(`✓ Método: autorizacionComprobante`);
    console.log(`✓ Clave de acceso: ${claveAcceso}\n`);
    
    console.log('⏳ Esperando autorización (puede tomar hasta 60 segundos)...\n');
    
    const respuestaAutorizacion = await sriConnector.autorizacionComprobanteConEspera(
      claveAcceso,
      60000, // máximo 60 segundos
      5000   // consultar cada 5 segundos
    );
    
    if (respuestaAutorizacion.autorizaciones.length === 0) {
      throw new Error('No se recibió autorización del SRI');
    }
    
    const autorizacion = respuestaAutorizacion.autorizaciones[0];
    
    console.log(`✓ Estado: ${autorizacion.estado}\n`);
    
    if (autorizacion.estado === 'AUTORIZADO') {
      console.log('✅ COMPROBANTE AUTORIZADO\n');
      console.log(`  Número de autorización: ${autorizacion.numeroAutorizacion}`);
      console.log(`  Fecha autorización: ${autorizacion.fechaAutorizacion}`);
      console.log(`  Ambiente: ${autorizacion.ambiente === '1' ? 'PRUEBAS' : 'PRODUCCIÓN'}\n`);
      
      // ============================================================
      // PASO 7: GENERAR Y GUARDAR XML AUTORIZADO
      // ============================================================
      console.log('💾 PASO 7: Guardando comprobante autorizado\n');
      
      const xmlAutorizado = `<?xml version="1.0" encoding="UTF-8"?>
<autorizacion>
  <estado>${autorizacion.estado}</estado>
  <numeroAutorizacion>${autorizacion.numeroAutorizacion}</numeroAutorizacion>
  <fechaAutorizacion>${autorizacion.fechaAutorizacion}</fechaAutorizacion>
  <ambiente>${autorizacion.ambiente}</ambiente>
  <comprobante><![CDATA[${xmlFirmado}]]></comprobante>
  <mensajes/>
</autorizacion>`;
      
      const xmlAutorizadoPath = path.join(outputDir, `${claveAcceso}_autorizado.xml`);
      await fs.writeFile(xmlAutorizadoPath, xmlAutorizado, 'utf-8');
      
      console.log(`✓ XML autorizado guardado en: ${xmlAutorizadoPath}\n`);
      
      // ============================================================
      // RESUMEN FINAL
      // ============================================================
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║                    FACTURA EMITIDA EXITOSAMENTE           ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');
      console.log(`  📄 Clave de acceso: ${claveAcceso}`);
      console.log(`  ✅ Número autorización: ${autorizacion.numeroAutorizacion}`);
      console.log(`  📅 Fecha autorización: ${autorizacion.fechaAutorizacion}`);
      console.log(`  💰 Total: $${facturaData.infoFactura.importeTotal}`);
      console.log(`  📁 Archivos generados en: ${outputDir}\n`);
      
    } else if (autorizacion.estado === 'NO AUTORIZADO') {
      console.error('❌ COMPROBANTE NO AUTORIZADO\n');
      
      if (autorizacion.mensajes) {
        console.error('Razones:');
        autorizacion.mensajes.forEach(msg => {
          console.error(`\n  Código: ${msg.identificador}`);
          console.error(`  Mensaje: ${msg.mensaje}`);
          console.error(`  Tipo: ${msg.tipo}`);
        });
      }
      
      throw new Error('El comprobante no fue autorizado');
    }
    
  } catch (error: any) {
    console.error('\n❌ ERROR EN EL PROCESO:\n');
    console.error(error.message);
    
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  console.log('\n🚀 Iniciando proceso de emisión de factura...\n');
  emitirFactura();
}

export { emitirFactura };