import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  connectionLimit: number;
  waitForConnections: boolean;
  queueLimit: number;
  enableKeepAlive: boolean;
  keepAliveInitialDelay: number;
}

class Database {
  private static instance: Database;
  private pool: mysql.Pool | null = null;
  private config: DatabaseConfig;

  private constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_NAME || 'sri_facturacion',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    try {
      if (!this.pool) {
        this.pool = mysql.createPool({
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password,
          connectionLimit: this.config.connectionLimit,
          waitForConnections: this.config.waitForConnections,
          queueLimit: this.config.queueLimit,
          enableKeepAlive: this.config.enableKeepAlive,
          keepAliveInitialDelay: this.config.keepAliveInitialDelay,
          timezone: 'Z',
          dateStrings: false,
          supportBigNumbers: true,
          bigNumberStrings: false,
          multipleStatements: false
        });

        // Test connection
        const connection = await this.pool.getConnection();
        console.log('✅ Base de datos MySQL conectada exitosamente');
        connection.release();
      }
    } catch (error: any) {
      console.error('❌ Error conectando a MySQL:', error.message);
      throw error;
    }
  }

  public getPool(): mysql.Pool {
    if (!this.pool) {
      throw new Error('La base de datos no está conectada. Llama a connect() primero.');
    }
    return this.pool;
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Base de datos desconectada');
    }
  }

  /**
   * Ejecuta una query con parámetros
   */
  public async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const pool = this.getPool();
    const [rows] = await pool.execute(sql, params);
    return rows as T[];
  }

  /**
   * Ejecuta una query y retorna el primer resultado
   */
  public async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Inicia una transacción
   */
  public async beginTransaction(): Promise<mysql.PoolConnection> {
    const pool = this.getPool();
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    return connection;
  }

  /**
   * Commit de una transacción
   */
  public async commitTransaction(connection: mysql.PoolConnection): Promise<void> {
    await connection.commit();
    connection.release();
  }

  /**
   * Rollback de una transacción
   */
  public async rollbackTransaction(connection: mysql.PoolConnection): Promise<void> {
    await connection.rollback();
    connection.release();
  }

  /**
   * Ejecuta múltiples queries en una transacción
   */
  public async executeTransaction(queries: { sql: string; params?: any[] }[]): Promise<void> {
    const connection = await this.beginTransaction();
    
    try {
      for (const query of queries) {
        await connection.execute(query.sql, query.params);
      }
      await this.commitTransaction(connection);
    } catch (error) {
      await this.rollbackTransaction(connection);
      throw error;
    }
  }

  /**
   * Verifica la salud de la conexión
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export default Database.getInstance();