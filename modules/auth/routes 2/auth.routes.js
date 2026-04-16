import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import User from '../models/user.js';

const router = express.Router();
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
});

// Passport Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.AUTH_URL || 'http://localhost:3001'}/auth/google/callback`,
    scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
            user = await User.create({
                googleId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                picture: profile.photos[0]?.value,
                lastLoginAt: new Date()
            });
        } else {
            user.lastLoginAt = new Date();
            await user.save();
        }
        
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

/**
 * Инициировать Google OAuth
 */
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
}));

/**
 * Callback Google OAuth
 */
router.get('/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`,
        session: false
    }),
    async (req, res) => {
        try {
            const user = req.user;
            
            // Генерируем JWT на 24 часа
            const token = jwt.sign(
                { 
                    userId: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            // Сохраняем в Redis
            await redis.setex(
                `token:${user._id}`,
                24 * 60 * 60,
                token
            );
            
            // Перенаправляем на фронтенд
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const userData = encodeURIComponent(JSON.stringify({
                id: user._id,
                name: user.name,
                email: user.email,
                picture: user.picture,
                role: user.role
            }));
            
            res.redirect(`${frontendUrl}/auth/callback?token=${token}&user=${userData}`);
            
        } catch (error) {
            console.error('Auth callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
        }
    }
);

/**
 * Валидация токена
 */
router.get('/validate', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ valid: false, error: 'No token' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const storedToken = await redis.get(`token:${decoded.userId}`);
        
        if (storedToken !== token) {
            return res.status(401).json({ valid: false, error: 'Invalid session' });
        }
        
        const user = await User.findById(decoded.userId).select('-__v');
        
        res.json({
            valid: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                picture: user.picture,
                role: user.role
            },
            expiresIn: decoded.exp - Math.floor(Date.now() / 1000)
        });
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ valid: false, expired: true });
        }
        res.status(401).json({ valid: false, error: 'Invalid token' });
    }
});

/**
 * Обновление токена
 */
router.post('/refresh', async (req, res) => {
    try {
        const oldToken = req.headers.authorization?.split(' ')[1];
        
        if (!oldToken) {
            return res.status(401).json({ error: 'No token' });
        }
        
        const decoded = jwt.decode(oldToken);
        
        if (!decoded?.userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        const storedToken = await redis.get(`token:${decoded.userId}`);
        
        if (storedToken !== oldToken) {
            return res.status(401).json({ error: 'Invalid session' });
        }
        
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const newToken = jwt.sign(
            { 
                userId: user._id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        await redis.setex(`token:${user._id}`, 24 * 60 * 60, newToken);
        
        res.json({ token: newToken });
        
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Refresh failed' });
    }
});

/**
 * Выход из системы
 */
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (token) {
            const decoded = jwt.decode(token);
            if (decoded?.userId) {
                await redis.del(`token:${decoded.userId}`);
            }
        }
        
        res.json({ success: true, message: 'Logged out successfully' });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * Получение информации о текущем пользователе
 */
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-__v');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            picture: user.picture,
            role: user.role,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt
        });
        
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;