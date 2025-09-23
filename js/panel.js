document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });

  // Protege la página si no está logueado
  if (localStorage.getItem('loggedIn') !== 'true') {
    window.location.href = 'login.html';
  }

  // Cargar datos del dashboard
  loadDashboardData();
});

function loadDashboardData() {
  // Cargar movimientos recientes
  const movimientos = JSON.parse(localStorage.getItem('movimientos')) || [];
  
  // Calcular totales
  let totalCompras = 0;
  let totalVentas = 0;

  movimientos.forEach(mov => {
    if (mov.cuenta && mov.cuenta.toLowerCase().includes('compra')) {
      totalCompras += parseFloat(mov.cargo || 0) + parseFloat(mov.abono || 0);
    } else if (mov.cuenta && mov.cuenta.toLowerCase().includes('venta')) {
      totalVentas += parseFloat(mov.cargo || 0) + parseFloat(mov.abono || 0);
    }
  });

  // Actualizar elementos si existen
  const totalComprasEl = document.getElementById('totalCompras');
  const totalVentasEl = document.getElementById('totalVentas');
  const estadoGeneralEl = document.getElementById('estadoGeneral');

  if (totalComprasEl) totalComprasEl.textContent = `$${totalCompras.toFixed(2)}`;
  if (totalVentasEl) totalVentasEl.textContent = `$${totalVentas.toFixed(2)}`;
  
  if (estadoGeneralEl) {
    const balance = totalVentas - totalCompras;
    estadoGeneralEl.textContent = balance >= 0 ? 'Positivo' : 'Negativo';
  }
}