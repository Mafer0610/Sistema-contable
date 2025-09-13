// Variables globales
let currentUser = null;
let authToken = null;
let cuentas = [];
let movimientos = [];
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
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        fechaInput.valueAsDate = new Date();
    }
    
    // Verificar autenticación
    verificarAutenticacion();
    
    // Event listeners
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    // Formulario de movimientos
    document.getElementById('movimientoForm')?.addEventListener('submit', registrarMovimiento);
    
    // Formulario de nueva cuenta
    document.getElementById('nuevaCuentaForm')?.addEventListener('submit', crearCuenta);
    
    // Calcular balance en tiempo real
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('debe-input') || e.target.classList.contains('haber-input')) {
            calcularBalance();
        }
    });
}

// Verificar autenticación
async function verificarAutenticacion() {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (!token) {
        window.location.href = '/login';
        return;
    }
    
    authToken = token;
    currentUser = userData ? JSON.parse(userData) : null;
    
    try {
        const response = await fetch(`${API_BASE}/auth/verify`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            localStorage.setItem('user_data', JSON.stringify(currentUser));
            
            // Mostrar información del usuario
            document.getElementById('userName').textContent = 
                `👤 ${currentUser.nombre} ${currentUser.apellidos} (${currentUser.rol})`;
            
            // Mostrar/ocultar elementos según el rol
            configurarInterfazPorRol();
            
            // Cargar datos iniciales
            await cargarDatosIniciales();
            
        } else {
            throw new Error('Token inválido');
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/login';
    }
}

// Configurar interfaz según el rol del usuario
function configurarInterfazPorRol() {
    const adminElements = document.querySelectorAll('.admin-only');
    const contadorElements = document.querySelectorAll('.contador-only');
    
    if (currentUser.rol === 'admin') {
        adminElements.forEach(el => el.style.display = '');
        contadorElements.forEach(el => el.style.display = '');
    } else if (currentUser.rol === 'contador') {
        adminElements.forEach(el => el.style.display = 'none');
        contadorElements.forEach(el => el.style.display = '');
    } else {
        adminElements.forEach(el => el.style.display = 'none');
        contadorElements.forEach(el => el.style.display = 'none');
    }
}

// Función de logout
function logout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: getAuthHeaders()
        }).finally(() => {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            window.location.href = '/login';
        });
    }
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
    const section = document.getElementById(sectionName);
    const button = event.target;
    
    if (section && button) {
        section.classList.add('active');
        button.classList.add('active');
        
        // Cargar datos específicos según la sección
        switch (sectionName) {
            case 'dashboard':
                actualizarDashboard();
                break;
            case 'cuentas':
                cargarCuentas();
                break;
            case 'balance':
                generarBalanceGeneral();
                break;
            case 'balanza':
                generarBalanzaComprobacion();
                break;
            case 'diario':
                generarLibroDiario();
                break;
            case 'mayor':
                generarLibroMayor();
                break;
            case 'usuarios':
                if (currentUser.rol === 'admin') {
                    cargarUsuarios();
                }
                break;
        }
    }
}

// Cargar datos iniciales
async function cargarDatosIniciales() {
    try {
        await Promise.all([
            cargarCuentas(),
            cargarMovimientos()
        ]);
        
        actualizarDashboard();
        actualizarFechas();
        
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        mostrarAlerta('error', 'Error cargando datos iniciales');
    }
}

// Cargar catálogo de cuentas
async function cargarCuentas() {
    try {
        const response = await fetch(`${API_BASE}/cuentas`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error cargando cuentas');
        
        cuentas = await response.json();
        
        // Actualizar select de cuentas
        actualizarSelectCuentas();
        
        // Actualizar tabla de cuentas
        actualizarTablaCuentas();
        
    } catch (error) {
        console.error('Error cargando cuentas:', error);
        mostrarAlerta('error', 'Error cargando catálogo de cuentas');
    }
}

// Actualizar select de cuentas en el formulario de movimientos
function actualizarSelectCuentas() {
    const selects = document.querySelectorAll('.cuenta-select');
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Seleccionar cuenta</option>';
        
        cuentas.forEach(cuenta => {
            const option = document.createElement('option');
            option.value = cuenta.id;
            option.textContent = `${cuenta.codigo} - ${cuenta.nombre}`;
            option.dataset.naturaleza = cuenta.naturaleza;
            select.appendChild(option);
        });
        
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// Actualizar tabla de cuentas
function actualizarTablaCuentas() {
    const tbody = document.getElementById('cuentasBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    cuentas.forEach(cuenta => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = cuenta.codigo;
        row.insertCell(1).textContent = cuenta.nombre;
        row.insertCell(2).textContent = cuenta.tipo;
        row.insertCell(3).textContent = cuenta.subtipo || '-';
        row.insertCell(4).textContent = cuenta.naturaleza;
        
        if (currentUser.rol === 'admin' || currentUser.rol === 'contador') {
            const actionsCell = row.insertCell(5);
            actionsCell.className = 'contador-only';
            actionsCell.innerHTML = `
                <button class="btn btn-sm btn-warning" onclick="editarCuenta(${cuenta.id})">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="eliminarCuenta(${cuenta.id})">🗑️</button>
            `;
        }
    });
}

// Cargar movimientos
async function cargarMovimientos() {
    try {
        const response = await fetch(`${API_BASE}/movimientos`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error cargando movimientos');
        
        movimientos = await response.json();
        
    } catch (error) {
        console.error('Error cargando movimientos:', error);
        mostrarAlerta('error', 'Error cargando movimientos');
    }
}

// Actualizar dashboard
async function actualizarDashboard() {
    try {
        const response = await fetch(`${API_BASE}/saldos`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error obteniendo saldos');
        
        const saldos = await response.json();
        
        let totalActivos = 0;
        let totalPasivos = 0;
        let totalCapital = 0;
        
        saldos.forEach(cuenta => {
            const saldo = cuenta.saldo;
            
            switch (cuenta.tipo) {
                case 'Activo':
                    if (saldo > 0) totalActivos += saldo;
                    break;
                case 'Pasivo':
                    if (saldo < 0) totalPasivos += Math.abs(saldo);
                    break;
                case 'Capital':
                    if (saldo !== 0) totalCapital += Math.abs(saldo);
                    break;
            }
        });
        
        document.getElementById('totalActivos').textContent = formatMoney(totalActivos);
        document.getElementById('totalPasivos').textContent = formatMoney(totalPasivos);
        document.getElementById('totalCapital').textContent = formatMoney(totalCapital);
        document.getElementById('totalMovimientos').textContent = movimientos.length;
        
        // Mostrar movimientos recientes
        mostrarMovimientosRecientes();
        
    } catch (error) {
        console.error('Error actualizando dashboard:', error);
    }
}

// Mostrar movimientos recientes en el dashboard
function mostrarMovimientosRecientes() {
    const container = document.getElementById('recentMovementsList');
    if (!container) return;
    
    const recientes = movimientos.slice(0, 5);
    
    if (recientes.length === 0) {
        container.innerHTML = '<p class="no-data">No hay movimientos registrados</p>';
        return;
    }
    
    container.innerHTML = recientes.map(mov => `
        <div class="recent-movement-item">
            <div class="movement-header">
                <strong>Asiento #${mov.numero_asiento}</strong>
                <span class="movement-date">${formatDate(mov.fecha)}</span>
            </div>
            <div class="movement-concept">${mov.concepto}</div>
            <div class="movement-amount">${formatNumber(mov.totalDebe)}</div>
        </div>
    `).join('');
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
    actualizarSelectCuentas();
    calcularBalance();
}

function quitarCuenta() {
    const container = document.getElementById('cuentasContainer');
    if (container.children.length > 1) {
        container.removeChild(container.lastElementChild);
        calcularBalance();
    }
}

// Calcular balance en tiempo real
function calcularBalance() {
    let totalDebe = 0;
    let totalHaber = 0;
    
    document.querySelectorAll('.debe-input').forEach(input => {
        totalDebe += parseFloat(input.value) || 0;
    });
    
    document.querySelectorAll('.haber-input').forEach(input => {
        totalHaber += parseFloat(input.value) || 0;
    });
    
    const diferencia = totalDebe - totalHaber;
    const balanceInfo = document.getElementById('balanceInfo');
    
    if (balanceInfo) {
        balanceInfo.innerHTML = `
            Debe: ${formatNumber(totalDebe)} | 
            Haber: ${formatNumber(totalHaber)} | 
            Diferencia: <span class="${diferencia === 0 ? 'balanced' : 'unbalanced'}">${formatNumber(Math.abs(diferencia))}</span>
        `;
    }
}

// Registrar movimiento
async function registrarMovimiento(e) {
    e.preventDefault();
    
    const fecha = document.getElementById('fecha').value;
    const concepto = document.getElementById('concepto').value;
    const referencia = document.getElementById('referencia').value;
    const cuentasRows = document.querySelectorAll('.cuenta-row');
    
    const cuentasData = [];
    let totalDebe = 0;
    let totalHaber = 0;
    
    cuentasRows.forEach(row => {
        const cuentaId = parseInt(row.querySelector('.cuenta-select').value);
        const debe = parseFloat(row.querySelector('.debe-input').value) || 0;
        const haber = parseFloat(row.querySelector('.haber-input').value) || 0;
        
        if (cuentaId && (debe > 0 || haber > 0)) {
            cuentasData.push({ cuenta_id: cuentaId, debe, haber });
            totalDebe += debe;
            totalHaber += haber;
        }
    });
    
    // Validaciones
    if (Math.abs(totalDebe - totalHaber) > 0.01) {
        mostrarAlerta('movimientosAlert', 'error', 'El asiento debe estar balanceado');
        return;
    }
    
    if (cuentasData.length < 2) {
        mostrarAlerta('movimientosAlert', 'error', 'Debe agregar al menos 2 cuentas');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/movimientos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                fecha,
                concepto,
                referencia,
                cuentas: cuentasData
            })
        });

        const data = await response.json();

        if (response.ok) {
            mostrarAlerta('movimientosAlert', 'success', 'Movimiento registrado correctamente');
            
            // Limpiar formulario
            document.getElementById('movimientoForm').reset();
            document.getElementById('fecha').valueAsDate = new Date();
            
            // Limpiar cuentas adicionales
            const container = document.getElementById('cuentasContainer');
            while (container.children.length > 1) {
                container.removeChild(container.lastElementChild);
            }
            
            calcularBalance();
            
            // Recargar datos
            await cargarMovimientos();
            actualizarDashboard();
        } else {
            mostrarAlerta('movimientosAlert', 'error', data.error || 'Error registrando movimiento');
        }
    } catch (error) {
        console.error('Error registrando movimiento:', error);
        mostrarAlerta('movimientosAlert', 'error', 'Error de conexión con el servidor');
    }
}

// Modal de nueva cuenta
function showCuentaModal() {
    document.getElementById('cuentaModal').style.display = 'block';
}

function closeCuentaModal() {
    document.getElementById('cuentaModal').style.display = 'none';
    document.getElementById('nuevaCuentaForm').reset();
}

// Crear nueva cuenta
async function crearCuenta(e) {
    e.preventDefault();
    
    const codigo = document.getElementById('modalCodigo').value.trim();
    const nombre = document.getElementById('modalNombre').value.trim();
    const tipo = document.getElementById('modalTipo').value;
    const naturaleza = document.getElementById('modalNaturaleza').value;
    const subtipo = document.getElementById('modalSubtipo').value.trim();
    
    try {
        const response = await fetch(`${API_BASE}/cuentas`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                codigo,
                nombre,
                tipo,
                subtipo: subtipo || null,
                naturaleza
            })
        });

        const data = await response.json();

        if (response.ok) {
            mostrarAlerta('cuentaModalAlert', 'success', 'Cuenta creada correctamente');
            setTimeout(() => {
                closeCuentaModal();
                cargarCuentas();
            }, 1000);
        } else {
            mostrarAlerta('cuentaModalAlert', 'error', data.error || 'Error creando cuenta');
        }
    } catch (error) {
        console.error('Error creando cuenta:', error);
        mostrarAlerta('cuentaModalAlert', 'error', 'Error de conexión con el servidor');
    }
}

// Generar Balance General
async function generarBalanceGeneral() {
    try {
        const response = await fetch(`${API_BASE}/balance-general`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error obteniendo balance general');
        
        const balance = await response.json();
        const tbody = document.getElementById('balanceBody');
        tbody.innerHTML = '';
        
        const maxRows = Math.max(
            balance.activo.circulante.length + balance.activo.fijo.length,
            balance.pasivo.corto_plazo.length + balance.pasivo.largo_plazo.length,
            balance.capital.cuentas.length
        );
        
        let activoIndex = 0;
        let pasivoIndex = 0;
        let capitalIndex = 0;
        
        const activoItems = [...balance.activo.circulante, ...balance.activo.fijo];
        const pasivoItems = [...balance.pasivo.corto_plazo, ...balance.pasivo.largo_plazo];
        const capitalItems = balance.capital.cuentas;
        
        for (let i = 0; i < maxRows; i++) {
            const row = tbody.insertRow();
            
            // Activo
            if (activoIndex < activoItems.length) {
                const item = activoItems[activoIndex];
                row.insertCell(0).textContent = item.nombre;
                row.insertCell(1).textContent = formatMoney(item.saldo);
                activoIndex++;
            } else {
                row.insertCell(0).textContent = '';
                row.insertCell(1).textContent = '';
            }
            
            // Pasivo
            if (pasivoIndex < pasivoItems.length) {
                const item = pasivoItems[pasivoIndex];
                row.insertCell(2).textContent = item.nombre;
                row.insertCell(3).textContent = formatMoney(item.saldo);
                pasivoIndex++;
            } else {
                row.insertCell(2).textContent = '';
                row.insertCell(3).textContent = '';
            }
            
            // Capital
            if (capitalIndex < capitalItems.length) {
                const item = capitalItems[capitalIndex];
                row.insertCell(4).textContent = item.nombre;
                row.insertCell(5).textContent = formatMoney(item.saldo);
                capitalIndex++;
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
        totalRow.insertCell(0).innerHTML = '<strong>Total activos</strong>';
        totalRow.insertCell(1).innerHTML = '<strong>' + formatMoney(balance.activo.total) + '</strong>';
        totalRow.insertCell(2).innerHTML = '<strong>Total pasivo</strong>';
        totalRow.insertCell(3).innerHTML = '<strong>' + formatMoney(balance.pasivo.total) + '</strong>';
        totalRow.insertCell(4).innerHTML = '<strong>Total capital</strong>';
        totalRow.insertCell(5).innerHTML = '<strong>' + formatMoney(balance.capital.total) + '</strong>';
        
        totalRow.cells.forEach(cell => cell.classList.add('money'));
        
    } catch (error) {
        console.error('Error generando balance general:', error);
        mostrarAlerta('error', 'Error cargando balance general');
    }
}

// Generar Balanza de Comprobación
async function generarBalanzaComprobacion() {
    try {
        const response = await fetch(`${API_BASE}/balanza-comprobacion`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error obteniendo balanza de comprobación');
        
        const balanza = await response.json();
        const tbody = document.getElementById('balanzaBody');
        tbody.innerHTML = '';
        
        let totalMovDebe = 0, totalMovHaber = 0, totalSaldoDebe = 0, totalSaldoHaber = 0;
        
        balanza.forEach(cuenta => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = `${cuenta.codigo} - ${cuenta.nombre}`;
            row.insertCell(1).textContent = cuenta.movimiento_debe > 0 ? formatMoney(cuenta.movimiento_debe) : '';
            row.insertCell(2).textContent = cuenta.movimiento_haber > 0 ? formatMoney(cuenta.movimiento_haber) : '';
            row.insertCell(3).textContent = cuenta.saldo > 0 ? formatMoney(cuenta.saldo) : '';
            row.insertCell(4).textContent = cuenta.saldo < 0 ? formatMoney(Math.abs(cuenta.saldo)) : '';
            
            row.cells.forEach((cell, index) => {
                if (index > 0) cell.classList.add('money');
            });
            
            totalMovDebe += cuenta.movimiento_debe;
            totalMovHaber += cuenta.movimiento_haber;
            if (cuenta.saldo > 0) totalSaldoDebe += cuenta.saldo;
            if (cuenta.saldo < 0) totalSaldoHaber += Math.abs(cuenta.saldo);
        });
        
        // Agregar fila de totales
        const totalRow = tbody.insertRow();
        totalRow.classList.add('total-row');
        totalRow.insertCell(0).innerHTML = '<strong>SUMA IGUALES</strong>';
        totalRow.insertCell(1).innerHTML = '<strong>' + formatMoney(totalMovDebe) + '</strong>';
        totalRow.insertCell(2).innerHTML = '<strong>' + formatMoney(totalMovHaber) + '</strong>';
        totalRow.insertCell(3).innerHTML = '<strong>' + formatMoney(totalSaldoDebe) + '</strong>';
        totalRow.insertCell(4).innerHTML = '<strong>' + formatMoney(totalSaldoHaber) + '</strong>';
        
        totalRow.cells.forEach((cell, index) => {
            if (index > 0) cell.classList.add('money');
        });
        
    } catch (error) {
        console.error('Error generando balanza de comprobación:', error);
        mostrarAlerta('error', 'Error cargando balanza de comprobación');
    }
}

// Generar Libro Diario
function generarLibroDiario() {
    const container = document.getElementById('diarioContent');
    container.innerHTML = '';
    
    movimientos.forEach((mov) => {
        const entry = document.createElement('div');
        entry.className = 'diario-entry';
        
        const header = document.createElement('div');
        header.className = 'diario-header';
        header.textContent = `${formatDate(mov.fecha)} - ${mov.concepto} - Asiento #${mov.numero_asiento}`;
        entry.appendChild(header);
        
        const details = document.createElement('div');
        details.className = 'diario-details';
        
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>CUENTA</th>
                    <th>DEBE</th>
                    <th>HABER</th>
                </tr>
            </thead>
        `;
        
        const tbody = document.createElement('tbody');
        mov.cuentas.forEach(cuenta => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = `${cuenta.codigo} - ${cuenta.nombre}`;
            row.insertCell(1).textContent = cuenta.debe > 0 ? formatMoney(cuenta.debe) : '';
            row.insertCell(2).textContent = cuenta.haber > 0 ? formatMoney(cuenta.haber) : '';
            
            row.cells[1].classList.add('debe-column');
            row.cells[2].classList.add('haber-column');
        });
        
        table.appendChild(tbody);
        details.appendChild(table);
        entry.appendChild(details);
        container.appendChild(entry);
    });
}

// Generar Libro Mayor
async function generarLibroMayor() {
    try {
        const response = await fetch(`${API_BASE}/libro-mayor`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error obteniendo libro mayor');
        
        const mayorData = await response.json();
        const container = document.getElementById('mayorContent');
        container.innerHTML = '';
        
        // Agrupar por cuenta
        const cuentasAgrupadas = {};
        mayorData.forEach(item => {
            const key = `${item.codigo} - ${item.cuenta_nombre}`;
            if (!cuentasAgrupadas[key]) {
                cuentasAgrupadas[key] = [];
            }
            cuentasAgrupadas[key].push(item);
        });
        
        // Generar tabla para cada cuenta
        Object.keys(cuentasAgrupadas).forEach(cuenta => {
            const movimientosCuenta = cuentasAgrupadas[cuenta];
            
            const cuentaDiv = document.createElement('div');
            cuentaDiv.className = 'mayor-cuenta';
            
            const header = document.createElement('div');
            header.className = 'mayor-header';
            header.textContent = cuenta;
            cuentaDiv.appendChild(header);
            
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
            let saldoAcumulado = 0;
            
            movimientosCuenta.forEach(mov => {
                saldoAcumulado += mov.debe - mov.haber;
                
                const row = tbody.insertRow();
                row.insertCell(0).textContent = formatDate(mov.fecha);
                row.insertCell(1).textContent = mov.concepto;
                row.insertCell(2).textContent = mov.debe > 0 ? formatMoney(mov.debe) : '';
                row.insertCell(3).textContent = mov.haber > 0 ? formatMoney(mov.haber) : '';
                row.insertCell(4).textContent = formatMoney(Math.abs(saldoAcumulado));
                
                row.cells[2].classList.add('debe-column');
                row.cells[3].classList.add('haber-column');
                row.cells[4].classList.add('money');
            });
            
            table.appendChild(tbody);
            cuentaDiv.appendChild(table);
            container.appendChild(cuentaDiv);
        });
        
    } catch (error) {
        console.error('Error generando libro mayor:', error);
        mostrarAlerta('error', 'Error cargando libro mayor');
    }
}

// Funciones auxiliares
function mostrarAlerta(containerId, tipo, mensaje) {
    const alertContainer = typeof containerId === 'string' ? document.getElementById(containerId) : document.getElementById('alert');
    if (!alertContainer) return;
    
    alertContainer.className = `alert ${tipo}`;
    alertContainer.textContent = mensaje;
    alertContainer.style.display = 'block';
    
    setTimeout(() => {
        alertContainer.style.display = 'none';
    }, 5000);
}

function formatMoney(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
}

function formatNumber(num) {
    return new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('es-MX');
}

function actualizarFechas() {
    const hoy = new Date();
    const fechaTexto = hoy.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const balanceDate = document.getElementById('balanceDate');
    const balanzaDate = document.getElementById('balanzaDate');
    
    if (balanceDate) balanceDate.textContent = `al ${fechaTexto}`;
    if (balanzaDate) balanzaDate.textContent = `al ${fechaTexto}`;
}getElementById('fecha');
    if (fechaInput) {
        fechaInput.valueAsDate = new Date();
    }
    
    // Verificar autenticación
    verificarAutenticacion();
});

// Verificar autenticación
async function verificarAutenticacion() {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (!token) {
        window.location.href = '/login';
        return;
    }
    
    authToken = token;
    currentUser = userData ? JSON.parse(userData) : null;
    
    try {
        const response = await fetch(`${API_BASE}/auth/verify`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            localStorage.setItem('user_data', JSON.stringify(currentUser));
            
            // Mostrar información del usuario
            document.getElementById('userName').textContent = 
                `👤 ${currentUser.nombre} ${currentUser.apellidos} (${currentUser.rol})`;
            
            // Mostrar/ocultar elementos según el rol
            configurarInterfazPorRol();
            
            // Cargar datos iniciales
            await cargarDatosIniciales();
            
        } else {
            throw new Error('Token inválido');
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/login';
    }
}

// Configurar interfaz según el rol del usuario
function configurarInterfazPorRol() {
    const adminElements = document.querySelectorAll('.admin-only');
    const contadorElements = document.querySelectorAll('.contador-only');
    
    if (currentUser.rol === 'admin') {
        adminElements.forEach(el => el.style.display = '');
        contadorElements.forEach(el => el.style.display = '');
    } else if (currentUser.rol === 'contador') {
        adminElements.forEach(el => el.style.display = 'none');
        contadorElements.forEach(el => el.style.display = '');
    } else {
        adminElements.forEach(el => el.style.display = 'none');
        contadorElements.forEach(el => el.style.display = 'none');
    }
}

// Función de logout
function logout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: getAuthHeaders()
        }).finally(() => {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            window.location.href = '/login';
        });
    }
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
    const section = document.getElementById(sectionName);
    const button = event.target;
    
    if (section && button) {
        section.classList.add('active');
        button.classList.add('active');
        
        // Cargar datos específicos según la sección
        switch (sectionName) {
            case 'dashboard':
                actualizarDashboard();
                break;
            case 'cuentas':
                cargarCuentas();
                break;
            case 'balance':
                generarBalanceGeneral();
                break;
            case 'balanza':
                generarBalanzaComprobacion();
                break;
            case 'diario':
                generarLibroDiario();
                break;
            case 'mayor':
                generarLibroMayor();
                break;
            case 'usuarios':
                if (currentUser.rol === 'admin') {
                    cargarUsuarios();
                }
                break;
        }
    }
}

// Cargar datos iniciales
async function cargarDatosIniciales() {
    try {
        await Promise.all([
            cargarCuentas(),
            cargarMovimientos()
        ]);
        
        actualizarDashboard();
        actualizarFechas();
        
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        mostrarAlerta('error', 'Error cargando datos iniciales');
    }
}

// Cargar catálogo de cuentas
async function cargarCuentas() {
    try {
        const response = await fetch(`${API_BASE}/cuentas`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error cargando cuentas');
        
        cuentas = await response.json();
        
        // Actualizar select de cuentas
        actualizarSelectCuentas();
        
        // Actualizar tabla de cuentas
        actualizarTablaCuentas();
        
    } catch (error) {
        console.error('Error cargando cuentas:', error);
        mostrarAlerta('error', 'Error cargando catálogo de cuentas');
    }
}

// Actualizar select de cuentas en el formulario de movimientos
function actualizarSelectCuentas() {
    const selects = document.querySelectorAll('.cuenta-select');
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Seleccionar cuenta</option>';
        
        cuentas.forEach(cuenta => {
            const option = document.createElement('option');
            option.value = cuenta.id;
            option.textContent = `${cuenta.codigo} - ${cuenta.nombre}`;
            option.dataset.naturaleza = cuenta.naturaleza;
            select.appendChild(option);
        });
        
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// Actualizar tabla de cuentas
function actualizarTablaCuentas() {
    const tbody = document.getElementById('cuentasBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    cuentas.forEach(cuenta => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = cuenta.codigo;
        row.insertCell(1).textContent = cuenta.nombre;
        row.insertCell(2).textContent = cuenta.tipo;
        row.insertCell(3).textContent = cuenta.subtipo || '-';
        row.insertCell(4).textContent = cuenta.naturaleza;
        
        if (currentUser.rol === 'admin' || currentUser.rol === 'contador') {
            const actionsCell = row.insertCell(5);
            actionsCell.className = 'contador-only';
            actionsCell.innerHTML = `
                <button class="btn btn-sm btn-warning" onclick="editarCuenta(${cuenta.id})">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="eliminarCuenta(${cuenta.id})">🗑️</button>
            `;
        }
    });
}

// Cargar movimientos
async function cargarMovimientos() {
    try {
        const response = await fetch(`${API_BASE}/movimientos`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error cargando movimientos');
        
        movimientos = await response.json();
        
    } catch (error) {
        console.error('Error cargando movimientos:', error);
        mostrarAlerta('error', 'Error cargando movimientos');
    }
}

// Actualizar dashboard
async function actualizarDashboard() {
    try {
        const response = await fetch(`${API_BASE}/saldos`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error obteniendo saldos');
        
        const saldos = await response.json();
        
        let totalActivos = 0;
        let totalPasivos = 0;
        let totalCapital = 0;
        
        saldos.forEach(cuenta => {
            const saldo = cuenta.saldo;
            
            switch (cuenta.tipo) {
                case 'Activo':
                    if (saldo > 0) totalActivos += saldo;
                    break;
                case 'Pasivo':
                    if (saldo < 0) totalPasivos += Math.abs(saldo);
                    break;
                case 'Capital':
                    if (saldo !== 0) totalCapital += Math.abs(saldo);
                    break;
            }
        });
        
        document.getElementById('totalActivos').textContent = formatMoney(totalActivos);
        document.getElementById('totalPasivos').textContent = formatMoney(totalPasivos);
        document.getElementById('totalCapital').textContent = formatMoney(totalCapital);
        document.getElementById('totalMovimientos').textContent = movimientos.length;
        
        // Most