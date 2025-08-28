import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { CertificateService } from '../modules/certificates/certificate.service';

const router = Router();
const certificateService = new CertificateService();

// Configurar multer para subida de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  },
  fileFilter: (_req, file, cb) => {
    // Solo aceptar archivos .p12 y .pfx
    if (file.mimetype === 'application/x-pkcs12' || 
        file.originalname.toLowerCase().endsWith('.p12') ||
        file.originalname.toLowerCase().endsWith('.pfx')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan archivos .p12 o .pfx') as any);
    }
  }
});

/**
 * POST /api/v1/certificates
 * Subir un nuevo certificado
 */
router.post('/', upload.single('certificate'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No se proporcionó archivo de certificado'
      });
    }
    
    const { password, nombre } = req.body;
    
    if (!password) {
      return res.status(400).json({
        error: 'La contraseña del certificado es requerida'
      });
    }
    
    // Parsear certificado
    const parseResult = await certificateService.parseP12(
      req.file.buffer,
      password
    );
    
    // Validar para SRI
    const validFrom = parseResult.info.validFrom;
    const validUntil = parseResult.info.validUntil;
    const now = new Date();
    
    if (validUntil < now) {
      return res.status(400).json({
        error: 'El certificado está expirado',
        validUntil: validUntil.toISOString()
      });
    }
    
    if (validFrom > now) {
      return res.status(400).json({
        error: 'El certificado aún no es válido',
        validFrom: validFrom.toISOString()
      });
    }
    
    // Encriptar certificado para almacenamiento
    await certificateService.encryptCertificate(
      req.file.buffer,
      process.env.CERTIFICATE_ENCRYPTION_KEY || 'default_key_change_in_production'
    );
    
    // TODO: Guardar en base de datos
    
    res.status(201).json({
      success: true,
      message: 'Certificado cargado exitosamente',
      data: {
        nombre: nombre || req.file.originalname,
        serialNumber: parseResult.info.serialNumber,
        issuer: parseResult.info.issuer,
        subject: parseResult.info.subject,
        validFrom: parseResult.info.validFrom,
        validUntil: parseResult.info.validUntil,
        daysUntilExpiration: Math.floor((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        isUANATACA: parseResult.isUANATACA
      }
    });
  } catch (error: any) {
    if (error.message.includes('Contraseña incorrecta')) {
      return res.status(400).json({
        error: 'Contraseña incorrecta para el certificado'
      });
    }
    next(error);
  }
});

/**
 * GET /api/v1/certificates
 * Listar certificados de la organización
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Obtener de base de datos
    
    res.json({
      success: true,
      data: [
        {
          id: '1',
          nombre: 'Certificado Principal',
          serialNumber: '123456789',
          validUntil: new Date('2025-12-31'),
          daysUntilExpiration: 365,
          isActive: true,
          isPrimary: true,
          isUANATACA: true
        }
      ]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/certificates/:id
 * Obtener detalles de un certificado
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // TODO: Obtener de base de datos
    
    res.json({
      success: true,
      data: {
        id,
        nombre: 'Certificado Principal',
        serialNumber: '123456789',
        issuer: 'CN=UANATACA CA, O=UANATACA, C=EC',
        subject: 'CN=EMPRESA TEST, C=EC',
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2025-12-31'),
        daysUntilExpiration: 365,
        isActive: true,
        isPrimary: true,
        isUANATACA: true,
        lastUsedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/certificates/:id
 * Eliminar un certificado
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { } = req.params;
    
    // TODO: Validar que no sea el único certificado activo
    // TODO: Eliminar de base de datos (soft delete)
    
    res.json({
      success: true,
      message: 'Certificado eliminado exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/certificates/:id/validate
 * Validar un certificado
 */
router.post('/:id/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        error: 'La contraseña es requerida para validar el certificado'
      });
    }
    
    // TODO: Obtener certificado de BD y validar
    
    res.json({
      success: true,
      message: 'Certificado válido',
      data: {
        isValid: true,
        daysUntilExpiration: 365,
        warnings: []
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;