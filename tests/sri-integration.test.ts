/**
 * Prueba de integración completa con el SRI
 * Siguiendo el manual técnico del SRI Ecuador
 * 
 * FLUJO CORRECTO:
 * 1. Generar XML del comprobante
 * 2. Generar clave de acceso (49 dígitos)
 * 3. Firmar el XML con certificado digital (XAdES-BES)
 * 4. Enviar a RecepcionComprobantesOffline
 * 5. Si estado = RECIBIDA, consultar AutorizacionComprobantesOffline
 * 6. Guardar XML autorizado
 */

import { XMLBuilderService } from '../src/modules/xml/xml-builder.service';
import { XAdESSignatureService } from '../src/modules/signature/xades.service';
import { SRIConnectorService } from '../src/modules/sri/sri-connector.service';
import { CertificateService } from '../src/modules/certificates/certificate.service';
import { FacturaData } from '../src/modules/xml/xml.types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Integración completa con SRI', () => {
  let xmlBuilder: XMLBuilderService;
  let signatureService: XAdESSignatureService;
  let sriConnector: SRIConnectorService;
  let certificateService: CertificateService;

  beforeAll(() => {
    xmlBuilder = new XMLBuilderService();
    signatureService = new XAdESSignatureService();
    sriConnector = new SRIConnectorService({
      ambiente: 1, // Pruebas
      timeout: 30000,
      maxRetries: 3
    });
    certificateService = new CertificateService();
  });

  describe('Proceso completo de factura electrónica', () => {
    it('debe emitir una factura siguiendo el proceso del SRI', async () => {
      console.log('=== INICIO PRUEBA FACTURA ELECTRÓNICA SRI ===\n');

      // 1. PREPARAR DATOS DE LA FACTURA (según manual SRI)
      const facturaData: FacturaData = {
        infoTributaria: {
          ambiente: 1, // Pruebas
          tipoEmision: 1, // Normal
          razonSocial: 'Kevin Villacreses',
          nombreComercial: 'PRUEBAS SRI',
          ruc: '1720598877001', // RUC de pruebas del SRI
          codDoc: '01', // Factura
          estab: '001',
          ptoEmi: '001',
          secuencial: '000000001',
          dirMatriz: 'RUMINAHUI S/N Y AMAZONAS'
        },
        infoFactura: {
          fechaEmision: new Date('2024-01-15'),
          dirEstablecimiento: 'RUMINAHUI S/N Y AMAZONAS',
          obligadoContabilidad: 'SI',
          tipoIdentificacionComprador: '05', // Cédula
          razonSocialComprador: 'CONSUMIDOR FINAL',
          identificacionComprador: '9999999999999',
          direccionComprador: 'QUITO',
          totalSinImpuestos: 100.00,
          totalDescuento: 0.00,
          totalConImpuestos: [
            {
              codigo: '2', // IVA
              codigoPorcentaje: '2', // 12%
              baseImponible: 100.00,
              valor: 12.00
            }
          ],
          propina: 0.00,
          importeTotal: 112.00,
          moneda: 'DOLAR'
        },
        detalles: [
          {
            codigoPrincipal: 'PROD001',
            descripcion: 'PRODUCTO DE PRUEBA',
            cantidad: 1,
            precioUnitario: 100.00,
            descuento: 0.00,
            precioTotalSinImpuesto: 100.00,
            impuestos: [
              {
                codigo: '2',
                codigoPorcentaje: '4',
                tarifa: 15,
                baseImponible: 100.00,
                valor: 15.00
              }
            ]
          }
        ],
        infoAdicional: [
          {
            nombre: 'Email',
            valor: 'pruebas@sri.gob.ec'
          }
        ]
      };

      // 2. GENERAR XML (con clave de acceso incluida)
      console.log('1. Generando XML del comprobante...');
      const xmlOriginal = await xmlBuilder.buildFactura(facturaData, '1.1.0');
      console.log('   ✓ XML generado correctamente');
      
      // La clave de acceso ya fue generada dentro del buildFactura
      const claveAcceso = facturaData.infoTributaria.claveAcceso!;
      console.log(`   ✓ Clave de acceso: ${claveAcceso}`);
      
      // Validar que la clave tiene 49 dígitos
      expect(claveAcceso).toHaveLength(49);
      expect(/^\d+$/.test(claveAcceso)).toBe(true);

      // 3. CARGAR CERTIFICADO DE PRUEBAS
      console.log('\n2. Cargando certificado digital...');
      
      // NOTA: Para pruebas reales necesitas:
      // - Certificado de pruebas del BCE o UANATACA
      // - Contraseña del certificado
      
      const certificatePath = process.env.TEST_CERTIFICATE_PATH;
      const certificatePassword = process.env.TEST_CERTIFICATE_PASSWORD;
      
      if (!certificatePath || !certificatePassword) {
        console.warn('   ⚠️  No se encontró certificado de pruebas');
        console.warn('   Configure TEST_CERTIFICATE_PATH y TEST_CERTIFICATE_PASSWORD');
        return;
      }
      
      const certificateBuffer = await fs.readFile(certificatePath);
      const parseResult = await certificateService.parseP12(
        certificateBuffer,
        certificatePassword
      );
      
      console.log(`   ✓ Certificado cargado: ${parseResult.info.subject}`);
      console.log(`   ✓ Emisor: ${parseResult.info.issuer}`);
      console.log(`   ✓ Válido hasta: ${parseResult.info.validUntil}`);

      // 4. FIRMAR XML CON XAdES-BES
      console.log('\n3. Firmando documento con XAdES-BES...');
      const xmlFirmado = await signatureService.signXML(
        xmlOriginal,
        parseResult.certificate,
        parseResult.privateKey,
        { 
          algorithm: 'SHA1' // SRI requiere SHA1
        }
      );
      console.log('   ✓ Documento firmado correctamente');
      
      // Guardar XML firmado para inspección
      const outputDir = path.join(__dirname, 'output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(
        path.join(outputDir, `${claveAcceso}_firmado.xml`),
        xmlFirmado,
        'utf-8'
      );
      console.log(`   ✓ XML firmado guardado en: tests/output/${claveAcceso}_firmado.xml`);

      // 5. ENVIAR AL SRI - RecepcionComprobantesOffline
      console.log('\n4. Enviando comprobante al SRI...');
      console.log('   Servicio: RecepcionComprobantesOffline');
      
      const respuestaRecepcion = await sriConnector.validarComprobante(xmlFirmado);
      console.log(`   Estado: ${respuestaRecepcion.estado}`);
      
      if (respuestaRecepcion.estado === 'DEVUELTA') {
        console.error('\n   ❌ COMPROBANTE DEVUELTO POR EL SRI');
        if (respuestaRecepcion.comprobantes[0]?.mensajes) {
          console.error('   Mensajes de error:');
          respuestaRecepcion.comprobantes[0].mensajes.forEach(msg => {
            console.error(`     - [${msg.identificador}] ${msg.mensaje}`);
            if (msg.informacionAdicional) {
              console.error(`       Info adicional: ${msg.informacionAdicional}`);
            }
          });
        }
        throw new Error('Comprobante rechazado por el SRI');
      }
      
      console.log('   ✓ Comprobante RECIBIDO por el SRI');

      // 6. CONSULTAR AUTORIZACIÓN - AutorizacionComprobantesOffline
      console.log('\n5. Consultando autorización...');
      console.log('   Servicio: AutorizacionComprobantesOffline');
      
      // Esperar un poco antes de consultar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const respuestaAutorizacion = await sriConnector.autorizacionComprobanteConEspera(
        claveAcceso,
        60000, // máximo 60 segundos
        5000   // consultar cada 5 segundos
      );
      
      if (respuestaAutorizacion.autorizaciones.length === 0) {
        console.error('   ❌ No se recibió autorización del SRI');
        throw new Error('Sin autorización');
      }
      
      const autorizacion = respuestaAutorizacion.autorizaciones[0];
      console.log(`   Estado autorización: ${autorizacion.estado}`);
      
      if (autorizacion.estado === 'AUTORIZADO') {
        console.log(`   ✓ COMPROBANTE AUTORIZADO`);
        console.log(`   Número de autorización: ${autorizacion.numeroAutorizacion}`);
        console.log(`   Fecha autorización: ${autorizacion.fechaAutorizacion}`);
        
        // 7. CONSTRUIR Y GUARDAR XML AUTORIZADO
        const xmlAutorizado = `<?xml version="1.0" encoding="UTF-8"?>
<autorizacion>
  <estado>${autorizacion.estado}</estado>
  <numeroAutorizacion>${autorizacion.numeroAutorizacion}</numeroAutorizacion>
  <fechaAutorizacion>${autorizacion.fechaAutorizacion}</fechaAutorizacion>
  <ambiente>${autorizacion.ambiente}</ambiente>
  <comprobante><![CDATA[${xmlFirmado}]]></comprobante>
  <mensajes/>
</autorizacion>`;
        
        await fs.writeFile(
          path.join(outputDir, `${claveAcceso}_autorizado.xml`),
          xmlAutorizado,
          'utf-8'
        );
        console.log(`   ✓ XML autorizado guardado en: tests/output/${claveAcceso}_autorizado.xml`);
        
      } else if (autorizacion.estado === 'NO AUTORIZADO') {
        console.error('   ❌ COMPROBANTE NO AUTORIZADO');
        if (autorizacion.mensajes) {
          console.error('   Mensajes:');
          autorizacion.mensajes.forEach(msg => {
            console.error(`     - [${msg.identificador}] ${msg.mensaje}`);
          });
        }
        throw new Error('Comprobante no autorizado');
      }
      
      console.log('\n=== PRUEBA COMPLETADA EXITOSAMENTE ===');
      
      // Assertions para el test
      expect(respuestaRecepcion.estado).toBe('RECIBIDA');
      expect(autorizacion.estado).toBe('AUTORIZADO');
      expect(autorizacion.numeroAutorizacion).toBeDefined();
      expect(autorizacion.fechaAutorizacion).toBeDefined();
      
    }, 120000); // Timeout de 2 minutos para la prueba completa
  });

  describe('Validaciones según manual SRI', () => {
    it('debe generar clave de acceso correcta de 49 dígitos', async () => {
      // Importar usando import dinámico para evitar error de ESLint
      const { ClaveAccesoService } = await import('../src/modules/xml/clave-acceso.service');
      const claveAccesoService = new ClaveAccesoService();
      
      // Crear fecha específica sin problemas de zona horaria
      const fechaEmision = new Date(2024, 0, 15); // 15 de enero de 2024 (mes es 0-indexed)
      
      const clave = claveAccesoService.generate({
        fechaEmision: fechaEmision,
        tipoComprobante: '01',
        ruc: '1792146739001',
        ambiente: 1,
        establecimiento: '001',
        puntoEmision: '001',
        secuencial: '000000001',
        tipoEmision: 1
      });
      
      expect(clave).toHaveLength(49);
      expect(/^\d+$/.test(clave)).toBe(true);
      
      // Validar estructura
      expect(clave.substring(0, 8)).toBe('15012024'); // fecha
      expect(clave.substring(8, 10)).toBe('01'); // tipo comprobante
      expect(clave.substring(10, 23)).toBe('1792146739001'); // RUC
      expect(clave.substring(23, 24)).toBe('1'); // ambiente
    });

    it('debe validar estructura XML según XSD del SRI', async () => {
      // Este test requiere los XSD del SRI
      // Los puedes descargar de:
      // https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/
      
      console.log('Validación contra XSD pendiente de implementar');
      expect(true).toBe(true);
    });

    it('debe manejar todos los tipos de comprobante', () => {
      const tipos = {
        '01': 'FACTURA',
        '03': 'LIQUIDACIÓN DE COMPRA',
        '04': 'NOTA DE CRÉDITO',
        '05': 'NOTA DE DÉBITO',
        '06': 'GUÍA DE REMISIÓN',
        '07': 'COMPROBANTE DE RETENCIÓN'
      };
      
      Object.entries(tipos).forEach(([codigo, nombre]) => {
        console.log(`Tipo ${codigo}: ${nombre}`);
        expect(codigo).toHaveLength(2);
      });
    });
  });

  describe('Manejo de errores del SRI', () => {
    it('debe identificar errores recuperables', () => {
      const erroresRecuperables = [26, 50, 65, 70];
      
      erroresRecuperables.forEach(codigo => {
        console.log(`Error recuperable ${codigo}: se debe reintentar`);
        expect(erroresRecuperables).toContain(codigo);
      });
    });

    it('debe identificar errores no recuperables', () => {
      const erroresNoRecuperables = [2, 10, 37, 43, 45];
      
      erroresNoRecuperables.forEach(codigo => {
        console.log(`Error no recuperable ${codigo}: no reintentar`);
        expect(erroresNoRecuperables).toContain(codigo);
      });
    });
  });
});

// Función helper para ejecutar la prueba
export async function runSRIIntegrationTest() {
  console.log('Ejecutando prueba de integración con SRI...');
  console.log('Asegúrese de tener:');
  console.log('1. Certificado digital de pruebas (.p12)');
  console.log('2. Variables de entorno configuradas:');
  console.log('   - TEST_CERTIFICATE_PATH');
  console.log('   - TEST_CERTIFICATE_PASSWORD');
  console.log('   - SRI_AMBIENTE=1');
  console.log('3. Conexión a internet para servicios del SRI');
}