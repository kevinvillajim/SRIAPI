import * as xmlCrypto from 'xml-crypto';
import * as forge from 'node-forge';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { CertificateLoader } from '../certificates/certificate-loader';

/**
 * Clase para firmar documentos XML con XAdES-BES
 * Compatible con los requerimientos del SRI Ecuador
 */
export class XMLSigner {
    private certificateLoader: CertificateLoader;
    
    constructor() {
        this.certificateLoader = new CertificateLoader();
    }
    
    /**
     * Firma un documento XML con XAdES-BES
     */
    public async signXML(xmlContent: string): Promise<string> {
        try {
            console.log('📝 Iniciando proceso de firma digital XAdES-BES...');
            
            // Cargar certificado
            const certInfo = await this.certificateLoader.loadCertificate();
            
            
            // Generar IDs únicos para la firma
            const signatureId = `Signature${Math.floor(Math.random() * 1000000)}`;
            const signedPropsId = `${signatureId}-SignedProperties${Math.floor(Math.random() * 1000000)}`;
            const signedInfoId = `Signature-SignedInfo${Math.floor(Math.random() * 1000000)}`;
            const referenceId = `Reference-ID-${Math.floor(Math.random() * 1000000)}`;
            const keyInfoId = `Certificate${Math.floor(Math.random() * 1000000)}`;
            const objectId = `${signatureId}-Object${Math.floor(Math.random() * 1000000)}`;
            const signatureValueId = `SignatureValue${Math.floor(Math.random() * 1000000)}`;
            const signedPropertiesRefId = `SignedPropertiesID${Math.floor(Math.random() * 1000000)}`;
            
            
            // Crear SignedProperties
            const signedProperties = this.createSignedProperties(
                signedPropsId,
                certInfo,
                referenceId
            );
            
            
            // Crear la firma usando xml-crypto
            const sig = new xmlCrypto.SignedXml();
            
            // Configurar algoritmos (SHA1 por compatibilidad con SRI)
            sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
            sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
            
            // Configurar clave privada
            sig.signingKey = this.certificateLoader.getPrivateKeyPEM();
            
            // Agregar referencia al documento principal (enveloped)
            sig.addReference(
                "//*[@id='comprobante']",
                [
                    'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
                ],
                'http://www.w3.org/2000/09/xmldsig#sha1'
            );
            
            // Las referencias a SignedProperties y KeyInfo se agregan después
            
            // Configurar KeyInfo personalizado
            sig.keyInfoProvider = {
                getKeyInfo: () => {
                    return this.createKeyInfo(keyInfoId, certInfo);
                },
                getKey: () => {
                    return Buffer.from(this.certificateLoader.getPrivateKeyPEM());
                }
            };
            
            // Calcular la firma
            sig.computeSignature(xmlContent);
            
            // Obtener el XML firmado
            let signedXml = sig.getSignedXml();
            
            // Agregar el objeto XAdES con SignedProperties
            signedXml = this.addXAdESObject(signedXml, objectId, signedProperties);
            
            // Ajustar los IDs en el XML firmado
            signedXml = this.adjustSignatureIds(
                signedXml,
                signatureId,
                signedInfoId,
                signatureValueId,
                referenceId,
                signedPropertiesRefId
            );
            
            console.log('   ✅ Documento firmado exitosamente');
            
            return signedXml;
            
        } catch (error: any) {
            console.error('   ❌ Error al firmar documento:', error.message);
            throw error;
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
        
        return `<etsi:SignedProperties Id="${signedPropsId}" xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
          <etsi:SignedSignatureProperties>
            <etsi:SigningTime>${signingTime}</etsi:SigningTime>
            <etsi:SigningCertificate>
              <etsi:Cert>
                <etsi:CertDigest>
                  <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                  <ds:DigestValue>${this.calculateCertificateDigest(this.certificateLoader.getCertificateBase64())}</ds:DigestValue>
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
        
        // Obtener el modulus del certificado (no de la clave privada)
        let modulus = '';
        if (certInfo.certificate && certInfo.certificate.publicKey) {
            const publicKey = certInfo.certificate.publicKey as forge.pki.rsa.PublicKey;
            // Convertir BigInteger a bytes y luego a base64
            const modulusBytes = publicKey.n.toByteArray();
            // Convertir array de bytes a string binario
            let binaryString = '';
            for (let i = 0; i < modulusBytes.length; i++) {
                binaryString += String.fromCharCode(modulusBytes[i] & 0xff);
            }
            modulus = forge.util.encode64(binaryString);
        }
        
        return `<ds:KeyInfo Id="${keyInfoId}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:X509Data>
        <ds:X509Certificate>${certBase64}</ds:X509Certificate>
      </ds:X509Data>
      <ds:KeyValue>
        <ds:RSAKeyValue>
          <ds:Modulus>${modulus}</ds:Modulus>
          <ds:Exponent>AQAB</ds:Exponent>
        </ds:RSAKeyValue>
      </ds:KeyValue>
    </ds:KeyInfo>`;
    }
    
    /**
     * Agrega el objeto XAdES al XML firmado
     */
    private addXAdESObject(signedXml: string, objectId: string, signedProperties: string): string {
        const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
        const signature = doc.getElementsByTagName('Signature')[0];
        
        if (signature) {
            const object = doc.createElement('ds:Object');
            object.setAttribute('Id', objectId);
            
            const qualifyingProps = doc.createElement('etsi:QualifyingProperties');
            qualifyingProps.setAttribute('xmlns:etsi', 'http://uri.etsi.org/01903/v1.3.2#');
            qualifyingProps.setAttribute('Target', `#${signature.getAttribute('Id') || 'Signature'}`);
            
            const tempDoc = new DOMParser().parseFromString(signedProperties, 'text/xml');
            const signedPropsElement = tempDoc.documentElement;
            
            qualifyingProps.appendChild(doc.importNode(signedPropsElement, true));
            object.appendChild(qualifyingProps);
            signature.appendChild(object);
            
            return new XMLSerializer().serializeToString(doc);
        }
        
        return signedXml;
    }
    
    /**
     * Ajusta los IDs en la firma
     */
    private adjustSignatureIds(
        signedXml: string,
        signatureId: string,
        signedInfoId: string,
        signatureValueId: string,
        referenceId: string,
        _signedPropertiesRefId: string
    ): string {
        let xml = signedXml;
        
        // Ajustar ID de Signature
        xml = xml.replace(/<(ds:)?Signature(\s+)/, `<$1Signature Id="${signatureId}"$2`);
        
        // Ajustar ID de SignedInfo
        xml = xml.replace(/<(ds:)?SignedInfo(\s+|>)/, `<$1SignedInfo Id="${signedInfoId}"$2`);
        
        // Ajustar ID de SignatureValue
        xml = xml.replace(/<(ds:)?SignatureValue(\s+|>)/, `<$1SignatureValue Id="${signatureValueId}"$2`);
        
        // Ajustar Reference IDs
        const references = xml.match(/<(ds:)?Reference\s+[^>]*>/g);
        if (references && references.length > 0) {
            // Solo ajustar si hay suficientes referencias
            for (let i = 0; i < references.length && i < 3; i++) {
                if (i === 0) {
                    // Primera referencia - documento principal
                    const newRef = references[i].replace(/Reference/, `Reference Id="${referenceId}"`);
                    xml = xml.replace(references[i], newRef);
                }
            }
        }
        
        return xml;
    }
    
    /**
     * Calcula el digest SHA1 de un contenido (no usado actualmente)
     */
    // private calculateDigest(content: string, algorithm: string = 'SHA1'): string {
    //     const md = algorithm === 'SHA256' 
    //         ? forge.md.sha256.create() 
    //         : forge.md.sha1.create();
    //     md.update(content, 'utf8');
    //     return forge.util.encode64(md.digest().bytes());
    // }
    
    /**
     * Calcula el digest del certificado
     */
    private calculateCertificateDigest(certBase64: string): string {
        const certDer = forge.util.decode64(certBase64);
        const md = forge.md.sha1.create();
        md.update(certDer);
        return forge.util.encode64(md.digest().bytes());
    }
    
    /**
     * Formatea el nombre del emisor según X.509
     */
    private formatIssuerName(certificate: forge.pki.Certificate): string {
        const attrs = certificate.issuer.attributes;
        const parts: string[] = [];
        
        // Orden estándar X.509
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

export default XMLSigner;