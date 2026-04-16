import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true,
        unique: true,
        sparse: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    name: {
        type: String,
        required: true
    },
    picture: String,
    role: {
        type: String,
        enum: ['user', 'admin', 'developer'],
        default: 'user'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLoginAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('User', userSchema);