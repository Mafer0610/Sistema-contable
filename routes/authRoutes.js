const express = require('express');
const router = express.Router();

function createAuthRoutes(authController, authMiddleware) {
    // Rutas públicas
    router.post('/register', (req, res) => authController.register(req, res));
    router.post('/login', (req, res) => authController.login(req, res));

    // Rutas protegidas
    router.post('/logout', authMiddleware.requireAuth(), (req, res) => authController.logout(req, res));
    router.get('/verify', authMiddleware.requireAuth(), (req, res) => authController.verify(req, res));
    
    // Rutas de administración de usuarios
    router.get('/usuarios', authMiddleware.requireAdmin(), (req, res) => authController.getUsers(req, res));
    router.put('/usuarios/:id/toggle', authMiddleware.requireAdmin(), (req, res) => authController.toggleUser(req, res));

    return router;
}

module.exports = createAuthRoutes;