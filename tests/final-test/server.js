const express = require('express');
const multer = require('multer');
const soap = require('soap');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Configuración
const PORT = 3005;
const SRI_RECEPCION_URL = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
const SRI_AUTORIZACION_URL = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Servir la página HTML principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint para recepción
app.post('/api/recepcion', upload.single('xml'), async (req, res) => {
    try {
        // Leer el archivo XML subido
        const xmlContent = fs.readFileSync(req.file.path, 'utf-8');
        
        // Eliminar BOM si existe
        let cleanXml = xmlContent;
        if (cleanXml.charCodeAt(0) === 0xFEFF) {
            cleanXml = cleanXml.slice(1);
        }
        
        // Extraer clave de acceso del XML
        const claveMatch = cleanXml.match(/<claveAcceso>(\d{49})<\/claveAcceso>/);
        const claveAcceso = claveMatch ? claveMatch[1] : 'No encontrada';
        
        // Convertir a Base64
        const xmlBase64 = Buffer.from(cleanXml).toString('base64');
        
        // Construir el envelope SOAP manualmente
        const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
               xmlns:ec="http://ec.gob.sri.ws.recepcion">
    <soap:Header/>
    <soap:Body>
        <ec:validarComprobante>
            <xml>${xmlBase64}</xml>
        </ec:validarComprobante>
    </soap:Body>
</soap:Envelope>`;
        
        console.log('Enviando a SRI Recepción...');
        
        // Crear cliente SOAP
        const client = await soap.createClientAsync(SRI_RECEPCION_URL, {
            wsdl_options: {
                timeout: 30000,
                forever: true
            }
        });
        
        // Enviar solicitud
        const request = { xml: xmlBase64 };
        const [result, rawResponse, soapHeader, rawRequest] = await client.validarComprobanteAsync(request);
        
        // Limpiar archivo temporal
        fs.unlinkSync(req.file.path);
        
        // Preparar respuesta
        const response = {
            claveAcceso: claveAcceso,
            soapRequest: {
                envelope: soapEnvelope,
                url: SRI_RECEPCION_URL,
                method: 'validarComprobante',
                xmlBase64Length: xmlBase64.length
            },
            sriResponse: result?.RespuestaRecepcionComprobante || {},
            rawResponse: rawResponse ? formatXml(rawResponse) : 'No disponible',
            estado: result?.RespuestaRecepcionComprobante?.estado || 'ERROR',
            comprobantes: result?.RespuestaRecepcionComprobante?.comprobantes || null
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('Error en recepción:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Endpoint para autorización
app.post('/api/autorizacion', express.json(), async (req, res) => {
    try {
        const { claveAcceso } = req.body;
        
        if (!claveAcceso || claveAcceso.length !== 49) {
            return res.status(400).json({
                error: 'Clave de acceso inválida. Debe tener 49 dígitos.'
            });
        }
        
        // Construir el envelope SOAP para autorización
        const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
               xmlns:ec="http://ec.gob.sri.ws.autorizacion">
    <soap:Header/>
    <soap:Body>
        <ec:autorizacionComprobante>
            <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
        </ec:autorizacionComprobante>
    </soap:Body>
</soap:Envelope>`;
        
        console.log('Consultando autorización para:', claveAcceso);
        
        // Crear cliente SOAP
        const client = await soap.createClientAsync(SRI_AUTORIZACION_URL, {
            wsdl_options: {
                timeout: 30000,
                forever: true
            }
        });
        
        // Enviar solicitud
        const request = { claveAccesoComprobante: claveAcceso };
        console.log('Request de autorización:', JSON.stringify(request));
        
        const [result, rawResponse, soapHeader, rawRequest] = await client.autorizacionComprobanteAsync(request);
        
        console.log('Respuesta SRI autorización:', JSON.stringify(result, null, 2));
        
        // Preparar respuesta
        const authResponse = result?.RespuestaAutorizacionComprobante;
        let autorizacion = null;
        
        if (authResponse?.autorizaciones?.autorizacion) {
            autorizacion = Array.isArray(authResponse.autorizaciones.autorizacion)
                ? authResponse.autorizaciones.autorizacion[0]
                : authResponse.autorizaciones.autorizacion;
        }
        
        const response = {
            soapRequest: {
                envelope: soapEnvelope,
                url: SRI_AUTORIZACION_URL,
                method: 'autorizacionComprobante',
                claveAcceso: claveAcceso
            },
            sriResponse: authResponse || {},
            rawResponse: rawResponse ? formatXml(rawResponse) : 'No disponible',
            numeroComprobantes: authResponse?.numeroComprobantes || 0,
            autorizacion: autorizacion ? {
                estado: autorizacion.estado,
                numeroAutorizacion: autorizacion.numeroAutorizacion,
                fechaAutorizacion: autorizacion.fechaAutorizacion,
                ambiente: autorizacion.ambiente,
                mensajes: autorizacion.mensajes
            } : null
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('Error en autorización:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            error: error.message,
            stack: error.stack,
            details: 'Error en consulta de autorización'
        });
    }
});

// Función auxiliar para formatear XML
function formatXml(xml) {
    try {
        // Remover saltos de línea existentes y espacios extras
        let formatted = xml.replace(/>\s*</g, '><');
        
        // Agregar saltos de línea y indentación
        let indent = 0;
        formatted = formatted.replace(/(<[^>]+>)/g, (match, p1) => {
            if (match.startsWith('</')) {
                indent--;
            }
            const spaces = '  '.repeat(Math.max(0, indent));
            if (!match.startsWith('</') && !match.endsWith('/>') && !match.includes('</')) {
                indent++;
            }
            if (match.endsWith('/>')) {
                // Self-closing tags
            }
            return '\n' + spaces + match;
        });
        
        return formatted.trim();
    } catch (e) {
        return xml;
    }
}

// Crear carpeta uploads si no existe
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Crear carpeta public si no existe
if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
}

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║           TEST GRÁFICO SRI - FACTURACIÓN ELECTRÓNICA      ║
╠══════════════════════════════════════════════════════════╣
║  Servidor iniciado en: http://localhost:${PORT}              ║
║                                                            ║
║  Ambiente: PRUEBAS (celcer.sri.gob.ec)                    ║
║                                                            ║
║  Endpoints disponibles:                                   ║
║  - POST /api/recepcion    (subir XML firmado)             ║
║  - POST /api/autorizacion (consultar con clave acceso)    ║
╚══════════════════════════════════════════════════════════╝
    `);
});