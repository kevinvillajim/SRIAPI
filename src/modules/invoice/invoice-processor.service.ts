import { XAdESSignatureService } from '../signature/xades.service';
import { XMLBuilderService } from '../xml/xml-builder.service';
import { SRIConnectorService } from '../sri/sri-connector.service';
import { 
  FacturaData, 
  NotaCreditoData, 
  ComprobanteRetencionData,
  Autorizacion 
} from '../xml/xml.types';

export interface ProcessInvoiceRequest {
  organizationId: string;
  certificateId: string;
  certificatePassword: string;
  invoiceData: FacturaData;
}

export interface ProcessInvoiceResponse {
  success: boolean;
  claveAcceso: string;
  estado: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  mensajes?: any[];
  xmlFirmado?: string;
  xmlAutorizado?: string;
  errors?: string[];
}

export class InvoiceProcessorService {
  private signatureService: XAdESSignatureService;
  private xmlBuilder: XMLBuilderService;
  private sriConnector: SRIConnectorService;

  constructor() {
    this.signatureService = new XAdESSignatureService();
    this.xmlBuilder = new XMLBuilderService();
    this.sriConnector = new SRIConnectorService();
  }

  /**
   * Procesa una factura completa: construcción, firma, envío y autorización
   */
  async processInvoice(request: ProcessInvoiceRequest): Promise<ProcessInvoiceResponse> {
    try {
      console.log('=== Iniciando procesamiento de factura ===');
      
      // 1. Construir XML
      console.log('1. Construyendo XML...');
      const xmlOriginal = await this.xmlBuilder.buildFactura(request.invoiceData);
      const claveAcceso = request.invoiceData.infoTributaria.claveAcceso!;
      console.log(`   Clave de acceso generada: ${claveAcceso}`);
      
      // 2. Obtener certificado (aquí simplificado - en producción obtener de BD)
      console.log('2. Preparando certificado...');
      // Este es un placeholder - en producción:
      // - Obtener certificado encriptado de BD
      // - Desencriptar con las claves del sistema
      // - Parsear y validar
      const certificatePem = await this.mockGetCertificate(request.certificateId);
      const privateKeyPem = await this.mockGetPrivateKey(request.certificateId);
      
      // 3. Firmar XML
      console.log('3. Firmando documento...');
      const xmlFirmado = await this.signatureService.signXML(
        xmlOriginal,
        certificatePem,
        privateKeyPem,
        { algorithm: 'SHA1' } // SRI requiere SHA1
      );
      console.log('   Documento firmado correctamente');
      
      // 4. Enviar al SRI
      console.log('4. Enviando al SRI...');
      const respuestaRecepcion = await this.sriConnector.validarComprobante(xmlFirmado);
      
      if (respuestaRecepcion.estado === 'DEVUELTA') {
        // Comprobante rechazado
        console.error('   Comprobante DEVUELTO por el SRI');
        
        const mensajes = respuestaRecepcion.comprobantes[0]?.mensajes || [];
        return {
          success: false,
          claveAcceso,
          estado: 'DEVUELTA',
          mensajes,
          xmlFirmado,
          errors: mensajes.map(m => `${m.identificador}: ${m.mensaje}`)
        };
      }
      
      console.log('   Comprobante RECIBIDO por el SRI');
      
      // 5. Esperar y consultar autorización
      console.log('5. Consultando autorización...');
      await this.sleep(2000); // Esperar 2 segundos antes de consultar
      
      const respuestaAutorizacion = await this.sriConnector.autorizacionComprobanteConEspera(
        claveAcceso,
        60000, // Máximo 60 segundos
        5000   // Consultar cada 5 segundos
      );
      
      if (respuestaAutorizacion.autorizaciones.length === 0) {
        return {
          success: false,
          claveAcceso,
          estado: 'SIN_AUTORIZACION',
          xmlFirmado,
          errors: ['No se encontró información de autorización']
        };
      }
      
      const autorizacion = respuestaAutorizacion.autorizaciones[0];
      console.log(`   Estado de autorización: ${autorizacion.estado}`);
      
      // 6. Construir XML autorizado si fue aprobado
      let xmlAutorizado: string | undefined;
      if (autorizacion.estado === 'AUTORIZADO') {
        xmlAutorizado = this.buildXmlAutorizado(autorizacion, xmlFirmado);
      }
      
      // 7. Retornar resultado
      return {
        success: autorizacion.estado === 'AUTORIZADO',
        claveAcceso,
        estado: autorizacion.estado,
        numeroAutorizacion: autorizacion.numeroAutorizacion,
        fechaAutorizacion: autorizacion.fechaAutorizacion,
        mensajes: autorizacion.mensajes,
        xmlFirmado,
        xmlAutorizado,
        errors: autorizacion.estado !== 'AUTORIZADO' 
          ? autorizacion.mensajes?.map(m => `${m.identificador}: ${m.mensaje}`)
          : undefined
      };
      
    } catch (error: any) {
      console.error('Error procesando factura:', error);
      return {
        success: false,
        claveAcceso: request.invoiceData.infoTributaria.claveAcceso || '',
        estado: 'ERROR',
        errors: [error.message]
      };
    }
  }

  /**
   * Procesa una nota de crédito
   */
  async processNotaCredito(
    notaCreditoData: NotaCreditoData,
    certificateId: string,
    _certificatePassword: string
  ): Promise<ProcessInvoiceResponse> {
    try {
      console.log('=== Procesando Nota de Crédito ===');
      
      // 1. Construir XML
      const xmlOriginal = await this.xmlBuilder.buildNotaCredito(notaCreditoData);
      const claveAcceso = notaCreditoData.infoTributaria.claveAcceso!;
      
      // 2. Obtener certificado
      const certificatePem = await this.mockGetCertificate(certificateId);
      const privateKeyPem = await this.mockGetPrivateKey(certificateId);
      
      // 3. Firmar
      const xmlFirmado = await this.signatureService.signXML(
        xmlOriginal,
        certificatePem,
        privateKeyPem,
        { algorithm: 'SHA1' }
      );
      
      // 4. Enviar al SRI
      const respuestaRecepcion = await this.sriConnector.validarComprobante(xmlFirmado);
      
      if (respuestaRecepcion.estado === 'DEVUELTA') {
        const mensajes = respuestaRecepcion.comprobantes[0]?.mensajes || [];
        return {
          success: false,
          claveAcceso,
          estado: 'DEVUELTA',
          mensajes,
          xmlFirmado,
          errors: mensajes.map(m => `${m.identificador}: ${m.mensaje}`)
        };
      }
      
      // 5. Consultar autorización
      await this.sleep(2000);
      const respuestaAutorizacion = await this.sriConnector.autorizacionComprobanteConEspera(
        claveAcceso,
        60000,
        5000
      );
      
      const autorizacion = respuestaAutorizacion.autorizaciones[0];
      
      return {
        success: autorizacion.estado === 'AUTORIZADO',
        claveAcceso,
        estado: autorizacion.estado,
        numeroAutorizacion: autorizacion.numeroAutorizacion,
        fechaAutorizacion: autorizacion.fechaAutorizacion,
        mensajes: autorizacion.mensajes,
        xmlFirmado,
        xmlAutorizado: autorizacion.estado === 'AUTORIZADO' 
          ? this.buildXmlAutorizado(autorizacion, xmlFirmado)
          : undefined
      };
      
    } catch (error: any) {
      console.error('Error procesando nota de crédito:', error);
      return {
        success: false,
        claveAcceso: notaCreditoData.infoTributaria.claveAcceso || '',
        estado: 'ERROR',
        errors: [error.message]
      };
    }
  }

  /**
   * Procesa un comprobante de retención
   */
  async processRetencion(
    retencionData: ComprobanteRetencionData,
    certificateId: string,
    _certificatePassword: string
  ): Promise<ProcessInvoiceResponse> {
    try {
      console.log('=== Procesando Comprobante de Retención ===');
      
      // Similar flow para retención
      const xmlOriginal = await this.xmlBuilder.buildComprobanteRetencion(retencionData);
      const claveAcceso = retencionData.infoTributaria.claveAcceso!;
      
      const certificatePem = await this.mockGetCertificate(certificateId);
      const privateKeyPem = await this.mockGetPrivateKey(certificateId);
      
      const xmlFirmado = await this.signatureService.signXML(
        xmlOriginal,
        certificatePem,
        privateKeyPem,
        { algorithm: 'SHA1' }
      );
      
      const respuestaRecepcion = await this.sriConnector.validarComprobante(xmlFirmado);
      
      if (respuestaRecepcion.estado === 'DEVUELTA') {
        const mensajes = respuestaRecepcion.comprobantes[0]?.mensajes || [];
        return {
          success: false,
          claveAcceso,
          estado: 'DEVUELTA',
          mensajes,
          xmlFirmado,
          errors: mensajes.map(m => `${m.identificador}: ${m.mensaje}`)
        };
      }
      
      await this.sleep(2000);
      const respuestaAutorizacion = await this.sriConnector.autorizacionComprobanteConEspera(
        claveAcceso,
        60000,
        5000
      );
      
      const autorizacion = respuestaAutorizacion.autorizaciones[0];
      
      return {
        success: autorizacion.estado === 'AUTORIZADO',
        claveAcceso,
        estado: autorizacion.estado,
        numeroAutorizacion: autorizacion.numeroAutorizacion,
        fechaAutorizacion: autorizacion.fechaAutorizacion,
        mensajes: autorizacion.mensajes,
        xmlFirmado,
        xmlAutorizado: autorizacion.estado === 'AUTORIZADO'
          ? this.buildXmlAutorizado(autorizacion, xmlFirmado)
          : undefined
      };
      
    } catch (error: any) {
      console.error('Error procesando retención:', error);
      return {
        success: false,
        claveAcceso: retencionData.infoTributaria.claveAcceso || '',
        estado: 'ERROR',
        errors: [error.message]
      };
    }
  }

  /**
   * Construye el XML autorizado con la respuesta del SRI
   */
  private buildXmlAutorizado(autorizacion: Autorizacion, xmlFirmado: string): string {
    const autorizacionXml = `<?xml version="1.0" encoding="UTF-8"?>
<autorizacion>
  <estado>${autorizacion.estado}</estado>
  <numeroAutorizacion>${autorizacion.numeroAutorizacion || ''}</numeroAutorizacion>
  <fechaAutorizacion>${autorizacion.fechaAutorizacion || ''}</fechaAutorizacion>
  <ambiente>${autorizacion.ambiente || ''}</ambiente>
  <comprobante><![CDATA[${xmlFirmado}]]></comprobante>
  <mensajes/>
</autorizacion>`;
    
    return autorizacionXml;
  }

  /**
   * Mock para obtener certificado - En producción obtener de BD
   */
  private async mockGetCertificate(_certificateId: string): Promise<string> {
    // En producción:
    // 1. Obtener de BD el certificado encriptado
    // 2. Desencriptar
    // 3. Parsear y retornar PEM
    
    // Por ahora retornamos un certificado de prueba
    return `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKLdQVPy90WjMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
...
-----END CERTIFICATE-----`;
  }

  /**
   * Mock para obtener clave privada - En producción obtener de BD
   */
  private async mockGetPrivateKey(_certificateId: string): Promise<string> {
    // En producción:
    // 1. Obtener de BD junto con el certificado
    // 2. Desencriptar
    // 3. Retornar PEM
    
    return `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
-----END RSA PRIVATE KEY-----`;
  }

  /**
   * Reintenta el procesamiento de un comprobante rechazado
   */
  async retryFailedInvoice(
    claveAcceso: string,
    invoiceData: FacturaData,
    certificateId: string,
    certificatePassword: string
  ): Promise<ProcessInvoiceResponse> {
    console.log(`Reintentando factura con clave: ${claveAcceso}`);
    
    // Generar nuevo secuencial si es necesario
    // En producción esto debe venir de la BD con un nuevo secuencial
    
    return this.processInvoice({
      organizationId: '', // Obtener de contexto
      certificateId,
      certificatePassword,
      invoiceData
    });
  }

  /**
   * Verifica el estado de un comprobante ya enviado
   */
  async checkInvoiceStatus(claveAcceso: string): Promise<{
    estado: string;
    numeroAutorizacion?: string;
    fechaAutorizacion?: string;
    mensajes?: any[];
  }> {
    try {
      const respuesta = await this.sriConnector.autorizacionComprobante(claveAcceso);
      
      if (respuesta.autorizaciones.length === 0) {
        return {
          estado: 'NO_ENCONTRADO',
          mensajes: [{ mensaje: 'No se encontró el comprobante' }]
        };
      }
      
      const autorizacion = respuesta.autorizaciones[0];
      
      return {
        estado: autorizacion.estado,
        numeroAutorizacion: autorizacion.numeroAutorizacion,
        fechaAutorizacion: autorizacion.fechaAutorizacion,
        mensajes: autorizacion.mensajes
      };
      
    } catch (error: any) {
      return {
        estado: 'ERROR',
        mensajes: [{ mensaje: error.message }]
      };
    }
  }

  /**
   * Helper para sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}