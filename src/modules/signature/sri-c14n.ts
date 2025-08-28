import { DOMParser } from '@xmldom/xmldom';

// Constantes de tipo de nodo
const NODE_ELEMENT = 1;
const NODE_TEXT = 3;

/**
 * Implementación específica de Canonicalización C14N para SRI Ecuador
 * Basada en los repositorios open-factura y ec-sri-invoice-signer
 */
export class SRIC14N {

    /**
     * Canonicaliza un elemento XML según las especificaciones específicas del SRI
     */
    public canonicalize(xmlContent: string): string {
        try {
            const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
            if (!doc.documentElement) {
                throw new Error('Invalid XML document');
            }
            
            return this.canonicalizeNode(doc.documentElement, {});
        } catch (error) {
            console.error('Error en canonicalización C14N:', error);
            throw error;
        }
    }

    /**
     * Canonicaliza un nodo específico con manejo de namespaces heredados
     */
    private canonicalizeNode(node: Node, inheritedNamespaces: { [key: string]: string }): string {
        if (node.nodeType === NODE_ELEMENT) {
            return this.canonicalizeElement(node as Element, inheritedNamespaces);
        } else if (node.nodeType === NODE_TEXT) {
            return this.canonicalizeText(node as Text);
        }
        
        return '';
    }

    /**
     * Canonicaliza un elemento XML
     */
    private canonicalizeElement(element: Element, inheritedNamespaces: { [key: string]: string }): string {
        let result = '<' + element.tagName;
        
        // Procesar namespaces
        const localNamespaces = this.extractNamespaces(element);
        const mergedNamespaces = { ...inheritedNamespaces, ...localNamespaces };
        
        // Obtener y ordenar atributos
        const attributes = this.getSortedAttributes(element);
        
        // Agregar namespaces ordenados
        const sortedNamespaces = this.getSortedNamespaces(localNamespaces);
        for (const ns of sortedNamespaces) {
            result += ` ${ns.name}="${this.escapeAttributeValue(ns.value)}"`;
        }
        
        // Agregar atributos ordenados
        for (const attr of attributes) {
            if (!attr.name.startsWith('xmlns')) {
                result += ` ${attr.name}="${this.escapeAttributeValue(attr.value)}"`;
            }
        }
        
        result += '>';
        
        // Procesar nodos hijo
        for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];
            result += this.canonicalizeNode(child, mergedNamespaces);
        }
        
        result += '</' + element.tagName + '>';
        
        return result;
    }

    /**
     * Canonicaliza texto eliminando espacios innecesarios
     */
    private canonicalizeText(textNode: Text): string {
        let text = textNode.nodeValue || '';
        
        // Escapar caracteres especiales en el texto
        text = text.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/\r/g, '&#xD;');
        
        return text;
    }

    /**
     * Extrae namespaces declarados en el elemento
     */
    private extractNamespaces(element: Element): { [key: string]: string } {
        const namespaces: { [key: string]: string } = {};
        
        if (element.attributes) {
            for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                if (attr.name.startsWith('xmlns')) {
                    const prefix = attr.name === 'xmlns' ? '' : attr.name.substring(6); // Remove 'xmlns:'
                    namespaces[prefix] = attr.value;
                }
            }
        }
        
        return namespaces;
    }

    /**
     * Obtiene atributos ordenados según especificación C14N
     */
    private getSortedAttributes(element: Element): Array<{ name: string; value: string }> {
        const attributes: Array<{ name: string; value: string }> = [];
        
        if (element.attributes) {
            for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                if (!attr.name.startsWith('xmlns')) {
                    attributes.push({
                        name: attr.name,
                        value: attr.value
                    });
                }
            }
        }
        
        // Ordenar atributos según especificación C14N
        attributes.sort((a, b) => this.attributeCompare(a.name, b.name));
        
        return attributes;
    }

    /**
     * Obtiene namespaces ordenados
     */
    private getSortedNamespaces(namespaces: { [key: string]: string }): Array<{ name: string; value: string }> {
        const nsArray: Array<{ name: string; value: string }> = [];
        
        for (const [prefix, uri] of Object.entries(namespaces)) {
            const name = prefix === '' ? 'xmlns' : `xmlns:${prefix}`;
            nsArray.push({ name, value: uri });
        }
        
        // Ordenar namespaces por nombre
        nsArray.sort((a, b) => a.name.localeCompare(b.name));
        
        return nsArray;
    }

    /**
     * Compara atributos según especificación C14N
     * Implementación específica para SRI basada en ec-sri-invoice-signer
     */
    private attributeCompare(a: string, b: string): number {
        // Separar namespace URI y local name
        const aParts = this.splitQName(a);
        const bParts = this.splitQName(b);
        
        // Comparar namespace URI primero
        if (aParts.namespaceURI !== bParts.namespaceURI) {
            if (!aParts.namespaceURI) return -1;
            if (!bParts.namespaceURI) return 1;
            return aParts.namespaceURI.localeCompare(bParts.namespaceURI);
        }
        
        // Si namespace URI es igual, comparar local name
        return aParts.localName.localeCompare(bParts.localName);
    }

    /**
     * Separa un QName en namespace URI y local name
     */
    private splitQName(qname: string): { namespaceURI: string; localName: string } {
        const colonIndex = qname.indexOf(':');
        if (colonIndex === -1) {
            return { namespaceURI: '', localName: qname };
        }
        
        const prefix = qname.substring(0, colonIndex);
        const localName = qname.substring(colonIndex + 1);
        
        // En una implementación completa, aquí se resolvería el prefix al namespace URI
        // Para SRI, mantenemos simple
        return { namespaceURI: prefix, localName };
    }

    /**
     * Escapa valores de atributos según especificación XML
     */
    private escapeAttributeValue(value: string): string {
        return value.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/"/g, '&quot;')
                   .replace(/\t/g, '&#x9;')
                   .replace(/\n/g, '&#xA;')
                   .replace(/\r/g, '&#xD;');
    }

    /**
     * Canonicaliza específicamente el contenido de SignedInfo
     */
    public canonicalizeSignedInfo(signedInfo: string): string {
        // Remover declaración XML si existe
        let cleanedSignedInfo = signedInfo.replace(/<\?xml[^>]*\?>\s*/i, '');
        
        // Aplicar canonicalización
        return this.canonicalize(cleanedSignedInfo);
    }

    /**
     * Canonicaliza específicamente para digest de documento enveloped
     */
    public canonicalizeForEnvelopedDigest(xmlContent: string): string {
        // Para firma enveloped, necesitamos remover la firma antes de calcular digest
        const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
        
        // Buscar y remover elementos ds:Signature
        const signatures = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature');
        for (let i = signatures.length - 1; i >= 0; i--) {
            const signature = signatures[i];
            if (signature.parentNode) {
                signature.parentNode.removeChild(signature);
            }
        }
        
        // Canonicalizar el documento sin firma
        return this.canonicalizeNode(doc.documentElement, {});
    }
}

export default SRIC14N;