document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    // Credenciales válidas (puedes cambiar estas)
    const usuarioValido = 'admin';
    const contraseñaValida = '123';

    if (username === usuarioValido && password === contraseñaValida) {
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('currentUser', username);
      window.location.href = 'panel.html';
    } else {
      alert('Usuario o contraseña incorrectos.');
    }
  });
});