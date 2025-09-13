const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'conta_bd',
    multipleStatements: true
};

class Database {
    constructor() {
        this.connection = null;
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection(dbConfig);
            console.log(`Conectado a la base de datos: ${dbConfig.database}`);
            return this.connection;
        } catch (error) {
            console.error('Error conectando a MySQL:', error);
            throw error;
        }
    }

    async createDatabase() {
        try {
            // Conectar sin especificar base de datos
            const tempConfig = { ...dbConfig };
            delete tempConfig.database;
            
            const tempConnection = await mysql.createConnection(tempConfig);
            
            // Crear la base de datos si no existe
            await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
            console.log(`Base de datos '${dbConfig.database}' creada o ya existe`);
            
            await tempConnection.end();
            
            // Conectar a la base de datos específica
            return await this.connect();
        } catch (error) {
            console.error('Error creando base de datos:', error);
            throw error;
        }
    }

    async initializeTables() {
        try {
            if (!this.connection) {
                throw new Error('No hay conexión a la base de datos');
            }

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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
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
                    FOREIGN KEY (cuenta_padre_id) REFERENCES catalogo_cuentas(id) ON DELETE SET NULL
                )
            `);

            // Crear tabla de movimientos
            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS movimientos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    numero_asiento INT NOT NULL,
                    fecha DATE NOT NULL,
                    concepto VARCHAR(255) NOT NULL,
                    referencia VARCHAR(100),
                    total_debe DECIMAL(15,2) NOT NULL,
                    total_haber DECIMAL(15,2) NOT NULL,
                    usuario_id INT NOT NULL,
                    empresa_id INT DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
                    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
                )
            `);

            // Crear tabla de cuentas del movimiento
            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS movimiento_cuentas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    movimiento_id INT NOT NULL,
                    cuenta_id INT NOT NULL,
                    debe DECIMAL(15,2) DEFAULT 0,
                    haber DECIMAL(15,2) DEFAULT 0,
                    FOREIGN KEY (movimiento_id) REFERENCES movimientos(id) ON DELETE CASCADE,
                    FOREIGN KEY (cuenta_id) REFERENCES catalogo_cuentas(id)
                )
            `);

            // Crear tabla de sesiones (para gestión de tokens)
            await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS sesiones (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    usuario_id INT NOT NULL,
                    token VARCHAR(500) NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
                )
            `);

            console.log('Todas las tablas han sido creadas correctamente');
            return true;
        } catch (error) {
            console.error('Error inicializando tablas:', error);
            throw error;
        }
    }

    getConnection() {
        return this.connection;
    }

    async close() {
        if (this.connection) {
            await this.connection.end();
            console.log('Conexión a la base de datos cerrada');
        }
    }
}

module.exports = Database;