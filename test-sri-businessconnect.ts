/**
 * PRUEBA CON DATOS REALES DE BUSINESSCONNECT S.A.S.
 * Usando el certificado UANATACA proporcionado
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { XMLBuilderService } from './src/modules/xml/xml-builder.service';
import { XAdESSignatureService } from './src/modules/signature/xades.service';
import { SRIConnectorService } from './src/modules/sri/sri-connector.service';
import { CertificateService } from './src/modules/certificates/certificate.service';
import { FacturaData } from './src/modules/xml/xml.types';

dotenv.config();

async function testBusinessConnect() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         PRUEBA BUSINESSCONNECT S.A.S. - SRI ECUADOR        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Obtener número de secuencial único basado en timestamp
    const secuencial = new Date().getTime().toString().slice(-9).padStart(9, '0');
    
    const facturaData: FacturaData = {
      infoTributaria: {
        ambiente: 1, // Pruebas
        tipoEmision: 1, // Normal
        razonSocial: 'BUSINESSCONNECT S.A.S.',
        nombreComercial: 'BUSINESSCONNECT',
        ruc: '1793204144001',
        codDoc: '01', // Factura
        estab: '001',
        ptoEmi: '001',
        secuencial: secuencial,
        dirMatriz: 'RAMIREZ DAVALOS Y AV. AMAZONAS EDIFICIO CENTRO AMAZONAS OF. 402',
        contribuyenteRimpe: 'CONTRIBUYENTE RÉGIMEN RIMPE' // Régimen RIMPE
      },
      infoFactura: {
        fechaEmision: new Date(),
        dirEstablecimiento: 'RAMIREZ DAVALOS Y AV. AMAZONAS EDIFICIO CENTRO AMAZONAS OF. 402',
        obligadoContabilidad: 'SI',
        tipoIdentificacionComprador: '07', // Consumidor Final
        razonSocialComprador: 'Kevin Villacreses',
        identificacionComprador: '1720598877',
        direccionComprador: 'Ferroviaria, Quito',
        totalSinImpuestos: 100.00,
        totalDescuento: 0.00,
        totalConImpuestos: [
          {
            codigo: '2', // IVA
            codigoPorcentaje: '4', // 15% IVA 
            baseImponible: 100.00,
            valor: 15.00
          }
        ],
        propina: 0.00,
        importeTotal: 115.00,
        moneda: 'DOLAR'
      },
      detalles: [
        {
          codigoPrincipal: 'SERV001',
          codigoAuxiliar: 'SERV001-A',
          descripcion: 'SERVICIO DE CONSULTORÍA TECNOLÓGICA',
          cantidad: 1,
          precioUnitario: 100.00,
          descuento: 0.00,
          precioTotalSinImpuesto: 100.00,
          impuestos: [
            {
              codigo: '2',
              codigoPorcentaje: '4', // 15% IVA
              tarifa: 15,
              baseImponible: 100.00,
              valor: 15.00
            }
          ]
        }
      ],
      infoAdicional: [
        {
          nombre: 'Dirección',
          valor: 'RAMIREZ DAVALOS Y AV. AMAZONAS'
        },
        {
          nombre: 'Teléfono',
          valor: '0999999999'
        },
        {
          nombre: 'Email',
          valor: 'info@businessconnect.com.ec'
        }
      ]
    };

    console.log(' INFORMACIÓN DEL COMPROBANTE\n');
    console.log(`   Emisor: ${facturaData.infoTributaria.razonSocial}`);
    console.log(`   RUC: ${facturaData.infoTributaria.ruc}`);
    console.log(`   Ambiente: ${facturaData.infoTributaria.ambiente === 1 ? 'PRUEBAS' : 'PRODUCCIÓN'}`);
    console.log(`   Tipo: FACTURA`);
    console.log(`   Serie: ${facturaData.infoTributaria.estab}-${facturaData.infoTributaria.ptoEmi}`);
    console.log(`   Secuencial: ${facturaData.infoTributaria.secuencial}`);
    console.log(`   Cliente: ${facturaData.infoFactura.razonSocialComprador}`);
    console.log(`   Total: $${facturaData.infoFactura.importeTotal}`);
    console.log(`   Régimen: RIMPE`);
    console.log(`   IVA: 15% (obligatorio desde 2025)\n`);

    // 1. GENERAR XML
    console.log('🔧 PASO 1: Generando XML\n');
    const xmlBuilder = new XMLBuilderService();
    const xmlOriginal = await xmlBuilder.buildFactura(facturaData, '1.1.0');
    const claveAcceso = facturaData.infoTributaria.claveAcceso!;
    
    console.log(`   ✓ XML generado (versión 1.1.0)`);
    console.log(`   ✓ Clave de acceso: ${claveAcceso}`);
    console.log(`   ✓ Longitud: ${claveAcceso.length} dígitos\n`);

    // 2. CARGAR CERTIFICADO
    console.log(' PASO 2: Cargando certificado UANATACA\n');
    const certificateService = new CertificateService();
    const certificateBuffer = await fs.readFile('./17092284_identity_1719307785.p12');
    
    const parseResult = await certificateService.parseP12(
      certificateBuffer,
      'FBConnect01'
    );
    
    console.log(`   ✓ Certificado: ${parseResult.info.subject}`);
    console.log(`   ✓ Emisor: UANATACA CA2 2016`);
    console.log(`   ✓ Válido hasta: ${parseResult.info.validUntil.toLocaleDateString()}`);
    
    // Verificar que el RUC del certificado coincida
    if (parseResult.info.subject.includes('1793204144001')) {
      console.log(`   ✓ RUC del certificado coincide con el emisor\n`);
    } else {
      console.warn(` Advertencia: RUC del certificado podría no coincidir\n`);
    }

    // 3. FIRMAR XML
    console.log(' PASO 3: Firmando con XAdES-BES\n');
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
    
    console.log('   ✓ Documento firmado correctamente');
    console.log('   ✓ Algoritmo: SHA1withRSA');
    console.log('   ✓ Tipo: ENVELOPED');
    console.log('   ✓ Estándar: XAdES-BES\n');

    // Guardar XMLs para depuración
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Guardar XML sin firmar
    await fs.writeFile(
      path.join(outputDir, `${claveAcceso}_original.xml`),
      xmlOriginal,
      'utf-8'
    );
    
    // Guardar XML firmado
    await fs.writeFile(
      path.join(outputDir, `${claveAcceso}_firmado.xml`),
      xmlFirmado,
      'utf-8'
    );
    
    console.log(`   ✓ XMLs guardados en carpeta output/\n`);

    // 4. ENVIAR AL SRI
    console.log(' PASO 4: Enviando al SRI\n');
    console.log('   Servicio: RecepcionComprobantesOffline');
    console.log('   URL: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline\n');
    
    const sriConnector = new SRIConnectorService({
      ambiente: 1,
      timeout: 30000,
      maxRetries: 3
    });

    console.log(' Enviando comprobante...\n');
    const respuestaRecepcion = await sriConnector.validarComprobante(xmlFirmado);
    
    console.log(` Respuesta: ${respuestaRecepcion.estado}\n`);
    
    if (respuestaRecepcion.estado === 'DEVUELTA') {
      console.log('❌ COMPROBANTE DEVUELTO\n');
      
      if (respuestaRecepcion.comprobantes[0]?.mensajes) {
        console.log('Mensajes del SRI:');
        respuestaRecepcion.comprobantes[0].mensajes.forEach(msg => {
          console.log(`\n   Código: ${msg.identificador}`);
          console.log(`   Tipo: ${msg.tipo}`);
          console.log(`   Mensaje: ${msg.mensaje}`);
          if (msg.informacionAdicional) {
            console.log(`   Info adicional: ${msg.informacionAdicional}`);
          }
        });
      }
      
      console.log('\n ANÁLISIS DEL ERROR:\n');
      
      const mensajes = respuestaRecepcion.comprobantes[0]?.mensajes || [];
      
      mensajes.forEach(msg => {
        switch(msg.identificador) {
          case '35':
            console.log('   → El XML no cumple con la estructura esperada');
            console.log('     Posibles causas:');
            console.log('     • Versión del XML incorrecta');
            console.log('     • Campos faltantes o mal formateados');
            console.log('     • Problema con la codificación UTF-8');
            break;
          case '39':
            console.log('   → Firma digital inválida');
            console.log('     Verificar certificado y proceso de firma');
            break;
          case '43':
            console.log('   → Clave de acceso ya registrada');
            console.log('     Usar un nuevo secuencial');
            break;
          case '45':
            console.log('   → Secuencial ya registrado');
            break;
          case '56':
            console.log('   → Establecimiento cerrado');
            console.log('     Verificar configuración en el SRI');
            break;
          case '58':
            console.log('   → Error en fechas o plazos');
            break;
          case '65':
            console.log('   → Fecha de emisión extemporánea');
            break;
          default:
            if (msg.mensaje.includes('RUC')) {
              console.log('   → Problema con el RUC del emisor');
              console.log('     Verificar que el RUC esté habilitado para facturación electrónica');
            }
        }
      });
      
    } else if (respuestaRecepcion.estado === 'RECIBIDA') {
      console.log('✅ COMPROBANTE RECIBIDO CORRECTAMENTE\n');
      
      // 5. CONSULTAR AUTORIZACIÓN
      console.log('🔍 PASO 5: Consultando autorización\n');
      console.log('   Servicio: AutorizacionComprobantesOffline');
      console.log('   Esperando respuesta del SRI...\n');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const respuestaAutorizacion = await sriConnector.autorizacionComprobanteConEspera(
        claveAcceso,
        60000,
        5000
      );
      
      if (respuestaAutorizacion.autorizaciones.length > 0) {
        const auth = respuestaAutorizacion.autorizaciones[0];
        
        if (auth.estado === 'AUTORIZADO') {
          console.log('✅ FACTURA AUTORIZADA\n');
          console.log(`   Número de autorización: ${auth.numeroAutorizacion}`);
          console.log(`   Fecha autorización: ${auth.fechaAutorizacion}`);
          console.log(`   Clave de acceso: ${claveAcceso}\n`);
          
          // Guardar XML autorizado
          const xmlAutorizado = `<?xml version="1.0" encoding="UTF-8"?>
<autorizacion>
  <estado>${auth.estado}</estado>
  <numeroAutorizacion>${auth.numeroAutorizacion}</numeroAutorizacion>
  <fechaAutorizacion>${auth.fechaAutorizacion}</fechaAutorizacion>
  <ambiente>${auth.ambiente}</ambiente>
  <comprobante><![CDATA[${xmlFirmado}]]></comprobante>
  <mensajes/>
</autorizacion>`;
          
          await fs.writeFile(
            path.join(outputDir, `${claveAcceso}_autorizado.xml`),
            xmlAutorizado,
            'utf-8'
          );
          
          console.log('   ✓ XML autorizado guardado en output/\n');
          
          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║                    ✅ PRUEBA EXITOSA                      ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          
        } else if (auth.estado === 'NO AUTORIZADO') {
          console.log('❌ FACTURA NO AUTORIZADA\n');
          
          if (auth.mensajes) {
            console.log('Razones:');
            auth.mensajes.forEach(msg => {
              console.log(`   - ${msg.mensaje}`);
            });
          }
        } else {
          console.log(`   Estado: ${auth.estado}`);
        }
      } else {
        console.log('   ⚠️  No se recibió información de autorización');
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ ERROR EN EL PROCESO:\n');
    console.error(`   ${error.message}\n`);
    
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.error('Stack trace:');
      console.error(error.stack);
    }
  }
}

// Ejecutar la prueba
console.log('🚀 Iniciando prueba con datos de BUSINESSCONNECT S.A.S.\n');
testBusinessConnect().catch(console.error);