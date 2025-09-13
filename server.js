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
        console.log('✅ Base de datos conectada correctamente');

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
            console.log('🎯 Para inicializar datos básicos ejecuta:');
            console.log('   npm run init-db');
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