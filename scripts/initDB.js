const Database = require('../config/database');
const AuthModel = require('../models/authModel');
const ContabilidadModel = require('../models/contabilidadModel');

async function initializeDatabase() {
    console.log('🚀 Iniciando configuración de la base de datos conta_bd...\n');
    
    const database = new Database();
    
    try {
        // Crear base de datos y conectar
        const db = await database.createDatabase();
        console.log('✅ Conexión establecida correctamente\n');

        // Inicializar tablas
        console.log('📊 Creando tablas...');
        await database.initializeTables();
        console.log('✅ Tablas creadas correctamente\n');

        // Inicializar modelos
        const authModel = new AuthModel(db);
        const contabilidadModel = new ContabilidadModel(db);

        // Crear usuario administrador por defecto
        console.log('👤 Creando usuario administrador...');
        try {
            await authModel.createUser({
                username: 'admin',
                password: '123',
                nombre: 'Administrador',
                apellidos: 'del Sistema',
                email: 'admin@contabd.com',
                rol: 'admin'
            });
            console.log('✅ Usuario administrador creado (admin/123)');
        } catch (error) {
            if (error.message === 'El usuario ya existe') {
                console.log('ℹ️  Usuario administrador ya existe');
            } else {
                throw error;
            }
        }

        // Crear empresa por defecto
        console.log('🏢 Creando empresa por defecto...');
        try {
            await contabilidadModel.createEmpresa({
                nombre: 'Sky Home S.A. de C.V.',
                rfc: 'SHO123456789',
                direccion: 'Av. Principal #123, Tuxtla Gutiérrez, Chiapas',
                telefono: '961-123-4567',
                email: 'info@skyhome.com'
            });
            console.log('✅ Empresa Sky Home S.A. creada');
        } catch (error) {
            console.log('ℹ️  Empresa por defecto ya existe');
        }

        // Crear catálogo de cuentas básico
        console.log('📋 Creando catálogo de cuentas básico...');
        const cuentasBasicas = [
            // ACTIVO CIRCULANTE
            { codigo: '1001', nombre: 'Caja', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora' },
            { codigo: '1002', nombre: 'Bancos', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora' },
            { codigo: '1003', nombre: 'Inventarios', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora' },
            { codigo: '1004', nombre: 'Clientes', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora' },
            { codigo: '1005', nombre: 'Deudores Diversos', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora' },
            { codigo: '1006', nombre: 'IVA Acreditable', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora' },
            { codigo: '1007', nombre: 'Gastos Pagados por Anticipado', tipo: 'Activo', subtipo: 'Circulante', naturaleza: 'Deudora' },

            // ACTIVO FIJO
            { codigo: '1101', nombre: 'Terrenos', tipo: 'Activo', subtipo: 'Fijo', naturaleza: 'Deudora' },
            { codigo: '1102', nombre: 'Edificios', tipo: 'Activo', subtipo: 'Fijo', naturaleza: 'Deudora' },
            { codigo: '1103', nombre: 'Mobiliario y Equipo de Oficina', tipo: 'Activo', subtipo: 'Fijo', naturaleza: 'Deudora' },
            { codigo: '1104', nombre: 'Equipo de Cómputo', tipo: 'Activo', subtipo: 'Fijo', naturaleza: 'Deudora' },
            { codigo: '1105', nombre: 'Equipo de Transporte', tipo: 'Activo', subtipo: 'Fijo', naturaleza: 'Deudora' },
            { codigo: '1106', nombre: 'Maquinaria y Equipo', tipo: 'Activo', subtipo: 'Fijo', naturaleza: 'Deudora' },

            // PASIVO A CORTO PLAZO
            { codigo: '2001', nombre: 'Proveedores', tipo: 'Pasivo', subtipo: 'Corto Plazo', naturaleza: 'Acreedora' },
            { codigo: '2002', nombre: 'Acreedores Diversos', tipo: 'Pasivo', subtipo: 'Corto Plazo', naturaleza: 'Acreedora' },
            { codigo: '2003', nombre: 'Documentos por Pagar', tipo: 'Pasivo', subtipo: 'Corto Plazo', naturaleza: 'Acreedora' },
            { codigo: '2004', nombre: 'IVA por Pagar', tipo: 'Pasivo', subtipo: 'Corto Plazo', naturaleza: 'Acreedora' },
            { codigo: '2005', nombre: 'Impuestos por Pagar', tipo: 'Pasivo', subtipo: 'Corto Plazo', naturaleza: 'Acreedora' },
            { codigo: '2006', nombre: 'Sueldos y Salarios por Pagar', tipo: 'Pasivo', subtipo: 'Corto Plazo', naturaleza: 'Acreedora' },

            // CAPITAL
            { codigo: '3001', nombre: 'Capital Social', tipo: 'Capital', subtipo: 'Social', naturaleza: 'Acreedora' },
            { codigo: '3002', nombre: 'Reserva Legal', tipo: 'Capital', subtipo: 'Reservas', naturaleza: 'Acreedora' },
            { codigo: '3003', nombre: 'Utilidades Retenidas', tipo: 'Capital', subtipo: 'Resultados', naturaleza: 'Acreedora' },
            { codigo: '3004', nombre: 'Utilidad del Ejercicio', tipo: 'Capital', subtipo: 'Resultados', naturaleza: 'Acreedora' },

            // INGRESOS
            { codigo: '4001', nombre: 'Ventas', tipo: 'Ingreso', subtipo: 'Operación', naturaleza: 'Acreedora' },
            { codigo: '4002', nombre: 'Productos Financieros', tipo: 'Ingreso', subtipo: 'Financiero', naturaleza: 'Acreedora' },
            { codigo: '4003', nombre: 'Otros Ingresos', tipo: 'Ingreso', subtipo: 'Otros', naturaleza: 'Acreedora' },

            // EGRESOS/GASTOS
            { codigo: '5001', nombre: 'Costo de Ventas', tipo: 'Egreso', subtipo: 'Costo', naturaleza: 'Deudora' },
            { codigo: '5002', nombre: 'Gastos de Administración', tipo: 'Egreso', subtipo: 'Operación', naturaleza: 'Deudora' },
            { codigo: '5003', nombre: 'Gastos de Venta', tipo: 'Egreso', subtipo: 'Operación', naturaleza: 'Deudora' },
            { codigo: '5004', nombre: 'Gastos Financieros', tipo: 'Egreso', subtipo: 'Financiero', naturaleza: 'Deudora' },
            { codigo: '5005', nombre: 'Sueldos y Salarios', tipo: 'Egreso', subtipo: 'Personal', naturaleza: 'Deudora' },
            { codigo: '5006', nombre: 'Renta', tipo: 'Egreso', subtipo: 'Operación', naturaleza: 'Deudora' },
            { codigo: '5007', nombre: 'Servicios Públicos', tipo: 'Egreso', subtipo: 'Operación', naturaleza: 'Deudora' },
            { codigo: '5008', nombre: 'Depreciaciones', tipo: 'Egreso', subtipo: 'Operación', naturaleza: 'Deudora' }
        ];

        let cuentasCreadas = 0;
        for (const cuenta of cuentasBasicas) {
            try {
                await contabilidadModel.createCuenta(cuenta);
                cuentasCreadas++;
            } catch (error) {
                if (!error.message.includes('ya existe')) {
                    console.log(`⚠️  Error creando cuenta ${cuenta.codigo}: ${error.message}`);
                }
            }
        }
        console.log(`✅ ${cuentasCreadas} cuentas del catálogo creadas\n`);

        console.log('🎉 ¡Inicialización completada exitosamente!\n');
        console.log('=================================');
        console.log('📊 BASE DE DATOS: conta_bd');
        console.log('👤 USUARIO ADMIN: admin');
        console.log('🔑 CONTRASEÑA: 123');
        console.log('🏢 EMPRESA: Sky Home S.A. de C.V.');
        console.log('📋 CUENTAS: ' + cuentasBasicas.length + ' cuentas básicas');
        console.log('=================================\n');
        
    } catch (error) {
        console.error('❌ Error durante la inicialización:', error);
        process.exit(1);
    } finally {
        await database.close();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    initializeDatabase();
}

module.exports = { initializeDatabase };