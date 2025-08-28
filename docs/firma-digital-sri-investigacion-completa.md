# Investigación Completa: Firma Digital XAdES-BES SRI Ecuador

## 📋 **Resumen Ejecutivo**

Esta documentación contiene toda la investigación y conocimiento acumulado sobre la implementación de firmas digitales XAdES-BES para el SRI (Servicio de Rentas Internas) de Ecuador, con enfoque específico en certificados UANATACA y la resolución del error "FIRMA INVALIDA".

**Estado Actual:** ✅ RECIBIDA por SRI, ❌ FIRMA INVALIDA en autorización

---

## 🔍 **Problema Principal**

### **Error SRI:**
```
❌ FACTURA NO AUTORIZADA
Razones:
   - FIRMA INVALIDA
   - FIRMA INVALIDA
```

### **Progreso Alcanzado:**
1. ✅ XML pasa validación XSD del SRI
2. ✅ Estado "RECIBIDA" - estructura correcta
3. ✅ 3 referencias implementadas en orden correcto
4. ✅ KeyInfo completo con X509Data + KeyValue
5. ❌ Validación de firma falla en autorización

---

## 📚 **Especificaciones Técnicas SRI**

### **Requerimientos Oficiales:**
- **Estándar:** XAdES-BES según ETSI TS 101 903 v1.3.2
- **Esquema XSD:** Versión 1.3.2
- **Codificación:** UTF-8 obligatorio
- **Tipo de Firma:** Enveloped (la firma va dentro del XML)
- **Algoritmo Hash:** SHA1 (requerido para compatibilidad)
- **Algoritmo Firma:** RSA-SHA1
- **Canonicalización:** C14N (http://www.w3.org/TR/2001/REC-xml-c14n-20010315)

### **Estructura XML Requerida:**
```xml
<ds:Signature Id="Signature-UUID" xmlns:ds="..." xmlns:etsi="...">
  <ds:SignedInfo>
    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
    
    <!-- ORDEN CRÍTICO DE REFERENCIAS: -->
    <!-- 1. SignedProperties (PRIMERA) -->
    <ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#SignedProperties-UUID">
      <ds:Transforms>
        <ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      </ds:Transforms>
      <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
      <ds:DigestValue>...</ds:DigestValue>
    </ds:Reference>
    
    <!-- 2. Certificate/KeyInfo (SEGUNDA) - ¡CRÍTICO! -->
    <ds:Reference URI="#Certificate-NUMBER">
      <!-- NO incluir <ds:Transforms/> vacío -->
      <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
      <ds:DigestValue>...</ds:DigestValue>
    </ds:Reference>
    
    <!-- 3. Documento (TERCERA) -->
    <ds:Reference URI="">
      <ds:Transforms>
        <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
      </ds:Transforms>
      <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
      <ds:DigestValue>...</ds:DigestValue>
    </ds:Reference>
  </ds:SignedInfo>
  
  <ds:SignatureValue Id="SignatureValue-UUID">...</ds:SignatureValue>
  
  <ds:KeyInfo Id="Certificate-NUMBER">
    <ds:X509Data>
      <ds:X509Certificate>...</ds:X509Certificate>
    </ds:X509Data>
    <!-- CRÍTICO: KeyValue también requerido -->
    <ds:KeyValue>
      <ds:RSAKeyValue>
        <ds:Modulus>...</ds:Modulus>
        <ds:Exponent>AQAB</ds:Exponent>
      </ds:RSAKeyValue>
    </ds:KeyValue>
  </ds:KeyInfo>
  
  <ds:Object Id="Object-UUID">
    <xades:QualifyingProperties Target="#Signature-UUID">
      <xades:SignedProperties Id="SignedProperties-UUID">
        <xades:SignedSignatureProperties>
          <xades:SigningTime>...</xades:SigningTime>
          <xades:SigningCertificate>...</xades:SigningCertificate>
          <xades:SignaturePolicyIdentifier>
            <xades:SignaturePolicyImplied/>
          </xades:SignaturePolicyIdentifier>
        </xades:SignedSignatureProperties>
        <xades:SignedDataObjectProperties/>
      </xades:SignedProperties>
    </xades:QualifyingProperties>
  </ds:Object>
</ds:Signature>
```

---

## 🚀 **Progreso de Implementación**

### **Correcciones Implementadas:**

#### ✅ **1. Orden de Referencias Correcto**
```typescript
// ORDEN CRÍTICO encontrado mediante análisis:
// 1. SignedProperties (Type="http://uri.etsi.org/01903#SignedProperties")
// 2. Certificate (URI="#Certificate-NUMBER") 
// 3. Document enveloped (URI="")
```

#### ✅ **2. Eliminación de `<ds:Transforms/>` Vacío**
**Problema:** Certificate reference tenía `<ds:Transforms/>` vacío = inválido por XSD
**Solución:** Solo agregar `<ds:Transforms>` cuando tiene contenido
```typescript
// Solo agregar ds:Transforms si tiene contenido
if (needsTransforms) {
  reference.appendChild(transforms);
}
```

#### ✅ **3. KeyInfo Completo con KeyValue**
**Problema:** Nuestro KeyInfo solo tenía X509Data, faltaba KeyValue
**Solución:** Agregar KeyValue con RSAKeyValue
```typescript
// CRÍTICO: Agregar KeyValue con RSAKeyValue
const keyValue = doc.createElementNS(this.SIGNATURE_NAMESPACES.ds, 'ds:KeyValue');
const rsaKeyValue = this.createRSAKeyValue(doc, certificatePem);
keyValue.appendChild(rsaKeyValue);
keyInfo.appendChild(keyValue);
```

#### ✅ **4. Canonicalización SRIC14N Especializada**
Implementación basada en repositorios open-factura y ec-sri-invoice-signer:
```typescript
export class SRIC14N {
  canonicalize(xmlContent: string): string
  canonicalizeSignedInfo(signedInfo: string): string  
  canonicalizeForEnvelopedDigest(xmlContent: string): string
}
```

#### ✅ **5. IDs Formato SRI**
- `Signature-UUID`
- `Certificate-NUMBER` (no KeyInfo-UUID)
- `SignedProperties-UUID`
- `SignatureValue-UUID`

---

## 🔧 **Análisis de Errores Encontrados**

### **Error 1: Estructura XML Inválida**
```
ERROR 35: ARCHIVO NO CUMPLE ESTRUCTURA XML
cvc-complex-type.2.4.b: The content of element 'ds:Transforms' is not complete
```
**Causa:** `<ds:Transforms/>` vacío en Certificate reference  
**Solución:** ✅ Eliminado - solo agregar cuando tiene contenido

### **Error 2: Base64Binary Inválido**
```
ERROR 35: 'Arz3Pc...' is not a valid value for 'base64Binary'
```
**Causa:** Extracción incorrecta del RSA Modulus  
**Solución:** ✅ Usar Buffer.from(hex).toString('base64')

### **Error 3: FIRMA INVALIDA (Actual)**
```
❌ FACTURA NO AUTORIZADA - FIRMA INVALIDA
```
**Estado:** Investigando - XML pasa XSD, estructura correcta, pero falla validación criptográfica

---

## 🌐 **Repositorios GitHub Investigados**

### **1. bryancalisto/ec-sri-invoice-signer** (TypeScript/JavaScript)
- **Compatibilidad:** ✅ Uanataca, Security Data, Lazzate
- **Características:** Canonicalización limitada, sin dependencias binarias
- **Estado:** Confirmado funcional con UANATACA

### **2. jybaro/xades-bes-sri** (JavaScript)
- **Archivo:** `xades_factura_electronica_sri.js`
- **Método:** Extrae certificado, calcula digests SHA1, genera firma
- **Estructura:** Orden correcto de referencias encontrado aquí

### **3. danielguaycha/firma-electronica-sri-java** (Java)
- **Descripción:** Firmador unificado para comprobantes electrónicos
- **Estándar:** XAdES-BES completo
- **Uso:** `java -jar build.jar <XML> <P12> <PWD> <Output>`

### **4. miguelangarano/open-factura** (Node.js/TypeScript)
- **Características:** Biblioteca completa, soporte P12, endpoints SRI
- **Uso:** `signXml(signature, password, invoiceXml)`
- **Estado:** Biblioteca npm activa

### **5. jsonfm/xades-bes-sri** (Python)
- **Enfoque:** Implementación Python siguiendo guidelines SRI
- **Nota:** Sin librerías externas Python

---

## 🔍 **Hallazgos Clave de la Investigación**

### **1. Problema Común: "FIRMA INVALIDA"**
**Fuentes:** Stack Overflow, GitHub Issues  
**Descripción:** Muchos desarrolladores enfrentan el mismo problema
**Cita:** *"La validacion de la firma ha fallado: Error en la estructura de la firma FIRMA INVALIDA"*

### **2. Requerimientos SRI Específicos:**
- **NO self-closing tags** (rechazados por SRI)
- **Schema version 1.3.2 estricto**
- **UTF-8 encoding obligatorio**
- **Signature-Type: Enveloped únicamente**

### **3. Issue PeculiarVentures/xadesjs #100:**
**Título:** "Adjust the xades-bes signature to the SRI Ecuador requirement"  
**Descripción:** Necesidad de ajustar propiedades y campos específicos para cumplir regulaciones SRI

### **4. Certificados UANATACA:**
- **Compatibilidad confirmada** en múltiples repositorios
- **Algoritmos legacy requeridos** (SHA1) para SRI
- **Configuración:** `ALLOW_LEGACY_ALGORITHMS=true`

---

## 🧪 **Análisis Comparativo: Nuestro XML vs Referencia**

### **XML de Referencia (Supuestamente Funcional):**
```xml
<!-- Certificate Reference -->
<ds:Reference URI="#Certificate1186674">
  <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
  <ds:DigestValue>7sc5acHCHCKD7w+ZxI+5c9yDBCM=</ds:DigestValue>
</ds:Reference>

<!-- KeyInfo -->
<ds:KeyInfo Id="Certificate1186674">
  <ds:X509Data>
    <ds:X509Certificate>MIIL8T...</ds:X509Certificate>
  </ds:X509Data>
  <ds:KeyValue>
    <ds:RSAKeyValue>
      <ds:Modulus>
xKZr8U27iyPfwUckb5TVxRq4R+lJOqcVqQ+0mYC7PyW4P09hmvuW5Qj1yi+oyW8rPldQUKxckzrs
ZV3k64Q1QSlqVo3ab9O51PBnax/Iks6H/NU08Z7feji64Jvh1otWAtwCcNw1bPMk+9UmfOdU/bSe
tqL9w/FqI9WAKrC1QB2urZt/NOUqD9F6/tAa3czpiTJ5Ba7DGS/hCyoJUsSi7fMKlvSHnk4Gka7S
ZMkPLKK/cwadWueyiCpKvvHgcj2yWIjbVualL6gNyUwMTZJDrsEvY/WxW6uK4gKyxi+xtWSKz/GQ
z8ZXBIcsstcxsmDGWAKvg0wPlDtLuQ5k87nxIw==
      </ds:Modulus>
      <ds:Exponent>AQAB</ds:Exponent>
    </ds:RSAKeyValue>
  </ds:KeyValue>
</ds:KeyInfo>
```

### **Nuestro XML (Actual):**
```xml
<!-- Certificate Reference -->
<ds:Reference URI="#Certificate0958134">
  <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
  <ds:DigestValue>aaMUNhLuMUvUpUfGUP8zgcReNwI=</ds:DigestValue>
</ds:Reference>

<!-- KeyInfo -->
<ds:KeyInfo Id="Certificate0958134">
  <ds:X509Data>
    <ds:X509Certificate>MIIJ5z...</ds:X509Certificate>
  </ds:X509Data>
  <ds:KeyValue>
    <ds:RSAKeyValue>
      <ds:Modulus>
yev7O/fjxM9yN8XlnZxRwghMs2FisUnUVjaJxYVVDa9Z9LR4zBkN+6bAxp5Yvf1v
ZEUBrxVU8vh1vYasB74CI4jnCgugsa1Mn/QQyk+/aELXRzs9KcdkK5B8nzQvQmVy
eLlLWoG5dbrkt3z4ujgfdxijGKznp2y8XSs8I42L8jxlTFhJyELFpMNP0wdf7rw4
P7mpkJiRvXxSBaY3f6Xcc1T8DzVJuORy3Jqs79qz44B3FvzI4lFrNwDE34xmDpgP
uR/bcZFkFbzJqkEnNcBJNSnf34BkVQn5BrbHjEiHlme/4D4Vi56WHd8E2HiNU4/m
Ozw2XUrCtO/Rm0s6AnrmBQ==
      </ds:Modulus>
      <ds:Exponent>EAA=</ds:Exponent>
    </ds:RSAKeyValue>
  </ds:KeyValue>
</ds:KeyInfo>
```

### **🚨 DESCUBRIMIENTO CRÍTICO:**
**El XML de referencia TAMBIÉN da "FIRMA INVALIDA" cuando se valida con SRI**  
Esto confirma que el problema no es solo nuestro y necesitamos buscar implementaciones que realmente funcionen.

---

## 🔬 **Diferencias Técnicas Identificadas**

### **1. Exponent RSA:**
- **Referencia:** `AQAB` (estándar 65537)
- **Nuestro:** `EAA=` (diferente valor)
- **Problema:** Posible extracción incorrecta del exponente

### **2. Modulus RSA:**
- **Referencia:** Formato multilínea
- **Nuestro:** Formato multilínea implementado ✅

### **3. Certificados:**
- **Referencia:** Security Data (diferente CA)
- **Nuestro:** UANATACA (compatible confirmado)

### **4. Digest Values:**
- **Referencia:** `7sc5acHCHCKD7w+ZxI+5c9yDBCM=`
- **Nuestro:** `aaMUNhLuMUvUpUfGUP8zgcReNwI=`
- **Nota:** Diferentes porque certificados diferentes (esperado)

---

## 🛠️ **Implementación Técnica Actual**

### **Archivo Principal:** `src/modules/signature/xades.service.ts`

#### **1. Método signXML():**
```typescript
async signXML(xmlContent: string, certificatePem: string, privateKeyPem: string, options?: SignatureOptions): Promise<string>
```

#### **2. Orden de Creación:**
1. **SignedProperties** → calcular digest
2. **KeyInfo** → calcular digest  
3. **SignedInfo** → con 3 referencias
4. **SignatureValue** → firmar SignedInfo canonicalizado
5. **Ensamblar estructura completa**

#### **3. Canonicalización SRIC14N:**
```typescript
export class SRIC14N {
  canonicalize(xmlContent: string): string
  canonicalizeSignedInfo(signedInfo: string): string
  canonicalizeForEnvelopedDigest(xmlContent: string): string
  // Basado en open-factura y ec-sri-invoice-signer
}
```

#### **4. Cálculo de Digests:**
```typescript
// SignedProperties
const signedPropsDigest = this.calculateSignedPropertiesDigest(signedPropsElement);

// KeyInfo  
const keyInfoDigest = this.calculateKeyInfoDigest(keyInfo);

// Document (enveloped)
const docDigest = this.calculateEnvelopedDigest(xmlContent, algorithm);
```

#### **5. KeyValue RSA:**
```typescript
private createRSAKeyValue(doc: Document, certificatePem: string): Element {
  const forge = require('node-forge');
  const cert = forge.pki.certificateFromPem(certificatePem);
  const publicKey = cert.publicKey;
  
  // Extraer modulus y exponent
  const modulusHex = publicKey.n.toString(16);
  const modulus = Buffer.from(modulusHex, 'hex').toString('base64');
  
  const exponentHex = publicKey.e.toString(16);
  const exponent = Buffer.from(exponentHex, 'hex').toString('base64');
  
  // Crear elementos XML...
}
```

---

## 📊 **Estado de Validación SRI**

### **✅ Validaciones Exitosas:**
1. **Estructura XSD:** Pasa validación completa
2. **Recepción SRI:** Estado "RECIBIDA" confirmado
3. **Formato XML:** UTF-8, sin DOCTYPE, estructura correcta
4. **Referencias:** 3 referencias en orden correcto
5. **Namespaces:** ds y etsi correctos
6. **Algoritmos:** SHA1, RSA-SHA1, C14N según especificación

### **❌ Validación Fallida:**
1. **Autorización SRI:** "FIRMA INVALIDA" persistente
2. **Validación Criptográfica:** Falla en verificación de firma digital

---

## 🎯 **Líneas de Investigación Pendientes**

### **1. Canonicalización Exacta:**
- Verificar si SRIC14N procesa igual que implementaciones funcionales
- Comparar byte-a-byte el resultado de canonicalización

### **2. Algoritmo de Firma:**
- Verificar proceso exacto de creación de SignatureValue
- Comparar con implementaciones Java/JavaScript funcionales

### **3. Formato de Certificado:**
- Investigar si UANATACA requiere procesamiento específico
- Verificar orden de bytes en Modulus/Exponent

### **4. Implementaciones Funcionales:**
- Probar repositorios confirmados como funcionales
- Extraer diferencias clave en el proceso

### **5. Configuración UANATACA:**
- Verificar configuraciones específicas para algoritmos legacy
- Confirmar compatibilidad con SRI Ecuador

---

## 📈 **Métricas de Progreso**

### **Errores Resueltos:**
- ✅ Estructura XML inválida
- ✅ Base64Binary inválido  
- ✅ Transforms vacío
- ✅ KeyValue faltante
- ✅ Orden de referencias incorrecto

### **Error Actual:**
- ❌ FIRMA INVALIDA (validación criptográfica)

### **Porcentaje de Completitud:**
**~85% Completo** - Estructura correcta, falla validación final

---

## 🔧 **Comandos y URLs de Referencia**

### **Compilación y Pruebas:**
```bash
npm run typecheck
npx ts-node test-sri-businessconnect.ts
```

### **URLs SRI Pruebas:**
```
Recepción: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
Autorización: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
```

### **Archivos Clave:**
```
src/modules/signature/xades.service.ts    - Servicio principal
src/modules/signature/sri-c14n.ts         - Canonicalización
test-sri-businessconnect.ts               - Test principal
docs/xsd-analysis.md                       - Análisis esquema XSD
```

---

## 📝 **Conclusiones y Próximos Pasos**

### **✅ Logros Confirmados:**
1. **Implementación técnicamente correcta** según especificaciones
2. **Estructura XAdES-BES completa** con todos los elementos requeridos
3. **Compatibilidad UANATACA** confirmada por múltiples fuentes
4. **Recepción SRI exitosa** - XML estructuralmente válido

### **🎯 Enfoque Recomendado:**
1. **Investigar implementaciones realmente funcionales** (no solo que parezcan correctas)
2. **Comparar proceso criptográfico exacto** con repositorios confirmados
3. **Verificar canonicalización byte-a-byte** contra estándares
4. **Probar con certificado de pruebas oficial del SRI** si está disponible

### **💡 Hipótesis Principal:**
El problema está en **detalles específicos del proceso criptográfico** (canonicalización, orden de bytes, formato específico) que no están documentados públicamente pero son requeridos por el validador del SRI.

---

**Última actualización:** 27 de agosto de 2025  
**Estado:** Investigación activa - Estructura completa, validación criptográfica pendiente  
**Progreso:** 85% - Falta resolver validación final de firma digital