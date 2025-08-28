import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as xmlCrypto from 'xml-crypto';
import { CertificateLoader } from '../certificates/certificate-loader';

/**
 * Firmador de XML versión 2 - Usando xml-crypto para mejor compatibilidad
 * Genera firma XAdES-BES exactamente como requiere el SRI Ecuador
 */
export class SRIXmlSignerV2 {
    private certificateLoader: CertificateLoader;
    
    constructor() {
        this.certificateLoader = new CertificateLoader();
    }
    
    /**
     * Firma un documento XML según especificaciones del SRI Ecuador
     */
    public async signXML(xmlContent: string): Promise<string> {
        try {
            console.log('📝 Iniciando firma digital v2 para SRI Ecuador...');
            
            // Cargar certificado
            const certInfo = await this.certificateLoader.loadCertificate();
            
            // Generar IDs únicos
            const signatureId = `Signature${Math.floor(Math.random() * 1000000)}`;
            const signedInfoId = `Signature-SignedInfo${Math.floor(Math.random() * 1000000)}`;
            const signedPropsId = `${signatureId}-SignedProperties${Math.floor(Math.random() * 1000000)}`;
            const signedPropertiesRefId = `SignedPropertiesID${Math.floor(Math.random() * 1000000)}`;
            const keyInfoId = `Certificate${Math.floor(Math.random() * 1000000)}`;
            const referenceId = `Reference-ID-${Math.floor(Math.random() * 1000000)}`;
            const signatureValueId = `SignatureValue${Math.floor(Math.random() * 1000000)}`;
            const objectId = `${signatureId}-Object${Math.floor(Math.random() * 1000000)}`;
            
            // Crear SignedProperties XML
            const signedProperties = this.createSignedProperties(
                signedPropsId,
                certInfo,
                referenceId
            );
            
            // Crear KeyInfo
            const keyInfo = this.createKeyInfo(keyInfoId, certInfo);
            
            // Crear objeto XAdES
            const xadesObject = `<ds:Object Id="${objectId}">
      <etsi:QualifyingProperties Target="#${signatureId}">
        ${signedProperties}
      </etsi:QualifyingProperties>
    </ds:Object>`;
            
            // Crear un signer con xml-crypto
            const sig = new xmlCrypto.SignedXml();
            
            // Configurar opciones
            sig.signingKey = this.certificateLoader.getPrivateKeyPEM();
            sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
            sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
            
            // Agregar transformación personalizada para SignedProperties
            sig.computeSignature(xmlContent, {
                prefix: 'ds',
                location: { 
                    reference: "//*[local-name()='factura']",
                    action: 'append' 
                },
                existingPrefixes: {
                    ds: 'http://www.w3.org/2000/09/xmldsig#',
                    etsi: 'http://uri.etsi.org/01903/v1.3.2#'
                }
            });
            
            // Obtener el XML firmado
            let signedXml = sig.getSignedXml();
            
            // Ahora necesitamos agregar manualmente los elementos XAdES
            const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
            
            // Buscar el elemento Signature
            const signatures = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature');
            if (signatures.length > 0) {
                const signature = signatures[0];
                
                // Agregar IDs
                signature.setAttribute('Id', signatureId);
                signature.setAttribute('xmlns:etsi', 'http://uri.etsi.org/01903/v1.3.2#');
                
                // Buscar SignedInfo y agregar ID
                const signedInfos = signature.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'SignedInfo');
                if (signedInfos.length > 0) {
                    signedInfos[0].setAttribute('Id', signedInfoId);
                }
                
                // Buscar SignatureValue y agregar ID
                const signatureValues = signature.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'SignatureValue');
                if (signatureValues.length > 0) {
                    signatureValues[0].setAttribute('Id', signatureValueId);
                }
                
                // Reemplazar KeyInfo con el nuestro
                const keyInfos = signature.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'KeyInfo');
                if (keyInfos.length > 0) {
                    const parent = keyInfos[0].parentNode;
                    parent?.removeChild(keyInfos[0]);
                }
                
                // Agregar nuestro KeyInfo
                const keyInfoDoc = new DOMParser().parseFromString(keyInfo, 'text/xml');
                const keyInfoElement = doc.importNode(keyInfoDoc.documentElement, true);
                signature.appendChild(keyInfoElement);
                
                // Agregar el Object con XAdES
                const objectDoc = new DOMParser().parseFromString(xadesObject, 'text/xml');
                const objectElement = doc.importNode(objectDoc.documentElement, true);
                signature.appendChild(objectElement);
                
                // Ahora necesitamos recalcular las referencias manualmente
                this.addSignedPropertiesReference(signature, signedPropertiesRefId, signedPropsId, signedProperties);
                this.addKeyInfoReference(signature, keyInfoId, keyInfo);
                this.updateDocumentReference(signature, referenceId);
            }
            
            // Serializar el resultado
            signedXml = new XMLSerializer().serializeToString(doc);
            
            console.log('   ✅ Documento firmado exitosamente (v2)');
            
            return signedXml;
            
        } catch (error: any) {
            console.error('   ❌ Error al firmar documento:', error.message);
            throw error;
        }
    }
    
    /**
     * Agrega la referencia a SignedProperties
     */
    private addSignedPropertiesReference(
        signature: Element,
        refId: string,
        propsId: string,
        signedProperties: string
    ): void {
        const signedInfo = signature.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'SignedInfo')[0];
        if (!signedInfo) return;
        
        // Calcular digest de SignedProperties
        const c14n = this.canonicalize(signedProperties);
        const digest = this.calculateDigest(c14n);
        
        // Crear la referencia
        const refXml = `<ds:Reference xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${refId}" Type="http://uri.etsi.org/01903#SignedProperties" URI="#${propsId}">
        <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <ds:DigestValue>${digest}</ds:DigestValue>
      </ds:Reference>`;
        
        const refDoc = new DOMParser().parseFromString(refXml, 'text/xml');
        const refElement = signedInfo.ownerDocument!.importNode(refDoc.documentElement, true);
        
        // Insertar como primera referencia
        const firstRef = signedInfo.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Reference')[0];
        signedInfo.insertBefore(refElement, firstRef);
    }
    
    /**
     * Agrega la referencia a KeyInfo
     */
    private addKeyInfoReference(signature: Element, keyInfoId: string, keyInfo: string): void {
        const signedInfo = signature.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'SignedInfo')[0];
        if (!signedInfo) return;
        
        // Calcular digest de KeyInfo
        const c14n = this.canonicalize(keyInfo);
        const digest = this.calculateDigest(c14n);
        
        // Crear la referencia
        const refXml = `<ds:Reference xmlns:ds="http://www.w3.org/2000/09/xmldsig#" URI="#${keyInfoId}">
        <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <ds:DigestValue>${digest}</ds:DigestValue>
      </ds:Reference>`;
        
        const refDoc = new DOMParser().parseFromString(refXml, 'text/xml');
        const refElement = signedInfo.ownerDocument!.importNode(refDoc.documentElement, true);
        
        // Insertar después de la primera referencia
        const refs = signedInfo.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Reference');
        if (refs.length > 0) {
            signedInfo.insertBefore(refElement, refs[refs.length - 1]);
        }
    }
    
    /**
     * Actualiza la referencia al documento
     */
    private updateDocumentReference(signature: Element, referenceId: string): void {
        const refs = signature.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Reference');
        
        // La última referencia debería ser la del documento
        for (let i = 0; i < refs.length; i++) {
            const ref = refs[i];
            const uri = ref.getAttribute('URI');
            if (uri === '#comprobante' || uri === '') {
                ref.setAttribute('Id', referenceId);
                break;
            }
        }
    }
    
    /**
     * Crea el elemento SignedProperties según XAdES-BES
     */
    private createSignedProperties(
        signedPropsId: string,
        certInfo: any,
        referenceId: string
    ): string {
        const signingTime = new Date().toISOString().replace(/\.\d{3}Z$/, '-05:00');
        
        // Obtener información del certificado
        const issuerName = this.formatIssuerName(certInfo.certificate);
        const serialNumber = parseInt(certInfo.certificate.serialNumber, 16).toString();
        const certDigest = this.calculateCertificateDigest(this.certificateLoader.getCertificateBase64());
        
        return `<etsi:SignedProperties Id="${signedPropsId}" xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
          <etsi:SignedSignatureProperties>
            <etsi:SigningTime>${signingTime}</etsi:SigningTime>
            <etsi:SigningCertificate>
              <etsi:Cert>
                <etsi:CertDigest>
                  <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                  <ds:DigestValue>${certDigest}</ds:DigestValue>
                </etsi:CertDigest>
                <etsi:IssuerSerial>
                  <ds:X509IssuerName>${issuerName}</ds:X509IssuerName>
                  <ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>
                </etsi:IssuerSerial>
              </etsi:Cert>
            </etsi:SigningCertificate>
          </etsi:SignedSignatureProperties>
          <etsi:SignedDataObjectProperties>
            <etsi:DataObjectFormat ObjectReference="#${referenceId}">
              <etsi:Description>Nube Digital Tel.22992900</etsi:Description>
              <etsi:MimeType>text/xml</etsi:MimeType>
            </etsi:DataObjectFormat>
          </etsi:SignedDataObjectProperties>
        </etsi:SignedProperties>`;
    }
    
    /**
     * Crea el elemento KeyInfo
     */
    private createKeyInfo(keyInfoId: string, certInfo: any): string {
        const certBase64 = this.certificateLoader.getCertificateBase64();
        
        // Obtener el modulus del certificado
        let modulus = '';
        if (certInfo.certificate && certInfo.certificate.publicKey) {
            const publicKey = certInfo.certificate.publicKey as forge.pki.rsa.PublicKey;
            const modulusBytes = publicKey.n.toByteArray();
            let binaryString = '';
            for (let i = 0; i < modulusBytes.length; i++) {
                binaryString += String.fromCharCode(modulusBytes[i] & 0xff);
            }
            modulus = forge.util.encode64(binaryString);
        }
        
        // Formatear para mejor legibilidad
        const certLines = certBase64.match(/.{1,76}/g) || [certBase64];
        const modulusLines = modulus.match(/.{1,76}/g) || [modulus];
        
        return `<ds:KeyInfo Id="${keyInfoId}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:X509Data>
        <ds:X509Certificate>${certLines.join('\n')}</ds:X509Certificate>
      </ds:X509Data>
      <ds:KeyValue>
        <ds:RSAKeyValue>
          <ds:Modulus>${modulusLines.join('\n')}</ds:Modulus>
          <ds:Exponent>AQAB</ds:Exponent>
        </ds:RSAKeyValue>
      </ds:KeyValue>
    </ds:KeyInfo>`;
    }
    
    /**
     * Calcula el digest SHA1 de un contenido
     */
    private calculateDigest(content: string): string {
        const hash = crypto.createHash('sha1');
        hash.update(content, 'utf8');
        return hash.digest('base64');
    }
    
    /**
     * Calcula el digest del certificado
     */
    private calculateCertificateDigest(certBase64: string): string {
        const certDer = Buffer.from(certBase64, 'base64');
        const hash = crypto.createHash('sha1');
        hash.update(certDer);
        return hash.digest('base64');
    }
    
    /**
     * Canonicaliza XML según C14N
     */
    private canonicalize(xmlContent: string): string {
        // Eliminar espacios en blanco innecesarios y normalizar
        return xmlContent
            .replace(/\r\n/g, '\n')
            .replace(/>\s+</g, '><')
            .trim();
    }
    
    /**
     * Formatea el nombre del emisor según X.509
     */
    private formatIssuerName(certificate: forge.pki.Certificate): string {
        const attrs = certificate.issuer.attributes;
        const parts: string[] = [];
        
        // Orden específico para SRI
        const order = ['CN', 'OU', 'O', 'C'];
        
        for (const name of order) {
            const attr = attrs.find(a => a.shortName === name);
            if (attr) {
                parts.push(`${name}=${attr.value}`);
            }
        }
        
        return parts.join(',');
    }
}

export default SRIXmlSignerV2;