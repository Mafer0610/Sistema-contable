const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar configuraciones y modelos
const Database = require('./config/database');
const AuthModel = require('./models/authModel');
const ContabilidadModel = require('./models/contabilidadModel');

// Importar controladores
const AuthController = require('./controllers/authController');
const ContabilidadController = require('./controllers/contabilidadController');

// Importar middleware y rutas
const AuthMiddleware = require('./middleware/auth');
const createAuthRoutes = require('./routes/authRoutes');
const createContabilidadRoutes = require('./routes/contabilidadRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Variables globales
let database;
let authModel;
let contabilidadModel;
let authController;
let contabilidadController;
let authMiddleware;

// Middleware básico
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static('public'));

// Inicializar aplicación
async function initializeApp() {
    try {
        console.log('🚀 Iniciando Sistema Contable - conta_bd\n');

        // Conectar a la base de datos
        database = new Database();
        const db = await database.createDatabase();
        console.log('✅ Base de datos "conta_bd" conectada correctamente');

        // ¡IMPORTANTE! Crear todas las tablas
        await database.initializeTables();
        console.log('✅ Tablas inicializadas correctamente');

        // Crear usuario administrador por defecto si no existe
        await createDefaultAdmin(db);

        // Inicializar modelos
        authModel = new AuthModel(db);
        contabilidadModel = new ContabilidadModel(db);
        console.log('✅ Modelos inicializados');

        // Inicializar controladores
        authController = new AuthController(authModel);
        contabilidadController = new ContabilidadController(contabilidadModel);
        console.log('✅ Controladores inicializados');

        // Inicializar middleware
        authMiddleware = new AuthMiddleware(authModel);
        console.log('✅ Middleware inicializado');

        // Configurar rutas
        const authRoutes = createAuthRoutes(authController, authMiddleware);
        const contabilidadRoutes = createContabilidadRoutes(contabilidadController, authMiddleware);

        app.use('/api/auth', authRoutes);
        app.use('/api', contabilidadRoutes);
        console.log('✅ Rutas configuradas\n');

        return true;
    } catch (error) {
        console.error('❌ Error inicializando aplicación:', error);
        throw error;
    }
}

// Crear usuario administrador por defecto
async function createDefaultAdmin(db) {
    try {
        const [existingAdmin] = await db.execute(
            'SELECT COUNT(*) as count FROM usuarios WHERE rol = "admin"'
        );
        
        if (existingAdmin[0].count === 0) {
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            await db.execute(
                'INSERT INTO usuarios (username, password, nombre, apellidos, email, rol) VALUES (?, ?, ?, ?, ?, ?)',
                ['admin', hashedPassword, 'Administrador', 'Sistema', 'admin@conta.com', 'admin']
            );
            
            console.log('✅ Usuario administrador creado:');
            console.log('   👤 Usuario: admin');
            console.log('   🔑 Contraseña: admin123');
            console.log('   📧 Email: admin@conta.com\n');
        }

        // Crear empresa por defecto
        const [existingCompany] = await db.execute(
            'SELECT COUNT(*) as count FROM empresas'
        );
        
        if (existingCompany[0].count === 0) {
            await db.execute(
                'INSERT INTO empresas (nombre, rfc, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)',
                ['Sky Home S.A. de C.V.', 'SHO123456789', 'Tuxtla Gutiérrez, Chiapas', '961-123-4567', 'info@skyhome.com']
            );
            console.log('✅ Empresa por defecto creada: Sky Home S.A. de C.V.\n');
        }

        // Crear catálogo de cuentas básico
        await createBasicChartOfAccounts(db);

    } catch (error) {
        console.error('❌ Error creando datos por defecto:', error);
    }
}

// Crear catálogo de cuentas básico
async function createBasicChartOfAccounts(db) {
    try {
        const [existingAccounts] = await db.execute(
            'SELECT COUNT(*) as count FROM catalogo_cuentas'
        );
        
        if (existingAccounts[0].count === 0) {
            const cuentasBasicas = [
                // ACTIVOS
                { codigo: '1000', nombre: 'ACTIVO', tipo: 'Activo', naturaleza: 'Deudora', nivel: 1 },
                { codigo: '1100', nombre: 'ACTIVO CIRCULANTE', tipo: 'Activo', naturaleza: 'Deudora', nivel: 2 },
                { codigo: '1101', nombre: 'Caja', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '1102', nombre: 'Bancos', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '1103', nombre: 'Clientes', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '1104', nombre: 'Inventarios', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '1105', nombre: 'IVA Acreditable', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora', nivel: 3 },
                
                { codigo: '1200', nombre: 'ACTIVO FIJO', tipo: 'Activo', naturaleza: 'Deudora', nivel: 2 },
                { codigo: '1201', nombre: 'Terrenos', tipo: 'Activo', subtipo: 'Fijo', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '1202', nombre: 'Edificios', tipo: 'Activo', subtipo: 'Fijo', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '1203', nombre: 'Mobiliario y Equipo', tipo: 'Activo', subtipo: 'Fijo', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '1204', nombre: 'Equipo de Transporte', tipo: 'Activo', subtipo: 'Fijo', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '1205', nombre: 'Depreciación Acumulada', tipo: 'Activo', subtipo: 'Fijo', naturaleza: 'Acreedora', nivel: 3 },
                
                // PASIVOS
                { codigo: '2000', nombre: 'PASIVO', tipo: 'Pasivo', naturaleza: 'Acreedora', nivel: 1 },
                { codigo: '2100', nombre: 'PASIVO CORTO PLAZO', tipo: 'Pasivo', naturaleza: 'Acreedora', nivel: 2 },
                { codigo: '2101', nombre: 'Proveedores', tipo: 'Pasivo', subtipo: 'Corto Plazo', naturaleza: 'Acreedora', nivel: 3 },
                { codigo: '2102', nombre: 'Acreedores Diversos', tipo: 'Pasivo', subtipo: 'Corto Plazo', naturaleza: 'Acreedora', nivel: 3 },
                { codigo: '2103', nombre: 'IVA por Pagar', tipo: 'Pasivo', subtipo: 'Corto Plazo', naturaleza: 'Acreedora', nivel: 3 },
                { codigo: '2104', nombre: 'ISR por Pagar', tipo: 'Pasivo', subtipo: 'Corto Plazo', naturaleza: 'Acreedora', nivel: 3 },
                { codigo: '2105', nombre: 'Sueldos por Pagar', tipo: 'Pasivo', subtipo: 'Corto Plazo', naturaleza: 'Acreedora', nivel: 3 },
                
                { codigo: '2200', nombre: 'PASIVO LARGO PLAZO', tipo: 'Pasivo', naturaleza: 'Acreedora', nivel: 2 },
                { codigo: '2201', nombre: 'Préstamos Bancarios LP', tipo: 'Pasivo', subtipo: 'Largo Plazo', naturaleza: 'Acreedora', nivel: 3 },
                { codigo: '2202', nombre: 'Hipotecas por Pagar', tipo: 'Pasivo', subtipo: 'Largo Plazo', naturaleza: 'Acreedora', nivel: 3 },
                
                // CAPITAL
                { codigo: '3000', nombre: 'CAPITAL', tipo: 'Capital', naturaleza: 'Acreedora', nivel: 1 },
                { codigo: '3100', nombre: 'CAPITAL CONTABLE', tipo: 'Capital', naturaleza: 'Acreedora', nivel: 2 },
                { codigo: '3101', nombre: 'Capital Social', tipo: 'Capital', naturaleza: 'Acreedora', nivel: 3 },
                { codigo: '3102', nombre: 'Reservas', tipo: 'Capital', naturaleza: 'Acreedora', nivel: 3 },
                { codigo: '3103', nombre: 'Utilidades Retenidas', tipo: 'Capital', naturaleza: 'Acreedora', nivel: 3 },
                { codigo: '3104', nombre: 'Utilidad del Ejercicio', tipo: 'Capital', naturaleza: 'Acreedora', nivel: 3 },
                
                // INGRESOS
                { codigo: '4000', nombre: 'INGRESOS', tipo: 'Ingreso', naturaleza: 'Acreedora', nivel: 1 },
                { codigo: '4100', nombre: 'INGRESOS OPERACIONALES', tipo: 'Ingreso', naturaleza: 'Acreedora', nivel: 2 },
                { codigo: '4101', nombre: 'Ventas', tipo: 'Ingreso', naturaleza: 'Acreedora', nivel: 3 },
                { codigo: '4102', nombre: 'Servicios', tipo: 'Ingreso', naturaleza: 'Acreedora', nivel: 3 },
                { codigo: '4103', nombre: 'Otros Ingresos', tipo: 'Ingreso', naturaleza: 'Acreedora', nivel: 3 },
                
                // EGRESOS
                { codigo: '5000', nombre: 'EGRESOS', tipo: 'Egreso', naturaleza: 'Deudora', nivel: 1 },
                { codigo: '5100', nombre: 'COSTOS DE VENTA', tipo: 'Egreso', naturaleza: 'Deudora', nivel: 2 },
                { codigo: '5101', nombre: 'Compras', tipo: 'Egreso', subtipo: 'Costo', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '5102', nombre: 'Costo de Ventas', tipo: 'Egreso', subtipo: 'Costo', naturaleza: 'Deudora', nivel: 3 },
                
                { codigo: '5200', nombre: 'GASTOS OPERATIVOS', tipo: 'Egreso', naturaleza: 'Deudora', nivel: 2 },
                { codigo: '5201', nombre: 'Gastos de Administración', tipo: 'Egreso', subtipo: 'Operativo', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '5202', nombre: 'Gastos de Ventas', tipo: 'Egreso', subtipo: 'Operativo', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '5203', nombre: 'Sueldos y Salarios', tipo: 'Egreso', subtipo: 'Operativo', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '5204', nombre: 'Renta', tipo: 'Egreso', subtipo: 'Operativo', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '5205', nombre: 'Servicios Públicos', tipo: 'Egreso', subtipo: 'Operativo', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '5206', nombre: 'Depreciaciones', tipo: 'Egreso', subtipo: 'Operativo', naturaleza: 'Deudora', nivel: 3 },
                
                { codigo: '5300', nombre: 'GASTOS FINANCIEROS', tipo: 'Egreso', naturaleza: 'Deudora', nivel: 2 },
                { codigo: '5301', nombre: 'Intereses Pagados', tipo: 'Egreso', subtipo: 'Financiero', naturaleza: 'Deudora', nivel: 3 },
                { codigo: '5302', nombre: 'Comisiones Bancarias', tipo: 'Egreso', subtipo: 'Financiero', naturaleza: 'Deudora', nivel: 3 }
            ];

            for (const cuenta of cuentasBasicas) {
                await db.execute(
                    'INSERT INTO catalogo_cuentas (codigo, nombre, tipo, subtipo, naturaleza, nivel) VALUES (?, ?, ?, ?, ?, ?)',
                    [cuenta.codigo, cuenta.nombre, cuenta.tipo, cuenta.subtipo || null, cuenta.naturaleza, cuenta.nivel]
                );
            }
            
            console.log(`✅ Catálogo de cuentas básico creado (${cuentasBasicas.length} cuentas)\n`);
        }
    } catch (error) {
        console.error('❌ Error creando catálogo de cuentas:', error);
    }
}

// Rutas principales
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Ruta de estado de la aplicación
app.get('/api/status', (req, res) => {
    res.json({
        status: 'OK',
        database: 'conta_bd',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Ha ocurrido un error'
    });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Endpoint no encontrado' });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
});

// Función para iniciar el servidor
async function startServer() {
    try {
        await initializeApp();
        
        app.listen(PORT, () => {
            console.log('🌟 ===================================');
            console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
            console.log(`🌐 Aplicación: http://localhost:${PORT}`);
            console.log(`📊 Base de datos: conta_bd`);
            console.log(`🔐 API: http://localhost:${PORT}/api`);
            console.log('🌟 ===================================\n');
            
            console.log('📋 ENDPOINTS DISPONIBLES:');
            console.log('🔐 Autenticación:');
            console.log('   POST /api/auth/register - Registrar usuario');
            console.log('   POST /api/auth/login - Iniciar sesión');
            console.log('   POST /api/auth/logout - Cerrar sesión');
            console.log('   GET  /api/auth/verify - Verificar token');
            console.log('');
            console.log('📊 Contabilidad:');
            console.log('   GET  /api/cuentas - Obtener catálogo de cuentas');
            console.log('   POST /api/cuentas - Crear cuenta');
            console.log('   GET  /api/movimientos - Obtener movimientos');
            console.log('   POST /api/movimientos - Crear movimiento');
            console.log('   GET  /api/saldos - Obtener saldos');
            console.log('   GET  /api/balanza-comprobacion - Balanza');
            console.log('   GET  /api/balance-general - Balance General');
            console.log('');
            console.log('🎯 Credenciales de prueba:');
            console.log('   👤 Usuario: admin');
            console.log('   🔑 Contraseña: admin123');
            console.log('');
        });
    } catch (error) {
        console.error('❌ Error iniciando servidor:', error);
        process.exit(1);
    }
}

// Manejo de cierre limpio
process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando aplicación...');
    if (database) {
        await database.close();
    }
    console.log('✅ Aplicación cerrada correctamente');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Cerrando aplicación...');
    if (database) {
        await database.close();
    }
    console.log('✅ Aplicación cerrada correctamente');
    process.exit(0);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Excepción no capturada:', error);
    process.exit(1);
});

// Iniciar servidor
startServer();