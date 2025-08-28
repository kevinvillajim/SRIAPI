import { Router, Request, Response, NextFunction } from 'express';
import { InvoiceProcessorService } from '../modules/invoice/invoice-processor.service';
import { FacturaData, NotaCreditoData, ComprobanteRetencionData } from '../modules/xml/xml.types';

const router = Router();
const invoiceProcessor = new InvoiceProcessorService();

/**
 * POST /api/v1/invoices
 * Emitir una nueva factura
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { certificateId, certificatePassword, invoiceData } = req.body;
    
    // Validación básica
    if (!certificateId || !certificatePassword || !invoiceData) {
      return res.status(400).json({
        error: 'Faltan parámetros requeridos',
        required: ['certificateId', 'certificatePassword', 'invoiceData']
      });
    }
    
    // Procesar factura
    const result = await invoiceProcessor.processInvoice({
      organizationId: req.body.organizationId || '1', // En producción obtener del token JWT
      certificateId,
      certificatePassword,
      invoiceData: invoiceData as FacturaData
    });
    
    // Responder según resultado
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Factura autorizada exitosamente',
        data: {
          claveAcceso: result.claveAcceso,
          numeroAutorizacion: result.numeroAutorizacion,
          fechaAutorizacion: result.fechaAutorizacion,
          estado: result.estado
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Factura rechazada por el SRI',
        data: {
          claveAcceso: result.claveAcceso,
          estado: result.estado,
          errores: result.errors,
          mensajes: result.mensajes
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/invoices/credit-note
 * Emitir una nota de crédito
 */
router.post('/credit-note', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { certificateId, certificatePassword, creditNoteData } = req.body;
    
    if (!certificateId || !certificatePassword || !creditNoteData) {
      return res.status(400).json({
        error: 'Faltan parámetros requeridos',
        required: ['certificateId', 'certificatePassword', 'creditNoteData']
      });
    }
    
    const result = await invoiceProcessor.processNotaCredito(
      creditNoteData as NotaCreditoData,
      certificateId,
      certificatePassword
    );
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Nota de crédito autorizada exitosamente',
        data: {
          claveAcceso: result.claveAcceso,
          numeroAutorizacion: result.numeroAutorizacion,
          fechaAutorizacion: result.fechaAutorizacion,
          estado: result.estado
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Nota de crédito rechazada por el SRI',
        data: {
          claveAcceso: result.claveAcceso,
          estado: result.estado,
          errores: result.errors,
          mensajes: result.mensajes
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/invoices/retention
 * Emitir un comprobante de retención
 */
router.post('/retention', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { certificateId, certificatePassword, retentionData } = req.body;
    
    if (!certificateId || !certificatePassword || !retentionData) {
      return res.status(400).json({
        error: 'Faltan parámetros requeridos',
        required: ['certificateId', 'certificatePassword', 'retentionData']
      });
    }
    
    const result = await invoiceProcessor.processRetencion(
      retentionData as ComprobanteRetencionData,
      certificateId,
      certificatePassword
    );
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Comprobante de retención autorizado exitosamente',
        data: {
          claveAcceso: result.claveAcceso,
          numeroAutorizacion: result.numeroAutorizacion,
          fechaAutorizacion: result.fechaAutorizacion,
          estado: result.estado
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Comprobante de retención rechazado por el SRI',
        data: {
          claveAcceso: result.claveAcceso,
          estado: result.estado,
          errores: result.errors,
          mensajes: result.mensajes
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/invoices/:claveAcceso
 * Consultar estado de un comprobante
 */
router.get('/:claveAcceso', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { claveAcceso } = req.params;
    
    if (!claveAcceso || claveAcceso.length !== 49) {
      return res.status(400).json({
        error: 'Clave de acceso inválida',
        message: 'La clave de acceso debe tener 49 dígitos'
      });
    }
    
    const result = await invoiceProcessor.checkInvoiceStatus(claveAcceso);
    
    res.json({
      success: result.estado === 'AUTORIZADO',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/invoices/:claveAcceso/retry
 * Reintentar envío de un comprobante rechazado
 */
router.post('/:claveAcceso/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { claveAcceso } = req.params;
    const { certificateId, certificatePassword, invoiceData } = req.body;
    
    if (!certificateId || !certificatePassword || !invoiceData) {
      return res.status(400).json({
        error: 'Faltan parámetros requeridos',
        required: ['certificateId', 'certificatePassword', 'invoiceData']
      });
    }
    
    const result = await invoiceProcessor.retryFailedInvoice(
      claveAcceso,
      invoiceData as FacturaData,
      certificateId,
      certificatePassword
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Comprobante reenviado y autorizado exitosamente',
        data: {
          claveAcceso: result.claveAcceso,
          numeroAutorizacion: result.numeroAutorizacion,
          fechaAutorizacion: result.fechaAutorizacion,
          estado: result.estado
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Comprobante rechazado nuevamente por el SRI',
        data: {
          claveAcceso: result.claveAcceso,
          estado: result.estado,
          errores: result.errors,
          mensajes: result.mensajes
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/invoices/:claveAcceso/xml
 * Descargar XML autorizado
 */
router.get('/:claveAcceso/xml', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { } = req.params;
    
    // En producción, obtener el XML de la base de datos
    // Por ahora retornamos un placeholder
    
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${claveAcceso}.xml"`);
    res.send('<?xml version="1.0" encoding="UTF-8"?><autorizacion>...</autorizacion>');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/invoices/:claveAcceso/pdf
 * Generar y descargar RIDE (PDF)
 */
router.get('/:claveAcceso/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { claveAcceso } = req.params;
    
    // En producción, generar PDF con una librería como puppeteer o pdfkit
    // Por ahora retornamos un mensaje
    
    res.status(501).json({
      error: 'Funcionalidad no implementada',
      message: 'La generación de RIDE PDF estará disponible próximamente'
    });
  } catch (error) {
    next(error);
  }
});

export default router;