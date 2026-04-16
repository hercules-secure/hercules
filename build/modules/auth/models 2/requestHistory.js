import mongoose from 'mongoose';

const requestHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    method: {
        type: String,
        required: true,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
    },
    path: {
        type: String,
        required: true
    },
    query: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed,
    statusCode: Number,
    responseSize: Number,
    duration: Number,
    ipAddress: String,
    userAgent: String,
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Составной индекс для быстрых запросов
requestHistorySchema.index({ userId: 1, createdAt: -1 });
requestHistorySchema.index({ userId: 1, method: 1 });

export default mongoose.model('RequestHistory', requestHistorySchema);