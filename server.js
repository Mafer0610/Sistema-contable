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

// Variables globales para evitar re-inicializaciones
let database;
let authModel;
let contabilidadModel;
let authController;
let contabilidadController;
let authMiddleware;
let isInitialized = false;
let server;

// DEBUGGING: Monitorear todos los eventos de proceso
console.log('🔍 Configurando monitoreo de eventos...');

process.on('SIGINT', (signal) => {
  console.log(`\n🛑 Recibida señal SIGINT (${signal}) - Cerrando aplicación...`);
  gracefulShutdown('SIGINT');
});

process.on('SIGTERM', (signal) => {
  console.log(`\n🛑 Recibida señal SIGTERM (${signal}) - Cerrando aplicación...`);
  gracefulShutdown('SIGTERM');
});

process.on('exit', (code) => {
  console.log(`🚪 Proceso terminando con código: ${code}`);
});

process.on('beforeExit', (code) => {
  console.log(`⚠️  beforeExit - código: ${code}`);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada en:', promise);
  console.error('   Razón:', reason);
  // NO cerrar el proceso automáticamente
});

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  // Solo cerrar en producción
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('uncaughtException');
  }
});

// Función de cierre limpio
async function gracefulShutdown(reason) {
  console.log(`\n🔄 Iniciando cierre limpio por: ${reason}`);
  
  try {
    if (server) {
      console.log('🔌 Cerrando servidor HTTP...');
      server.close(() => {
        console.log('✅ Servidor HTTP cerrado');
      });
    }

    if (database) {
      console.log('🗄️  Cerrando conexión a base de datos...');
      await database.close();
    }
    
    console.log('✅ Aplicación cerrada correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante cierre:', error);
    process.exit(1);
  }
}

// Middleware básico
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de seguridad básico
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// Servir archivos estáticos (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  app.use(express.static(path.join(__dirname, 'html')));
  app.use('/js', express.static(path.join(__dirname, 'js')));
  app.use('/css', express.static(path.join(__dirname, 'css')));
}

// Ruta de salud del sistema (disponible antes de la inicialización)
app.get('/api/health', (req, res) => {
  res.json({
    status: isInitialized ? 'OK' : 'Initializing',
    database: process.env.DB_NAME,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    initialized: isInitialized,
    uptime: process.uptime()
  });
});

// Corregir configuración de base de datos (eliminar opciones no válidas)
function getCleanDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'conta_bd',
    multipleStatements: true,
    charset: 'utf8mb4',
    timezone: '+00:00'
    // Removidas las opciones inválidas que causan warnings
  };
}

// Inicializar aplicación
async function initializeApp() {
  // Evitar múltiples inicializaciones
  if (isInitialized) {
    console.log('⚠️  Sistema ya inicializado, saltando inicialización...');
    return true;
  }

  try {
    console.log('🚀 Iniciando Sistema Contable - conta_bd\n');

    // Validar variables de entorno requeridas
    const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
    }

    console.log('📝 Configuración de base de datos:');
    console.log(`   - Host: ${process.env.DB_HOST}`);
    console.log(`   - Puerto: ${process.env.DB_PORT || 3306}`);
    console.log(`   - Usuario: ${process.env.DB_USER}`);
    console.log(`   - Base de datos: ${process.env.DB_NAME}\n`);

    // Conectar a la base de datos con configuración corregida
    console.log('🔌 Conectando a la base de datos...');
    database = new Database();
    
    // Actualizar la configuración de la base de datos para evitar warnings
    database.config = getCleanDbConfig();
    
    // Primero intentar conectar para verificar credenciales
    const connection = await database.connect();
    console.log('✅ Conexión inicial exitosa');
    
    // Cerrar la conexión inicial y crear la base de datos
    await connection.end();
    console.log('🗄️  Creando/verificando base de datos...');
    
    const db = await database.createDatabase();
    console.log('✅ Base de datos "conta_bd" conectada correctamente');

    // Inicializar tablas
    console.log('🏗️  Inicializando tablas...');
    await database.initializeTables();
    console.log('✅ Tablas inicializadas correctamente');

    // Verificar si existen datos básicos
    console.log('📊 Verificando datos iniciales...');
    await checkAndCreateInitialData(db);

    // Inicializar modelos
    console.log('🔧 Inicializando modelos...');
    authModel = new AuthModel(db);
    contabilidadModel = new ContabilidadModel(db);
    console.log('✅ Modelos inicializados');

    // Inicializar controladores
    console.log('🎮 Inicializando controladores...');
    authController = new AuthController(authModel);
    contabilidadController = new ContabilidadController(contabilidadModel);
    console.log('✅ Controladores inicializados');

    // Inicializar middleware
    console.log('🛡️  Inicializando middleware...');
    authMiddleware = new AuthMiddleware(authModel);
    console.log('✅ Middleware inicializado');

    // Configurar rutas
    console.log('🛣️  Configurando rutas...');
    setupRoutes();
    console.log('✅ Rutas configuradas\n');

    // Marcar como inicializado
    isInitialized = true;
    console.log('🎉 Inicialización completada exitosamente\n');

    return true;
  } catch (error) {
    console.error('❌ Error inicializando aplicación:', error.message);
    
    // Información adicional para depuración
    if (error.code) {
      console.error(`   Código de error: ${error.code}`);
    }
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Verificar credenciales en archivo .env:');
      console.error('   - DB_HOST');
      console.error('   - DB_USER');
      console.error('   - DB_PASSWORD');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Verificar que MySQL esté ejecutándose');
    }
    
    throw error;
  }
}

// Verificar y crear datos iniciales básicos
async function checkAndCreateInitialData(db) {
  try {
    console.log('   Verificando empresa por defecto...');
    // Verificar si existe al menos una empresa
    const [existingCompanies] = await db.execute(
      'SELECT COUNT(*) as count FROM empresas'
    );
    
    if (existingCompanies[0].count === 0) {
      await db.execute(
        'INSERT INTO empresas (nombre, rfc, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)',
        ['Sky Home S.A. de C.V.', 'SHO123456789', 'Tuxtla Gutiérrez, Chiapas', '961-123-4567', 'info@skyhome.com']
      );
      console.log('   ✅ Empresa por defecto creada: Sky Home S.A. de C.V.');
    } else {
      console.log('   ✅ Empresa existente encontrada');
    }

    console.log('   Verificando catálogo de cuentas...');
    // Verificar si existe el catálogo de cuentas
    const [existingAccounts] = await db.execute(
      'SELECT COUNT(*) as count FROM catalogo_cuentas'
    );
    
    if (existingAccounts[0].count === 0) {
      console.log('   ⚠️  No se encontró catálogo de cuentas. Ejecute el script SQL proporcionado.');
    } else {
      console.log(`   ✅ Catálogo de cuentas encontrado (${existingAccounts[0].count} cuentas)`);
    }

    console.log('   Verificando usuarios administradores...');
    // Verificar si existe al menos un usuario administrador
    const [existingAdmins] = await db.execute(
      'SELECT COUNT(*) as count FROM usuarios WHERE rol = "admin" AND activo = true'
    );
    
    if (existingAdmins[0].count === 0) {
      console.log('   ⚠️  No se encontraron usuarios administradores activos.');
      console.log('   📝 Para crear el primer usuario administrador, use:');
      console.log('      POST /api/setup/admin con rol="admin"');
    } else {
      console.log(`   ✅ Usuarios administradores encontrados: ${existingAdmins[0].count}`);
    }

  } catch (error) {
    console.error('❌ Error verificando datos iniciales:', error);
    throw error;
  }
}

function setupRoutes() {
  try {
    // Verificar que los controladores estén inicializados
    if (!authController || !contabilidadController || !authMiddleware) {
      throw new Error('Controladores o middleware no inicializados');
    }

    const authRoutes = createAuthRoutes(authController, authMiddleware);
    const contabilidadRoutes = createContabilidadRoutes(contabilidadController, authMiddleware);

    // CONFIGURAR LAS RUTAS AQUÍ
    app.use('/api/auth', authRoutes);
    app.use('/api', contabilidadRoutes);

    console.log('✅ Rutas API configuradas');
  } catch (error) {
    console.error('❌ Error configurando rutas:', error);
    throw error;
  }
}

// Middleware para verificar inicialización
function requireInitialization(req, res, next) {
  if (!isInitialized) {
    return res.status(503).json({ 
      error: 'Sistema no inicializado completamente',
      message: 'Por favor espere a que el sistema termine de inicializarse'
    });
  }
  next();
}

// Rutas principales (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'login.html'));
  });

  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'login.html'));
  });

  app.get('/panel', requireInitialization, (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'panel.html'));
  });
}

// Ruta para crear el primer usuario administrador
app.post('/api/setup/admin', requireInitialization, async (req, res) => {
  try {
    if (!authModel) {
      return res.status(503).json({ error: 'Sistema no inicializado' });
    }

    // Verificar si ya existe un administrador
    const [existingAdmins] = await database.getConnection().execute(
      'SELECT COUNT(*) as count FROM usuarios WHERE rol = "admin"'
    );

    if (existingAdmins[0].count > 0) {
      return res.status(409).json({ 
        error: 'Ya existe al menos un usuario administrador' 
      });
    }

    const { username, password, nombre, apellidos, email } = req.body;

    if (!username || !password || !nombre || !apellidos || !email) {
      return res.status(400).json({ 
        error: 'Todos los campos son obligatorios' 
      });
    }

    // Crear primer administrador
    const admin = await authModel.createUser({
      username,
      password,
      nombre,
      apellidos,
      email,
      rol: 'admin'
    });

    res.status(201).json({
      message: 'Usuario administrador creado exitosamente',
      admin: {
        id: admin.id,
        username: admin.username,
        nombre: admin.nombre,
        apellidos: admin.apellidos,
        email: admin.email,
        rol: admin.rol
      }
    });

  } catch (error) {
    console.error('Error creando administrador:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'El usuario o email ya existe' });
    } else {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

app.use('/api', (req, res, next) => {
  // Excluir rutas que no necesitan inicialización completa
  if (req.path === '/health' || req.path === '/setup/admin') {
    return next();
  }
  
  // Verificar si está inicializado
  if (!isInitialized) {
    return res.status(503).json({ 
      error: 'Sistema no inicializado completamente',
      message: 'Por favor espere a que el sistema termine de inicializarse',
      initialized: false
    });
  }
  
  next();
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.message);
  
  // No exponer detalles del error en producción
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({ 
    error: err.message || 'Error interno del servidor',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Endpoint no encontrado' });
  } else {
    if (process.env.NODE_ENV === 'development') {
      res.status(404).sendFile(path.join(__dirname, 'html', 'login.html'));
    } else {
      res.status(404).json({ error: 'Página no encontrada' });
    }
  }
});

// Función para iniciar el servidor
async function startServer() {
  try {
    console.log('🔍 Iniciando servidor HTTP...');
    
    // Iniciar servidor primero
    server = app.listen(PORT, async () => {
      console.log('🌟 ===================================');
      console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
      console.log(`🌐 Aplicación: http://localhost:${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
      console.log('🌟 ===================================\n');
      
      console.log('⏳ Iniciando inicialización del sistema...\n');
      
      try {
        // Inicializar aplicación después de que el servidor esté corriendo
        await initializeApp();
        
        // Mostrar información adicional solo después de inicializar
        if (process.env.NODE_ENV === 'development') {
          console.log('📋 ENDPOINTS PRINCIPALES:');
          console.log('🔐 Autenticación:');
          console.log('   POST /api/auth/register - Registrar usuario');
          console.log('   POST /api/auth/login - Iniciar sesión');
          console.log('   POST /api/auth/logout - Cerrar sesión');
          console.log('   GET  /api/auth/verify - Verificar token');
          console.log('   POST /api/setup/admin - Crear primer administrador');
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
          console.log('🎯 Para crear el primer usuario administrador:');
          console.log('   POST /api/setup/admin');
          console.log('   Body: { username, password, nombre, apellidos, email }');
          console.log('');
          console.log('✅ Sistema completamente listo para recibir peticiones!');
          console.log('🔄 El servidor seguirá ejecutándose...');
        }
      } catch (initError) {
        console.error('❌ Error durante inicialización:', initError);
        console.log('🔄 El servidor HTTP seguirá ejecutándose para debug...');
      }
    });

    // Evitar que el servidor se cierre automáticamente
    server.on('close', () => {
      console.log('🚪 Servidor HTTP cerrado');
    });

    server.on('error', (error) => {
      console.error('❌ Error del servidor HTTP:', error);
    });

    console.log('🔄 Proceso principal continuará ejecutándose...');
    
    return server;
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    throw error;
  }
}

// Función para mantener el proceso vivo
function keepAlive() {
  console.log('💓 Proceso mantenido vivo...');
  // Mantener el event loop activo
  setInterval(() => {
    // No hacer nada, solo mantener el proceso vivo
  }, 60000); // Cada minuto
}

// Iniciar servidor
if (require.main === module) {
  console.log('🎬 Iniciando aplicación principal...');
  
  startServer()
    .then(() => {
      console.log('🔄 Servidor iniciado exitosamente');
      keepAlive();
    })
    .catch((error) => {
      console.error('❌ Error fatal iniciando servidor:', error);
      process.exit(1);
    });
}

module.exports = app;