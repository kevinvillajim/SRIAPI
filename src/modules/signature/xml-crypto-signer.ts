import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as xmlCrypto from 'xml-crypto';
import { CertificateLoader } from '../certificates/certificate-loader';

/**
 * Firmador usando xml-crypto directamente para mayor compatibilidad
 */
export class XmlCryptoSigner {
    private certificateLoader: CertificateLoader;
    
    constructor() {
        this.certificateLoader = new CertificateLoader();
    }
    
    /**
     * Firma un documento XML usando xml-crypto
     */
    public async signXML(xmlContent: string): Promise<string> {
        try {
            console.log('📝 Iniciando firma digital con xml-crypto...');
            
            // Cargar certificado
            const certInfo = await this.certificateLoader.loadCertificate();
            const privateKeyPem = this.certificateLoader.getPrivateKeyPEM();
            const certBase64 = this.certificateLoader.getCertificateBase64();
            
            // Parsear XML
            const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
            
            // Generar IDs únicos
            const signatureId = `Signature${Math.floor(Math.random() * 1000000)}`;
            const signedPropsId = `${signatureId}-SignedProperties${Math.floor(Math.random() * 1000000)}`;
            const keyInfoId = `Certificate${Math.floor(Math.random() * 1000000)}`;
            const referenceId = `Reference-ID-${Math.floor(Math.random() * 1000000)}`;
            
            // Crear SignedXml
            const sig = new (xmlCrypto as any).SignedXml();
            
            // Configurar algoritmos
            sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
            sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
            
            // Configurar la clave privada
            sig.signingKey = privateKeyPem;
            
            // Agregar la referencia al documento principal con transform enveloped
            sig.addReference(
                "//*[local-name()='factura']",
                ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
                'http://www.w3.org/2000/09/xmldsig#sha1',
                null,
                null,
                '',
                referenceId
            );
            
            // Crear y agregar SignedProperties
            const signedProperties = this.createSignedProperties(
                signedPropsId,
                certInfo,
                referenceId,
                certBase64
            );
            
            // Agregar referencia a SignedProperties
            const signedPropsDoc = new DOMParser().parseFromString(signedProperties, 'text/xml');
            const signedPropsElement = signedPropsDoc.documentElement;
            
            // Insertar SignedProperties temporalmente para calcular su digest
            const tempObject = doc.createElement('ds:Object');
            tempObject.setAttribute('Id', `${signatureId}-Object`);
            const qualProps = doc.createElement('etsi:QualifyingProperties');
            qualProps.setAttribute('Target', `#${signatureId}`);
            tempObject.appendChild(qualProps);
            qualProps.appendChild(doc.importNode(signedPropsElement, true));
            
            // Agregar referencia a SignedProperties
            sig.addReference(
                `#${signedPropsId}`,
                null,
                'http://www.w3.org/2000/09/xmldsig#sha1',
                'http://uri.etsi.org/01903#SignedProperties'
            );
            
            // Crear KeyInfo personalizado
            sig.keyInfoProvider = {
                getKeyInfo: (_key?: any, prefix?: string) => {
                    prefix = prefix || '';
                    prefix = prefix ? prefix + ':' : prefix;
                    
                    // Obtener información del certificado
                    const modulus = this.getModulusFromCertificate(certInfo);
                    const certLines = certBase64.match(/.{1,76}/g) || [certBase64];
                    const modulusLines = modulus.match(/.{1,76}/g) || [modulus];
                    
                    return `<${prefix}KeyInfo Id="${keyInfoId}">
      <${prefix}X509Data>
        <${prefix}X509Certificate>
${certLines.join('\n')}
</${prefix}X509Certificate>
      </${prefix}X509Data>
      <${prefix}KeyValue>
        <${prefix}RSAKeyValue>
          <${prefix}Modulus>
${modulusLines.join('\n')}
</${prefix}Modulus>
          <${prefix}Exponent>AQAB</${prefix}Exponent>
        </${prefix}RSAKeyValue>
      </${prefix}KeyValue>
    </${prefix}KeyInfo>`;
                },
                getKey: (_keyInfo?: any) => {
                    return privateKeyPem;
                }
            };
            
            // Agregar referencia a KeyInfo
            sig.addReference(
                `#${keyInfoId}`,
                null,
                'http://www.w3.org/2000/09/xmldsig#sha1'
            );
            
            // Calcular y agregar la firma
            sig.computeSignature(doc.documentElement);
            
            // Obtener el XML de la firma
            let signatureXml = sig.getSignatureXml();
            
            // Agregar los atributos necesarios
            const sigDoc = new DOMParser().parseFromString(signatureXml, 'text/xml');
            const signatureElement = sigDoc.documentElement;
            signatureElement.setAttribute('Id', signatureId);
            signatureElement.setAttribute('xmlns:etsi', 'http://uri.etsi.org/01903/v1.3.2#');
            
            // Agregar el Object con QualifyingProperties
            const objectElement = sigDoc.createElement('ds:Object');
            objectElement.setAttribute('Id', `${signatureId}-Object`);
            const qualifyingProps = sigDoc.createElement('etsi:QualifyingProperties');
            qualifyingProps.setAttribute('Target', `#${signatureId}`);
            objectElement.appendChild(qualifyingProps);
            qualifyingProps.appendChild(sigDoc.importNode(signedPropsElement, true));
            signatureElement.appendChild(objectElement);
            
            // Insertar la firma en el documento original
            doc.documentElement.appendChild(doc.createTextNode('\n'));
            doc.documentElement.appendChild(doc.importNode(signatureElement, true));
            
            // Serializar el documento firmado
            const signedXml = new XMLSerializer().serializeToString(doc);
            
            console.log('   ✅ Documento firmado exitosamente con xml-crypto');
            
            return signedXml;
            
        } catch (error: any) {
            console.error('   ❌ Error al firmar con xml-crypto:', error.message);
            throw error;
        }
    }
    
    /**
     * Crea el elemento SignedProperties según XAdES-BES
     */
    private createSignedProperties(
        signedPropsId: string,
        certInfo: any,
        referenceId: string,
        certBase64: string
    ): string {
        const signingTime = new Date().toISOString().replace(/\.\d{3}Z$/, '-05:00');
        
        // Obtener información del certificado
        const issuerName = this.formatIssuerName(certInfo.certificate);
        const serialNumber = parseInt(certInfo.certificate.serialNumber, 16).toString();
        const certDigest = this.calculateCertificateDigest(certBase64);
        
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
     * Obtiene el modulus del certificado
     */
    private getModulusFromCertificate(certInfo: any): string {
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
        return modulus;
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

export default XmlCryptoSigner;