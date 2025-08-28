# 🧪 Test Visual SRI - Facturación Electrónica Ecuador

## 📋 Descripción

Herramienta de testing visual para probar el envío de comprobantes electrónicos al SRI de Ecuador. Permite:

1. **Cargar un XML firmado** mediante drag & drop o selección de archivo
2. **Enviar a Recepción** con visualización completa del request SOAP
3. **Consultar Autorización** con la clave de acceso
4. **Ver las respuestas del SRI** en formato visual amigable
5. **Inspeccionar el envelope SOAP** exacto que se envía

## 🚀 Inicio Rápido

### Windows:
```bash
# Doble clic en start.bat o ejecutar:
start.bat
```

### Linux/Mac:
```bash
chmod +x start.sh
./start.sh
```

### Manual:
```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start
```

## 🌐 Acceso

Una vez iniciado, abrir en el navegador:

**http://localhost:3001**

## 📝 Cómo Usar

### 1. Cargar XML Firmado
- Haz clic en "📁 Seleccionar XML Firmado"
- O arrastra y suelta tu archivo XML en el área indicada
- El sistema detectará automáticamente la clave de acceso

### 2. Enviar a Recepción
- Clic en el botón "📤 ENVIAR A RECEPCIÓN"
- Verás:
  - El envelope SOAP completo enviado
  - La respuesta del SRI (RECIBIDA/DEVUELTA)
  - Mensajes de error si los hay

### 3. Consultar Autorización
- Clic en el botón "🔍 CONSULTAR AUTORIZACIÓN"
- Verás:
  - El envelope SOAP de consulta
  - Estado de autorización (AUTORIZADO/NO AUTORIZADO)
  - Número de autorización si está autorizado
  - Mensajes del SRI

## 🔧 Características Técnicas

### Ambiente
- **PRUEBAS**: celcer.sri.gob.ec (configurado por defecto)
- Para cambiar a producción, editar `server.js`:
  ```javascript
  // Cambiar estas URLs:
  const SRI_RECEPCION_URL = 'https://cel.sri.gob.ec/...';
  const SRI_AUTORIZACION_URL = 'https://cel.sri.gob.ec/...';
  ```

### Endpoints del Servidor

- `GET /` - Interfaz web principal
- `POST /api/recepcion` - Envío a recepción
- `POST /api/autorizacion` - Consulta de autorización

## 📊 Información Mostrada

### Box de Recepción
- Estado del comprobante (RECIBIDA/DEVUELTA)
- Clave de acceso detectada
- Mensajes del SRI con códigos de error
- JSON completo de respuesta

### Box de Autorización  
- Estado de autorización
- Número de autorización
- Fecha de autorización
- Mensajes del SRI
- JSON completo de respuesta

### Box de SOAP Request
- URL del servicio web
- Método llamado
- Envelope SOAP completo con formato
- Tamaño del XML en Base64

## 🎨 Interfaz Visual

La interfaz incluye:
- **Drag & Drop** para cargar archivos
- **Indicadores visuales** de estado (badges de colores)
- **Spinners de carga** durante las peticiones
- **Formato syntax highlighting** para XML/SOAP
- **Diseño responsive** para móviles y desktop

## 📁 Estructura de Archivos

```
final-test/
├── server.js          # Servidor Express con lógica SOAP
├── package.json       # Dependencias del proyecto
├── start.bat         # Script inicio Windows
├── start.sh          # Script inicio Linux/Mac
├── README.md         # Esta documentación
├── public/           
│   └── index.html    # Interfaz web completa
└── uploads/          # Carpeta temporal para XMLs (se crea automáticamente)
```

## 🔍 Debugging

El servidor muestra en consola:
- Peticiones recibidas
- Claves de acceso procesadas
- Errores si ocurren

Para ver más detalles, revisa la consola del navegador (F12).

## ⚠️ Notas Importantes

1. **Certificados**: Este test usa XMLs ya firmados. No firma documentos.
2. **Ambiente**: Por defecto apunta a PRUEBAS del SRI
3. **Clave de Acceso**: Se extrae automáticamente del XML
4. **Limpieza**: Los archivos subidos se eliminan después de procesarse

## 🐛 Solución de Problemas

### Error: "Cannot find module 'express'"
```bash
npm install
```

### Error: "EADDRINUSE: Port 3001 already in use"
Cambiar el puerto en `server.js`:
```javascript
const PORT = 3002; // O cualquier puerto libre
```

### El SRI no responde
- Verificar conexión a internet
- El servicio del SRI puede estar temporalmente no disponible
- Verificar que el XML esté correctamente firmado

## 📞 Soporte

Para problemas específicos del SRI, consultar:
- [Manual Técnico SRI](https://www.sri.gob.ec/DocumentosAlfrescoPortlet/descargar/493147f5-9c63-4a6e-87a3-0e6ffe5dbdf2/FICHA+TECNICA+COMPROBANTES+ELECTRONICOS+ESQUEMA+OFFLINE.pdf)
- Ambiente de pruebas: https://celcer.sri.gob.ec
- Ambiente de producción: https://cel.sri.gob.ec

---

**Desarrollado para testing de Facturación Electrónica SRI Ecuador** 🇪🇨