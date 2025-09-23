document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  // Verificar si ya está logueado
  if (localStorage.getItem('token')) {
    window.location.href = 'panel.html';
    return;
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      alert('Por favor ingrese usuario y contraseña');
      return;
    }

    // Deshabilitar botón durante la petición
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Iniciando sesión...';
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        // Guardar token y datos del usuario
        localStorage.setItem('token', data.token);
        localStorage.setItem('loggedIn', 'true');
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        // Redireccionar al panel
        window.location.href = 'panel.html';
      } else {
        alert(data.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error de conexión. Por favor intente nuevamente.');
    } finally {
      // Restaurar botón
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
});