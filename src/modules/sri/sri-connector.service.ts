import * as soap from 'soap';
import { Autorizacion, ComprobanteRespuesta } from '../xml/xml.types';

export interface SRIConfig {
  ambiente: number; // 1: Pruebas, 2: Producción
  timeout: number;
  maxRetries: number;
}

export interface ValidarComprobanteResponse {
  estado: 'RECIBIDA' | 'DEVUELTA';
  comprobantes: ComprobanteRespuesta[];
}

export interface AutorizacionResponse {
  claveAccesoConsultada: string;
  numeroComprobantes: string;
  autorizaciones: Autorizacion[];
}

export class SRIConnectorService {
  private config: SRIConfig;
  private recepcionClient: soap.Client | null = null;
  private autorizacionClient: soap.Client | null = null;
  private readonly userAgent = 'SRI-Facturacion-Electronica/1.0';

  constructor(config?: Partial<SRIConfig>) {
    this.config = {
      ambiente: parseInt(process.env.SRI_AMBIENTE || '1'),
      timeout: parseInt(process.env.SRI_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.SRI_MAX_RETRIES || '3'),
      ...config
    };
  }

  /**
   * Obtiene las URLs de los servicios según el ambiente
   */
  private getServiceUrls() {
    const isPruebas = this.config.ambiente === 1;
    
    return {
      recepcion: isPruebas
        ? process.env.SRI_WS_RECEPCION_PRUEBAS!
        : process.env.SRI_WS_RECEPCION_PRODUCCION!,
      autorizacion: isPruebas
        ? process.env.SRI_WS_AUTORIZACION_PRUEBAS!
        : process.env.SRI_WS_AUTORIZACION_PRODUCCION!
    };
  }

  /**
   * Inicializa los clientes SOAP
   */
  private async initializeClients(): Promise<void> {
    const urls = this.getServiceUrls();
    
    // Opciones para el cliente SOAP
    const options = {
      wsdl_options: {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': this.userAgent
        }
      },
      endpoint: undefined as string | undefined,
      forceSoap12Headers: false,
      connection: 'keep-alive'
    };

    try {
      // Crear cliente de recepción si no existe
      if (!this.recepcionClient) {
        console.log('Inicializando cliente de recepción SRI...');
        this.recepcionClient = await soap.createClientAsync(urls.recepcion, options);
        console.log('Cliente de recepción creado exitosamente');
      }

      // Crear cliente de autorización si no existe
      if (!this.autorizacionClient) {
        console.log('Inicializando cliente de autorización SRI...');
        this.autorizacionClient = await soap.createClientAsync(urls.autorizacion, options);
        console.log('Cliente de autorización creado exitosamente');
      }
    } catch (error: any) {
      console.error('Error inicializando clientes SOAP:', error.message);
      throw new Error(`No se pudo conectar con los servicios del SRI: ${error.message}`);
    }
  }

  /**
   * Envía un comprobante al SRI para su validación
   */
  async validarComprobante(xml: string): Promise<ValidarComprobanteResponse> {
    await this.initializeClients();
    
    if (!this.recepcionClient) {
      throw new Error('Cliente de recepción no inicializado');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`Intento ${attempt} de ${this.config.maxRetries} - Enviando comprobante al SRI...`);
        
        // Convertir XML a base64
        const xmlBase64 = Buffer.from(xml, 'utf-8').toString('base64');
        
        // Preparar el request
        const args = {
          xml: xmlBase64
        };

        // Llamar al servicio
        const [result] = await this.recepcionClient.validarComprobanteAsync(args);
        
        // Procesar respuesta
        const respuesta = this.processValidarResponse(result);
        
        console.log(`Respuesta del SRI: ${respuesta.estado}`);
        
        if (respuesta.estado === 'RECIBIDA') {
          return respuesta;
        }
        
        // Si fue DEVUELTA, no reintentar
        if (respuesta.estado === 'DEVUELTA') {
          console.warn('Comprobante devuelto por el SRI:', respuesta.comprobantes);
          return respuesta;
        }
        
      } catch (error: any) {
        lastError = error;
        console.error(`Error en intento ${attempt}:`, error.message);
        
        // Si es un error de timeout o red, reintentar
        if (this.isRetryableError(error)) {
          if (attempt < this.config.maxRetries) {
            const delay = this.getRetryDelay(attempt);
            console.log(`Esperando ${delay}ms antes de reintentar...`);
            await this.sleep(delay);
            continue;
          }
        } else {
          // Si no es un error recuperable, lanzar inmediatamente
          throw error;
        }
      }
    }
    
    throw new Error(`Fallo al validar comprobante después de ${this.config.maxRetries} intentos: ${lastError?.message}`);
  }

  /**
   * Consulta la autorización de un comprobante
   */
  async autorizacionComprobante(claveAcceso: string): Promise<AutorizacionResponse> {
    await this.initializeClients();
    
    if (!this.autorizacionClient) {
      throw new Error('Cliente de autorización no inicializado');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`Intento ${attempt} de ${this.config.maxRetries} - Consultando autorización para: ${claveAcceso}`);
        
        // Preparar el request
        const args = {
          claveAccesoComprobante: claveAcceso
        };

        // Llamar al servicio
        const [result] = await this.autorizacionClient.autorizacionComprobanteAsync(args);
        
        // Procesar respuesta
        const respuesta = this.processAutorizacionResponse(result, claveAcceso);
        
        console.log(`Número de autorizaciones: ${respuesta.numeroComprobantes}`);
        
        return respuesta;
        
      } catch (error: any) {
        lastError = error;
        console.error(`Error en intento ${attempt}:`, error.message);
        
        if (this.isRetryableError(error)) {
          if (attempt < this.config.maxRetries) {
            const delay = this.getRetryDelay(attempt);
            console.log(`Esperando ${delay}ms antes de reintentar...`);
            await this.sleep(delay);
            continue;
          }
        } else {
          throw error;
        }
      }
    }
    
    throw new Error(`Fallo al consultar autorización después de ${this.config.maxRetries} intentos: ${lastError?.message}`);
  }

  /**
   * Consulta autorización con reintentos hasta obtener respuesta definitiva
   */
  async autorizacionComprobanteConEspera(
    claveAcceso: string,
    maxEspera: number = 60000,
    intervalo: number = 5000
  ): Promise<AutorizacionResponse> {
    const tiempoInicio = Date.now();
    
    while (Date.now() - tiempoInicio < maxEspera) {
      try {
        const respuesta = await this.autorizacionComprobante(claveAcceso);
        
        if (respuesta.autorizaciones && respuesta.autorizaciones.length > 0) {
          const autorizacion = respuesta.autorizaciones[0];
          
          // Si tiene estado definitivo, retornar
          if (['AUTORIZADO', 'NO AUTORIZADO', 'RECHAZADO'].includes(autorizacion.estado)) {
            return respuesta;
          }
          
          // Si está en procesamiento, esperar
          if (autorizacion.estado === 'EN PROCESAMIENTO') {
            console.log('Comprobante en procesamiento, esperando...');
            await this.sleep(intervalo);
            continue;
          }
        }
        
        // Si no hay autorizaciones, el comprobante puede no existir
        if (!respuesta.autorizaciones || respuesta.autorizaciones.length === 0) {
          console.log('No se encontraron autorizaciones, esperando...');
          await this.sleep(intervalo);
          continue;
        }
        
        return respuesta;
        
      } catch (error: any) {
        console.error('Error consultando autorización:', error.message);
        
        if (Date.now() - tiempoInicio + intervalo < maxEspera) {
          await this.sleep(intervalo);
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error(`Timeout esperando autorización del comprobante ${claveAcceso}`);
  }

  /**
   * Procesa la respuesta del servicio validarComprobante
   */
  private processValidarResponse(result: any): ValidarComprobanteResponse {
    try {
      // La estructura de la respuesta puede variar según la versión del servicio
      const respuesta = result.RespuestaRecepcionComprobante || result;
      
      const estado = respuesta.estado || 'DEVUELTA';
      const comprobantes: ComprobanteRespuesta[] = [];
      
      // Procesar comprobantes
      if (respuesta.comprobantes) {
        const comprobantesList = Array.isArray(respuesta.comprobantes.comprobante)
          ? respuesta.comprobantes.comprobante
          : [respuesta.comprobantes.comprobante];
        
        for (const comp of comprobantesList) {
          if (comp) {
            const comprobante: ComprobanteRespuesta = {
              claveAcceso: comp.claveAcceso,
              mensajes: []
            };
            
            // Procesar mensajes
            if (comp.mensajes && comp.mensajes.mensaje) {
              const mensajesList = Array.isArray(comp.mensajes.mensaje)
                ? comp.mensajes.mensaje
                : [comp.mensajes.mensaje];
              
              for (const msg of mensajesList) {
                if (msg) {
                  comprobante.mensajes!.push({
                    identificador: msg.identificador || '',
                    mensaje: msg.mensaje || '',
                    informacionAdicional: msg.informacionAdicional || '',
                    tipo: msg.tipo || 'ERROR'
                  });
                }
              }
            }
            
            comprobantes.push(comprobante);
          }
        }
      }
      
      return {
        estado: estado as 'RECIBIDA' | 'DEVUELTA',
        comprobantes
      };
      
    } catch (error: any) {
      console.error('Error procesando respuesta de validación:', error);
      throw new Error(`Error al procesar respuesta del SRI: ${error.message}`);
    }
  }

  /**
   * Procesa la respuesta del servicio autorizacionComprobante
   */
  private processAutorizacionResponse(result: any, claveAcceso: string): AutorizacionResponse {
    try {
      // La estructura puede variar
      const respuesta = result.RespuestaAutorizacionComprobante || result;
      
      const autorizaciones: Autorizacion[] = [];
      
      // Procesar autorizaciones
      if (respuesta.autorizaciones) {
        const autorizacionesList = Array.isArray(respuesta.autorizaciones.autorizacion)
          ? respuesta.autorizaciones.autorizacion
          : [respuesta.autorizaciones.autorizacion];
        
        for (const auth of autorizacionesList) {
          if (auth) {
            const autorizacion: Autorizacion = {
              estado: auth.estado || 'NO AUTORIZADO',
              numeroAutorizacion: auth.numeroAutorizacion,
              fechaAutorizacion: auth.fechaAutorizacion,
              ambiente: auth.ambiente,
              comprobante: auth.comprobante,
              mensajes: []
            };
            
            // Procesar mensajes
            if (auth.mensajes && auth.mensajes.mensaje) {
              const mensajesList = Array.isArray(auth.mensajes.mensaje)
                ? auth.mensajes.mensaje
                : [auth.mensajes.mensaje];
              
              for (const msg of mensajesList) {
                if (msg) {
                  autorizacion.mensajes!.push({
                    identificador: msg.identificador || '',
                    mensaje: msg.mensaje || '',
                    informacionAdicional: msg.informacionAdicional || '',
                    tipo: msg.tipo || 'ERROR'
                  });
                }
              }
            }
            
            autorizaciones.push(autorizacion);
          }
        }
      }
      
      return {
        claveAccesoConsultada: respuesta.claveAccesoConsultada || claveAcceso,
        numeroComprobantes: respuesta.numeroComprobantes || autorizaciones.length.toString(),
        autorizaciones
      };
      
    } catch (error: any) {
      console.error('Error procesando respuesta de autorización:', error);
      throw new Error(`Error al procesar respuesta del SRI: ${error.message}`);
    }
  }

  /**
   * Determina si un error es recuperable
   */
  private isRetryableError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    
    // Errores de red/timeout
    if (
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('econnreset') ||
      message.includes('socket hang up') ||
      message.includes('network')
    ) {
      return true;
    }
    
    // Error HTTP 500, 502, 503, 504
    if (error.response) {
      const status = error.response.status;
      if ([500, 502, 503, 504].includes(status)) {
        return true;
      }
    }
    
    // Errores específicos del SRI que son recuperables
    if (error.code) {
      const recoverableCodes = [26, 50, 65, 70]; // Según documentación SRI
      if (recoverableCodes.includes(parseInt(error.code))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calcula el delay para reintentos con backoff exponencial
   */
  private getRetryDelay(attempt: number): number {
    // Backoff exponencial con jitter
    const baseDelay = 1000; // 1 segundo
    const maxDelay = 30000; // 30 segundos
    
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 1000; // Hasta 1 segundo de jitter
    
    return exponentialDelay + jitter;
  }

  /**
   * Helper para sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Limpia los recursos
   */
  async cleanup(): Promise<void> {
    this.recepcionClient = null;
    this.autorizacionClient = null;
  }

  /**
   * Obtiene información del estado del servicio
   */
  async checkServiceStatus(): Promise<{
    recepcion: boolean;
    autorizacion: boolean;
    ambiente: string;
  }> {
    const status = {
      recepcion: false,
      autorizacion: false,
      ambiente: this.config.ambiente === 1 ? 'PRUEBAS' : 'PRODUCCIÓN'
    };
    
    try {
      await this.initializeClients();
      status.recepcion = this.recepcionClient !== null;
      status.autorizacion = this.autorizacionClient !== null;
    } catch (error) {
      console.error('Error verificando estado de servicios:', error);
    }
    
    return status;
  }
}