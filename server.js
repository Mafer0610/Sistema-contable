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
  app.use(express.static('html'));
  app.use('/js', express.static('js'));
  app.use('/css', express.static('css'));
}

// Inicializar aplicación
async function initializeApp() {
  try {
    console.log('🚀 Iniciando Sistema Contable - conta_bd\n');

    // Validar variables de entorno requeridas
    const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
    }

    // Conectar a la base de datos
    database = new Database();
    const db = await database.createDatabase();
    console.log('✅ Base de datos "conta_bd" conectada correctamente');

    // Inicializar tablas
    await database.initializeTables();
    console.log('✅ Tablas inicializadas correctamente');

    // Verificar si existen datos básicos
    await checkAndCreateInitialData(db);

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
    setupRoutes();
    console.log('✅ Rutas configuradas\n');

    return true;
  } catch (error) {
    console.error('❌ Error inicializando aplicación:', error);
    throw error;
  }
}

// Configurar rutas
function setupRoutes() {
  const authRoutes = createAuthRoutes(authController, authMiddleware);
  const contabilidadRoutes = createContabilidadRoutes(contabilidadController, authMiddleware);

  app.use('/api/auth', authRoutes);
  app.use('/api', contabilidadRoutes);
}

// Verificar y crear datos iniciales básicos
async function checkAndCreateInitialData(db) {
  try {
    // Verificar si existe al menos una empresa
    const [existingCompanies] = await db.execute(
      'SELECT COUNT(*) as count FROM empresas'
    );
    
    if (existingCompanies[0].count === 0) {
      await db.execute(
        'INSERT INTO empresas (nombre, rfc, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)',
        ['Sky Home S.A. de C.V.', 'SHO123456789', 'Tuxtla Gutiérrez, Chiapas', '961-123-4567', 'info@skyhome.com']
      );
      console.log('✅ Empresa por defecto creada: Sky Home S.A. de C.V.');
    }

    // Verificar si existe el catálogo de cuentas
    const [existingAccounts] = await db.execute(
      'SELECT COUNT(*) as count FROM catalogo_cuentas'
    );
    
    if (existingAccounts[0].count === 0) {
      console.log('⚠️  No se encontró catálogo de cuentas. Ejecute el script SQL proporcionado.');
    } else {
      console.log(`✅ Catálogo de cuentas encontrado (${existingAccounts[0].count} cuentas)`);
    }

    // Verificar si existe al menos un usuario administrador
    const [existingAdmins] = await db.execute(
      'SELECT COUNT(*) as count FROM usuarios WHERE rol = "admin" AND activo = true'
    );
    
    if (existingAdmins[0].count === 0) {
      console.log('⚠️  No se encontraron usuarios administradores activos.');
      console.log('📝 Para crear el primer usuario administrador, use:');
      console.log('   POST /api/auth/register con rol="admin"');
    } else {
      console.log(`✅ Usuarios administradores encontrados: ${existingAdmins[0].count}`);
    }

  } catch (error) {
    console.error('❌ Error verificando datos iniciales:', error);
  }
}

// Rutas principales (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'login.html'));
  });

  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'login.html'));
  });

  app.get('/panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'panel.html'));
  });
}

// Ruta de salud del sistema
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    database: process.env.DB_NAME,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta para crear el primer usuario administrador
app.post('/api/setup/admin', async (req, res) => {
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

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  
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
    await initializeApp();
    
    app.listen(PORT, () => {
      console.log('🌟 ===================================');
      console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
      console.log(`🌐 Aplicación: http://localhost:${PORT}`);
      console.log(`📊 Base de datos: ${process.env.DB_NAME}`);
      console.log(`🔐 API: http://localhost:${PORT}/api`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
      console.log('🌟 ===================================\n');
      
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
      }
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
  console.error('❌ Promesa rechazada no manejada en:', promise, 'razón:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

// Iniciar servidor
if (require.main === module) {
  startServer();
}

module.exports = app;