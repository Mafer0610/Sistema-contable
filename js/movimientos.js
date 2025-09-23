document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('movimientoForm');
  const table = document.getElementById('movimientosTable');

  // Protege la página si no está logueado
  if (localStorage.getItem('loggedIn') !== 'true') {
    window.location.href = 'login.html';
    return;
  }

  // Cargar movimientos del localStorage
  let movimientos = JSON.parse(localStorage.getItem('movimientos')) || [];

  // Función para renderizar los movimientos en la tabla
  function renderMovimientos() {
    if (!table) return;
    
    table.innerHTML = '';
    
    if (movimientos.length === 0) {
      table.innerHTML = '<tr><td colspan="6" class="text-center">No hay movimientos registrados</td></tr>';
      return;
    }

    movimientos.forEach((mov, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${mov.fecha}</td>
        <td>${mov.cuenta}</td>
        <td>$${(mov.cargo || 0).toFixed(2)}</td>
        <td>$${(mov.abono || 0).toFixed(2)}</td>
        <td>
          <button class="btn btn-sm" style="background: #ff6b6b; color: white;" onclick="eliminarMovimiento(${mov.id || index})">
            Eliminar
          </button>
        </td>
      `;
      table.appendChild(row);
    });
  }

  // Event listener para agregar movimiento
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const fecha = document.getElementById('fecha').value;
      const cuenta = document.getElementById('cuenta').value;
      const cargo = parseFloat(document.getElementById('cargo').value) || 0;
      const abono = parseFloat(document.getElementById('abono').value) || 0;

      // Validar que al menos uno de los campos tenga valor
      if (cargo === 0 && abono === 0) {
        alert('Debe ingresar un valor en Cargo o Abono');
        return;
      }

      const nuevoMovimiento = {
        id: Date.now(),
        fecha,
        cuenta,
        cargo,
        abono,
        usuario: localStorage.getItem('currentUser') || 'admin'
      };

      // Guardar el nuevo movimiento en el array
      movimientos.push(nuevoMovimiento);

      // Guardar en el localStorage
      localStorage.setItem('movimientos', JSON.stringify(movimientos));

      // Renderizar de nuevo los movimientos
      renderMovimientos();

      // Limpiar formulario
      form.reset();
      document.getElementById('fecha').valueAsDate = new Date();

      alert('Movimiento guardado exitosamente');
    });
  }

  // Función global para eliminar movimiento
  window.eliminarMovimiento = function(id) {
    if (confirm('¿Está seguro de eliminar este movimiento?')) {
      movimientos = movimientos.filter(mov => (mov.id || movimientos.indexOf(mov)) !== id);
      localStorage.setItem('movimientos', JSON.stringify(movimientos));
      renderMovimientos();
    }
  };

  // Renderizar los movimientos cuando se carga la página
  renderMovimientos();

  // Establecer fecha actual por defecto si existe el campo
  const fechaInput = document.getElementById('fecha');
  if (fechaInput) {
    fechaInput.valueAsDate = new Date();
  }
});