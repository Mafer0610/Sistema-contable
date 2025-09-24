class AuthMiddleware {
    constructor(authModel) {
        this.authModel = authModel;
    }

    verifyToken = async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Token de acceso requerido' });
            }

            const token = authHeader.substring(7);
            const decoded = this.authModel.verifyToken(token);

            if (!decoded) {
                return res.status(401).json({ error: 'Token inválido' });
            }

            // Verificar que el usuario existe y está activo
            const user = await this.authModel.findUserById(decoded.id);
            if (!user || !user.activo) {
                return res.status(401).json({ error: 'Usuario no autorizado' });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('Error en middleware de autenticación:', error);
            res.status(401).json({ error: 'Token inválido' });
        }
    };

    // Método opcional que permite continuar sin autenticación
    optionalAuth = async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                // No hay token, continuar sin usuario
                req.user = null;
                return next();
            }

            const token = authHeader.substring(7);
            const decoded = this.authModel.verifyToken(token);

            if (decoded) {
                const user = await this.authModel.findUserById(decoded.id);
                if (user && user.activo) {
                    req.user = user;
                } else {
                    req.user = null;
                }
            } else {
                req.user = null;
            }

            next();
        } catch (error) {
            console.error('Error en middleware de autenticación opcional:', error);
            req.user = null;
            next();
        }
    };

    requireAuth() {
        return this.verifyToken;
    }

    requireAdmin() {
        return [
            this.verifyToken,
            (req, res, next) => {
                if (req.user.rol !== 'admin') {
                    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
                }
                next();
            }
        ];
    }

    requireContador() {
        return [
            this.verifyToken,
            (req, res, next) => {
                if (req.user.rol !== 'admin' && req.user.rol !== 'contador') {
                    return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de contador o administrador.' });
                }
                next();
            }
        ];
    }
}

module.exports = AuthMiddleware;