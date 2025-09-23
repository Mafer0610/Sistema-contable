// login.js - Sistema de autenticación simple
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  console.log('🔍 Sistema de login simple iniciado...');

  // Verificar si ya está logueado
  if (localStorage.getItem('loggedIn') === 'true') {
    console.log('✅ Usuario ya autenticado, redirigiendo...');
    window.location.href = 'panel.html';
    return;
  }

  // Usuarios válidos del sistema
  const usuariosValidos = {
    'admin': {
      password: '12345',
      nombre: 'Administrador',
      apellidos: 'Sistema',
      rol: 'admin'
    }
  };

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    console.log('🔐 Intentando iniciar sesión con:', username);

    // Validaciones básicas
    if (!username || !password) {
      showMessage('Por favor ingrese usuario y contraseña', 'error');
      return;
    }

    // Deshabilitar botón durante validación
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Validando...';
    submitBtn.disabled = true;

    // Simular pequeño delay para parecer más real
    setTimeout(() => {
      // Verificar credenciales
      const usuario = usuariosValidos[username];
      
      if (usuario && usuario.password === password) {
        console.log('✅ Login exitoso para:', username);
        
        // Guardar datos de sesión
        const sessionData = {
          username: username,
          nombre: usuario.nombre,
          apellidos: usuario.apellidos,
          rol: usuario.rol,
          email: usuario.email,
          loginTime: new Date().toISOString()
        };

        localStorage.setItem('loggedIn', 'true');
        localStorage.setItem('currentUser', JSON.stringify(sessionData));
        localStorage.setItem('loginTime', new Date().getTime());

        // Mostrar mensaje de éxito
        showMessage('¡Bienvenido! Redirigiendo...', 'success');
        
        // Redirigir después de un momento
        setTimeout(() => {
          window.location.href = 'panel.html';
        }, 1000);

      } else {
        console.log('❌ Credenciales inválidas');
        showMessage('Usuario o contraseña incorrectos', 'error');
        
        // Limpiar campos
        passwordInput.value = '';
        passwordInput.focus();
      }

      // Restaurar botón
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }, 800);
  });

  // Función para mostrar mensajes
  function showMessage(message, type = 'info') {
    // Remover mensaje anterior si existe
    const existingMessage = document.querySelector('.auth-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    // Crear nuevo mensaje
    const messageDiv = document.createElement('div');
    messageDiv.className = `auth-message alert ${getAlertClass(type)}`;
    messageDiv.style.marginTop = '15px';
    messageDiv.style.borderRadius = '10px';
    messageDiv.style.padding = '10px 15px';
    messageDiv.style.fontSize = '0.9rem';
    messageDiv.textContent = message;

    // Insertar después del formulario
    loginForm.insertAdjacentElement('afterend', messageDiv);

    // Remover después de unos segundos (excepto para éxito)
    if (type !== 'success') {
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 4000);
    }
  }

  // Función para obtener clase de Bootstrap según el tipo
  function getAlertClass(type) {
    switch (type) {
      case 'error': return 'alert-danger';
      case 'success': return 'alert-success';
      case 'warning': return 'alert-warning';
      default: return 'alert-info';
    }
  }

  // Limpiar cualquier dato residual al cargar la página
  function clearAuthData() {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('loginTime');
  }

  // Auto-focus en el campo de usuario
  usernameInput.focus();

  // Permitir login con Enter en cualquier campo
  [usernameInput, passwordInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loginForm.dispatchEvent(new Event('submit'));
      }
    });
  });

  console.log('📋 Usuarios disponibles:');
  console.log('- admin / 12345 (Administrador)');
  console.log('- Ignacio / 12345 (Contador)');
  console.log('- contador / conta123 (Contador)');
  console.log('- usuario / user123 (Usuario General)');
});