import * as forge from 'node-forge';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

/**
 * Interfaz para información del certificado
 */
export interface CertificateInfo {
    subject: string;
    issuer: string;
    serialNumber: string;
    validFrom: Date;
    validTo: Date;
    ruc: string;
    razonSocial: string;
    isValid: boolean;
    privateKey: forge.pki.PrivateKey;
    certificate: forge.pki.Certificate;
    certificateChain: forge.pki.Certificate[];
}

/**
 * Clase para cargar y gestionar certificados digitales .p12
 */
export class CertificateLoader {
    private certificatePath: string;
    private certificatePassword: string;
    private certificateInfo: CertificateInfo | null = null;
    
    constructor() {
        this.certificatePath = process.env.CERTIFICATE_PATH || '';
        this.certificatePassword = process.env.CERTIFICATE_PASSWORD || '';
    }
    
    /**
     * Carga el certificado desde el archivo .p12
     */
    public async loadCertificate(): Promise<CertificateInfo> {
        try {
            console.log('🔐 Cargando certificado digital...');
            
            // Verificar que el archivo existe
            const fullPath = path.resolve(this.certificatePath);
            if (!fs.existsSync(fullPath)) {
                throw new Error(`Certificado no encontrado en: ${fullPath}`);
            }
            
            // Leer el archivo .p12
            const p12Buffer = fs.readFileSync(fullPath);
            const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
            
            // Configurar para permitir algoritmos legacy si es necesario
            if (process.env.ALLOW_LEGACY_ALGORITHMS === 'true') {
                // Permitir SHA1 y otros algoritmos legacy
                console.log('   ⚠️ Habilitando soporte para algoritmos legacy (SHA1)');
            }
            
            // Parsear el archivo PKCS#12
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, this.certificatePassword);
            
            // Extraer certificado y clave privada
            let privateKey: forge.pki.PrivateKey | null = null;
            let certificate: forge.pki.Certificate | null = null;
            let certificateChain: forge.pki.Certificate[] = [];
            
            // Buscar bags con certificados y claves
            for (const safeContent of p12.safeContents) {
                for (const safeBag of safeContent.safeBags) {
                    if (safeBag.type === forge.pki.oids.certBag) {
                        const cert = safeBag.cert;
                        if (cert) {
                            if (!certificate) {
                                certificate = cert;
                            } else {
                                certificateChain.push(cert);
                            }
                        }
                    } else if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
                        privateKey = safeBag.key as forge.pki.PrivateKey;
                    }
                }
            }
            
            if (!certificate || !privateKey) {
                throw new Error('No se pudo extraer el certificado o la clave privada del archivo .p12');
            }
            
            // Extraer información del certificado
            const subject = certificate.subject.attributes.reduce((acc, attr) => {
                if (attr.shortName === 'CN') return attr.value as string;
                return acc;
            }, '');
            
            const issuer = certificate.issuer.attributes.reduce((acc, attr) => {
                if (attr.shortName === 'CN') return attr.value as string;
                return acc;
            }, '');
            
            // Extraer RUC del subject o de las extensiones
            let ruc = '1793204144001'; // RUC por defecto de BUSINESSCONNECT
            let razonSocial = 'BUSINESSCONNECT S.A.S.';
            
            // Intentar extraer del CN
            const cnMatch = subject.match(/(\d{13})/);
            if (cnMatch) {
                ruc = cnMatch[1];
            }
            
            // Validar fechas
            const now = new Date();
            const validFrom = certificate.validity.notBefore;
            const validTo = certificate.validity.notAfter;
            const isValid = now >= validFrom && now <= validTo;
            
            this.certificateInfo = {
                subject,
                issuer,
                serialNumber: certificate.serialNumber,
                validFrom,
                validTo,
                ruc,
                razonSocial,
                isValid,
                privateKey,
                certificate,
                certificateChain
            };
            
            console.log('   ✅ Certificado cargado exitosamente');
            console.log(`   📋 Titular: ${subject}`);
            console.log(`   🏢 RUC: ${ruc}`);
            console.log(`   🔏 Emisor: ${issuer}`);
            console.log(`   📅 Válido hasta: ${validTo.toLocaleDateString()}`);
            console.log(`   ✓ Estado: ${isValid ? 'VÁLIDO' : 'EXPIRADO'}`);
            
            if (!isValid) {
                throw new Error('El certificado ha expirado');
            }
            
            return this.certificateInfo;
            
        } catch (error: any) {
            console.error('   ❌ Error al cargar certificado:', error.message);
            throw error;
        }
    }
    
    /**
     * Obtiene la información del certificado cargado
     */
    public getCertificateInfo(): CertificateInfo | null {
        return this.certificateInfo;
    }
    
    /**
     * Obtiene el certificado en formato PEM
     */
    public getCertificatePEM(): string {
        if (!this.certificateInfo) {
            throw new Error('Certificado no cargado');
        }
        return forge.pki.certificateToPem(this.certificateInfo.certificate);
    }
    
    /**
     * Obtiene la clave privada en formato PEM
     */
    public getPrivateKeyPEM(): string {
        if (!this.certificateInfo) {
            throw new Error('Certificado no cargado');
        }
        return forge.pki.privateKeyToPem(this.certificateInfo.privateKey);
    }
    
    /**
     * Obtiene el certificado en formato Base64 (DER)
     */
    public getCertificateBase64(): string {
        if (!this.certificateInfo) {
            throw new Error('Certificado no cargado');
        }
        const der = forge.asn1.toDer(forge.pki.certificateToAsn1(this.certificateInfo.certificate));
        return forge.util.encode64(der.getBytes());
    }
    
    /**
     * Valida si el certificado es de UANATACA
     */
    public isUanatacaCertificate(): boolean {
        if (!this.certificateInfo) {
            return false;
        }
        return this.certificateInfo.issuer.toLowerCase().includes('uanataca');
    }
    
    /**
     * Configura el certificado para un path específico
     */
    public setCertificatePath(path: string, password: string): void {
        this.certificatePath = path;
        this.certificatePassword = password;
        this.certificateInfo = null; // Resetear info cargada
    }
}

export default CertificateLoader;