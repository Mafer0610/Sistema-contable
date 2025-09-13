const express = require('express');
const router = express.Router();

function createContabilidadRoutes(contabilidadController, authMiddleware) {
    // === EMPRESAS ===
    router.post('/empresas', authMiddleware.requireAdmin(), (req, res) => contabilidadController.createEmpresa(req, res));
    router.get('/empresas', authMiddleware.requireAuth(), (req, res) => contabilidadController.getEmpresas(req, res));

    // === CATÁLOGO DE CUENTAS ===
    router.post('/cuentas', authMiddleware.requireContador(), (req, res) => contabilidadController.createCuenta(req, res));
    router.get('/cuentas', authMiddleware.requireAuth(), (req, res) => contabilidadController.getCuentas(req, res));
    router.put('/cuentas/:id', authMiddleware.requireContador(), (req, res) => contabilidadController.updateCuenta(req, res));

    // === MOVIMIENTOS CONTABLES ===
    router.post('/movimientos', authMiddleware.requireAuth(), (req, res) => contabilidadController.createMovimiento(req, res));
    router.get('/movimientos', authMiddleware.requireAuth(), (req, res) => contabilidadController.getAllMovimientos(req, res));
    router.delete('/movimientos/:id', authMiddleware.requireContador(), (req, res) => contabilidadController.deleteMovimiento(req, res));

    // === REPORTES ===
    router.get('/saldos', authMiddleware.requireAuth(), (req, res) => contabilidadController.getSaldos(req, res));
    router.get('/movimientos-totales', authMiddleware.requireAuth(), (req, res) => contabilidadController.getMovimientosTotales(req, res));
    router.get('/balanza-comprobacion', authMiddleware.requireAuth(), (req, res) => contabilidadController.getBalanzaComprobacion(req, res));
    router.get('/libro-mayor', authMiddleware.requireAuth(), (req, res) => contabilidadController.getLibroMayor(req, res));
    router.get('/balance-general', authMiddleware.requireAuth(), (req, res) => contabilidadController.getBalanceGeneral(req, res));
    router.get('/estado-resultados', authMiddleware.requireAuth(), (req, res) => contabilidadController.getEstadoResultados(req, res));

    return router;
}

module.exports = createContabilidadRoutes;