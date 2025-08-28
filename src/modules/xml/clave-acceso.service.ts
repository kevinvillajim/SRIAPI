export interface ClaveAccesoParams {
  fechaEmision: Date | string;
  tipoComprobante: string; // 01, 04, 05, 06, 07
  ruc: string;
  ambiente: number; // 1: Pruebas, 2: Producción
  establecimiento: string; // 3 dígitos
  puntoEmision: string; // 3 dígitos
  secuencial: string; // 9 dígitos
  tipoEmision: number; // 1: Normal
}

export class ClaveAccesoService {
  /**
   * Genera la clave de acceso de 49 dígitos según especificación SRI
   * 
   * Estructura:
   * - Fecha de emisión (8 dígitos): ddmmyyyy
   * - Tipo de comprobante (2 dígitos)
   * - RUC (13 dígitos)
   * - Ambiente (1 dígito)
   * - Serie (6 dígitos): establecimiento + punto emisión
   * - Número del comprobante (9 dígitos): secuencial
   * - Código numérico (8 dígitos): aleatorio
   * - Tipo de emisión (1 dígito)
   * - Dígito verificador (1 dígito): módulo 11
   */
  generate(params: ClaveAccesoParams): string {
    // Validaciones estrictas según XSD
    this.validateParams(params);
    
    // Formatear fecha
    const fecha = this.formatFecha(params.fechaEmision);
    
    // Generar código numérico aleatorio de 8 dígitos
    const codigoNumerico = this.generateCodigoNumerico();
    
    // Construir clave sin dígito verificador (48 dígitos)
    const fechaPart = fecha;                                    // 8 dígitos
    const tipoComprobantePart = params.tipoComprobante.padStart(2, '0');  // 2 dígitos
    const rucPart = params.ruc.padStart(13, '0');               // 13 dígitos
    const ambientePart = params.ambiente.toString();            // 1 dígito
    const establecimientoPart = params.establecimiento.padStart(3, '0'); // 3 dígitos
    const puntoEmisionPart = params.puntoEmision.padStart(3, '0');       // 3 dígitos
    const secuencialPart = params.secuencial.padStart(9, '0');           // 9 dígitos
    const codigoNumericoPart = codigoNumerico;                           // 8 dígitos
    const tipoEmisionPart = params.tipoEmision.toString();               // 1 dígito
    
    console.log(`DEBUG Clave de Acceso:
      Fecha: ${fechaPart} (${fechaPart.length})
      TipoComprobante: ${tipoComprobantePart} (${tipoComprobantePart.length})
      RUC: ${rucPart} (${rucPart.length})
      Ambiente: ${ambientePart} (${ambientePart.length})
      Establecimiento: ${establecimientoPart} (${establecimientoPart.length})
      PuntoEmision: ${puntoEmisionPart} (${puntoEmisionPart.length})
      Secuencial: ${secuencialPart} (${secuencialPart.length})
      CodigoNumerico: ${codigoNumericoPart} (${codigoNumericoPart.length})
      TipoEmision: ${tipoEmisionPart} (${tipoEmisionPart.length})`);
    
    const claveSinDigito = fechaPart + tipoComprobantePart + rucPart + ambientePart + 
                          establecimientoPart + puntoEmisionPart + secuencialPart + 
                          codigoNumericoPart + tipoEmisionPart;
    
    // Validar que la clave base tenga exactamente 48 dígitos
    if (claveSinDigito.length !== 48) {
      throw new Error(`Clave base debe tener exactamente 48 dígitos. Construida: ${claveSinDigito.length}`);
    }
    
    // Validar que solo contenga dígitos
    if (!/^[0-9]{48}$/.test(claveSinDigito)) {
      throw new Error('Clave base debe contener solo dígitos numéricos');
    }
    
    // Calcular dígito verificador
    const digitoVerificador = this.calcularModulo11(claveSinDigito);
    
    // Clave completa (49 dígitos)
    const claveAcceso = claveSinDigito + digitoVerificador;
    
    // Validación final según patrón XSD: exactamente 49 dígitos numéricos
    if (!/^[0-9]{49}$/.test(claveAcceso)) {
      throw new Error(`Clave de acceso debe cumplir patrón XSD [0-9]{49}. Generada: ${claveAcceso}`);
    }
    
    return claveAcceso;
  }

  /**
   * Valida una clave de acceso existente
   */
  validate(claveAcceso: string): boolean {
    // Validar longitud
    if (claveAcceso.length !== 49) {
      return false;
    }
    
    // Validar que solo contenga dígitos
    if (!/^\d+$/.test(claveAcceso)) {
      return false;
    }
    
    // Validar dígito verificador
    const claveSinDigito = claveAcceso.substring(0, 48);
    const digitoVerificador = claveAcceso.substring(48, 49);
    const digitoCalculado = this.calcularModulo11(claveSinDigito);
    
    return digitoVerificador === digitoCalculado;
  }

  /**
   * Extrae información de una clave de acceso
   */
  parse(claveAcceso: string): any {
    if (!this.validate(claveAcceso)) {
      throw new Error('Clave de acceso inválida');
    }
    
    return {
      fechaEmision: this.parseFecha(claveAcceso.substring(0, 8)),
      tipoComprobante: claveAcceso.substring(8, 10),
      ruc: claveAcceso.substring(10, 23),
      ambiente: parseInt(claveAcceso.substring(23, 24)),
      establecimiento: claveAcceso.substring(24, 27),
      puntoEmision: claveAcceso.substring(27, 30),
      secuencial: claveAcceso.substring(30, 39),
      codigoNumerico: claveAcceso.substring(39, 47),
      tipoEmision: parseInt(claveAcceso.substring(47, 48)),
      digitoVerificador: claveAcceso.substring(48, 49)
    };
  }

  /**
   * Formatea la fecha al formato requerido (ddmmyyyy)
   */
  private formatFecha(fecha: Date | string): string {
    let d: Date;
    
    if (typeof fecha === 'string') {
      // Si es string, intentar parsear diferentes formatos
      if (fecha.includes('/')) {
        // Formato dd/mm/yyyy
        const parts = fecha.split('/');
        if (parts.length === 3) {
          const dia = parseInt(parts[0]);
          const mes = parseInt(parts[1]) - 1; // Mes es 0-indexed
          const año = parseInt(parts[2]);
          d = new Date(año, mes, dia);
        } else {
          d = new Date(fecha);
        }
      } else {
        d = new Date(fecha);
      }
    } else {
      d = fecha;
    }
    
    // Verificar que la fecha es válida
    if (isNaN(d.getTime())) {
      throw new Error(`Fecha inválida proporcionada: ${fecha}`);
    }
    
    const dia = d.getDate().toString().padStart(2, '0');
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    const año = d.getFullYear().toString();
    
    return dia + mes + año;
  }

  /**
   * Parsea una fecha desde el formato de clave (ddmmyyyy)
   */
  private parseFecha(fechaStr: string): Date {
    const dia = parseInt(fechaStr.substring(0, 2));
    const mes = parseInt(fechaStr.substring(2, 4)) - 1; // Mes es 0-indexed
    const año = parseInt(fechaStr.substring(4, 8));
    
    return new Date(año, mes, dia);
  }

  /**
   * Genera un código numérico aleatorio de 8 dígitos
   */
  private generateCodigoNumerico(): string {
    // Generar número aleatorio entre 10000000 y 99999999
    const min = 10000000;
    const max = 99999999;
    const codigo = Math.floor(Math.random() * (max - min + 1)) + min;
    return codigo.toString();
  }

  /**
   * Calcula el dígito verificador usando módulo 11 EXACTO según especificación SRI
   * Multiplicadores específicos: 7,6,5,4,3,2,7,6,5,4,3,2,...(secuencia repetitiva)
   */
  private calcularModulo11(clave: string): string {
    // Multiplicadores específicos según documentación SRI (exactos de la ficha técnica)
    const multiplicadores = [7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    
    if (clave.length !== 48) {
      throw new Error(`Clave debe tener exactamente 48 dígitos para el cálculo. Recibida: ${clave.length}`);
    }
    
    let suma = 0;
    
    // Multiplicar cada dígito por su multiplicador correspondiente (de izquierda a derecha)
    for (let i = 0; i < 48; i++) {
      const digito = parseInt(clave[i]);
      const multiplicador = multiplicadores[i];
      suma += digito * multiplicador;
    }
    
    // Calcular módulo 11
    const residuo = suma % 11;
    let digitoVerificador = 11 - residuo;
    
    // Casos especiales EXACTOS según documentación SRI
    if (digitoVerificador === 11) {
      digitoVerificador = 0;
    } else if (digitoVerificador === 10) {
      digitoVerificador = 1;
    }
    
    return digitoVerificador.toString();
  }

  /**
   * Genera múltiples claves de acceso para un lote de comprobantes
   */
  generateBatch(paramsList: ClaveAccesoParams[]): string[] {
    return paramsList.map(params => this.generate(params));
  }

  /**
   * Obtiene el tipo de comprobante desde su código
   */
  getTipoComprobante(codigo: string): string {
    const tipos: { [key: string]: string } = {
      '01': 'FACTURA',
      '03': 'LIQUIDACIÓN DE COMPRA',
      '04': 'NOTA DE CRÉDITO',
      '05': 'NOTA DE DÉBITO',
      '06': 'GUÍA DE REMISIÓN',
      '07': 'COMPROBANTE DE RETENCIÓN'
    };
    
    return tipos[codigo] || 'DESCONOCIDO';
  }

  /**
   * Valida el formato del secuencial
   */
  validateSecuencial(secuencial: string): boolean {
    // Debe ser numérico y máximo 9 dígitos
    return /^\d{1,9}$/.test(secuencial);
  }

  /**
   * Formatea el secuencial al formato requerido (9 dígitos con ceros a la izquierda)
   */
  formatSecuencial(secuencial: number | string): string {
    const sec = typeof secuencial === 'number' ? secuencial.toString() : secuencial;
    
    if (!this.validateSecuencial(sec)) {
      throw new Error('Secuencial inválido');
    }
    
    return sec.padStart(9, '0');
  }

  /**
   * Valida los parámetros de entrada según patrones XSD
   */
  private validateParams(params: ClaveAccesoParams): void {
    const errors: string[] = [];

    // Validar RUC: debe ser exactamente 13 dígitos terminando en 001
    if (!/^[0-9]{10}001$/.test(params.ruc)) {
      errors.push('RUC debe tener formato [0-9]{10}001 según XSD');
    }

    // Validar ambiente: solo 1 o 2
    if (!/^[1-2]{1}$/.test(params.ambiente.toString())) {
      errors.push('Ambiente debe ser 1 o 2 según XSD');
    }

    // Validar tipo emisión: solo 1 o 2
    if (!/^[12]{1}$/.test(params.tipoEmision.toString())) {
      errors.push('Tipo emisión debe ser 1 o 2 según XSD');
    }

    // Validar establecimiento: exactamente 3 dígitos
    if (!/^[0-9]{3}$/.test(params.establecimiento)) {
      errors.push('Establecimiento debe tener exactamente 3 dígitos según XSD');
    }

    // Validar punto emisión: exactamente 3 dígitos
    if (!/^[0-9]{3}$/.test(params.puntoEmision)) {
      errors.push('Punto emisión debe tener exactamente 3 dígitos según XSD');
    }

    // Validar secuencial: exactamente 9 dígitos (se rellena con ceros)
    const secuencialNum = parseInt(params.secuencial);
    if (isNaN(secuencialNum) || secuencialNum <= 0 || secuencialNum > 999999999) {
      errors.push('Secuencial debe ser un número válido entre 1 y 999999999');
    }

    // Validar tipo comprobante: debe ser válido
    const tiposValidos = ['01', '03', '04', '05', '06', '07'];
    if (!tiposValidos.includes(params.tipoComprobante)) {
      errors.push(`Tipo comprobante debe ser uno de: ${tiposValidos.join(', ')}`);
    }

    if (errors.length > 0) {
      throw new Error(`Parámetros inválidos para clave de acceso:\n${errors.join('\n')}`);
    }
  }
}