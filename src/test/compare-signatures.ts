import * as fs from 'fs';
import * as path from 'path';
import { DOMParser } from '@xmldom/xmldom';

/**
 * Compara las firmas digitales entre nuestro XML y el de referencia
 */
class CompareSignatures {
    
    async compare(): Promise<void> {
        console.log('=== COMPARACIÓN DE FIRMAS DIGITALES ===\n');
        
        try {
            // Cargar XMLs
            const referenceXml = this.loadAndCleanXml('../../1308202501120603993300110010010000001181321514411_Firmado.xml');
            const ourXml = this.loadAndCleanXml('../../test-output/1808202501179320414400110010010000000019651687611_firmado.xml');
            
            // Parsear XMLs
            const refDoc = new DOMParser().parseFromString(referenceXml, 'text/xml');
            const ourDoc = new DOMParser().parseFromString(ourXml, 'text/xml');
            
            // Extraer elementos de firma
            const refSignature = this.extractSignatureElements(refDoc);
            const ourSignature = this.extractSignatureElements(ourDoc);
            
            // Comparar elementos
            console.log('📋 COMPARACIÓN DE ELEMENTOS:\n');
            
            // 1. Algoritmos
            console.log('1. ALGORITMOS:');
            console.log('   Canonicalización:');
            console.log('   - Referencia:', refSignature.canonicalizationMethod);
            console.log('   - Nuestro:', ourSignature.canonicalizationMethod);
            console.log('   ✅ Coincide:', refSignature.canonicalizationMethod === ourSignature.canonicalizationMethod);
            
            console.log('\n   Firma:');
            console.log('   - Referencia:', refSignature.signatureMethod);
            console.log('   - Nuestro:', ourSignature.signatureMethod);
            console.log('   ✅ Coincide:', refSignature.signatureMethod === ourSignature.signatureMethod);
            
            // 2. Referencias
            console.log('\n2. REFERENCIAS:');
            console.log('   Cantidad:');
            console.log('   - Referencia:', refSignature.references.length);
            console.log('   - Nuestro:', ourSignature.references.length);
            
            if (refSignature.references.length === ourSignature.references.length) {
                for (let i = 0; i < refSignature.references.length; i++) {
                    console.log(`\n   Referencia ${i + 1}:`);
                    console.log('   - URI Ref:', refSignature.references[i].uri);
                    console.log('   - URI Nuestro:', ourSignature.references[i].uri);
                    console.log('   - Type Ref:', refSignature.references[i].type || 'No especificado');
                    console.log('   - Type Nuestro:', ourSignature.references[i].type || 'No especificado');
                    console.log('   - Transform Ref:', refSignature.references[i].transform || 'Ninguno');
                    console.log('   - Transform Nuestro:', ourSignature.references[i].transform || 'Ninguno');
                }
            }
            
            // 3. Estructura XAdES
            console.log('\n3. ESTRUCTURA XAdES:');
            console.log('   SignedProperties presente:');
            console.log('   - Referencia:', refSignature.hasSignedProperties);
            console.log('   - Nuestro:', ourSignature.hasSignedProperties);
            
            console.log('\n   SigningTime:');
            console.log('   - Referencia:', refSignature.signingTime);
            console.log('   - Nuestro:', ourSignature.signingTime);
            
            // 4. KeyInfo
            console.log('\n4. KEYINFO:');
            console.log('   Tiene certificado:');
            console.log('   - Referencia:', refSignature.hasCertificate);
            console.log('   - Nuestro:', ourSignature.hasCertificate);
            
            console.log('   Tiene RSAKeyValue:');
            console.log('   - Referencia:', refSignature.hasRSAKeyValue);
            console.log('   - Nuestro:', ourSignature.hasRSAKeyValue);
            
            // 5. Verificar el atributo id="comprobante"
            console.log('\n5. ATRIBUTO ID EN FACTURA:');
            const refFactura = refDoc.getElementsByTagName('factura')[0];
            const ourFactura = ourDoc.getElementsByTagName('factura')[0];
            
            console.log('   - Referencia id:', refFactura?.getAttribute('id'));
            console.log('   - Nuestro id:', ourFactura?.getAttribute('id'));
            console.log('   ✅ Coincide:', refFactura?.getAttribute('id') === ourFactura?.getAttribute('id'));
            
            // 6. Posición de la firma
            console.log('\n6. POSICIÓN DE LA FIRMA:');
            const refSigPosition = this.getSignaturePosition(refDoc);
            const ourSigPosition = this.getSignaturePosition(ourDoc);
            
            console.log('   - Referencia:', refSigPosition);
            console.log('   - Nuestro:', ourSigPosition);
            console.log('   ✅ Coincide:', refSigPosition === ourSigPosition);
            
            console.log('\n=== FIN DE COMPARACIÓN ===');
            
        } catch (error: any) {
            console.error('Error:', error.message);
        }
    }
    
    private loadAndCleanXml(relativePath: string): string {
        const fullPath = path.join(__dirname, relativePath);
        let content = fs.readFileSync(fullPath, 'utf-8');
        
        // Eliminar BOM si existe
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }
        
        return content;
    }
    
    private extractSignatureElements(doc: Document): any {
        const signature = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];
        
        if (!signature) {
            throw new Error('No se encontró elemento Signature');
        }
        
        // Extraer algoritmos
        const canonMethod = signature.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'CanonicalizationMethod')[0];
        const sigMethod = signature.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'SignatureMethod')[0];
        
        // Extraer referencias
        const references = [];
        const refElements = signature.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Reference');
        
        for (let i = 0; i < refElements.length; i++) {
            const ref = refElements[i];
            const transforms = ref.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Transform');
            
            references.push({
                uri: ref.getAttribute('URI'),
                type: ref.getAttribute('Type'),
                transform: transforms.length > 0 ? transforms[0].getAttribute('Algorithm') : null
            });
        }
        
        // Verificar XAdES
        const signedProps = signature.getElementsByTagNameNS('http://uri.etsi.org/01903/v1.3.2#', 'SignedProperties')[0];
        const signingTime = signature.getElementsByTagNameNS('http://uri.etsi.org/01903/v1.3.2#', 'SigningTime')[0];
        
        // Verificar KeyInfo
        const keyInfo = signature.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'KeyInfo')[0];
        const certificate = keyInfo?.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'X509Certificate')[0];
        const rsaKeyValue = keyInfo?.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'RSAKeyValue')[0];
        
        return {
            canonicalizationMethod: canonMethod?.getAttribute('Algorithm'),
            signatureMethod: sigMethod?.getAttribute('Algorithm'),
            references: references,
            hasSignedProperties: !!signedProps,
            signingTime: signingTime?.textContent,
            hasCertificate: !!certificate,
            hasRSAKeyValue: !!rsaKeyValue
        };
    }
    
    private getSignaturePosition(doc: Document): string {
        const factura = doc.getElementsByTagName('factura')[0];
        const signature = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];
        
        if (!factura || !signature) {
            return 'No encontrado';
        }
        
        // Verificar si la firma está dentro de factura
        let current = signature.parentNode;
        while (current) {
            if (current === factura) {
                return 'Dentro de <factura> (ENVELOPED)';
            }
            current = current.parentNode;
        }
        
        return 'Fuera de <factura>';
    }
}

// Ejecutar
if (require.main === module) {
    const compare = new CompareSignatures();
    compare.compare()
        .then(() => {
            console.log('\n✅ Comparación completada');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Error:', error);
            process.exit(1);
        });
}

export default CompareSignatures;