class ContabilidadController {
    constructor(contabilidadModel) {
        this.contabilidadModel = contabilidadModel;
    }

    // === GESTIÓN DE EMPRESAS ===
    async createEmpresa(req, res) {
        try {
            if (req.user.rol !== 'admin') {
                return res.status(403).json({ error: 'Acceso denegado' });
            }

            const { nombre } = req.body;

            if (!nombre) {
                return res.status(400).json({ error: 'El nombre de la empresa es obligatorio' });
            }

            const empresa = await this.contabilidadModel.createEmpresa({ nombre });

            res.status(201).json({
                message: 'Empresa creada exitosamente',
                empresa
            });
        } catch (error) {
            console.error('Error creando empresa:', error);
            res.status(500).json({ error: 'Error creando empresa' });
        }
    }

    async getEmpresas(req, res) {
        try {
            const empresas = await this.contabilidadModel.getEmpresas();
            res.json(empresas);
        } catch (error) {
            console.error('Error obteniendo empresas:', error);
            res.status(500).json({ error: 'Error obteniendo empresas' });
        }
    }

    // === CATÁLOGO DE CUENTAS ===
    async createCuenta(req, res) {
        try {
            const { codigo, nombre, tipo, subtipo, naturaleza, nivel, cuenta_padre_id } = req.body;

            if (!codigo || !nombre || !tipo || !naturaleza) {
                return res.status(400).json({ 
                    error: 'Código, nombre, tipo y naturaleza son obligatorios' 
                });
            }

            const cuenta = await this.contabilidadModel.createCuenta({
                codigo, nombre, tipo, subtipo, naturaleza, nivel, cuenta_padre_id
            });

            res.status(201).json({
                message: 'Cuenta creada exitosamente',
                cuenta
            });
        } catch (error) {
            console.error('Error creando cuenta:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                res.status(409).json({ error: 'El código de cuenta ya existe' });
            } else {
                res.status(500).json({ error: 'Error creando cuenta' });
            }
        }
    }

    async getCuentas(req, res) {
        try {
            const cuentas = await this.contabilidadModel.getCuentas();
            res.json(cuentas);
        } catch (error) {
            console.error('Error obteniendo cuentas:', error);
            res.status(500).json({ error: 'Error obteniendo cuentas' });
        }
    }

    async updateCuenta(req, res) {
        try {
            const { id } = req.params;
            const { nombre, tipo, subtipo, naturaleza, nivel, cuenta_padre_id } = req.body;

            const cuenta = await this.contabilidadModel.updateCuenta(id, {
                nombre, tipo, subtipo, naturaleza, nivel, cuenta_padre_id
            });

            if (!cuenta) {
                return res.status(404).json({ error: 'Cuenta no encontrada' });
            }

            res.json({
                message: 'Cuenta actualizada exitosamente',
                cuenta
            });
        } catch (error) {
            console.error('Error actualizando cuenta:', error);
            res.status(500).json({ error: 'Error actualizando cuenta' });
        }
    }

    // === MOVIMIENTOS CONTABLES ===
    async createMovimiento(req, res) {
        try {
            const { fecha, concepto, referencia, cuentas, empresaId } = req.body;

            if (!fecha || !concepto || !cuentas || cuentas.length < 2) {
                return res.status(400).json({ 
                    error: 'Fecha, concepto y al menos 2 cuentas son obligatorias' 
                });
            }

            // Validar que cada cuenta tenga debe o haber
            for (const cuenta of cuentas) {
                if (!cuenta.cuenta_id || ((!cuenta.debe || cuenta.debe <= 0) && (!cuenta.haber || cuenta.haber <= 0))) {
                    return res.status(400).json({ 
                        error: 'Cada cuenta debe tener un ID válido y un valor en debe o haber mayor a 0' 
                    });
                }
            }

            const movimiento = await this.contabilidadModel.createMovimiento(
                { fecha, concepto, referencia, cuentas, empresaId },
                req.user.id
            );

            res.status(201).json({
                message: 'Movimiento registrado exitosamente',
                movimiento
            });
        } catch (error) {
            console.error('Error creando movimiento:', error);
            if (error.message.includes('no balanceado') || error.message.includes('no existe')) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Error registrando movimiento' });
            }
        }
    }

    async getAllMovimientos(req, res) {
        try {
            const { empresaId } = req.query;
            const movimientos = await this.contabilidadModel.getAllMovimientos(empresaId);
            res.json(movimientos);
        } catch (error) {
            console.error('Error obteniendo movimientos:', error);
            res.status(500).json({ error: 'Error obteniendo movimientos' });
        }
    }

    async deleteMovimiento(req, res) {
        try {
            const { id } = req.params;
            const result = await this.contabilidadModel.deleteMovimiento(id, req.user.id);
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

    // === REPORTES ===
    async getSaldos(req, res) {
        try {
            const { empresaId } = req.query;
            const saldos = await this.contabilidadModel.getSaldos(empresaId);
            res.json(saldos);
        } catch (error) {
            console.error('Error obteniendo saldos:', error);
            res.status(500).json({ error: 'Error obteniendo saldos' });
        }
    }

    async getMovimientosTotales(req, res) {
        try {
            const { empresaId } = req.query;
            const movimientos = await this.contabilidadModel.getMovimientosTotales(empresaId);
            res.json(movimientos);
        } catch (error) {
            console.error('Error obteniendo movimientos totales:', error);
            res.status(500).json({ error: 'Error obteniendo movimientos totales' });
        }
    }

    async getBalanzaComprobacion(req, res) {
        try {
            const { fechaInicio, fechaFin, empresaId } = req.query;
            const balanza = await this.contabilidadModel.getBalanzaComprobacion(fechaInicio, fechaFin, empresaId);
            res.json(balanza);
        } catch (error) {
            console.error('Error generando balanza de comprobación:', error);
            res.status(500).json({ error: 'Error generando balanza de comprobación' });
        }
    }

    async getLibroMayor(req, res) {
        try {
            const { cuentaId, fechaInicio, fechaFin, empresaId } = req.query;
            const mayor = await this.contabilidadModel.getLibroMayor(cuentaId, fechaInicio, fechaFin, empresaId);
            res.json(mayor);
        } catch (error) {
            console.error('Error generando libro mayor:', error);
            res.status(500).json({ error: 'Error generando libro mayor' });
        }
    }

    async getBalanceGeneral(req, res) {
        try {
            const { fechaCorte, empresaId } = req.query;
            const saldos = await this.contabilidadModel.getSaldos(empresaId);
            
            // Organizar por tipo de cuenta
            const balance = {
                activo: {
                    circulante: [],
                    fijo: [],
                    total: 0
                },
                pasivo: {
                    corto_plazo: [],
                    largo_plazo: [],
                    total: 0
                },
                capital: {
                    cuentas: [],
                    total: 0
                }
            };

            saldos.forEach(cuenta => {
                const saldo = cuenta.saldo;
                
                switch (cuenta.tipo) {
                    case 'Activo':
                        if (saldo > 0) { // Los activos tienen naturaleza deudora
                            const item = {
                                codigo: cuenta.codigo,
                                nombre: cuenta.nombre,
                                saldo: saldo
                            };
                            
                            if (cuenta.subtipo && cuenta.subtipo.toLowerCase().includes('fijo')) {
                                balance.activo.fijo.push(item);
                            } else {
                                balance.activo.circulante.push(item);
                            }
                            balance.activo.total += saldo;
                        }
                        break;
                        
                    case 'Pasivo':
                        if (saldo < 0) { // Los pasivos tienen naturaleza acreedora
                            const item = {
                                codigo: cuenta.codigo,
                                nombre: cuenta.nombre,
                                saldo: Math.abs(saldo)
                            };
                            
                            if (cuenta.subtipo && cuenta.subtipo.toLowerCase().includes('largo')) {
                                balance.pasivo.largo_plazo.push(item);
                            } else {
                                balance.pasivo.corto_plazo.push(item);
                            }
                            balance.pasivo.total += Math.abs(saldo);
                        }
                        break;
                        
                    case 'Capital':
                        if (saldo !== 0) {
                            balance.capital.cuentas.push({
                                codigo: cuenta.codigo,
                                nombre: cuenta.nombre,
                                saldo: Math.abs(saldo)
                            });
                            balance.capital.total += Math.abs(saldo);
                        }
                        break;
                }
            });

            res.json(balance);
        } catch (error) {
            console.error('Error generando balance general:', error);
            res.status(500).json({ error: 'Error generando balance general' });
        }
    }

    async getEstadoResultados(req, res) {
        try {
            const { fechaInicio, fechaFin, empresaId } = req.query;
            const saldos = await this.contabilidadModel.getSaldos(empresaId);
            
            const estadoResultados = {
                ingresos: [],
                egresos: [],
                utilidad_bruta: 0,
                utilidad_neta: 0
            };

            let totalIngresos = 0;
            let totalEgresos = 0;

            saldos.forEach(cuenta => {
                const saldo = Math.abs(cuenta.saldo);
                
                if (cuenta.tipo === 'Ingreso' && saldo > 0) {
                    estadoResultados.ingresos.push({
                        codigo: cuenta.codigo,
                        nombre: cuenta.nombre,
                        saldo: saldo
                    });
                    totalIngresos += saldo;
                } else if (cuenta.tipo === 'Egreso' && saldo > 0) {
                    estadoResultados.egresos.push({
                        codigo: cuenta.codigo,
                        nombre: cuenta.nombre,
                        saldo: saldo
                    });
                    totalEgresos += saldo;
                }
            });

            estadoResultados.utilidad_bruta = totalIngresos;
            estadoResultados.utilidad_neta = totalIngresos - totalEgresos;

            res.json(estadoResultados);
        } catch (error) {
            console.error('Error generando estado de resultados:', error);
            res.status(500).json({ error: 'Error generando estado de resultados' });
        }
    }
}

module.exports = ContabilidadController;