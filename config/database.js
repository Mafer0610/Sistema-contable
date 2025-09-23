const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'conta_bd',
    multipleStatements: true,
    charset: 'utf8mb4',
    timezone: '+00:00',
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
};

class Database {
    constructor() {
        this.connection = null;
        this.config = dbConfig;
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection(this.config);
            console.log(`✅ Conectado a MySQL: ${this.config.host}:${this.config.port}`);
            console.log(`📊 Base de datos: ${this.config.database}`);
            return this.connection;
        } catch (error) {
            console.error('❌ Error conectando a MySQL:', error.message);
            throw error;
        }
    }

    async createDatabase() {
        try {
            // Conectar sin especificar base de datos para crearla si no existe
            const tempConfig = { ...this.config };
            delete tempConfig.database;
            
            const tempConnection = await mysql.createConnection(tempConfig);
            
            // Crear la base de datos si no existe
            await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            console.log(`✅ Base de datos '${this.config.database}' verificada/creada`);
            
            await tempConnection.end();
            
            // Conectar a la base de datos específica
            return await this.connect();
        } catch (error) {
            console.error('❌ Error creando/conectando base de datos:', error.message);
            
            // Información adicional de depuración
            if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                console.error('🔐 Error de acceso: Verifique las credenciales en el archivo .env');
                console.error(`   - DB_HOST: ${process.env.DB_HOST}`);
                console.error(`   - DB_USER: ${process.env.DB_USER}`);
                console.error('   - DB_PASSWORD: [OCULTO]');
            } else if (error.code === 'ECONNREFUSED') {
                console.error('🔌 Error de conexión: MySQL no está ejecutándose o no es accesible');
                console.error(`   - Verifique que MySQL esté ejecutándose en ${this.config.host}:${this.config.port}`);
            }
            
            throw error;
        }
    }

    async initializeTables() {
        try {
            if (!this.connection) {
                throw new Error('No hay conexión a la base de datos');
            }

            console.log('🏗️  Inicializando estructura de tablas...');

            // Crear tabla de usuarios
            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS usuarios (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    nombre VARCHAR(100) NOT NULL,
                    apellidos VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    rol ENUM('admin', 'contador', 'usuario') DEFAULT 'usuario',
                    activo BOOLEAN DEFAULT true,
                    intentos_login INT DEFAULT 0,
                    bloqueado_hasta TIMESTAMP NULL,
                    ultimo_login TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    INDEX idx_email (email),
                    INDEX idx_rol (rol),
                    INDEX idx_activo (activo)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Crear tabla de empresas
            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS empresas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nombre VARCHAR(255) NOT NULL,
                    rfc VARCHAR(20),
                    direccion TEXT,
                    telefono VARCHAR(20),
                    email VARCHAR(100),
                    activa BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_nombre (nombre),
                    INDEX idx_rfc (rfc),
                    INDEX idx_activa (activa)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Crear tabla de catálogo de cuentas
            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS catalogo_cuentas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    codigo VARCHAR(20) UNIQUE NOT NULL,
                    nombre VARCHAR(100) NOT NULL,
                    tipo ENUM('Activo', 'Pasivo', 'Capital', 'Ingreso', 'Egreso') NOT NULL,
                    subtipo VARCHAR(50),
                    naturaleza ENUM('Deudora', 'Acreedora') NOT NULL,
                    nivel INT DEFAULT 1,
                    cuenta_padre_id INT DEFAULT NULL,
                    activa BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (cuenta_padre_id) REFERENCES catalogo_cuentas(id) ON DELETE SET NULL,
                    INDEX idx_codigo (codigo),
                    INDEX idx_tipo (tipo),
                    INDEX idx_naturaleza (naturaleza),
                    INDEX idx_activa (activa),
                    INDEX idx_cuenta_padre (cuenta_padre_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Crear tabla de movimientos
            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS movimientos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    numero_asiento INT NOT NULL,
                    fecha DATE NOT NULL,
                    concepto VARCHAR(255) NOT NULL,
                    referencia VARCHAR(100),
                    total_debe DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    total_haber DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    usuario_id INT NOT NULL,
                    empresa_id INT DEFAULT 1,
                    estado ENUM('activo', 'anulado') DEFAULT 'activo',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
                    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
                    INDEX idx_numero_asiento (numero_asiento),
                    INDEX idx_fecha (fecha),
                    INDEX idx_usuario (usuario_id),
                    INDEX idx_empresa (empresa_id),
                    INDEX idx_estado (estado),
                    INDEX idx_fecha_empresa (fecha, empresa_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Crear tabla de cuentas del movimiento
            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS movimiento_cuentas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    movimiento_id INT NOT NULL,
                    cuenta_id INT NOT NULL,
                    debe DECIMAL(15,2) DEFAULT 0.00,
                    haber DECIMAL(15,2) DEFAULT 0.00,
                    FOREIGN KEY (movimiento_id) REFERENCES movimientos(id) ON DELETE CASCADE,
                    FOREIGN KEY (cuenta_id) REFERENCES catalogo_cuentas(id) ON DELETE RESTRICT,
                    INDEX idx_movimiento (movimiento_id),
                    INDEX idx_cuenta (cuenta_id),
                    INDEX idx_debe_haber (debe, haber)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Crear tabla de sesiones (para gestión de tokens)
            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS sesiones (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    usuario_id INT NOT NULL,
                    token VARCHAR(500) NOT NULL,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                    INDEX idx_usuario_sesion (usuario_id),
                    INDEX idx_token (token(100)),
                    INDEX idx_expires (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Crear tabla de auditoría (opcional)
            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS auditoria (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    usuario_id INT,
                    accion VARCHAR(100) NOT NULL,
                    tabla VARCHAR(50) NOT NULL,
                    registro_id INT,
                    datos_anteriores JSON,
                    datos_nuevos JSON,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
                    INDEX idx_usuario_auditoria (usuario_id),
                    INDEX idx_fecha_auditoria (created_at),
                    INDEX idx_tabla_registro (tabla, registro_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            console.log('✅ Todas las tablas han sido creadas/verificadas correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error inicializando tablas:', error.message);
            throw error;
        }
    }

    async testConnection() {
        try {
            if (!this.connection) {
                throw new Error('No hay conexión establecida');
            }
            
            await this.connection.execute('SELECT 1');
            return true;
        } catch (error) {
            console.error('❌ Error probando conexión:', error.message);
            return false;
        }
    }

    async getTableInfo() {
        try {
            const [tables] = await this.connection.execute(`
                SELECT 
                    TABLE_NAME as table_name,
                    TABLE_ROWS as row_count,
                    DATA_LENGTH as data_length,
                    INDEX_LENGTH as index_length
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = ?
                ORDER BY TABLE_NAME
            `, [this.config.database]);
            
            return tables;
        } catch (error) {
            console.error('❌ Error obteniendo información de tablas:', error.message);
            throw error;
        }
    }

    getConnection() {
        if (!this.connection) {
            throw new Error('Base de datos no conectada. Llame a connect() primero.');
        }
        return this.connection;
    }

    async beginTransaction() {
        if (!this.connection) {
            throw new Error('No hay conexión a la base de datos');
        }
        return await this.connection.beginTransaction();
    }

    async commit() {
        if (!this.connection) {
            throw new Error('No hay conexión a la base de datos');
        }
        return await this.connection.commit();
    }

    async rollback() {
        if (!this.connection) {
            throw new Error('No hay conexión a la base de datos');
        }
        return await this.connection.rollback();
    }

    async close() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
            console.log('✅ Conexión a la base de datos cerrada');
        }
    }

    // Método para limpiar sesiones expiradas
    async cleanExpiredSessions() {
        try {
            const [result] = await this.connection.execute(
                'DELETE FROM sesiones WHERE expires_at < NOW()'
            );
            if (result.affectedRows > 0) {
                console.log(`🧹 Limpiadas ${result.affectedRows} sesiones expiradas`);
            }
            return result.affectedRows;
        } catch (error) {
            console.error('❌ Error limpiando sesiones:', error.message);
            throw error;
        }
    }
}

module.exports = Database;