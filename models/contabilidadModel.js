class ContabilidadModel {
    constructor(db) {
        this.db = db;
    }

    // === GESTIÓN DE EMPRESAS ===
    async createEmpresa(empresaData) {
        const { nombre, rfc, direccion, telefono, email } = empresaData;
        try {
            const [result] = await this.db.execute(
                'INSERT INTO empresas (nombre, rfc, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)',
                [nombre, rfc, direccion, telefono, email]
            );
            return { id: result.insertId, ...empresaData };
        } catch (error) {
            throw error;
        }
    }

    async getEmpresas() {
        try {
            const [empresas] = await this.db.execute(
                'SELECT * FROM empresas WHERE activa = true ORDER BY nombre'
            );
            return empresas;
        } catch (error) {
            throw error;
        }
    }

    // === CATÁLOGO DE CUENTAS ===
    async createCuenta(cuentaData) {
        const { codigo, nombre, tipo, subtipo, naturaleza, nivel = 1, cuenta_padre_id = null } = cuentaData;
        try {
            const [result] = await this.db.execute(
                'INSERT INTO catalogo_cuentas (codigo, nombre, tipo, subtipo, naturaleza, nivel, cuenta_padre_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [codigo, nombre, tipo, subtipo, naturaleza, nivel, cuenta_padre_id]
            );
            return { id: result.insertId, ...cuentaData };
        } catch (error) {
            throw error;
        }
    }

    async getCuentas() {
        try {
            const [cuentas] = await this.db.execute(`
                SELECT c.*, cp.nombre as cuenta_padre_nombre 
                FROM catalogo_cuentas c 
                LEFT JOIN catalogo_cuentas cp ON c.cuenta_padre_id = cp.id 
                WHERE c.activa = true 
                ORDER BY c.codigo
            `);
            return cuentas;
        } catch (error) {
            throw error;
        }
    }

    async getCuentaById(id) {
        try {
            const [cuentas] = await this.db.execute(
                'SELECT * FROM catalogo_cuentas WHERE id = ? AND activa = true',
                [id]
            );
            return cuentas.length > 0 ? cuentas[0] : null;
        } catch (error) {
            throw error;
        }
    }

    async updateCuenta(id, cuentaData) {
        const { nombre, tipo, subtipo, naturaleza, nivel, cuenta_padre_id } = cuentaData;
        try {
            await this.db.execute(
                'UPDATE catalogo_cuentas SET nombre = ?, tipo = ?, subtipo = ?, naturaleza = ?, nivel = ?, cuenta_padre_id = ? WHERE id = ?',
                [nombre, tipo, subtipo, naturaleza, nivel, cuenta_padre_id, id]
            );
            return await this.getCuentaById(id);
        } catch (error) {
            throw error;
        }
    }

    // === MOVIMIENTOS CONTABLES ===
    async getNextAsientoNumber() {
        try {
            const [result] = await this.db.execute(
                'SELECT COALESCE(MAX(numero_asiento), 0) + 1 as next_number FROM movimientos'
            );
            return result[0].next_number;
        } catch (error) {
            throw error;
        }
    }

    async createMovimiento(movimientoData, usuarioId) {
        const { fecha, concepto, referencia = '', cuentas, empresaId = 1 } = movimientoData;

        // Calcular totales
        const totalDebe = cuentas.reduce((sum, c) => sum + (c.debe || 0), 0);
        const totalHaber = cuentas.reduce((sum, c) => sum + (c.haber || 0), 0);

        // Validar que el asiento esté balanceado
        if (Math.abs(totalDebe - totalHaber) > 0.01) {
            throw new Error(`Asiento no balanceado. Debe: ${totalDebe}, Haber: ${totalHaber}`);
        }

        // Validar que existan las cuentas
        for (const cuenta of cuentas) {
            const cuentaExistente = await this.getCuentaById(cuenta.cuenta_id);
            if (!cuentaExistente) {
                throw new Error(`La cuenta con ID ${cuenta.cuenta_id} no existe`);
            }
        }

        await this.db.beginTransaction();

        try {
            // Obtener número de asiento
            const numeroAsiento = await this.getNextAsientoNumber();

            // Insertar movimiento
            const [result] = await this.db.execute(
                'INSERT INTO movimientos (numero_asiento, fecha, concepto, referencia, total_debe, total_haber, usuario_id, empresa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [numeroAsiento, fecha, concepto, referencia, totalDebe, totalHaber, usuarioId, empresaId]
            );

            const movimientoId = result.insertId;

            // Insertar cuentas del movimiento
            for (const cuenta of cuentas) {
                await this.db.execute(
                    'INSERT INTO movimiento_cuentas (movimiento_id, cuenta_id, debe, haber) VALUES (?, ?, ?, ?)',
                    [movimientoId, cuenta.cuenta_id, cuenta.debe || 0, cuenta.haber || 0]
                );
            }

            await this.db.commit();

            return {
                id: movimientoId,
                numero_asiento: numeroAsiento,
                fecha,
                concepto,
                referencia,
                cuentas,
                totalDebe,
                totalHaber
            };
        } catch (error) {
            await this.db.rollback();
            throw error;
        }
    }

    async getAllMovimientos(empresaId = null) {
        try {
            let whereClause = '';
            let params = [];
            
            if (empresaId) {
                whereClause = 'WHERE m.empresa_id = ?';
                params = [empresaId];
            }

            const [movimientos] = await this.db.execute(`
                SELECT m.*, 
                       u.nombre as usuario_nombre,
                       u.apellidos as usuario_apellidos,
                       e.nombre as empresa_nombre,
                       GROUP_CONCAT(
                           CONCAT(c.codigo, ':', c.nombre, ':', mc.debe, ':', mc.haber, ':', mc.cuenta_id)
                           SEPARATOR '|'
                       ) as cuentas_data
                FROM movimientos m
                LEFT JOIN usuarios u ON m.usuario_id = u.id
                LEFT JOIN empresas e ON m.empresa_id = e.id
                LEFT JOIN movimiento_cuentas mc ON m.id = mc.movimiento_id
                LEFT JOIN catalogo_cuentas c ON mc.cuenta_id = c.id
                ${whereClause}
                GROUP BY m.id
                ORDER BY m.numero_asiento DESC, m.fecha DESC
            `, params);

            return movimientos.map(mov => {
                const cuentas = mov.cuentas_data ? mov.cuentas_data.split('|').map(cuenta => {
                    const [codigo, nombre, debe, haber, cuenta_id] = cuenta.split(':');
                    return {
                        cuenta_id: parseInt(cuenta_id),
                        codigo,
                        nombre,
                        debe: parseFloat(debe),
                        haber: parseFloat(haber)
                    };
                }) : [];

                return {
                    id: mov.id,
                    numero_asiento: mov.numero_asiento,
                    fecha: mov.fecha.toISOString().split('T')[0],
                    concepto: mov.concepto,
                    referencia: mov.referencia,
                    cuentas,
                    totalDebe: parseFloat(mov.total_debe),
                    totalHaber: parseFloat(mov.total_haber),
                    usuario: {
                        nombre: mov.usuario_nombre,
                        apellidos: mov.usuario_apellidos
                    },
                    empresa: mov.empresa_nombre,
                    created_at: mov.created_at
                };
            });
        } catch (error) {
            throw error;
        }
    }

    async deleteMovimiento(id, usuarioId) {
        try {
            // Verificar que el movimiento existe
            const [movimiento] = await this.db.execute(
                'SELECT * FROM movimientos WHERE id = ?',
                [id]
            );
            
            if (movimiento.length === 0) {
                throw new Error('Movimiento no encontrado');
            }

            // Eliminar movimiento (las cuentas se eliminan por CASCADE)
            await this.db.execute('DELETE FROM movimientos WHERE id = ?', [id]);
            
            return { message: 'Movimiento eliminado correctamente' };
        } catch (error) {
            throw error;
        }
    }

    // === REPORTES ===
    async getSaldos(empresaId = null) {
        try {
            let whereClause = '';
            let params = [];
            
            if (empresaId) {
                whereClause = 'AND m.empresa_id = ?';
                params = [empresaId];
            }

            const [saldos] = await this.db.execute(`
                SELECT c.codigo, c.nombre, c.tipo, c.naturaleza,
                       SUM(mc.debe - mc.haber) as saldo
                FROM movimiento_cuentas mc
                JOIN movimientos m ON mc.movimiento_id = m.id
                JOIN catalogo_cuentas c ON mc.cuenta_id = c.id
                WHERE c.activa = true ${whereClause}
                GROUP BY c.id, c.codigo, c.nombre, c.tipo, c.naturaleza
                ORDER BY c.codigo
            `, params);
            
            return saldos.map(s => ({
                ...s,
                saldo: parseFloat(s.saldo)
            }));
        } catch (error) {
            throw error;
        }
    }

    async getMovimientosTotales(empresaId = null) {
        try {
            let whereClause = '';
            let params = [];
            
            if (empresaId) {
                whereClause = 'AND m.empresa_id = ?';
                params = [empresaId];
            }

            const [movimientos] = await this.db.execute(`
                SELECT c.codigo, c.nombre,
                       SUM(mc.debe) as total_debe,
                       SUM(mc.haber) as total_haber
                FROM movimiento_cuentas mc
                JOIN movimientos m ON mc.movimiento_id = m.id
                JOIN catalogo_cuentas c ON mc.cuenta_id = c.id
                WHERE c.activa = true ${whereClause}
                GROUP BY c.id, c.codigo, c.nombre
                ORDER BY c.codigo
            `, params);
            
            return movimientos.map(m => ({
                ...m,
                total_debe: parseFloat(m.total_debe),
                total_haber: parseFloat(m.total_haber)
            }));
        } catch (error) {
            throw error;
        }
    }

    async getBalanzaComprobacion(fechaInicio = null, fechaFin = null, empresaId = null) {
        try {
            let whereClause = 'WHERE c.activa = true';
            let params = [];
            
            if (fechaInicio && fechaFin) {
                whereClause += ' AND m.fecha BETWEEN ? AND ?';
                params.push(fechaInicio, fechaFin);
            }
            
            if (empresaId) {
                whereClause += ' AND m.empresa_id = ?';
                params.push(empresaId);
            }

            const [balanza] = await this.db.execute(`
                SELECT c.codigo, c.nombre, c.tipo, c.naturaleza,
                       SUM(mc.debe) as movimiento_debe,
                       SUM(mc.haber) as movimiento_haber,
                       SUM(mc.debe - mc.haber) as saldo
                FROM catalogo_cuentas c
                LEFT JOIN movimiento_cuentas mc ON c.id = mc.cuenta_id
                LEFT JOIN movimientos m ON mc.movimiento_id = m.id
                ${whereClause}
                GROUP BY c.id, c.codigo, c.nombre, c.tipo, c.naturaleza
                HAVING movimiento_debe > 0 OR movimiento_haber > 0
                ORDER BY c.codigo
            `, params);
            
            return balanza.map(b => ({
                ...b,
                movimiento_debe: parseFloat(b.movimiento_debe || 0),
                movimiento_haber: parseFloat(b.movimiento_haber || 0),
                saldo: parseFloat(b.saldo || 0)
            }));
        } catch (error) {
            throw error;
        }
    }

    async getLibroMayor(cuentaId = null, fechaInicio = null, fechaFin = null, empresaId = null) {
        try {
            let whereClause = 'WHERE c.activa = true';
            let params = [];
            
            if (cuentaId) {
                whereClause += ' AND c.id = ?';
                params.push(cuentaId);
            }
            
            if (fechaInicio && fechaFin) {
                whereClause += ' AND m.fecha BETWEEN ? AND ?';
                params.push(fechaInicio, fechaFin);
            }
            
            if (empresaId) {
                whereClause += ' AND m.empresa_id = ?';
                params.push(empresaId);
            }

            const [mayor] = await this.db.execute(`
                SELECT m.fecha, m.concepto, m.referencia, m.numero_asiento,
                       c.codigo, c.nombre as cuenta_nombre, c.tipo, c.naturaleza,
                       mc.debe, mc.haber
                FROM movimientos m
                JOIN movimiento_cuentas mc ON m.id = mc.movimiento_id
                JOIN catalogo_cuentas c ON mc.cuenta_id = c.id
                ${whereClause}
                ORDER BY c.codigo, m.fecha, m.numero_asiento
            `, params);
            
            return mayor.map(m => ({
                ...m,
                fecha: m.fecha.toISOString().split('T')[0],
                debe: parseFloat(m.debe),
                haber: parseFloat(m.haber)
            }));
        } catch (error) {
            throw error;
        }
    }
}

module.exports = ContabilidadModel;