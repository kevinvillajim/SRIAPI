import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import database from './config/database';

// Importar rutas
import authRoutes from './api/auth.routes';
import invoiceRoutes from './api/invoice.routes';
import certificateRoutes from './api/certificate.routes';
import organizationRoutes from './api/organization.routes';

// Cargar variables de entorno
dotenv.config();

class Server {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Seguridad
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: true
    }));
    
    // Body parser
    this.app.use(express.json({ limit: '5mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '5mb' }));
    
    // Logging
    if (process.env.NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutos
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    
    this.app.use('/api/', limiter);
    
    // Trust proxy
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    const apiPrefix = process.env.API_PREFIX || '/api';
    const apiVersion = process.env.API_VERSION || 'v1';
    const basePath = `${apiPrefix}/${apiVersion}`;
    
    // Health check
    this.app.get('/health', async (_req: Request, res: Response) => {
      const dbHealth = await database.healthCheck();
      res.status(dbHealth ? 200 : 503).json({
        status: dbHealth ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbHealth ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development'
      });
    });
    
    // API routes
    this.app.use(`${basePath}/auth`, authRoutes);
    this.app.use(`${basePath}/invoices`, invoiceRoutes);
    this.app.use(`${basePath}/certificates`, certificateRoutes);
    this.app.use(`${basePath}/organizations`, organizationRoutes);
    
    // Root endpoint
    this.app.get('/', (_req: Request, res: Response) => {
      res.json({
        name: 'SRI Facturación Electrónica API',
        version: '1.0.0',
        description: 'Sistema de facturación electrónica para Ecuador',
        documentation: `${basePath}/docs`,
        health: '/health'
      });
    });
    
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Endpoint no encontrado',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  private initializeErrorHandling(): void {
    // Error handling middleware
    this.app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Error interno del servidor';
      
      res.status(status).json({
        error: message,
        status,
        ...(process.env.NODE_ENV === 'development' && {
          stack: err.stack,
          details: err
        })
      });
    });
  }

  public async start(): Promise<void> {
    try {
      // Conectar a la base de datos
      await database.connect();
      
      // Iniciar servidor
      this.app.listen(this.port, () => {
        console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║     SRI Facturación Electrónica API v1.0.0        ║
║                                                    ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║  🚀 Servidor corriendo en puerto: ${this.port}              ║
║  🌍 Ambiente: ${process.env.NODE_ENV || 'development'}                     ║
║  🗄️  Base de datos: MySQL                          ║
║  🔐 JWT habilitado                                 ║
║  📝 Logs: ${process.env.LOG_LEVEL || 'info'}                              ║
║                                                    ║
╚════════════════════════════════════════════════════╝
        `);
      });
      
      // Manejo de señales para cierre graceful
      process.on('SIGTERM', this.gracefulShutdown.bind(this));
      process.on('SIGINT', this.gracefulShutdown.bind(this));
      
    } catch (error) {
      console.error('Error iniciando servidor:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    console.log('\n🛑 Recibida señal de terminación, cerrando servidor...');
    
    try {
      // Cerrar conexión a base de datos
      await database.disconnect();
      console.log('✅ Base de datos desconectada');
      
      // Cerrar otros recursos si es necesario
      
      console.log('👋 Servidor cerrado exitosamente');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error durante el cierre:', error);
      process.exit(1);
    }
  }
}

// Iniciar servidor
const server = new Server();
server.start().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export default server;