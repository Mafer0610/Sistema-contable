const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

class MovimientoModel {
    constructor(db) {
        this.db = db;
    }

    // Métodos de autenticación
    async findUserByUsername(username) {
        const [users] = await this.db.execute(
            'SELECT * FROM usuarios WHERE username = ?',
            [username]
        );
        return users.length > 0 ? users[0] : null;
    }

    async validatePassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    // Métodos de movimientos
    async getAllMovimientos() {
        const [movimientos] = await this.db.execute(`
            SELECT m.*, 
                   GROUP_CONCAT(
                       CONCAT(mc.cuenta, ':', mc.debe, ':', mc.haber)
                       SEPARATOR '|'
                   ) as cuentas_data
            FROM movimientos m
            LEFT JOIN movimiento_cuentas mc ON m.id = mc.movimiento_id
            GROUP BY m.id
            ORDER BY m.fecha DESC, m.id DESC
        `);

        return movimientos.map(mov => {
            const cuentas = mov.cuentas_data ? mov.cuentas_data.split('|').map(cuenta => {
                const [nombre, debe, haber] = cuenta.split(':');
                return {
                    cuenta: nombre,
                    debe: parseFloat(debe),
                    haber: parseFloat(haber)
                };
            }) : [];

            return {
                id: mov.id,
                fecha: mov.fecha.toISOString().split('T')[0],
                concepto: mov.concepto,
                cuentas: cuentas,
                totalDebe: parseFloat(mov.total_debe),
                totalHaber: parseFloat(mov.total_haber)
            };
        });
    }

    async createMovimiento(fecha, concepto, cuentas, usuarioId) {
        const totalDebe = cuentas.reduce((sum, c) => sum + (c.debe || 0), 0);
        const totalHaber = cuentas.reduce((sum, c) => sum + (c.haber || 0), 0);

        // Validar que el asiento esté balanceado
        if (Math.abs(totalDebe - totalHaber) > 0.01) {
            throw new Error(`Asiento no balanceado. Debe: ${totalDebe}, Haber: ${totalHaber}`);
        }

        // Iniciar transacción
        await this.db.beginTransaction();

        try {
            // Insertar movimiento
            const [result] = await this.db.execute(
                'INSERT INTO movimientos (fecha, concepto, total_debe, total_haber, usuario_id) VALUES (?, ?, ?, ?, ?)',
                [fecha, concepto, totalDebe, totalHaber, usuarioId]
            );

            const movimientoId = result.insertId;

            // Insertar cuentas del movimiento
            for (const cuenta of cuentas) {
                await this.db.execute(
                    'INSERT INTO movimiento_cuentas (movimiento_id, cuenta, debe, haber) VALUES (?, ?, ?, ?)',
                    [movimientoId, cuenta.cuenta, cuenta.debe || 0, cuenta.haber || 0]
                );
            }

            await this.db.commit();

            return {
                id: movimientoId,
                fecha,
                concepto,
                cuentas,
                totalDebe,
                totalHaber
            };
        } catch (error) {
            await this.db.rollback();
            throw error;
        }
    }

    async deleteMovimiento(id) {
        // Verificar que el movimiento existe
        const [movimiento] = await this.db.execute('SELECT * FROM movimientos WHERE id = ?', [id]);
        if (movimiento.length === 0) {
            throw new Error('Movimiento no encontrado');
        }

        // Eliminar movimiento (las cuentas se eliminan por CASCADE)
        await this.db.execute('DELETE FROM movimientos WHERE id = ?', [id]);
        
        return { message: 'Movimiento eliminado correctamente' };
    }

    // Métodos para reportes
    async getSaldos() {
        const [saldos] = await this.db.execute(`
            SELECT cuenta,
                   SUM(debe - haber) as saldo
            FROM movimiento_cuentas mc
            JOIN movimientos m ON mc.movimiento_id = m.id
            GROUP BY cuenta
            HAVING saldo != 0
            ORDER BY cuenta
        `);
        
        const saldosObj = {};
        saldos.forEach(s => {
            saldosObj[s.cuenta] = parseFloat(s.saldo);
        });
        
        return saldosObj;
    }

    async getMovimientosTotales() {
        const [movimientos] = await this.db.execute(`
            SELECT cuenta,
                   SUM(debe) as total_debe,
                   SUM(haber) as total_haber
            FROM movimiento_cuentas mc
            JOIN movimientos m ON mc.movimiento_id = m.id
            GROUP BY cuenta
            ORDER BY cuenta
        `);
        
        const movimientosObj = {};
        movimientos.forEach(m => {
            movimientosObj[m.cuenta] = {
                debe: parseFloat(m.total_debe),
                haber: parseFloat(m.total_haber)
            };
        });
        
        return movimientosObj;
    }

    async getReporte(tipo, fechaInicio = null, fechaFin = null) {
        let whereClause = '';
        let params = [];
        
        if (fechaInicio && fechaFin) {
            whereClause = 'WHERE m.fecha BETWEEN ? AND ?';
            params = [fechaInicio, fechaFin];
        }
        
        switch (tipo) {
            case 'balance':
                // Balance General
                const [saldosBalance] = await this.db.execute(`
                    SELECT cuenta,
                           SUM(debe - haber) as saldo,
                           cc.tipo
                    FROM movimiento_cuentas mc
                    JOIN movimientos m ON mc.movimiento_id = m.id
                    LEFT JOIN catalogo_cuentas cc ON mc.cuenta = cc.nombre
                    ${whereClause}
                    GROUP BY cuenta
                    ORDER BY cc.tipo, cuenta
                `, params);
                
                return saldosBalance;
                
            case 'diario':
                // Libro Diario
                const [movimientosDiario] = await this.db.execute(`
                    SELECT m.*, mc.cuenta, mc.debe, mc.haber
                    FROM movimientos m
                    JOIN movimiento_cuentas mc ON m.id = mc.movimiento_id
                    ${whereClause}
                    ORDER BY m.fecha, m.id, mc.id
                `, params);
                
                return movimientosDiario;
                
            case 'mayor':
                // Libro Mayor
                const [movimientosMayor] = await this.db.execute(`
                    SELECT m.fecha, m.concepto, mc.cuenta, mc.debe, mc.haber,
                           SUM(mc.debe - mc.haber) OVER (
                               PARTITION BY mc.cuenta 
                               ORDER BY m.fecha, m.id, mc.id 
                               ROWS UNBOUNDED PRECEDING
                           ) as saldo_acumulado
                    FROM movimientos m
                    JOIN movimiento_cuentas mc ON m.id = mc.movimiento_id
                    ${whereClause}
                    ORDER BY mc.cuenta, m.fecha, m.id
                `, params);
                
                return movimientosMayor;
                
            case 'balanza':
                // Balanza de Comprobación
                const [balanza] = await this.db.execute(`
                    SELECT cuenta,
                           SUM(debe) as movimiento_debe,
                           SUM(haber) as movimiento_haber,
                           SUM(debe - haber) as saldo
                    FROM movimiento_cuentas mc
                    JOIN movimientos m ON mc.movimiento_id = m.id
                    ${whereClause}
                    GROUP BY cuenta
                    ORDER BY cuenta
                `, params);
                
                return balanza;
                
            default:
                throw new Error('Tipo de reporte no válido');
        }
    }

    // Métodos de catálogo
    async getCuentas() {
        const [cuentas] = await this.db.execute(
            'SELECT * FROM catalogo_cuentas WHERE activa = true ORDER BY codigo'
        );
        return cuentas;
    }

    // Métodos de inicialización
    async initializeTables() {
        try {
            // Crear tabla de usuarios
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS usuarios (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    nombre VARCHAR(100),
                    rol VARCHAR(50) DEFAULT 'contador',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Crear tabla de movimientos
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS movimientos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fecha DATE NOT NULL,
                    concepto VARCHAR(255) NOT NULL,
                    total_debe DECIMAL(15,2) NOT NULL,
                    total_haber DECIMAL(15,2) NOT NULL,
                    usuario_id INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
                )
            `);

            // Crear tabla de cuentas del movimiento
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS movimiento_cuentas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    movimiento_id INT NOT NULL,
                    cuenta VARCHAR(100) NOT NULL,
                    debe DECIMAL(15,2) DEFAULT 0,
                    haber DECIMAL(15,2) DEFAULT 0,
                    FOREIGN KEY (movimiento_id) REFERENCES movimientos(id) ON DELETE CASCADE
                )
            `);

            // Crear tabla de catálogo de cuentas
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS catalogo_cuentas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    codigo VARCHAR(20) UNIQUE,
                    nombre VARCHAR(100) NOT NULL,
                    tipo ENUM('Activo', 'Pasivo', 'Capital', 'Ingreso', 'Egreso') NOT NULL,
                    subtipo VARCHAR(50),
                    activa BOOLEAN DEFAULT true
                )
            `);

            return true;
        } catch (error) {
            console.error('Error inicializando tablas:', error);
            throw error;
        }
    }

    async insertDefaultUsers() {
        const usuariosDefault = [
            { username: 'admin', password: 'admin123', nombre: 'Administrador', rol: 'admin' },
            { username: 'contador', password: 'conta123', nombre: 'Contador Principal', rol: 'contador' }
        ];

        for (const user of usuariosDefault) {
            const existing = await this.findUserByUsername(user.username);
            if (!existing) {
                const hashedPassword = await bcrypt.hash(user.password, 10);
                await this.db.execute(
                    'INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)',
                    [user.username, hashedPassword, user.nombre, user.rol]
                );
            }
        }
    }

    async insertDefaultCuentas() {
        const cuentasDefault = [
            { codigo: '1001', nombre: 'Caja', tipo: 'Activo', subtipo: 'Circulante' },
            { codigo: '1002', nombre: 'Banco', tipo: 'Activo', subtipo: 'Circulante' },
            { codigo: '1003', nombre: 'Inventario', tipo: 'Activo', subtipo: 'Circulante' },
            { codigo: '1004', nombre: 'IVA acreditable', tipo: 'Activo', subtipo: 'Circulante' },
            { codigo: '1005', nombre: 'IVA por acreditar', tipo: 'Activo', subtipo: 'Circulante' },
            { codigo: '1006', nombre: 'Papeleria y utiles', tipo: 'Activo', subtipo: 'Circulante' },
            { codigo: '1007', nombre: 'Rentas pag. x anticipado', tipo: 'Activo', subtipo: 'Circulante' },
            { codigo: '1101', nombre: 'Terreno', tipo: 'Activo', subtipo: 'Fijo' },
            { codigo: '1102', nombre: 'Edificio', tipo: 'Activo', subtipo: 'Fijo' },
            { codigo: '1103', nombre: 'Mobiliario', tipo: 'Activo', subtipo: 'Fijo' },
            { codigo: '1104', nombre: 'Equipo de computo', tipo: 'Activo', subtipo: 'Fijo' },
            { codigo: '1105', nombre: 'Equipo de transporte', tipo: 'Activo', subtipo: 'Fijo' },
            { codigo: '2001', nombre: 'Cuentas por pagar', tipo: 'Pasivo', subtipo: 'Corto Plazo' },
            { codigo: '2002', nombre: 'Doc por pagar', tipo: 'Pasivo', subtipo: 'Corto Plazo' },
            { codigo: '2003', nombre: 'Anticipo clientes', tipo: 'Pasivo', subtipo: 'Corto Plazo' },
            { codigo: '2004', nombre: 'IVA trasladado', tipo: 'Pasivo', subtipo: 'Corto Plazo' },
            { codigo: '3001', nombre: 'Capital', tipo: 'Capital', subtipo: 'Social' }
        ];

        for (const cuenta of cuentasDefault) {
            const [existing] = await this.db.execute('SELECT id FROM catalogo_cuentas WHERE codigo = ?', [cuenta.codigo]);
            if (existing.length === 0) {
                await this.db.execute(
                    'INSERT INTO catalogo_cuentas (codigo, nombre, tipo, subtipo) VALUES (?, ?, ?, ?)',
                    [cuenta.codigo, cuenta.nombre, cuenta.tipo, cuenta.subtipo]
                );
            }
        }
    }

    async insertInitialData() {
        // Verificar si ya hay movimientos
        const [movimientosExistentes] = await this.db.execute('SELECT COUNT(*) as count FROM movimientos');
        if (movimientosExistentes[0].count > 0) {
            return; // Ya hay datos
        }

        const datosIniciales = [
            {
                fecha: '2025-08-12',
                concepto: 'Asiento inicial',
                cuentas: [
                    { cuenta: 'Caja', debe: 15000, haber: 0 },
                    { cuenta: 'Banco', debe: 50000, haber: 0 },
                    { cuenta: 'Inventario', debe: 20000, haber: 0 },
                    { cuenta: 'Terreno', debe: 2000000, haber: 0 },
                    { cuenta: 'Edificio', debe: 3000000, haber: 0 },
                    { cuenta: 'Mobiliario', debe: 20000, haber: 0 },
                    { cuenta: 'Equipo de computo', debe: 15000, haber: 0 },
                    { cuenta: 'Equipo de transporte', debe: 65000, haber: 0 },
                    { cuenta: 'Capital', debe: 0, haber: 5185000 }
                ]
            },
            {
                fecha: '2025-08-12',
                concepto: 'Compra contado de inventario',
                cuentas: [
                    { cuenta: 'Caja', debe: 0, haber: 8120 },
                    { cuenta: 'Inventario', debe: 7000, haber: 0 },
                    { cuenta: 'IVA acreditable', debe: 1120, haber: 0 }
                ]
            },
            {
                fecha: '2025-08-15',
                concepto: 'Compra a crédito',
                cuentas: [
                    { cuenta: 'Mobiliario', debe: 3000, haber: 0 },
                    { cuenta: 'IVA por acreditar', debe: 480, haber: 0 },
                    { cuenta: 'Cuentas por pagar', debe: 0, haber: 3480 }
                ]
            },
            {
                fecha: '2025-08-19',
                concepto: 'Compra a crédito a 1 mes de plazo',
                cuentas: [
                    { cuenta: 'Banco', debe: 0, haber: 3480 },
                    { cuenta: 'IVA acreditable', debe: 480, haber: 0 },
                    { cuenta: 'IVA por acreditar', debe: 720, haber: 0 },
                    { cuenta: 'Equipo de computo', debe: 7500, haber: 0 },
                    { cuenta: 'Doc por pagar', debe: 0, haber: 5220 }
                ]
            },
            {
                fecha: '2025-08-26',
                concepto: 'Compra contado de papelería y útiles',
                cuentas: [
                    { cuenta: 'Banco', debe: 0, haber: 4350 },
                    { cuenta: 'Papeleria y utiles', debe: 3750, haber: 0 },
                    { cuenta: 'IVA acreditable', debe: 600, haber: 0 }
                ]
            },
            {
                fecha: '2025-08-26',
                concepto: '2 rentas pagadas por anticipado',
                cuentas: [
                    { cuenta: 'Banco', debe: 0, haber: 10440 },
                    { cuenta: 'IVA acreditable', debe: 1440, haber: 0 },
                    { cuenta: 'Rentas pag. x anticipado', debe: 9000, haber: 0 }
                ]
            },
            {
                fecha: '2025-08-27',
                concepto: 'Venta a cliente',
                cuentas: [
                    { cuenta: 'Banco', debe: 10440, haber: 0 },
                    { cuenta: 'Anticipo clientes', debe: 0, haber: 9000 },
                    { cuenta: 'IVA trasladado', debe: 0, haber: 1440 }
                ]
            }
        ];

        for (const movimiento of datosIniciales) {
            await this.createMovimiento(movimiento.fecha, movimiento.concepto, movimiento.cuentas, 1);
        }
    }
}

module.exports = MovimientoModel;