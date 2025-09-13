const jwt = require('jsonwebtoken');

class AuthMiddleware {
    constructor(authModel) {
        this.authModel = authModel;
    }

    // Middleware para verificar token JWT
    authenticateToken() {
        return async (req, res, next) => {
            try {
                const authHeader = req.headers['authorization'];
                const token = authHeader && authHeader.split(' ')[1];

                if (!token) {
                    return res.status(401).json({ error: 'Token de acceso requerido' });
                }

                // Verificar token en la base de datos
                const session = await this.authModel.isValidSession(token);
                if (!session) {
                    return res.status(403).json({ error: 'Token inválido o expirado' });
                }

                // Verificar token JWT
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
                
                req.user = {
                    id: decoded.id,
                    username: decoded.username,
                    rol: decoded.rol
                };
                
                next();
            } catch (error) {
                if (error.name === 'JsonWebTokenError') {
                    return res.status(403).json({ error: 'Token inválido' });
                } else if (error.name === 'TokenExpiredError') {
                    return res.status(403).json({ error: 'Token expirado' });
                } else {
                    console.error('Error en autenticación:', error);
                    return res.status(500).json({ error: 'Error interno del servidor' });
                }
            }
        };
    }

    // Middleware para verificar roles específicos
    requireRole(roles) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Usuario no autenticado' });
            }

            const userRoles = Array.isArray(roles) ? roles : [roles];
            
            if (!userRoles.includes(req.user.rol)) {
                return res.status(403).json({ 
                    error: 'No tienes permisos suficientes para esta acción' 
                });
            }

            next();
        };
    }

    // Middleware solo para admin
    requireAdmin() {
        return this.requireRole('admin');
    }

    // Middleware para contador o admin
    requireContador() {
        return this.requireRole(['admin', 'contador']);
    }

    // Middleware para cualquier usuario autenticado
    requireAuth() {
        return this.authenticateToken();
    }
}

module.exports = AuthMiddleware;