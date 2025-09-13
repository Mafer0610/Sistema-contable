const express = require('express');
const router = express.Router();

function createAuthRoutes(authController, authMiddleware) {
    // Rutas públicas
    router.post('/register', (req, res) => authController.register(req, res));
    router.post('/login', (req, res) => authController.login(req, res));

    // Rutas protegidas
    router.post('/logout', authMiddleware.requireAuth(), (req, res) => authController.logout(req, res));
    router.get('/verify', authMiddleware.requireAuth(), (req, res) => authController.verifyToken(req, res));
    router.put('/change-password', authMiddleware.requireAuth(), (req, res) => authController.changePassword(req, res));

    // Rutas solo para admin
    router.get('/users', authMiddleware.requireAdmin(), (req, res) => authController.getAllUsers(req, res));
    router.put('/users/:id', authMiddleware.requireAuth(), (req, res) => authController.updateUser(req, res));
    router.delete('/users/:id', authMiddleware.requireAdmin(), (req, res) => authController.deleteUser(req, res));

    return router;
}

module.exports = createAuthRoutes;