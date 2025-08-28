import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

/**
 * POST /api/v1/organizations
 * Crear una nueva organización
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      ruc,
      razonSocial,
      nombreComercial,
      direccionMatriz,
      telefono,
      email,
      ambiente,
      obligadoContabilidad,
      contribuyenteEspecial
    } = req.body;
    
    // Validaciones
    if (!ruc || !razonSocial || !direccionMatriz || !email) {
      return res.status(400).json({
        error: 'Faltan campos requeridos',
        required: ['ruc', 'razonSocial', 'direccionMatriz', 'email']
      });
    }
    
    // Validar RUC (13 dígitos)
    if (!/^\d{13}$/.test(ruc)) {
      return res.status(400).json({
        error: 'RUC inválido, debe tener 13 dígitos'
      });
    }
    
    // TODO: Crear en base de datos
    
    res.status(201).json({
      success: true,
      message: 'Organización creada exitosamente',
      data: {
        id: '1',
        ruc,
        razonSocial,
        nombreComercial,
        direccionMatriz,
        telefono,
        email,
        ambiente: ambiente || 1,
        obligadoContabilidad: obligadoContabilidad || 'SI',
        contribuyenteEspecial
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/organizations
 * Listar organizaciones (solo super admin)
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Verificar permisos de super admin
    // TODO: Obtener de base de datos con paginación
    
    res.json({
      success: true,
      data: [
        {
          id: '1',
          ruc: '1234567890001',
          razonSocial: 'EMPRESA DEMO S.A.',
          nombreComercial: 'DEMO',
          ambiente: 1,
          isActive: true,
          createdAt: new Date()
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/organizations/:id
 * Obtener detalles de una organización
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // TODO: Obtener de base de datos
    
    res.json({
      success: true,
      data: {
        id,
        ruc: '1234567890001',
        razonSocial: 'EMPRESA DEMO S.A.',
        nombreComercial: 'DEMO',
        direccionMatriz: 'Av. Principal 123',
        telefono: '0999999999',
        email: 'info@demo.com',
        ambiente: 1,
        tipoEmision: 'NORMAL',
        obligadoContabilidad: 'SI',
        contribuyenteEspecial: null,
        contribuyenteRimpe: false,
        agenteRetencion: false,
        regimenMicroempresa: false,
        isActive: true,
        establishments: [
          {
            id: '1',
            codigo: '001',
            nombre: 'Matriz',
            direccion: 'Av. Principal 123',
            emissionPoints: [
              {
                id: '1',
                codigo: '001',
                descripcion: 'Punto Principal',
                tipoEmision: 'NORMAL'
              }
            ]
          }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/organizations/:id
 * Actualizar una organización
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // TODO: Validar y actualizar en base de datos
    
    res.json({
      success: true,
      message: 'Organización actualizada exitosamente',
      data: {
        id,
        ...updateData
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/organizations/:id/establishments
 * Agregar establecimiento
 */
router.post('/:id/establishments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, direccion } = req.body;
    
    if (!codigo || !nombre || !direccion) {
      return res.status(400).json({
        error: 'Faltan campos requeridos',
        required: ['codigo', 'nombre', 'direccion']
      });
    }
    
    // Validar código (3 dígitos)
    if (!/^\d{3}$/.test(codigo)) {
      return res.status(400).json({
        error: 'Código de establecimiento inválido, debe tener 3 dígitos'
      });
    }
    
    // TODO: Crear en base de datos
    
    res.status(201).json({
      success: true,
      message: 'Establecimiento creado exitosamente',
      data: {
        id: '2',
        organizationId: id,
        codigo,
        nombre,
        direccion
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/organizations/:id/establishments/:estId/emission-points
 * Agregar punto de emisión
 */
router.post('/:id/establishments/:estId/emission-points', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { estId } = req.params;
    const { codigo, descripcion, tipoEmision } = req.body;
    
    if (!codigo) {
      return res.status(400).json({
        error: 'El código es requerido'
      });
    }
    
    // Validar código (3 dígitos)
    if (!/^\d{3}$/.test(codigo)) {
      return res.status(400).json({
        error: 'Código de punto de emisión inválido, debe tener 3 dígitos'
      });
    }
    
    // TODO: Crear en base de datos
    
    res.status(201).json({
      success: true,
      message: 'Punto de emisión creado exitosamente',
      data: {
        id: '2',
        establishmentId: estId,
        codigo,
        descripcion: descripcion || `Punto ${codigo}`,
        tipoEmision: tipoEmision || 'NORMAL'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/organizations/:id/sequences
 * Obtener secuenciales actuales
 */
router.get('/:id/sequences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { } = req.params;
    
    // TODO: Obtener de base de datos
    
    res.json({
      success: true,
      data: [
        {
          establishmentCode: '001',
          emissionPointCode: '001',
          documentType: '01',
          documentTypeName: 'FACTURA',
          currentSequential: 1234,
          lastUsed: new Date()
        },
        {
          establishmentCode: '001',
          emissionPointCode: '001',
          documentType: '04',
          documentTypeName: 'NOTA DE CRÉDITO',
          currentSequential: 56,
          lastUsed: new Date()
        }
      ]
    });
  } catch (error) {
    next(error);
  }
});

export default router;