import * as fs from 'fs';
import * as path from 'path';
import * as soap from 'soap';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const SRI_RECEPCION_URL = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
const SRI_AUTORIZACION_URL = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';

/**
 * Test de depuración para ver exactamente qué devuelve el SRI
 */
class DebugReceptionResponse {
    
    async runDebug(): Promise<void> {
        console.log('=== DEBUG DE RESPUESTA DE RECEPCIÓN DEL SRI ===\n');
        
        try {
            // 1. Cargar el XML firmado de referencia
            console.log('1. Cargando XML de referencia firmado...');
            const xmlPath = path.join(__dirname, '../../1308202501120603993300110010010000001181321514411_Firmado.xml');
            
            let xmlContent = fs.readFileSync(xmlPath, 'utf-8');
            
            // Eliminar BOM si existe
            if (xmlContent.charCodeAt(0) === 0xFEFF) {
                xmlContent = xmlContent.slice(1);
                console.log('   BOM eliminado');
            }
            
            // Extraer clave de acceso del XML
            const claveMatch = xmlContent.match(/<claveAcceso>(\d{49})<\/claveAcceso>/);
            const claveAccesoOriginal = claveMatch ? claveMatch[1] : '';
            console.log('   Clave de acceso en el XML:', claveAccesoOriginal);
            console.log('');
            
            // 2. Convertir a Base64
            console.log('2. Convirtiendo a Base64...');
            const xmlBase64 = Buffer.from(xmlContent).toString('base64');
            console.log('   Tamaño Base64:', xmlBase64.length, 'caracteres\n');
            
            // 3. Enviar a Recepción
            console.log('3. Enviando a RECEPCIÓN...');
            console.log('   URL:', SRI_RECEPCION_URL);
            
            const client = await soap.createClientAsync(SRI_RECEPCION_URL, {
                wsdl_options: {
                    timeout: 30000,
                    forever: true
                }
            });
            
            const request = { xml: xmlBase64 };
            console.log('   Enviando request con campo "xml" en Base64...\n');
            
            const [result] = await client.validarComprobanteAsync(request);
            
            // 4. Analizar respuesta COMPLETA
            console.log('4. RESPUESTA COMPLETA DE RECEPCIÓN:');
            console.log('=====================================');
            console.log(JSON.stringify(result, null, 2));
            console.log('=====================================\n');
            
            // 5. Extraer información específica
            const response = result?.RespuestaRecepcionComprobante;
            
            if (response) {
                console.log('5. ANÁLISIS DE LA RESPUESTA:\n');
                
                console.log('   📌 Estado:', response.estado);
                
                // Verificar si hay comprobantes
                if (response.comprobantes) {
                    console.log('   📦 Comprobantes encontrados: SÍ');
                    
                    if (response.comprobantes.comprobante) {
                        const comprobante = response.comprobantes.comprobante;
                        console.log('\n   📋 INFORMACIÓN DEL COMPROBANTE:');
                        
                        // CLAVE DE ACCESO - ESTE ES EL PUNTO CRÍTICO
                        if (comprobante.claveAcceso) {
                            console.log('   ✅ CLAVE DE ACCESO RECIBIDA:', comprobante.claveAcceso);
                            console.log('   ¿Es la misma del XML?:', comprobante.claveAcceso === claveAccesoOriginal);
                        } else {
                            console.log('   ❌ NO SE RECIBIÓ CLAVE DE ACCESO');
                        }
                        
                        // Mensajes
                        if (comprobante.mensajes?.mensaje) {
                            console.log('\n   📝 Mensajes:');
                            const mensajes = Array.isArray(comprobante.mensajes.mensaje)
                                ? comprobante.mensajes.mensaje
                                : [comprobante.mensajes.mensaje];
                            
                            mensajes.forEach((msg: any) => {
                                console.log(`     - [${msg.identificador}] ${msg.tipo}: ${msg.mensaje}`);
                                if (msg.informacionAdicional) {
                                    console.log(`       Info adicional: ${msg.informacionAdicional}`);
                                }
                            });
                        }
                    }
                } else {
                    console.log('   📦 Comprobantes: NO HAY');
                }
                
                // 6. Si el estado es RECIBIDA, probar autorización
                if (response.estado === 'RECIBIDA') {
                    console.log('\n6. PROBANDO AUTORIZACIÓN:\n');
                    
                    // Determinar qué clave de acceso usar
                    let claveParaAutorizacion = '';
                    
                    if (response.comprobantes?.comprobante?.claveAcceso) {
                        claveParaAutorizacion = response.comprobantes.comprobante.claveAcceso;
                        console.log('   ✅ Usando clave de acceso RECIBIDA del SRI:', claveParaAutorizacion);
                    } else {
                        claveParaAutorizacion = claveAccesoOriginal;
                        console.log('   ⚠️ NO se recibió clave del SRI, usando la del XML:', claveParaAutorizacion);
                    }
                    
                    // Esperar un poco
                    console.log('   Esperando 3 segundos...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Consultar autorización
                    console.log('\n   Consultando AUTORIZACIÓN...');
                    console.log('   URL:', SRI_AUTORIZACION_URL);
                    
                    const authClient = await soap.createClientAsync(SRI_AUTORIZACION_URL, {
                        wsdl_options: {
                            timeout: 30000,
                            forever: true
                        }
                    });
                    
                    const authRequest = { 
                        claveAccesoComprobante: claveParaAutorizacion 
                    };
                    
                    console.log('   Request de autorización:');
                    console.log('   { claveAccesoComprobante: "' + claveParaAutorizacion + '" }\n');
                    
                    const [authResult] = await authClient.autorizacionComprobanteAsync(authRequest);
                    
                    console.log('7. RESPUESTA COMPLETA DE AUTORIZACIÓN:');
                    console.log('=====================================');
                    console.log(JSON.stringify(authResult, null, 2));
                    console.log('=====================================\n');
                    
                    // Analizar respuesta de autorización
                    const authResponse = authResult?.RespuestaAutorizacionComprobante;
                    
                    if (authResponse) {
                        console.log('8. ANÁLISIS DE AUTORIZACIÓN:\n');
                        console.log('   Número de comprobantes:', authResponse.numeroComprobantes);
                        
                        if (authResponse.autorizaciones?.autorizacion) {
                            const auth = Array.isArray(authResponse.autorizaciones.autorizacion)
                                ? authResponse.autorizaciones.autorizacion[0]
                                : authResponse.autorizaciones.autorizacion;
                            
                            console.log('   Estado de autorización:', auth.estado);
                            console.log('   Número de autorización:', auth.numeroAutorizacion || 'No disponible');
                            console.log('   Fecha:', auth.fechaAutorizacion);
                            
                            if (auth.mensajes?.mensaje) {
                                console.log('\n   Mensajes de autorización:');
                                const msgs = Array.isArray(auth.mensajes.mensaje)
                                    ? auth.mensajes.mensaje
                                    : [auth.mensajes.mensaje];
                                msgs.forEach((msg: any) => {
                                    console.log(`     - [${msg.identificador}] ${msg.tipo}: ${msg.mensaje}`);
                                    if (msg.informacionAdicional) {
                                        console.log(`       Info adicional: ${msg.informacionAdicional}`);
                                    }
                                });
                            }
                        }
                    }
                }
            }
            
            // Guardar todo para análisis
            const debugData = {
                timestamp: new Date().toISOString(),
                claveAccesoOriginal,
                recepcionResponse: result,
                analisis: {
                    estadoRecepcion: response?.estado,
                    claveAccesoRecibida: response?.comprobantes?.comprobante?.claveAcceso,
                    tieneComprobantes: !!response?.comprobantes,
                    tieneClaveAcceso: !!response?.comprobantes?.comprobante?.claveAcceso
                }
            };
            
            const outputPath = path.join(__dirname, '../../test-output/debug-reception.json');
            fs.writeFileSync(outputPath, JSON.stringify(debugData, null, 2));
            console.log('\n   ✓ Datos guardados en: test-output/debug-reception.json');
            
        } catch (error: any) {
            console.error('\n❌ Error:', error.message);
            if (error.stack) {
                console.error('Stack:', error.stack);
            }
        }
    }
}

// Ejecutar
if (require.main === module) {
    const debug = new DebugReceptionResponse();
    debug.runDebug()
        .then(() => {
            console.log('\n✅ Debug completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Error fatal:', error);
            process.exit(1);
        });
}

export default DebugReceptionResponse;