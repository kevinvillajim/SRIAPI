import * as forge from 'node-forge';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as crypto from 'crypto';
import { SignatureOptions } from './xades.types';
import { SRIC14N } from './sri-c14n';

export class XAdESSignatureService {
  
  // Instancia de canonicalización especializada SRI
  private readonly c14n = new SRIC14N();
  
  // Constantes según especificación SRI
  private readonly SIGNATURE_NAMESPACES = {
    ds: 'http://www.w3.org/2000/09/xmldsig#',
    etsi: 'http://uri.etsi.org/01903/v1.3.2#',
    xades: 'http://uri.etsi.org/01903/v1.3.2#'
  };

  private readonly CANONICALIZATION_METHOD = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  private readonly SIGNATURE_METHOD_RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  private readonly SIGNATURE_METHOD_RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  private readonly DIGEST_METHOD_SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';

  /**
   * Firma un documento XML según estándar XAdES-BES para SRI
   */
  async signXML(
    xmlContent: string,
    certificatePem: string,
    privateKeyPem: string,
    options?: SignatureOptions
  ): Promise<string> {
    try {
      // Parsear el XML
      const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
      
      // Generar ID único para la firma
      const signatureId = `Signature-${this.generateUUID()}`;
      const signatureValueId = `SignatureValue-${this.generateUUID()}`;
      const objectId = `Object-${this.generateUUID()}`;
      const referenceId = `Reference-${this.generateUUID()}`;
      const signedPropsId = `SignedProperties-${this.generateUUID()}`;
      const keyInfoId = `Certificate${Date.now().toString().slice(-7)}`; // Formato SRI: Certificate + números
      
      // 1. Crear las SignedProperties primero para calcular su digest
      const signedPropsElement = this.createSignedPropertiesElement(
        doc,
        signedPropsId,
        certificatePem,
        signatureId
      );
      
      // 2. Calcular digest de SignedProperties canonicalizadas
      const signedPropsDigest = this.calculateSignedPropertiesDigest(signedPropsElement);
      
      // 3. Crear KeyInfo ANTES del SignedInfo para calcular su digest
      const keyInfo = this.createKeyInfo(doc, keyInfoId, certificatePem);
      const keyInfoDigest = this.calculateKeyInfoDigest(keyInfo);
      
      // 4. Crear el elemento Signature
      const signatureElement = this.createSignatureElement(doc, signatureId);
      
      // 5. Crear SignedInfo con todos los digests correctos
      const signedInfo = this.createSignedInfo(
        doc,
        xmlContent,
        referenceId,
        signedPropsId,
        signedPropsDigest,
        keyInfoId,
        keyInfoDigest,
        options
      );
      signatureElement.appendChild(signedInfo);
      
      // Calcular SignatureValue
      const signatureValue = await this.calculateSignatureValue(
        signedInfo,
        privateKeyPem,
        options
      );
      const signatureValueElement = this.createSignatureValueElement(
        doc,
        signatureValueId,
        signatureValue
      );
      signatureElement.appendChild(signatureValueElement);
      
      // Agregar KeyInfo ya creado
      signatureElement.appendChild(keyInfo);
      
      // Crear Object con SignedProperties (XAdES) - usar las ya creadas
      const objectElement = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:Object');
      objectElement.setAttribute('Id', objectId);
      
      // QualifyingProperties
      const qualifyingProps = doc.createElementNS(this.SIGNATURE_NAMESPACES.xades, 'xades:QualifyingProperties');
      qualifyingProps.setAttribute('Target', `#${signatureId}`);
      qualifyingProps.appendChild(signedPropsElement);
      
      objectElement.appendChild(qualifyingProps);
      signatureElement.appendChild(objectElement);
      
      // Insertar la firma en el documento
      const rootElement = doc.documentElement;
      
      // Para factura electrónica SRI, la firma va al final del documento
      rootElement.appendChild(signatureElement);
      
      // Serializar el documento firmado
      const serializer = new XMLSerializer();
      const signedXml = serializer.serializeToString(doc);
      
      // Formatear y limpiar el XML
      return this.formatXML(signedXml);
    } catch (error: any) {
      throw new Error(`Error al firmar XML: ${error.message}`);
    }
  }

  /**
   * Crea el elemento Signature principal
   */
  private createSignatureElement(doc: Document, signatureId: string): Element {
    const signature = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:Signature');
    signature.setAttribute('Id', signatureId);
    signature.setAttribute('xmlns:ds', this.SIGNATURE_NAMESPACES.ds);
    signature.setAttribute('xmlns:etsi', this.SIGNATURE_NAMESPACES.etsi);
    return signature;
  }

  /**
   * Crea el elemento SignedInfo
   */
  private createSignedInfo(
    doc: Document,
    xmlContent: string,
    referenceId: string,
    signedPropsId: string,
    signedPropsDigest: string,
    keyInfoId: string,
    keyInfoDigest: string,
    options?: SignatureOptions
  ): Element {
    const signedInfo = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:SignedInfo');
    
    // CanonicalizationMethod
    const canonMethod = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:CanonicalizationMethod');
    canonMethod.setAttribute('Algorithm', this.CANONICALIZATION_METHOD);
    signedInfo.appendChild(canonMethod);
    
    // SignatureMethod
    const signMethod = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:SignatureMethod');
    const algorithm = options?.algorithm === 'SHA256' 
      ? this.SIGNATURE_METHOD_RSA_SHA256 
      : this.SIGNATURE_METHOD_RSA_SHA1;
    signMethod.setAttribute('Algorithm', algorithm);
    signedInfo.appendChild(signMethod);
    
    // ORDEN CORRECTO SEGÚN XML QUE FUNCIONA:
    // 1. Reference a SignedProperties (PRIMERA)
    const propsReference = this.createReference(
      doc,
      `${referenceId}-SignedProperties`,
      `#${signedPropsId}`,
      signedPropsDigest,
      false,
      'http://uri.etsi.org/01903#SignedProperties'
    );
    signedInfo.appendChild(propsReference);
    
    // 2. Reference al Certificate/KeyInfo (SEGUNDA) - ¡CRÍTICO!
    const certReference = this.createReference(
      doc,
      `Certificate-${this.generateUUID()}`,
      `#${keyInfoId}`,
      keyInfoDigest, // Digest calculado del KeyInfo
      false
    );
    signedInfo.appendChild(certReference);
    
    // 3. Reference al documento (Enveloped) (TERCERA)
    const docReference = this.createReference(
      doc,
      referenceId,
      '', // URI vacío para firma enveloped
      this.calculateEnvelopedDigest(xmlContent, options?.algorithm || 'SHA1'),
      true // isEnveloped
    );
    signedInfo.appendChild(docReference);
    
    return signedInfo;
  }

  /**
   * Crea un elemento Reference
   */
  private createReference(
    doc: Document,
    id: string,
    uri: string,
    digestValue: string,
    isEnveloped: boolean,
    type?: string
  ): Element {
    const reference = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:Reference');
    reference.setAttribute('Id', id);
    reference.setAttribute('URI', uri);
    if (type) {
      reference.setAttribute('Type', type);
    }
    
    // Transforms - Solo agregar si realmente hay transforms (no para Certificate references)
    let needsTransforms = false;
    const transforms = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:Transforms');
    
    if (isEnveloped) {
      const envelopedTransform = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:Transform');
      envelopedTransform.setAttribute('Algorithm', 'http://www.w3.org/2000/09/xmldsig#enveloped-signature');
      transforms.appendChild(envelopedTransform);
      needsTransforms = true;
    } else if (type === 'http://uri.etsi.org/01903#SignedProperties') {
      // Para SignedProperties, agregar canonicalización según XAdES-BES
      const canonTransform = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:Transform');
      canonTransform.setAttribute('Algorithm', this.CANONICALIZATION_METHOD);
      transforms.appendChild(canonTransform);
      needsTransforms = true;
    }
    
    // Solo agregar ds:Transforms si tiene contenido (evita <ds:Transforms/> vacío para Certificate)
    if (needsTransforms) {
      reference.appendChild(transforms);
    }
    
    // DigestMethod
    const digestMethod = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:DigestMethod');
    digestMethod.setAttribute('Algorithm', this.DIGEST_METHOD_SHA1);
    reference.appendChild(digestMethod);
    
    // DigestValue
    const digestValueElement = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:DigestValue');
    digestValueElement.textContent = digestValue;
    reference.appendChild(digestValueElement);
    
    return reference;
  }


  /**
   * Calcula el valor de la firma
   */
  private async calculateSignatureValue(
    signedInfo: Element,
    privateKeyPem: string,
    options?: SignatureOptions
  ): Promise<string> {
    // Canonicalizar SignedInfo usando método especializado SRI
    const serializer = new XMLSerializer();
    const signedInfoXml = serializer.serializeToString(signedInfo);
    const canonicalizedXml = this.c14n.canonicalizeSignedInfo(signedInfoXml);
    
    // Crear firma
    const algorithm = options?.algorithm === 'SHA256' ? 'RSA-SHA256' : 'RSA-SHA1';
    const sign = crypto.createSign(algorithm);
    sign.update(canonicalizedXml);
    sign.end();
    
    return sign.sign(privateKeyPem, 'base64');
  }

  /**
   * Crea el elemento SignatureValue
   */
  private createSignatureValueElement(
    doc: Document,
    id: string,
    value: string
  ): Element {
    const signatureValue = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:SignatureValue');
    signatureValue.setAttribute('Id', id);
    signatureValue.textContent = value;
    return signatureValue;
  }

  /**
   * Crea el elemento KeyInfo con el certificado y clave pública RSA
   */
  private createKeyInfo(doc: Document, id: string, certificatePem: string): Element {
    const keyInfo = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:KeyInfo');
    keyInfo.setAttribute('Id', id);
    
    // X509Data
    const x509Data = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:X509Data');
    
    // X509Certificate
    const x509Cert = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:X509Certificate');
    // Remover headers y formatear
    const certBase64 = certificatePem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');
    x509Cert.textContent = certBase64;
    
    x509Data.appendChild(x509Cert);
    keyInfo.appendChild(x509Data);
    
    // CRÍTICO: Agregar KeyValue con RSAKeyValue (faltaba en implementación anterior)
    const keyValue = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:KeyValue');
    const rsaKeyValue = this.createRSAKeyValue(doc, certificatePem);
    keyValue.appendChild(rsaKeyValue);
    keyInfo.appendChild(keyValue);
    
    return keyInfo;
  }

  /**
   * Crea el elemento RSAKeyValue con Modulus y Exponent extraídos del certificado
   */
  private createRSAKeyValue(doc: Document, certificatePem: string): Element {
    try {
      // Usar node-forge para parsear el certificado y extraer la clave pública
      const forge = require('node-forge');
      const cert = forge.pki.certificateFromPem(certificatePem);
      const publicKey = cert.publicKey as any;
      
      // Extraer modulus y exponent correctamente para SRI
      // El modulus debe ser un número entero grande positivo
      const modulusBytes = publicKey.n.toString(16); // Hexadecimal
      const modulusBuffer = Buffer.from(modulusBytes, 'hex');
      const modulus = modulusBuffer.toString('base64');
      
      // El exponent suele ser 65537 (AQAB en base64)
      // Asegurar que el exponent se codifique correctamente
      let exponentHex = publicKey.e.toString(16);
      // Si es impar, agregar un 0 al inicio
      if (exponentHex.length % 2 !== 0) {
        exponentHex = '0' + exponentHex;
      }
      const exponentBuffer = Buffer.from(exponentHex, 'hex');
      const exponent = exponentBuffer.toString('base64');
      
      // Crear elementos XML
      const rsaKeyValue = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:RSAKeyValue');
      
      const modulusElement = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:Modulus');
      // Formatear modulus en múltiples líneas como referencia
      const formattedModulus = modulus.match(/.{1,64}/g)?.join('\n') || modulus;
      modulusElement.textContent = '\n' + formattedModulus + '\n';
      
      const exponentElement = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:Exponent');
      exponentElement.textContent = exponent;
      
      rsaKeyValue.appendChild(modulusElement);
      rsaKeyValue.appendChild(exponentElement);
      
      return rsaKeyValue;
    } catch (error: any) {
      throw new Error(`Error creating RSAKeyValue: ${error.message}`);
    }
  }

  /**
   * Crea el elemento SigningCertificate
   */
  private createSigningCertificate(doc: Document, certificatePem: string): Element {
    const signingCert = doc.createElementNS(this.SIGNATURE_NAMESPACES.xades, 'xades:SigningCertificate');
    
    // Cert
    const cert = doc.createElementNS(this.SIGNATURE_NAMESPACES.xades, 'xades:Cert');
    
    // CertDigest
    const certDigest = doc.createElementNS(this.SIGNATURE_NAMESPACES.xades, 'xades:CertDigest');
    
    // DigestMethod
    const digestMethod = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:DigestMethod');
    digestMethod.setAttribute('Algorithm', this.DIGEST_METHOD_SHA1);
    certDigest.appendChild(digestMethod);
    
    // DigestValue
    const digestValue = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:DigestValue');
    const certBase64 = certificatePem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');
    const certBuffer = Buffer.from(certBase64, 'base64');
    const hash = crypto.createHash('sha1');
    hash.update(certBuffer);
    digestValue.textContent = hash.digest('base64');
    certDigest.appendChild(digestValue);
    
    cert.appendChild(certDigest);
    
    // IssuerSerial
    const issuerSerial = this.createIssuerSerial(doc, certificatePem);
    cert.appendChild(issuerSerial);
    
    signingCert.appendChild(cert);
    
    return signingCert;
  }

  /**
   * Crea el elemento IssuerSerial
   */
  private createIssuerSerial(doc: Document, certificatePem: string): Element {
    const issuerSerial = doc.createElementNS(this.SIGNATURE_NAMESPACES.xades, 'xades:IssuerSerial');
    
    // Parsear certificado para obtener issuer y serial
    const cert = forge.pki.certificateFromPem(certificatePem);
    
    // X509IssuerName
    const issuerName = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:X509IssuerName');
    issuerName.textContent = this.formatIssuerName(cert.issuer.attributes);
    issuerSerial.appendChild(issuerName);
    
    // X509SerialNumber
    const serialNumber = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:X509SerialNumber');
    serialNumber.textContent = parseInt(cert.serialNumber, 16).toString();
    issuerSerial.appendChild(serialNumber);
    
    return issuerSerial;
  }

  /**
   * Crea el SignaturePolicyIdentifier
   */
  private createSignaturePolicyIdentifier(doc: Document): Element {
    const policyId = doc.createElementNS(this.SIGNATURE_NAMESPACES.xades, 'xades:SignaturePolicyIdentifier');
    
    // SignaturePolicyImplied (política implícita según SRI)
    const policyImplied = doc.createElementNS(this.SIGNATURE_NAMESPACES.xades, 'xades:SignaturePolicyImplied');
    policyId.appendChild(policyImplied);
    
    return policyId;
  }

  /**
   * Canonicaliza XML según C14N especializado para SRI
   */
  private canonicalize(xml: string): string {
    return this.c14n.canonicalize(xml);
  }

  /**
   * Calcula el digest SHA1 del elemento KeyInfo
   */
  private calculateKeyInfoDigest(keyInfo: Element): string {
    try {
      const serializer = new XMLSerializer();
      const keyInfoXml = serializer.serializeToString(keyInfo);
      
      // Canonicalizar el KeyInfo usando SRIC14N
      const canonicalizedXml = this.c14n.canonicalize(keyInfoXml);
      
      // Calcular SHA1 digest
      const crypto = require('crypto');
      const hash = crypto.createHash('sha1');
      hash.update(canonicalizedXml, 'utf8');
      return hash.digest('base64');
    } catch (error: any) {
      throw new Error(`Error calculating KeyInfo digest: ${error.message}`);
    }
  }

  /**
   * Formatea el issuer name según RFC2253
   */
  private formatIssuerName(attributes: any[]): string {
    const order = ['CN', 'OU', 'O', 'L', 'ST', 'C'];
    const formatted: string[] = [];
    
    for (const attr of attributes) {
      const shortName = attr.shortName || attr.type;
      if (order.includes(shortName)) {
        formatted.push(`${shortName}=${attr.value}`);
      }
    }
    
    return formatted.reverse().join(',');
  }

  /**
   * Formatea el XML resultante
   */
  private formatXML(xml: string): string {
    // Asegurar declaración XML
    if (!xml.startsWith('<?xml')) {
      xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
    }
    
    // Limpiar espacios innecesarios pero mantener estructura
    return xml
      .replace(/>\s+</g, '><')
      .replace(/\n\s*\n/g, '\n');
  }

  /**
   * Genera un UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Valida una firma XAdES existente
   */
  async validateSignature(signedXml: string): Promise<boolean> {
    try {
      const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
      
      // Buscar elemento Signature
      const signatures = doc.getElementsByTagNameNS(this.SIGNATURE_NAMESPACES.ds, 'Signature');
      if (signatures.length === 0) {
        throw new Error('No se encontró firma en el documento');
      }
      
      // Aquí implementar validación completa según necesidad
      // Por ahora retornamos true si la estructura es correcta
      return true;
    } catch (error: any) {
      throw new Error(`Error al validar firma: ${error.message}`);
    }
  }

  /**
   * Crea el elemento SignedProperties separadamente para poder calcular su digest
   */
  private createSignedPropertiesElement(
    doc: Document,
    signedPropsId: string,
    certificatePem: string,
    _signatureId: string
  ): Element {
    const signedProps = doc.createElementNS(this.SIGNATURE_NAMESPACES.xades, 'xades:SignedProperties');
    signedProps.setAttribute('Id', signedPropsId);
    
    // SignedSignatureProperties
    const signedSigProps = doc.createElementNS(this.SIGNATURE_NAMESPACES.xades, 'xades:SignedSignatureProperties');
    
    // SigningTime
    const signingTime = doc.createElementNS(this.SIGNATURE_NAMESPACES.xades, 'xades:SigningTime');
    signingTime.textContent = new Date().toISOString();
    signedSigProps.appendChild(signingTime);
    
    // SigningCertificate
    const signingCert = this.createSigningCertificate(doc, certificatePem);
    signedSigProps.appendChild(signingCert);
    
    // SignaturePolicyIdentifier
    const policyId = this.createSignaturePolicyIdentifier(doc);
    signedSigProps.appendChild(policyId);
    
    signedProps.appendChild(signedSigProps);
    
    // SignedDataObjectProperties (vacío para SRI)
    const signedDataProps = doc.createElementNS(this.SIGNATURE_NAMESPACES.xades, 'xades:SignedDataObjectProperties');
    signedProps.appendChild(signedDataProps);
    
    return signedProps;
  }

  /**
   * Calcula el digest de las SignedProperties canonicalizadas
   */
  private calculateSignedPropertiesDigest(signedPropsElement: Element): string {
    // Serializar el elemento SignedProperties
    const serializer = new XMLSerializer();
    const signedPropsXml = serializer.serializeToString(signedPropsElement);
    
    // Canonicalizar según C14N especializado SRI
    const canonicalXml = this.canonicalize(signedPropsXml);
    
    // Calcular digest SHA1
    const hash = crypto.createHash('sha1');
    hash.update(canonicalXml, 'utf8');
    return hash.digest('base64');
  }

  /**
   * Calcula el digest del documento para firma enveloped usando SRIC14N
   */
  private calculateEnvelopedDigest(xmlContent: string, algorithm: string = 'SHA1'): string {
    // Usar canonicalización especializada para enveloped
    const canonicalXml = this.c14n.canonicalizeForEnvelopedDigest(xmlContent);
    
    // Calcular digest
    const hashAlgorithm = algorithm.toLowerCase() === 'sha256' ? 'sha256' : 'sha1';
    const hash = crypto.createHash(hashAlgorithm);
    hash.update(canonicalXml, 'utf8');
    return hash.digest('base64');
  }
}