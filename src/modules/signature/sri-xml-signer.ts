import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { CertificateLoader } from '../certificates/certificate-loader';
import { SRIC14N } from './sri-c14n';

/**
 * Firmador de XML específico para SRI Ecuador
 * Genera firma XAdES-BES exactamente como el XML de referencia
 */
export class SRIXmlSigner {
    private certificateLoader: CertificateLoader;
    private c14n: SRIC14N;
    
    constructor() {
        this.certificateLoader = new CertificateLoader();
        this.c14n = new SRIC14N();
    }
    
    /**
     * Firma un documento XML según especificaciones del SRI Ecuador
     */
    public async signXML(xmlContent: string): Promise<string> {
        try {
            console.log('📝 Iniciando firma digital para SRI Ecuador...');
            
            // Cargar certificado
            const certInfo = await this.certificateLoader.loadCertificate();
            
            // Parsear XML
            const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
            const facturaElement = doc.documentElement;
            
            // Generar IDs únicos (mismo formato que el de referencia)
            const signatureId = `Signature${Math.floor(Math.random() * 1000000)}`;
            const signedInfoId = `Signature-SignedInfo${Math.floor(Math.random() * 1000000)}`;
            const signedPropsId = `${signatureId}-SignedProperties${Math.floor(Math.random() * 1000000)}`;
            const signedPropertiesRefId = `SignedPropertiesID${Math.floor(Math.random() * 1000000)}`;
            const keyInfoId = `Certificate${Math.floor(Math.random() * 1000000)}`;
            const referenceId = `Reference-ID-${Math.floor(Math.random() * 1000000)}`;
            const signatureValueId = `SignatureValue${Math.floor(Math.random() * 1000000)}`;
            const objectId = `${signatureId}-Object${Math.floor(Math.random() * 1000000)}`;
            
            // Calcular digest del documento (sin la firma)
            // Para firma enveloped, el digest se calcula sobre el documento canonicalizado
            const c14nDocument = this.c14n.canonicalizeForEnvelopedDigest(xmlContent);
            const documentDigest = this.calculateDigest(c14nDocument);
            
            // Crear SignedProperties
            const signedProperties = this.createSignedProperties(
                signedPropsId,
                certInfo,
                referenceId
            );
            
            // Calcular digest de SignedProperties
            const c14nSignedProps = this.c14n.canonicalize(signedProperties);
            const signedPropsDigest = this.calculateDigest(c14nSignedProps);
            
            // Obtener certificado y calcular su digest
            const keyInfoContent = this.createKeyInfoContent(keyInfoId, certInfo);
            const c14nKeyInfo = this.c14n.canonicalize(keyInfoContent);
            const keyInfoDigest = this.calculateDigest(c14nKeyInfo);
            
            // Crear SignedInfo
            const signedInfo = this.createSignedInfo(
                signedInfoId,
                signedPropertiesRefId,
                signedPropsId,
                signedPropsDigest,
                keyInfoId,
                keyInfoDigest,
                referenceId,
                documentDigest
            );
            
            // Canonicalizar y firmar SignedInfo
            const c14nSignedInfo = this.c14n.canonicalizeSignedInfo(signedInfo);
            const signature = this.signData(c14nSignedInfo, certInfo.privateKey);
            
            // Construir el elemento Signature completo
            const signatureElement = this.buildSignatureElement(
                signatureId,
                signedInfo,
                signature,
                signatureValueId,
                keyInfoContent,
                objectId,
                signedProperties
            );
            
            // Insertar la firma como ÚLTIMO elemento según XML de referencia SRI
            // La firma digital debe ser el último elemento antes del cierre de factura
            
            // Agregar salto de línea antes de la firma
            facturaElement.appendChild(doc.createTextNode('\n    '));
            
            // Parsear el elemento signature y agregarlo al documento
            const signatureDoc = new DOMParser().parseFromString(signatureElement, 'text/xml');
            const importedSignature = doc.importNode(signatureDoc.documentElement, true);
            
            // Verificar que sea el último elemento (después de infoAdicional si existe)
            facturaElement.appendChild(importedSignature);
            
            // Agregar salto de línea final
            facturaElement.appendChild(doc.createTextNode('\n'));
            
            // Serializar el documento firmado
            const signedXml = new XMLSerializer().serializeToString(doc);
            
            console.log('   ✅ Documento firmado exitosamente (estructura SRI)');
            
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
     * Crea el contenido de KeyInfo
     */
    private createKeyInfoContent(keyInfoId: string, certInfo: any): string {
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
        
        // Dividir el certificado en líneas para mejor formato
        const certLines = certBase64.match(/.{1,76}/g) || [certBase64];
        const formattedCert = certLines.join('\n');
        
        // Dividir el modulus en líneas
        const modulusLines = modulus.match(/.{1,76}/g) || [modulus];
        const formattedModulus = modulusLines.join('\n');
        
        return `<ds:KeyInfo Id="${keyInfoId}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:X509Data>
        <ds:X509Certificate>
${formattedCert}
</ds:X509Certificate>
      </ds:X509Data>
      <ds:KeyValue>
        <ds:RSAKeyValue>
          <ds:Modulus>
${formattedModulus}
</ds:Modulus>
          <ds:Exponent>AQAB</ds:Exponent>
        </ds:RSAKeyValue>
      </ds:KeyValue>
    </ds:KeyInfo>`;
    }
    
    /**
     * Crea el elemento SignedInfo
     */
    private createSignedInfo(
        signedInfoId: string,
        signedPropertiesRefId: string,
        signedPropsId: string,
        signedPropsDigest: string,
        keyInfoId: string,
        keyInfoDigest: string,
        referenceId: string,
        documentDigest: string
    ): string {
        return `<ds:SignedInfo Id="${signedInfoId}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315">
      </ds:CanonicalizationMethod>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1">
      </ds:SignatureMethod>
      <ds:Reference Id="${signedPropertiesRefId}" Type="http://uri.etsi.org/01903#SignedProperties" URI="#${signedPropsId}">
        <ds:Transforms>
          <ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        </ds:Transforms>
        <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1">
        </ds:DigestMethod>
        <ds:DigestValue>${signedPropsDigest}</ds:DigestValue>
      </ds:Reference>
      <ds:Reference URI="#${keyInfoId}">
        <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1">
        </ds:DigestMethod>
        <ds:DigestValue>${keyInfoDigest}</ds:DigestValue>
      </ds:Reference>
      <ds:Reference Id="${referenceId}" URI="#comprobante">
        <ds:Transforms>
          <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature">
          </ds:Transform>
        </ds:Transforms>
        <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1">
        </ds:DigestMethod>
        <ds:DigestValue>${documentDigest}</ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>`;
    }
    
    /**
     * Construye el elemento Signature completo
     */
    private buildSignatureElement(
        signatureId: string,
        signedInfo: string,
        signatureValue: string,
        signatureValueId: string,
        keyInfoContent: string,
        objectId: string,
        signedProperties: string
    ): string {
        // Formatear el signature value en líneas
        const sigValueLines = signatureValue.match(/.{1,76}/g) || [signatureValue];
        const formattedSigValue = sigValueLines.join('\n');
        
        return `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" Id="${signatureId}">
    ${signedInfo}
    <ds:SignatureValue Id="${signatureValueId}">
${formattedSigValue}
</ds:SignatureValue>
    ${keyInfoContent}
    <ds:Object Id="${objectId}">
      <etsi:QualifyingProperties Target="#${signatureId}">
        ${signedProperties}
      </etsi:QualifyingProperties>
    </ds:Object>
  </ds:Signature>`;
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
     * Firma datos con la clave privada
     */
    private signData(data: string, privateKey: forge.pki.PrivateKey): string {
        // Crear hash SHA1
        const md = forge.md.sha1.create();
        md.update(data, 'utf8');
        
        // Firmar con RSA
        // Verificar el tipo de privateKey para usar el método correcto
        let signature: string;
        if (typeof (privateKey as any).sign === 'function') {
            signature = (privateKey as any).sign(md);
        } else {
            // Usar crypto nativo si forge no funciona
            const sign = crypto.createSign('RSA-SHA1');
            sign.update(data);
            const privateKeyPem = this.certificateLoader.getPrivateKeyPEM();
            return sign.sign(privateKeyPem, 'base64');
        }
        
        // Convertir a base64
        return forge.util.encode64(signature);
    }
    
    /**
     * Formatea el nombre del emisor según X.509 con formatos específicos UANATACA
     * Según documentación oficial: https://uanataca.ec/facturadores.html
     */
    private formatIssuerName(certificate: forge.pki.Certificate): string {
        const attrs = certificate.issuer.attributes;
        
        // Obtener CN para detectar si es UANATACA
        const cnAttr = attrs.find(a => a.shortName === 'CN');
        const cn = cnAttr ? cnAttr.value : '';
        
        // Detectar certificados UANATACA y aplicar formato específico
        if (cn.includes('UANATACA CA2')) {
            console.log(`🔍 Certificado UANATACA detectado: ${cn}`);
            
            if (cn.includes('2016')) {
                // Formato para certificados UANATACA CA2 2016 (1-3 años)
                const uanatacaFormat = 'CN=UANATACA CA2 2016,OU=TSP-UANATACA,O=UANATACA S.A.,L=Barcelona (see current address at www.uanataca.com/address),C=ES';
                console.log(`✅ Aplicando formato UANATACA 2016: ${uanatacaFormat}`);
                return uanatacaFormat;
            } else if (cn.includes('2021')) {
                // Formato para certificados UANATACA CA2 2021 (4-5 años)
                const uanatacaFormat = 'CN=UANATACA CA2 2021,OU=TSP-UANATACA,O=UANATACA S.A.,L=Barcelona,C=ES';
                console.log(`✅ Aplicando formato UANATACA 2021: ${uanatacaFormat}`);
                return uanatacaFormat;
            } else {
                console.log(`⚠️ Certificado UANATACA no reconocido, aplicando formato genérico`);
            }
        }
        
        // Formato genérico para certificados no-UANATACA
        const parts: string[] = [];
        const order = ['CN', 'OU', 'O', 'L', 'C'];
        
        for (const name of order) {
            const attr = attrs.find(a => a.shortName === name);
            if (attr) {
                parts.push(`${name}=${attr.value}`);
            }
        }
        
        const genericFormat = parts.join(',');
        console.log(`📝 Aplicando formato genérico: ${genericFormat}`);
        return genericFormat;
    }
}

export default SRIXmlSigner;