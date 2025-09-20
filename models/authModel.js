const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthModel {
    constructor(db) {
        this.db = db;
    }

    async createUser(userData) {
        const { username, password, nombre, apellidos, email, rol = 'usuario' } = userData;
        
        try {
            // Encriptar contraseña
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const [result] = await this.db.execute(
                'INSERT INTO usuarios (username, password, nombre, apellidos, email, rol) VALUES (?, ?, ?, ?, ?, ?)',
                [username, hashedPassword, nombre, apellidos, email, rol]
            );
            
            return { id: result.insertId, username, nombre, apellidos, email, rol };
        } catch (error) {
            throw error;
        }
    }

    async findUserByUsername(username) {
        try {
            const [users] = await this.db.execute(
                'SELECT * FROM usuarios WHERE username = ? AND activo = true',
                [username]
            );
            return users.length > 0 ? users[0] : null;
        } catch (error) {
            throw error;
        }
    }

    async findUserById(id) {
        try {
            const [users] = await this.db.execute(
                'SELECT id, username, nombre, apellidos, email, rol, activo FROM usuarios WHERE id = ?',
                [id]
            );
            return users.length > 0 ? users[0] : null;
        } catch (error) {
            throw error;
        }
    }

    async validatePassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    generateToken(user) {
        return jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                rol: user.rol 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return null;
        }
    }

    async saveSession(userId, token) {
        try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            
            await this.db.execute(
                'INSERT INTO sesiones (usuario_id, token, expires_at) VALUES (?, ?, ?)',
                [userId, token, expiresAt]
            );
        } catch (error) {
            console.error('Error guardando sesión:', error);
        }
    }

    async deleteSession(userId, token) {
        try {
            await this.db.execute(
                'DELETE FROM sesiones WHERE usuario_id = ? AND token = ?',
                [userId, token]
            );
        } catch (error) {
            console.error('Error eliminando sesión:', error);
        }
    }

    async getAllUsers() {
        try {
            const [users] = await this.db.execute(
                'SELECT id, username, nombre, apellidos, email, rol, activo, created_at FROM usuarios ORDER BY created_at DESC'
            );
            return users;
        } catch (error) {
            throw error;
        }
    }

    async toggleUserStatus(userId) {
        try {
            await this.db.execute(
                'UPDATE usuarios SET activo = NOT activo WHERE id = ?',
                [userId]
            );
            return { message: 'Estado del usuario actualizado' };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = AuthModel;