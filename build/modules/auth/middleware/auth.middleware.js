import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import User from '../models/user.js';

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => Math.min(times * 50, 2000)
});

/**
 * Middleware проверки JWT токена
 */
export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Токен не предоставлен',
                code: 'NO_TOKEN'
            });
        }
        
        // Проверяем токен
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    error: 'Токен истек',
                    code: 'TOKEN_EXPIRED'
                });
            }
            return res.status(401).json({ 
                error: 'Недействительный токен',
                code: 'INVALID_TOKEN'
            });
        }
        
        // Проверяем токен в Redis (черный список)
        const storedToken = await redis.get(`token:${decoded.userId}`);
        
        if (storedToken !== token) {
            return res.status(401).json({ 
                error: 'Сессия недействительна',
                code: 'INVALID_SESSION'
            });
        }
        
        // Получаем пользователя
        const user = await User.findById(decoded.userId).select('-__v');
        
        if (!user || !user.isActive) {
            return res.status(401).json({ 
                error: 'Пользователь не найден или заблокирован',
                code: 'USER_NOT_FOUND'
            });
        }
        
        req.user = {
            id: user._id,
            email: user.email,
            name: user.name,
            picture: user.picture,
            role: user.role
        };
        
        next();
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Ошибка авторизации' });
    }
};

/**
 * Проверка роли администратора
 */
export const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
    }
    next();
};

/**
 * Проверка роли разработчика
 */
export const requireDeveloper = (req, res, next) => {
    if (!['admin', 'developer'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Доступ запрещен. Требуются права разработчика' });
    }
    next();
};