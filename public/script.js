// Variables globales
let movimientos = [];
let currentUser = null;
let authToken = null;
const API_BASE = '/api';

// Configuración de headers para peticiones autenticadas
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    // Establecer fecha actual
    document.getElementById('fecha').valueAsDate = new Date();
    
    // Verificar si hay token guardado
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
        authToken = savedToken;
        verificarToken();
    }
});

// Verificar token guardado
async function verificarToken() {
    try {
        const response = await fetch(`${API_BASE}/movimientos`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            // Token válido, ir a la aplicación
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            actualizarFechas();
            await cargarDatos();
        } else {
            // Token inválido, limpiar y mostrar login
            localStorage.removeItem('auth_token');
            authToken = null;
        }
    } catch (error) {
        console.error('Error verificando token:', error);
        localStorage.removeItem('auth_token');
        authToken = null;
    }
}

// Función de login
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = data.user;
            authToken = data.token;
            localStorage.setItem('auth_token', authToken);
            
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            actualizarFechas();
            await cargarDatos();
        } else {
            alert(data.error || 'Error de autenticación');
        }
    } catch (error) {
        console.error('Error en login:', error);
        alert('Error de conexión con el servidor');
    }
});

// Función de logout
function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('auth_token');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginForm').reset();
}

// Mostrar secciones
function showSection(sectionName) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remover clase active de botones
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar sección seleccionada
    document.getElementById(sectionName).classList.add('active');
    event.target.classList.add('active');
    
    // Cargar datos específicos según la sección
    if (sectionName === 'balance') {
        generarBalanceGeneral();
    } else if (sectionName === 'diario') {
        generarLibroDiario();
    } else if (sectionName === 'mayor') {
        generarLibroMayor();
    } else if (sectionName === 'balanza') {
        generarBalanzaComprobacion();
    }
}

// Agregar/quitar cuentas en el formulario
function agregarCuenta() {
    const container = document.getElementById('cuentasContainer');
    const nuevaCuenta = container.firstElementChild.cloneNode(true);
    
    // Limpiar valores
    nuevaCuenta.querySelector('.cuenta-select').value = '';
    nuevaCuenta.querySelector('.debe-input').value = '';
    nuevaCuenta.querySelector('.haber-input').value = '';
    
    container.appendChild(nuevaCuenta);
}

function quitarCuenta() {
    const container = document.getElementById('cuentasContainer');
    if (container.children.length > 1) {
        container.removeChild(container.lastElementChild);
    }
}

// Registrar movimiento
document.getElementById('movimientoForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fecha = document.getElementById('fecha').value;
    const concepto = document.getElementById('concepto').value;
    const cuentasRows = document.querySelectorAll('.cuenta-row');
    
    const cuentas = [];
    let totalDebe = 0;
    let totalHaber = 0;
    
    cuentasRows.forEach(row => {
        const cuenta = row.querySelector('.cuenta-select').value;
        const debe = parseFloat(row.querySelector('.debe-input').value) || 0;
        const haber = parseFloat(row.querySelector('.haber-input').value) || 0;
        
        if (cuenta && (debe > 0 || haber > 0)) {
            cuentas.push({ cuenta, debe, haber });
            totalDebe += debe;
            totalHaber += haber;
        }
    });
    
    // Validar que el asiento esté balanceado
    if (Math.abs(totalDebe - totalHaber) > 0.01) {
        mostrarAlerta('error', 'El asiento debe estar balanceado. Total Debe: $' + totalDebe.toFixed(2) + ', Total Haber: $' + totalHaber.toFixed(2));
        return;
    }
    
    if (cuentas.length < 2) {
        mostrarAlerta('error', 'Debe agregar al menos 2 cuentas');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/movimientos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                fecha: fecha,
                concepto: concepto,
                cuentas: cuentas
            })
        });

        const data = await response.json();

        if (response.ok) {
            mostrarAlerta('success', 'Movimiento registrado correctamente');
            document.getElementById('movimientoForm').reset();
            document.getElementById('fecha').valueAsDate = new Date();
            
            // Limpiar cuentas adicionales
            const container = document.getElementById('cuentasContainer');
            while (container.children.length > 1) {
                container.removeChild(container.lastElementChild);
            }
            
            // Recargar datos
            await cargarDatos();
        } else {
            mostrarAlerta('error', data.error || 'Error registrando movimiento');
        }
    } catch (error) {
        console.error('Error registrando movimiento:', error);
        mostrarAlerta('error', 'Error de conexión con el servidor');
    }
});

// Mostrar alertas
function mostrarAlerta(tipo, mensaje) {
    const alert = document.getElementById('alert');
    alert.className = `alert ${tipo}`;
    alert.textContent = mensaje;
    alert.style.display = 'block';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

// Actualizar fechas en los reportes
function actualizarFechas() {
    const hoy = new Date();
    const fechaTexto = hoy.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    document.getElementById('balanceDate').textContent = `al ${fechaTexto}`;
    document.getElementById('balanzaDate').textContent = `al ${fechaTexto}`;
}

// Generar Balance General
async function generarBalanceGeneral() {
    try {
        const response = await fetch(`${API_BASE}/saldos`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Error obteniendo saldos');
        }
        
        const saldos = await response.json();
        const tbody = document.getElementById('balanceBody');
        tbody.innerHTML = '';
        
        // Definir estructura del balance
        const estructura = {
            activo: [
                'Caja', 'Banco', 'Inventario', 'IVA acreditable', 'IVA por acreditar',
                'Terreno', 'Edificio', 'Mobiliario', 'Equipo de computo', 'Equipo de transporte',
                'Papeleria y utiles', 'Rentas pag. x anticipado'
            ],
            pasivo: [
                'Cuentas por pagar', 'Doc por pagar', 'Anticipo clientes', 'IVA trasladado'
            ],
            capital: ['Capital']
        };
        
        const maxRows = Math.max(estructura.activo.length, estructura.pasivo.length, estructura.capital.length);
        let totalActivo = 0, totalPasivo = 0, totalCapital = 0;
        
        for (let i = 0; i < maxRows; i++) {
            const row = tbody.insertRow();
            
            // Activo
            if (i < estructura.activo.length) {
                const cuenta = estructura.activo[i];
                const saldo = saldos[cuenta] || 0;
                if (saldo > 0) totalActivo += saldo;
                row.insertCell(0).textContent = cuenta;
                row.insertCell(1).textContent = saldo > 0 ? '$' + formatNumber(saldo) : '';
            } else {
                row.insertCell(0).textContent = '';
                row.insertCell(1).textContent = '';
            }
            
            // Pasivo
            if (i < estructura.pasivo.length) {
                const cuenta = estructura.pasivo[i];
                const saldo = Math.abs(saldos[cuenta] || 0);
                if (saldo > 0) totalPasivo += saldo;
                row.insertCell(2).textContent = cuenta;
                row.insertCell(3).textContent = saldo > 0 ? '$' + formatNumber(saldo) : '';
            } else {
                row.insertCell(2).textContent = '';
                row.insertCell(3).textContent = '';
            }
            
            // Capital
            if (i < estructura.capital.length) {
                const cuenta = estructura.capital[i];
                const saldo = Math.abs(saldos[cuenta] || 0);
                if (saldo > 0) totalCapital += saldo;
                row.insertCell(4).textContent = cuenta;
                row.insertCell(5).textContent = saldo > 0 ? '$' + formatNumber(saldo) : '';
            } else {
                row.insertCell(4).textContent = '';
                row.insertCell(5).textContent = '';
            }
            
            row.cells[1].classList.add('money');
            row.cells[3].classList.add('money');
            row.cells[5].classList.add('money');
        }
        
        // Agregar totales
        const totalRow = tbody.insertRow();
        totalRow.classList.add('total-row');
        totalRow.insertCell(0).textContent = 'Total activos';
        totalRow.insertCell(1).textContent = '$' + formatNumber(totalActivo);
        totalRow.insertCell(2).textContent = 'Total pasivo';
        totalRow.insertCell(3).textContent = '$' + formatNumber(totalPasivo);
        totalRow.insertCell(4).textContent = 'Total capital';
        totalRow.insertCell(5).textContent = '$' + formatNumber(totalCapital);
        
        totalRow.cells[1].classList.add('money');
        totalRow.cells[3].classList.add('money');
        totalRow.cells[5].classList.add('money');
        
        // Segunda fila de totales
        const totalRow2 = tbody.insertRow();
        totalRow2.classList.add('total-row');
        totalRow2.insertCell(0).textContent = '';
        totalRow2.insertCell(1).textContent = '$' + formatNumber(totalActivo);
        totalRow2.insertCell(2).textContent = 'Total pasivo + capital';
        totalRow2.insertCell(3).textContent = '';
        totalRow2.insertCell(4).textContent = '';
        totalRow2.insertCell(5).textContent = '$' + formatNumber(totalPasivo + totalCapital);
        
        totalRow2.cells[1].classList.add('money');
        totalRow2.cells[5].classList.add('money');
    } catch (error) {
        console.error('Error generando balance general:', error);
        mostrarAlerta('error', 'Error cargando balance general');
    }
}

// Generar Libro Diario
async function generarLibroDiario() {
    try {
        const container = document.getElementById('diarioContent');
        container.innerHTML = '';
        
        movimientos.forEach((mov, index) => {
            const entry = document.createElement('div');
            entry.className = 'diario-entry';
            
            const header = document.createElement('div');
            header.className = 'diario-header';
            header.textContent = `${mov.fecha} - ${mov.concepto} - Asiento ${index + 1}`;
            entry.appendChild(header);
            
            const details = document.createElement('div');
            details.className = 'diario-details';
            
            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>FECHA</th>
                        <th>CONCEPTO</th>
                        <th>DEBE</th>
                        <th>HABER</th>
                    </tr>
                </thead>
            `;
            
            const tbody = document.createElement('tbody');
            mov.cuentas.forEach(cuenta => {
                const row = tbody.insertRow();
                row.insertCell(0).textContent = mov.fecha;
                row.insertCell(1).textContent = cuenta.cuenta;
                row.insertCell(2).textContent = cuenta.debe > 0 ? ' + formatNumber(cuenta.debe) : '';
                row.insertCell(3).textContent = cuenta.haber > 0 ? ' + formatNumber(cuenta.haber) : '';
                
                row.cells[2].classList.add('debe-column');
                row.cells[3].classList.add('haber-column');
            });
            
            table.appendChild(tbody);
            details.appendChild(table);
            entry.appendChild(details);
            container.appendChild(entry);
        });
    } catch (error) {
        console.error('Error generando libro diario:', error);
        mostrarAlerta('error', 'Error cargando libro diario');
    }
}

// Generar Libro Mayor
async function generarLibroMayor() {
    try {
        const container = document.getElementById('mayorContent');
        container.innerHTML = '';
        
        const cuentas = obtenerTodasLasCuentas();
        const saldos = calcularSaldos();
        
        cuentas.forEach(cuenta => {
            if (!saldos[cuenta] && saldos[cuenta] !== 0) return;
            
            const cuentaDiv = document.createElement('div');
            cuentaDiv.style.marginBottom = '30px';
            cuentaDiv.style.border = '1px solid #ddd';
            cuentaDiv.style.borderRadius = '8px';
            cuentaDiv.style.overflow = 'hidden';
            
            const header = document.createElement('div');
            header.style.background = '#f8f9fa';
            header.style.padding = '15px';
            header.style.fontWeight = 'bold';
            header.style.borderBottom = '1px solid #ddd';
            header.textContent = cuenta;
            cuentaDiv.appendChild(header);
            
            const movimientosCuenta = [];
            let saldoAcumulado = 0;
            
            movimientos.forEach(mov => {
                mov.cuentas.forEach(c => {
                    if (c.cuenta === cuenta) {
                        saldoAcumulado += c.debe - c.haber;
                        movimientosCuenta.push({
                            fecha: mov.fecha,
                            concepto: mov.concepto,
                            debe: c.debe,
                            haber: c.haber,
                            saldo: saldoAcumulado
                        });
                    }
                });
            });
            
            if (movimientosCuenta.length > 0) {
                const table = document.createElement('table');
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Concepto</th>
                            <th>Debe</th>
                            <th>Haber</th>
                            <th>Saldo</th>
                        </tr>
                    </thead>
                `;
                
                const tbody = document.createElement('tbody');
                movimientosCuenta.forEach(mov => {
                    const row = tbody.insertRow();
                    row.insertCell(0).textContent = mov.fecha;
                    row.insertCell(1).textContent = mov.concepto;
                    row.insertCell(2).textContent = mov.debe > 0 ? ' + formatNumber(mov.debe) : '';
                    row.insertCell(3).textContent = mov.haber > 0 ? ' + formatNumber(mov.haber) : '';
                    row.insertCell(4).textContent = ' + formatNumber(Math.abs(mov.saldo));
                    
                    row.cells[2].classList.add('debe-column');
                    row.cells[3].classList.add('haber-column');
                    row.cells[4].classList.add('money');
                });
                
                table.appendChild(tbody);
                cuentaDiv.appendChild(table);
            }
            
            container.appendChild(cuentaDiv);
        });
    } catch (error) {
        console.error('Error generando libro mayor:', error);
        mostrarAlerta('error', 'Error cargando libro mayor');
    }
}

// Generar Balanza de Comprobación
async function generarBalanzaComprobacion() {
    try {
        const response = await fetch(`${API_BASE}/movimientos-totales`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Error obteniendo movimientos totales');
        }
        
        const movimientosTotales = await response.json();
        const saldos = calcularSaldos();
        const tbody = document.getElementById('balanzaBody');
        tbody.innerHTML = '';
        
        const cuentas = obtenerTodasLasCuentas();
        let totalMovDebe = 0, totalMovHaber = 0, totalSaldoDebe = 0, totalSaldoHaber = 0;
        
        cuentas.forEach(cuenta => {
            const movimientos = movimientosTotales[cuenta] || { debe: 0, haber: 0 };
            const saldo = saldos[cuenta] || 0;
            
            if (movimientos.debe > 0 || movimientos.haber > 0 || saldo !== 0) {
                const row = tbody.insertRow();
                row.insertCell(0).textContent = cuenta;
                row.insertCell(1).textContent = movimientos.debe > 0 ? ' + formatNumber(movimientos.debe) : '';
                row.insertCell(2).textContent = movimientos.haber > 0 ? ' + formatNumber(movimientos.haber) : '';
                row.insertCell(3).textContent = saldo > 0 ? ' + formatNumber(saldo) : '';
                row.insertCell(4).textContent = saldo < 0 ? ' + formatNumber(Math.abs(saldo)) : '';
                
                row.cells[1].classList.add('money');
                row.cells[2].classList.add('money');
                row.cells[3].classList.add('money');
                row.cells[4].classList.add('money');
                
                totalMovDebe += movimientos.debe;
                totalMovHaber += movimientos.haber;
                if (saldo > 0) totalSaldoDebe += saldo;
                if (saldo < 0) totalSaldoHaber += Math.abs(saldo);
            }
        });
        
        // Agregar fila de totales
        const totalRow = tbody.insertRow();
        totalRow.classList.add('total-row');
        totalRow.insertCell(0).textContent = 'SUMA IGUALES';
        totalRow.insertCell(1).textContent = ' + formatNumber(totalMovDebe);
        totalRow.insertCell(2).textContent = ' + formatNumber(totalMovHaber);
        totalRow.insertCell(3).textContent = ' + formatNumber(totalSaldoDebe);
        totalRow.insertCell(4).textContent = ' + formatNumber(totalSaldoHaber);
        
        totalRow.cells[1].classList.add('money');
        totalRow.cells[2].classList.add('money');
        totalRow.cells[3].classList.add('money');
        totalRow.cells[4].classList.add('money');
    } catch (error) {
        console.error('Error generando balanza de comprobación:', error);
        mostrarAlerta('error', 'Error cargando balanza de comprobación');
    }
}

// Funciones auxiliares
function calcularSaldos() {
    const saldos = {};
    
    movimientos.forEach(mov => {
        mov.cuentas.forEach(cuenta => {
            if (!saldos[cuenta.cuenta]) {
                saldos[cuenta.cuenta] = 0;
            }
            saldos[cuenta.cuenta] += cuenta.debe - cuenta.haber;
        });
    });
    
    return saldos;
}

function obtenerTodasLasCuentas() {
    const cuentas = new Set();
    
    movimientos.forEach(mov => {
        mov.cuentas.forEach(cuenta => {
            cuentas.add(cuenta.cuenta);
        });
    });
    
    return Array.from(cuentas).sort();
}

function formatNumber(num) {
    return num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '            const tbody = document.createElement('tbody');
            mov.cuentas.forEach(cuenta => {
                ,');
}

// Funciones de carga de datos
async function cargarDatos() {
    try {
        const response = await fetch(`${API_BASE}/movimientos`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Error cargando movimientos');
        }
        
        movimientos = await response.json();
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarAlerta('error', 'Error cargando datos del servidor');
    }
}