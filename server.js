// server.js - Servidor principal con estructura MVC
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar modelos, controladores y rutas
const MovimientoModel = require('./models/movimientoModel');
const MovimientosController = require('./controllers/movimientosController');
const createRoutes = require('./routes/movimientosRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuración de la base de datos
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sistema_contable'
};

// Variables globales
let db;
let movimientoModel;
let movimientosController;

// Crear conexión a la base de datos e inicializar MVC
async function conectarDB() {
    try {
        db = await mysql.createConnection(dbConfig);
        console.log('Conectado a MySQL');

        // Inicializar modelo
        movimientoModel = new MovimientoModel(db);
        
        // Inicializar controlador
        movimientosController = new MovimientosController(movimientoModel);
        
        // Configurar rutas
        const routes = createRoutes(movimientosController);
        app.use('/api', routes);

        // Inicializar base de datos
        await inicializarBaseDatos();
        
    } catch (error) {
        console.error('Error conectando a MySQL:', error);
        process.exit(1);
    }
}

// Inicializar base de datos y datos por defecto
async function inicializarBaseDatos() {
    try {
        console.log('Inicializando base de datos...');
        
        // Crear tablas
        await movimientoModel.initializeTables();
        console.log('Tablas creadas correctamente');

        // Insertar usuarios por defecto
        await movimientoModel.insertDefaultUsers();
        console.log('Usuarios por defecto creados');

        // Insertar catálogo de cuentas por defecto
        await movimientoModel.insertDefaultCuentas();
        console.log('Catálogo de cuentas creado');

        // Insertar datos iniciales
        await movimientoModel.insertInitialData();
        console.log('Datos iniciales insertados');

        console.log('Base de datos inicializada correctamente');
    } catch (error) {
        console.error('Error inicializando base de datos:', error);
        throw error;
    }
}

// Ruta para servir la aplicación
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor
async function iniciarServidor() {
    try {
        await conectarDB();
        app.listen(PORT, () => {
            console.log(`Servidor ejecutándose en puerto ${PORT}`);
            console.log(`Aplicación disponible en: http://localhost:${PORT}`);
            console.log('Estructura MVC inicializada correctamente');
            console.log('\n=== USUARIOS POR DEFECTO ===');
            console.log('admin / admin123');
            console.log('contador / conta123');
            console.log('===============================\n');
        });
    } catch (error) {
        console.error('Error iniciando servidor:', error);
        process.exit(1);
    }
}

// Manejo de cierre limpio
process.on('SIGINT', async () => {
    console.log('\nCerrando conexiones...');
    if (db) {
        await db.end();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nCerrando conexiones...');
    if (db) {
        await db.end();
    }
    process.exit(0);
});

iniciarServidor();
    try {
        const [cuentas] = await db.execute(
            'SELECT * FROM catalogo_cuentas WHERE activa = true ORDER BY codigo'
        );
        res.json(cuentas);
    } catch (error) {
        console.error('Error obteniendo cuentas:', error);
        res.status(500).json({ error: 'Error obteniendo cuentas' });
    }
});

// Ruta para obtener saldos de cuentas
app.get('/api/saldos', authenticateToken, async (req, res) => {
    try {
        const [saldos] = await db.execute(`
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
        
        res.json(saldosObj);
    } catch (error) {
        console.error('Error obteniendo saldos:', error);
        res.status(500).json({ error: 'Error obteniendo saldos' });
    }
});

// Ruta para obtener movimientos totales por cuenta
app.get('/api/movimientos-totales', authenticateToken, async (req, res) => {
    try {
        const [movimientos] = await db.execute(`
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
        
        res.json(movimientosObj);
    } catch (error) {
        console.error('Error obteniendo movimientos totales:', error);
        res.status(500).json({ error: 'Error obteniendo movimientos totales' });
    }
});

// Ruta para reportes
app.get('/api/reportes/:tipo', authenticateToken, async (req, res) => {
    try {
        const { tipo } = req.params;
        const { fechaInicio, fechaFin } = req.query;
        
        let whereClause = '';
        let params = [];
        
        if (fechaInicio && fechaFin) {
            whereClause = 'WHERE m.fecha BETWEEN ? AND ?';
            params = [fechaInicio, fechaFin];
        }
        
        switch (tipo) {
            case 'balance':
                // Balance General
                const [saldosBalance] = await db.execute(`
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
                
                res.json(saldosBalance);
                break;
                
            case 'diario':
                // Libro Diario
                const [movimientosDiario] = await db.execute(`
                    SELECT m.*, mc.cuenta, mc.debe, mc.haber
                    FROM movimientos m
                    JOIN movimiento_cuentas mc ON m.id = mc.movimiento_id
                    ${whereClause}
                    ORDER BY m.fecha, m.id, mc.id
                `, params);
                
                res.json(movimientosDiario);
                break;
                
            case 'mayor':
                // Libro Mayor
                const [movimientosMayor] = await db.execute(`
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
                
                res.json(movimientosMayor);
                break;
                
            case 'balanza':
                // Balanza de Comprobación
                const [balanza] = await db.execute(`
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
                
                res.json(balanza);
                break;
                
            default:
                res.status(400).json({ error: 'Tipo de reporte no válido' });
        }
    } catch (error) {
        console.error('Error generando reporte:', error);
        res.status(500).json({ error: 'Error generando reporte' });
    }
});

// Ruta para eliminar movimiento
app.delete('/api/movimientos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que el movimiento existe
        const [movimiento] = await db.execute('SELECT * FROM movimientos WHERE id = ?', [id]);
        if (movimiento.length === 0) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }
        
        // Eliminar movimiento (las cuentas se eliminan por CASCADE)
        await db.execute('DELETE FROM movimientos WHERE id = ?', [id]);
        
        res.json({ message: 'Movimiento eliminado correctamente' });
    } catch (error) {
        console.error('Error eliminando movimiento:', error);
        res.status(500).json({ error: 'Error eliminando movimiento' });
    }
});

// Ruta para servir la aplicación
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
async function iniciarServidor() {
    await conectarDB();
    app.listen(PORT, () => {
        console.log(`Servidor ejecutándose en puerto ${PORT}`);
        console.log(`Aplicación disponible en: http://localhost:${PORT}`);
    });
}

iniciarServidor();