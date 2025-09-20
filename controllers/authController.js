class AuthController {
    constructor(authModel) {
        this.authModel = authModel;
    }

    async register(req, res) {
        try {
            const { username, password, nombre, apellidos, email, rol } = req.body;

            // Validaciones básicas
            if (!username || !password || !nombre || !apellidos || !email) {
                return res.status(400).json({ 
                    error: 'Todos los campos son obligatorios' 
                });
            }

            // Verificar si el usuario ya existe
            const existingUser = await this.authModel.findUserByUsername(username);
            if (existingUser) {
                return res.status(409).json({ 
                    error: 'El nombre de usuario ya existe' 
                });
            }

            // Crear usuario
            const user = await this.authModel.createUser({
                username, password, nombre, apellidos, email, rol
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
            if (error.code === 'ER_DUP_ENTRY') {
                res.status(409).json({ error: 'El usuario o email ya existe' });
            } else {
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        }
    }

    async login(req, res) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ 
                    error: 'Usuario y contraseña son obligatorios' 
                });
            }

            // Buscar usuario
            const user = await this.authModel.findUserByUsername(username);
            if (!user) {
                return res.status(401).json({ 
                    error: 'Credenciales inválidas' 
                });
            }

            // Validar contraseña
            const isValidPassword = await this.authModel.validatePassword(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ 
                    error: 'Credenciales inválidas' 
                });
            }

            // Generar token
            const token = this.authModel.generateToken(user);

            // Guardar sesión
            await this.authModel.saveSession(user.id, token);

            res.json({
                message: 'Login exitoso',
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

    async logout(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (token && req.user) {
                await this.authModel.deleteSession(req.user.id, token);
            }

            res.json({ message: 'Logout exitoso' });
        } catch (error) {
            console.error('Error en logout:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    async verify(req, res) {
        try {
            // El middleware de autenticación ya validó el token
            const user = await this.authModel.findUserById(req.user.id);
            
            if (!user) {
                return res.status(401).json({ error: 'Usuario no encontrado' });
            }

            res.json({
                valid: true,
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
            res.status(401).json({ error: 'Token inválido' });
        }
    }

    async getUsers(req, res) {
        try {
            const users = await this.authModel.getAllUsers();
            res.json(users);
        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            res.status(500).json({ error: 'Error obteniendo usuarios' });
        }
    }

    async toggleUser(req, res) {
        try {
            const { id } = req.params;
            const result = await this.authModel.toggleUserStatus(id);
            res.json(result);
        } catch (error) {
            console.error('Error cambiando estado del usuario:', error);
            res.status(500).json({ error: 'Error cambiando estado del usuario' });
        }
    }
}

module.exports = AuthController;