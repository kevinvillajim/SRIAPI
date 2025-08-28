import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Autenticación de usuario
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son requeridos'
      });
    }
    
    // TODO: Validar usuario en base de datos
    // Por ahora mock para testing
    if (email === 'admin@test.com' && password === 'admin123') {
      const token = jwt.sign(
        { 
          userId: '1',
          email,
          organizationId: '1',
          role: 'ADMIN'
        },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as string | number }
      );
      
      const refreshToken = jwt.sign(
        { userId: '1', type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || 'refresh_secret',
        { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as string | number }
      );
      
      res.json({
        success: true,
        message: 'Login exitoso',
        data: {
          token,
          refreshToken,
          user: {
            id: '1',
            email,
            role: 'ADMIN',
            organizationId: '1'
          }
        }
      });
    } else {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Renovar token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token es requerido'
      });
    }
    
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'refresh_secret'
      ) as any;
      
      if (decoded.type !== 'refresh') {
        throw new Error('Token inválido');
      }
      
      // Generar nuevo access token
      const newToken = jwt.sign(
        { 
          userId: decoded.userId,
          email: 'admin@test.com', // TODO: Obtener de BD
          organizationId: '1',
          role: 'ADMIN'
        },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as string | number }
      );
      
      res.json({
        success: true,
        data: {
          token: newToken
        }
      });
    } catch (error) {
      return res.status(401).json({
        error: 'Refresh token inválido o expirado'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Cerrar sesión
 */
router.post('/logout', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Invalidar token en base de datos o cache
    
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

export default router;