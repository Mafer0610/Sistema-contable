const jwt = require('jsonwebtoken');

class MovimientosController {
    constructor(model) {
        this.model = model;
    }

    // Método de login
    async login(req, res) {
        try {
            const { username, password } = req.body;

            const user = await this.model.findUserByUsername(username);
            if (!user) {
                return res.status(401).json({ error: 'Usuario no encontrado' });
            }

            const validPassword = await this.model.validatePassword(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Contraseña incorrecta' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, rol: user.rol },
                process.env.JWT_SECRET || 'secret_key',
                { expiresIn: '24h' }
            );

            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    nombre: user.nombre,
                    rol: user.rol
                }
            });
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // Obtener todos los movimientos
    async getAllMovimientos(req, res) {
        try {
            const movimientos = await this.model.getAllMovimientos();
            res.json(movimientos);
        } catch (error) {
            console.error('Error obteniendo movimientos:', error);
            res.status(500).json({ error: 'Error obteniendo movimientos' });
        }
    }

    // Crear nuevo movimiento
    async createMovimiento(req, res) {
        try {
            const { fecha, concepto, cuentas } = req.body;

            const movimiento = await this.model.createMovimiento(fecha, concepto, cuentas, req.user.id);
            res.json(movimiento);
        } catch (error) {
            console.error('Error creando movimiento:', error);
            if (error.message.includes('no balanceado')) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Error creando movimiento' });
            }
        }
    }

    // Eliminar movimiento
    async deleteMovimiento(req, res) {
        try {
            const { id } = req.params;
            const result = await this.model.deleteMovimiento(id);
            res.json(result);
        } catch (error) {
            console.error('Error eliminando movimiento:', error);
            if (error.message === 'Movimiento no encontrado') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Error eliminando movimiento' });
            }
        }
    }

    // Obtener catálogo de cuentas
    async getCuentas(req, res) {
        try {
            const cuentas = await this.model.getCuentas();
            res.json(cuentas);
        } catch (error) {
            console.error('Error obteniendo cuentas:', error);
            res.status(500).json({ error: 'Error obteniendo cuentas' });
        }
    }

    // Obtener saldos de cuentas
    async getSaldos(req, res) {
        try {
            const saldos = await this.model.getSaldos();
            res.json(saldos);
        } catch (error) {
            console.error('Error obteniendo saldos:', error);
            res.status(500).json({ error: 'Error obteniendo saldos' });
        }
    }

    // Obtener movimientos totales por cuenta
    async getMovimientosTotales(req, res) {
        try {
            const movimientos = await this.model.getMovimientosTotales();
            res.json(movimientos);
        } catch (error) {
            console.error('Error obteniendo movimientos totales:', error);
            res.status(500).json({ error: 'Error obteniendo movimientos totales' });
        }
    }

    // Generar reportes
    async getReporte(req, res) {
        try {
            const { tipo } = req.params;
            const { fechaInicio, fechaFin } = req.query;
            
            const reporte = await this.model.getReporte(tipo, fechaInicio, fechaFin);
            res.json(reporte);
        } catch (error) {
            console.error('Error generando reporte:', error);
            if (error.message === 'Tipo de reporte no válido') {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Error generando reporte' });
            }
        }
    }
}

module.exports = MovimientosController;