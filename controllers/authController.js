const jwt = require('jsonwebtoken');

class AuthController {
    constructor(authModel) {
        this.authModel = authModel;
    }

    // Registrar nuevo usuario
    async register(req, res) {
        try {
            const { username, password, nombre, apellidos, email, rol } = req.body;

            // Validaciones básicas
            if (!username || !password || !nombre || !apellidos || !email) {
                return res.status(400).json({ 
                    error: 'Todos los campos son obligatorios' 
                });
            }

            if (password.length < 6) {
                return res.status(400).json({ 
                    error: 'La contraseña debe tener al menos 6 caracteres' 
                });
            }

            const user = await this.authModel.createUser({
                username,
                password,
                nombre,
                apellidos,
                email,
                rol: rol || 'usuario'
            });

            res.status(201).json({
                message: 'Usuario creado exitosamente',
                user: {
                    id: user.id,
                    username: user.username,
                    nombre: user.nombre,
                    apellidos: user.apellidos,
                    email: user.email,
                    rol: user.rol
                }
            });
        } catch (error) {
            console.error('Error en registro:', error);
            if (error.message === 'El usuario ya existe' || error.message === 'El email ya está registrado') {
                res.status(409).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        }
    }

    // Iniciar sesión
    async login(req, res) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ 
                    error: 'Usuario y contraseña son obligatorios' 
                });
            }

            const user = await this.authModel.findUserByUsername(username);
            if (!user) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            const validPassword = await this.authModel.validatePassword(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            // Generar token JWT
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username, 
                    rol: user.rol 
                },
                process.env.JWT_SECRET || 'secret_key',
                { expiresIn: '24h' }
            );

            // Calcular fecha de expiración
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            // Guardar sesión en la base de datos
            await this.authModel.saveSession(user.id, token, expiresAt);

            // Limpiar sesiones expiradas
            await this.authModel.cleanExpiredSessions();

            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    nombre: user.nombre,
                    apellidos: user.apellidos,
                    email: user.email,
                    rol: user.rol
                }
            });
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // Cerrar sesión
    async logout(req, res) {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token) {
                await this.authModel.closeSession(token);
            }
            res.json({ message: 'Sesión cerrada exitosamente' });
        } catch (error) {
            console.error('Error en logout:', error);
            res.status(500).json({ error: 'Error cerrando sesión' });
        }
    }

    // Verificar token
    async verifyToken(req, res) {
        try {
            const user = await this.authModel.findUserById(req.user.id);
            if (!user) {
                return res.status(401).json({ error: 'Usuario no encontrado' });
            }

            res.json({
                user: {
                    id: user.id,
                    username: user.username,
                    nombre: user.nombre,
                    apellidos: user.apellidos,
                    email: user.email,
                    rol: user.rol
                }
            });
        } catch (error) {
            console.error('Error verificando token:', error);
            res.status(500).json({ error: 'Error verificando token' });
        }
    }

    // Obtener todos los usuarios (solo admin)
    async getAllUsers(req, res) {
        try {
            if (req.user.rol !== 'admin') {
                return res.status(403).json({ error: 'Acceso denegado' });
            }

            const users = await this.authModel.getAllUsers();
            res.json(users);
        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            res.status(500).json({ error: 'Error obteniendo usuarios' });
        }
    }

    // Actualizar usuario
    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const { nombre, apellidos, email, rol, activo } = req.body;

            // Solo admin puede actualizar otros usuarios o cambiar roles
            if (req.user.rol !== 'admin' && (req.user.id != id || rol)) {
                return res.status(403).json({ error: 'Acceso denegado' });
            }

            const updatedUser = await this.authModel.updateUser(id, {
                nombre,
                apellidos,
                email,
                rol: req.user.rol === 'admin' ? rol : undefined,
                activo: req.user.rol === 'admin' ? activo : undefined
            });

            res.json({
                message: 'Usuario actualizado exitosamente',
                user: updatedUser
            });
        } catch (error) {
            console.error('Error actualizando usuario:', error);
            res.status(500).json({ error: 'Error actualizando usuario' });
        }
    }

    // Cambiar contraseña
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ 
                    error: 'Contraseña actual y nueva son obligatorias' 
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ 
                    error: 'La nueva contraseña debe tener al menos 6 caracteres' 
                });
            }

            // Verificar contraseña actual
            const user = await this.authModel.findUserByUsername(req.user.username);
            const validPassword = await this.authModel.validatePassword(currentPassword, user.password);
            
            if (!validPassword) {
                return res.status(401).json({ error: 'Contraseña actual incorrecta' });
            }

            await this.authModel.changePassword(userId, newPassword);
            res.json({ message: 'Contraseña cambiada exitosamente' });
        } catch (error) {
            console.error('Error cambiando contraseña:', error);
            res.status(500).json({ error: 'Error cambiando contraseña' });
        }
    }

    // Eliminar usuario (solo admin)
    async deleteUser(req, res) {
        try {
            const { id } = req.params;

            if (req.user.rol !== 'admin') {
                return res.status(403).json({ error: 'Acceso denegado' });
            }

            if (req.user.id == id) {
                return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
            }

            await this.authModel.deleteUser(id);
            res.json({ message: 'Usuario eliminado exitosamente' });
        } catch (error) {
            console.error('Error eliminando usuario:', error);
            res.status(500).json({ error: 'Error eliminando usuario' });
        }
    }
}

module.exports = AuthController;