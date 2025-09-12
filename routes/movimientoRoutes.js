const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware de autenticación
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

// Función para crear las rutas con el controlador
function createRoutes(controller) {
    // Rutas de autenticación
    router.post('/login', (req, res) => controller.login(req, res));

    // Rutas de movimientos
    router.get('/movimientos', authenticateToken, (req, res) => controller.getAllMovimientos(req, res));
    router.post('/movimientos', authenticateToken, (req, res) => controller.createMovimiento(req, res));
    router.delete('/movimientos/:id', authenticateToken, (req, res) => controller.deleteMovimiento(req, res));

    // Rutas de catálogo y reportes
    router.get('/cuentas', authenticateToken, (req, res) => controller.getCuentas(req, res));
    router.get('/saldos', authenticateToken, (req, res) => controller.getSaldos(req, res));
    router.get('/movimientos-totales', authenticateToken, (req, res) => controller.getMovimientosTotales(req, res));
    router.get('/reportes/:tipo', authenticateToken, (req, res) => controller.getReporte(req, res));

    return router;
}

module.exports = createRoutes;