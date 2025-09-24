const express = require('express');
const router = express.Router();

function createContabilidadRoutes(contabilidadController, authMiddleware) {
    // Usar el middleware opcional del authMiddleware
    const optionalAuth = authMiddleware.optionalAuth;

    // === EMPRESAS ===
    router.get('/empresas', optionalAuth, async (req, res) => {
        try {
            const empresas = await contabilidadController.getEmpresas(req, res);
            if (!res.headersSent) {
                res.json(empresas);
            }
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en GET /empresas:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    router.post('/empresas', authMiddleware.verifyToken, async (req, res) => {
        try {
            await contabilidadController.createEmpresa(req, res);
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en POST /empresas:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    // === CATÁLOGO DE CUENTAS ===
    router.get('/cuentas', optionalAuth, async (req, res) => {
        try {
            const cuentas = await contabilidadController.getCuentas(req, res);
            if (!res.headersSent) {
                res.json(cuentas);
            }
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en GET /cuentas:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    router.post('/cuentas', authMiddleware.verifyToken, async (req, res) => {
        try {
            await contabilidadController.createCuenta(req, res);
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en POST /cuentas:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    router.get('/cuentas/:id', optionalAuth, async (req, res) => {
        try {
            await contabilidadController.getCuentaById(req, res);
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en GET /cuentas/:id:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    router.put('/cuentas/:id', authMiddleware.verifyToken, async (req, res) => {
        try {
            await contabilidadController.updateCuenta(req, res);
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en PUT /cuentas/:id:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    // === MOVIMIENTOS ===
    router.get('/movimientos', optionalAuth, async (req, res) => {
        try {
            const movimientos = await contabilidadController.getMovimientos(req, res);
            if (!res.headersSent) {
                res.json(movimientos);
            }
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en GET /movimientos:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    router.post('/movimientos', optionalAuth, async (req, res) => {
        try {
            // Si no hay usuario autenticado, usar usuario por defecto
            if (!req.user) {
                req.user = { id: 1 }; // Usuario por defecto
            }
            await contabilidadController.createMovimiento(req, res);
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en POST /movimientos:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    router.delete('/movimientos/:id', authMiddleware.verifyToken, async (req, res) => {
        try {
            await contabilidadController.deleteMovimiento(req, res);
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en DELETE /movimientos/:id:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    // === REPORTES ===
    router.get('/saldos', optionalAuth, async (req, res) => {
        try {
            await contabilidadController.getSaldos(req, res);
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en GET /saldos:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    router.get('/balanza-comprobacion', optionalAuth, async (req, res) => {
        try {
            await contabilidadController.getBalanzaComprobacion(req, res);
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en GET /balanza-comprobacion:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    router.get('/balance-general', optionalAuth, async (req, res) => {
        try {
            await contabilidadController.getBalanceGeneral(req, res);
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en GET /balance-general:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    router.get('/libro-mayor', optionalAuth, async (req, res) => {
        try {
            await contabilidadController.getLibroMayor(req, res);
        } catch (error) {
            if (!res.headersSent) {
                console.error('Error en GET /libro-mayor:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });

    return router;
}

module.exports = createContabilidadRoutes;