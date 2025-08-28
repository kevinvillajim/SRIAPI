import * as forge from 'node-forge';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { CertificateInfo, P12ParseResult } from './certificate.types';

export class CertificateService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyDerivationIterations = 100000;

  /**
   * Parsea un certificado P12/PFX compatible con UANATACA
   */
  async parseP12(
    p12Buffer: Buffer,
    password: string
  ): Promise<P12ParseResult> {
    try {
      // Convertir buffer a formato ASN.1
      const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
      
      // Parsear P12 con compatibilidad UANATACA
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
      
      // Extraer certificado y clave privada
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      
      // Obtener certificado principal
      const certBag = certBags[forge.pki.oids.certBag]?.[0];
      if (!certBag || !certBag.cert) {
        throw new Error('No se encontró certificado en el archivo P12');
      }
      
      // Obtener clave privada
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
      if (!keyBag || !keyBag.key) {
        throw new Error('No se encontró clave privada en el archivo P12');
      }
      
      const cert = certBag.cert;
      const privateKey = keyBag.key;
      
      // Extraer información del certificado
      const info: CertificateInfo = {
        serialNumber: cert.serialNumber,
        issuer: this.attributesToString(cert.issuer.attributes),
        subject: this.attributesToString(cert.subject.attributes),
        validFrom: cert.validity.notBefore,
        validUntil: cert.validity.notAfter,
        subjectAlternativeNames: this.extractSANs(cert),
        keyUsage: this.extractKeyUsage(cert),
        extendedKeyUsage: this.extractExtendedKeyUsage(cert),
        signatureAlgorithm: cert.signatureOid,
        publicKeyAlgorithm: 'RSA', // Default to RSA for compatibility
        thumbprint: this.calculateThumbprint(cert)
      };
      
      // Validar compatibilidad con SRI
      this.validateForSRI(cert);
      
      return {
        certificate: forge.pki.certificateToPem(cert),
        privateKey: forge.pki.privateKeyToPem(privateKey),
        certificateChain: this.extractCertificateChain(p12),
        info,
        isUANATACA: this.isUANATACACertificate(cert)
      };
    } catch (error: any) {
      // Manejo especial para certificados UANATACA con formatos legacy
      if (error.message.includes('Invalid password') || error.message.includes('PKCS#12 MAC')) {
        throw new Error('Contraseña incorrecta para el certificado');
      }
      
      // Intentar con algoritmos legacy si es necesario
      if (process.env.ALLOW_LEGACY_ALGORITHMS === 'true') {
        return this.parseP12Legacy(p12Buffer, password);
      }
      
      throw new Error(`Error al parsear certificado P12: ${error.message}`);
    }
  }

  /**
   * Parseo alternativo para certificados con algoritmos legacy
   */
  private async parseP12Legacy(
    p12Buffer: Buffer,
    password: string
  ): Promise<P12ParseResult> {
    try {
      // Configurar forge para soportar algoritmos legacy
      const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      
      // Usar opciones específicas para UANATACA
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, {
        password: password,
        strict: false // Permitir certificados no estrictos
      } as any);
      
      const certBags = p12.getBags({ 
        bagType: forge.pki.oids.certBag,
        localKeyId: undefined 
      });
      
      const keyBags = p12.getBags({ 
        bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
        localKeyId: undefined 
      });
      
      // Buscar certificado válido
      let cert: forge.pki.Certificate | null = null;
      let privateKey: forge.pki.PrivateKey | null = null;
      
      for (const bagId in certBags) {
        const bags = certBags[bagId];
        if (bags && bags.length > 0 && bags[0].cert) {
          cert = bags[0].cert;
          break;
        }
      }
      
      for (const bagId in keyBags) {
        const bags = keyBags[bagId];
        if (bags && bags.length > 0 && bags[0].key) {
          privateKey = bags[0].key;
          break;
        }
      }
      
      if (!cert || !privateKey) {
        throw new Error('No se pudo extraer certificado o clave privada del archivo');
      }
      
      const info: CertificateInfo = {
        serialNumber: cert.serialNumber,
        issuer: this.attributesToString(cert.issuer.attributes),
        subject: this.attributesToString(cert.subject.attributes),
        validFrom: cert.validity.notBefore,
        validUntil: cert.validity.notAfter,
        subjectAlternativeNames: [],
        keyUsage: [],
        extendedKeyUsage: [],
        signatureAlgorithm: cert.signatureOid,
        publicKeyAlgorithm: 'RSA',
        thumbprint: this.calculateThumbprint(cert)
      };
      
      return {
        certificate: forge.pki.certificateToPem(cert),
        privateKey: forge.pki.privateKeyToPem(privateKey),
        certificateChain: [],
        info,
        isUANATACA: true
      };
    } catch (error: any) {
      throw new Error(`Error en parseo legacy: ${error.message}`);
    }
  }

  /**
   * Valida que el certificado cumple con los requisitos del SRI
   */
  private validateForSRI(cert: forge.pki.Certificate): void {
    // Validar que no esté expirado
    const now = new Date();
    if (cert.validity.notAfter < now) {
      throw new Error('El certificado está expirado');
    }
    
    if (cert.validity.notBefore > now) {
      throw new Error('El certificado aún no es válido');
    }
    
    // Validar key usage para firma digital
    const keyUsageExt = cert.getExtension('keyUsage');
    if (keyUsageExt) {
      const keyUsage = (keyUsageExt as any).digitalSignature;
      if (!keyUsage) {
        console.warn('Advertencia: El certificado no tiene el flag digitalSignature');
      }
    }
    
    // Validar algoritmo de firma
    const supportedAlgorithms = [
      forge.pki.oids.sha256WithRSAEncryption,
      forge.pki.oids.sha1WithRSAEncryption // SRI aún acepta SHA1
    ];
    
    if (!supportedAlgorithms.includes(cert.signatureOid)) {
      console.warn(`Advertencia: Algoritmo de firma no estándar: ${cert.signatureOid}`);
    }
  }

  /**
   * Identifica si es un certificado UANATACA
   */
  private isUANATACACertificate(cert: forge.pki.Certificate): boolean {
    const issuerStr = this.attributesToString(cert.issuer.attributes);
    const uanatacaIdentifiers = [
      'UANATACA',
      'AC UANATACA',
      'UANATACA CA',
      'Autoridad Certificadora UANATACA'
    ];
    
    return uanatacaIdentifiers.some(id => 
      issuerStr.toUpperCase().includes(id.toUpperCase())
    );
  }

  /**
   * Encripta el certificado para almacenamiento seguro
   */
  async encryptCertificate(
    p12Buffer: Buffer,
    encryptionKey: string
  ): Promise<{ encrypted: string; iv: string; authTag: string; salt: string }> {
    // Generar salt aleatorio
    const salt = crypto.randomBytes(32);
    
    // Derivar clave de encriptación
    const key = await promisify(crypto.pbkdf2)(
      encryptionKey,
      salt,
      this.keyDerivationIterations,
      32,
      'sha256'
    );
    
    // Generar IV aleatorio
    const iv = crypto.randomBytes(16);
    
    // Crear cipher
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    // Encriptar datos
    const encrypted = Buffer.concat([
      cipher.update(p12Buffer),
      cipher.final()
    ]);
    
    // Obtener auth tag para GCM
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      salt: salt.toString('base64')
    };
  }

  /**
   * Desencripta el certificado
   */
  async decryptCertificate(
    encryptedData: string,
    iv: string,
    authTag: string,
    salt: string,
    encryptionKey: string
  ): Promise<Buffer> {
    // Derivar clave
    const key = await promisify(crypto.pbkdf2)(
      encryptionKey,
      Buffer.from(salt, 'base64'),
      this.keyDerivationIterations,
      32,
      'sha256'
    );
    
    // Crear decipher
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(iv, 'base64')
    );
    
    // Establecer auth tag
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    // Desencriptar
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData, 'base64')),
      decipher.final()
    ]);
    
    return decrypted;
  }

  /**
   * Encripta la contraseña del certificado
   */
  async encryptPassword(password: string, key: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      crypto.scryptSync(key, 'salt', 32),
      iv
    );
    
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Desencripta la contraseña del certificado
   */
  async decryptPassword(encryptedPassword: string, key: string): Promise<string> {
    const parts = encryptedPassword.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.scryptSync(key, 'salt', 32),
      iv
    );
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Convierte atributos del certificado a string
   */
  private attributesToString(attrs: any[]): string {
    return attrs
      .map(attr => `${attr.shortName || attr.type}=${attr.value}`)
      .join(', ');
  }

  /**
   * Extrae nombres alternativos del sujeto
   */
  private extractSANs(cert: forge.pki.Certificate): string[] {
    const sans: string[] = [];
    const ext = cert.getExtension('subjectAltName');
    
    if (ext && (ext as any).altNames) {
      for (const altName of (ext as any).altNames) {
        if (altName.type === 2) { // DNS
          sans.push(altName.value);
        }
      }
    }
    
    return sans;
  }

  /**
   * Extrae key usage del certificado
   */
  private extractKeyUsage(cert: forge.pki.Certificate): string[] {
    const usage: string[] = [];
    const ext = cert.getExtension('keyUsage');
    
    if (ext) {
      const keyUsage = ext as any;
      if (keyUsage.digitalSignature) usage.push('digitalSignature');
      if (keyUsage.nonRepudiation) usage.push('nonRepudiation');
      if (keyUsage.keyEncipherment) usage.push('keyEncipherment');
      if (keyUsage.dataEncipherment) usage.push('dataEncipherment');
      if (keyUsage.keyAgreement) usage.push('keyAgreement');
      if (keyUsage.keyCertSign) usage.push('keyCertSign');
      if (keyUsage.cRLSign) usage.push('cRLSign');
    }
    
    return usage;
  }

  /**
   * Extrae extended key usage
   */
  private extractExtendedKeyUsage(cert: forge.pki.Certificate): string[] {
    const usage: string[] = [];
    const ext = cert.getExtension('extKeyUsage');
    
    if (ext && (ext as any).serverAuth) usage.push('serverAuth');
    if (ext && (ext as any).clientAuth) usage.push('clientAuth');
    if (ext && (ext as any).codeSigning) usage.push('codeSigning');
    if (ext && (ext as any).emailProtection) usage.push('emailProtection');
    if (ext && (ext as any).timeStamping) usage.push('timeStamping');
    
    return usage;
  }

  /**
   * Calcula el thumbprint del certificado
   */
  private calculateThumbprint(cert: forge.pki.Certificate): string {
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert));
    const md = forge.md.sha256.create();
    md.update(der.getBytes());
    return md.digest().toHex();
  }

  /**
   * Extrae la cadena de certificados
   */
  private extractCertificateChain(p12: any): string[] {
    const chain: string[] = [];
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    
    for (const bagId in certBags) {
      const bags = certBags[bagId];
      if (bags) {
        for (const bag of bags) {
          if (bag.cert) {
            chain.push(forge.pki.certificateToPem(bag.cert));
          }
        }
      }
    }
    
    return chain;
  }
}