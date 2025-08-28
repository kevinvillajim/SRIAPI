import * as fs from 'fs';
import * as path from 'path';
import * as soap from 'soap';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// URLs del SRI
const SRI_RECEPCION_URL = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
const SRI_AUTORIZACION_URL = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';

/**
 * Test para validar que el XML de referencia funciona correctamente con el SRI
 */
class ValidateReferenceXML {
    
    /**
     * Ejecuta la validación del XML de referencia
     */
    async runValidation(): Promise<void> {
        console.log('=== VALIDACIÓN DE XML DE REFERENCIA ===\n');
        console.log('Este test valida que el XML firmado de referencia funciona con el SRI\n');
        
        try {
            // 1. Cargar el XML firmado de referencia
            console.log('1. Cargando XML de referencia...');
            const xmlPath = path.join(__dirname, '../../1308202501120603993300110010010000001181321514411_Firmado.xml');
            console.log('   Archivo:', path.basename(xmlPath));
            
            let xmlContent = fs.readFileSync(xmlPath, 'utf-8');
            
            // Eliminar BOM si existe
            if (xmlContent.charCodeAt(0) === 0xFEFF) {
                xmlContent = xmlContent.slice(1);
                console.log('   BOM detectado y eliminado');
            }
            
            console.log('   ✓ XML cargado, tamaño:', xmlContent.length, 'caracteres');
            
            // Extraer clave de acceso del XML
            const claveMatch = xmlContent.match(/<claveAcceso>(\d{49})<\/claveAcceso>/);
            const claveAcceso = claveMatch ? claveMatch[1] : '';
            console.log('   🔑 Clave de acceso:', claveAcceso);
            console.log('');
            
            // 2. Convertir a Base64
            console.log('2. Convirtiendo XML a Base64...');
            const xmlBase64 = Buffer.from(xmlContent).toString('base64');
            console.log('   ✓ Conversión exitosa, tamaño Base64:', xmlBase64.length, 'caracteres\n');
            
            // 3. Enviar al servicio de Recepción
            console.log('3. Enviando al servicio de RECEPCIÓN del SRI...');
            console.log('   URL:', SRI_RECEPCION_URL);
            
            const recepcionClient = await soap.createClientAsync(SRI_RECEPCION_URL, {
                wsdl_options: {
                    timeout: 30000,
                    forever: true
                }
            });
            
            console.log('   Enviando comprobante...');
            const recepcionRequest = { xml: xmlBase64 };
            const [recepcionResult] = await recepcionClient.validarComprobanteAsync(recepcionRequest);
            
            const recepcionResponse = recepcionResult?.RespuestaRecepcionComprobante;
            
            console.log('\n   📨 RESPUESTA DE RECEPCIÓN:');
            console.log('   =====================================');
            console.log('   Estado:', recepcionResponse?.estado || 'Sin estado');
            
            // Procesar clave de acceso devuelta
            let claveAccesoRecibida = claveAcceso;
            if (recepcionResponse?.comprobantes?.comprobante?.claveAcceso) {
                claveAccesoRecibida = recepcionResponse.comprobantes.comprobante.claveAcceso;
                console.log('   Clave de acceso recibida:', claveAccesoRecibida);
            }
            
            // Mostrar mensajes si existen
            if (recepcionResponse?.comprobantes?.comprobante?.mensajes?.mensaje) {
                const mensajes = Array.isArray(recepcionResponse.comprobantes.comprobante.mensajes.mensaje)
                    ? recepcionResponse.comprobantes.comprobante.mensajes.mensaje
                    : [recepcionResponse.comprobantes.comprobante.mensajes.mensaje];
                    
                console.log('\n   Mensajes del SRI:');
                mensajes.forEach((msg: any) => {
                    const icono = msg.tipo === 'ERROR' ? '❌' : msg.tipo === 'ADVERTENCIA' ? '⚠️' : 'ℹ️';
                    console.log(`     ${icono} [${msg.identificador}] ${msg.tipo}: ${msg.mensaje}`);
                    if (msg.informacionAdicional) {
                        console.log(`        Info adicional: ${msg.informacionAdicional}`);
                    }
                });
            }
            
            console.log('   =====================================\n');
            
            // 4. Si fue RECIBIDA, consultar autorización
            if (recepcionResponse?.estado === 'RECIBIDA') {
                console.log('   ✅ Comprobante RECIBIDO correctamente\n');
                
                console.log('4. Consultando AUTORIZACIÓN del comprobante...');
                console.log('   URL:', SRI_AUTORIZACION_URL);
                console.log('   Esperando 3 segundos para que el SRI procese...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                const autorizacionClient = await soap.createClientAsync(SRI_AUTORIZACION_URL, {
                    wsdl_options: {
                        timeout: 30000,
                        forever: true
                    }
                });
                
                console.log('   Consultando con clave de acceso:', claveAccesoRecibida);
                const autorizacionRequest = { claveAccesoComprobante: claveAccesoRecibida };
                const [autorizacionResult] = await autorizacionClient.autorizacionComprobanteAsync(autorizacionRequest);
                
                const autorizacionResponse = autorizacionResult?.RespuestaAutorizacionComprobante;
                
                console.log('\n   📋 RESPUESTA DE AUTORIZACIÓN:');
                console.log('   =====================================');
                
                if (autorizacionResponse?.numeroComprobantes) {
                    console.log('   Número de comprobantes:', autorizacionResponse.numeroComprobantes);
                }
                
                if (autorizacionResponse?.autorizaciones?.autorizacion) {
                    const autorizaciones = Array.isArray(autorizacionResponse.autorizaciones.autorizacion)
                        ? autorizacionResponse.autorizaciones.autorizacion
                        : [autorizacionResponse.autorizaciones.autorizacion];
                    
                    autorizaciones.forEach((auth: any, index: number) => {
                        if (autorizaciones.length > 1) {
                            console.log(`\n   Autorización ${index + 1}:`);
                        }
                        
                        console.log('   🔸 Estado:', auth.estado || 'Sin estado');
                        
                        if (auth.estado === 'AUTORIZADO') {
                            console.log('   ✅✅✅ COMPROBANTE AUTORIZADO EXITOSAMENTE ✅✅✅');
                        }
                        
                        if (auth.numeroAutorizacion) {
                            console.log('   📝 Número de Autorización:', auth.numeroAutorizacion);
                        }
                        
                        if (auth.fechaAutorizacion) {
                            console.log('   📅 Fecha Autorización:', auth.fechaAutorizacion);
                        }
                        
                        console.log('   🌍 Ambiente:', auth.ambiente === '1' ? 'PRUEBAS' : 'PRODUCCIÓN');
                        
                        if (auth.comprobante) {
                            console.log('   📄 XML autorizado incluido: SÍ');
                        }
                        
                        // Mensajes
                        if (auth.mensajes?.mensaje) {
                            console.log('\n   Mensajes:');
                            const msgs = Array.isArray(auth.mensajes.mensaje)
                                ? auth.mensajes.mensaje
                                : [auth.mensajes.mensaje];
                            msgs.forEach((msg: any) => {
                                const icono = msg.tipo === 'ERROR' ? '❌' : msg.tipo === 'ADVERTENCIA' ? '⚠️' : 'ℹ️';
                                console.log(`     ${icono} [${msg.identificador}] ${msg.tipo}: ${msg.mensaje}`);
                                if (msg.informacionAdicional) {
                                    console.log(`        Info adicional: ${msg.informacionAdicional}`);
                                }
                            });
                        }
                    });
                } else {
                    console.log('   ⚠️ No se encontraron autorizaciones');
                    console.log('   Puede que el comprobante aún esté siendo procesado');
                }
                
                console.log('   =====================================\n');
                
                // Guardar resultados
                const results = {
                    timestamp: new Date().toISOString(),
                    xmlReferencia: path.basename(xmlPath),
                    claveAcceso: claveAccesoRecibida,
                    recepcion: {
                        estado: recepcionResponse?.estado,
                        mensajes: recepcionResponse?.comprobantes?.comprobante?.mensajes
                    },
                    autorizacion: autorizacionResponse
                };
                
                const resultsPath = path.join(__dirname, '../../test-output/reference-validation-results.json');
                fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
                console.log('   ✓ Resultados guardados en: test-output/reference-validation-results.json');
                
            } else {
                console.log('   ❌ El comprobante NO fue recibido');
                console.log('   Estado:', recepcionResponse?.estado);
            }
            
            console.log('\n=== FIN DE VALIDACIÓN ===\n');
            
            // Resumen final
            if (recepcionResponse?.estado === 'RECIBIDA') {
                console.log('📊 RESUMEN:');
                console.log('   1. Recepción: ✅ RECIBIDA');
                console.log('   2. Autorización: Consultada');
                console.log('\n   El XML de referencia funciona correctamente con el SRI');
            } else {
                console.log('📊 RESUMEN:');
                console.log('   El XML de referencia NO pasó la validación del SRI');
            }
            
        } catch (error: any) {
            console.error('\n❌ Error durante la validación:', error.message);
            if (error.stack) {
                console.error('Stack:', error.stack);
            }
            throw error;
        }
    }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
    const validator = new ValidateReferenceXML();
    validator.runValidation()
        .then(() => {
            console.log('\n✅ Validación completada');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Error fatal:', error);
            process.exit(1);
        });
}

export default ValidateReferenceXML;