const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection and topology
const { connectDB, getClusterTopology } = require('./config/db');
const port = process.env.PORT || 8000;

if (process.env.NODE_ENV !== 'test') {
    connectDB().catch(err => {
        console.error('[Database] Failed initial connection attempt:', err.message);
    });
}

// Root & Health check routes
app.get('/', (req, res) => {
    res.status(200).json({
        name: 'Distributed E-Commerce NoSQL API',
        status: 'online',
        endpoints: {
            users: '/api/users',
            products: '/api/products',
            orders: '/api/orders',
            payments: '/api/payments',
            shipping: '/api/shipping',
            discounts: '/api/discounts',
            refunds: '/api/refunds',
            reviews: '/api/reviews',
            analytics: '/api/analytics',
            health: '/api/health'
        }
    });
});

app.get('/api/health', async (req, res) => {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const topology = await getClusterTopology();
    res.status(200).json({
        status: 'UP',
        timestamp: new Date(),
        connectionState: states[mongoose.connection.readyState] || 'unknown',
        topology
    });
});


// Mount Resource Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/shipping', require('./routes/shipping'));
app.use('/api/discounts', require('./routes/discounts'));
app.use('/api/refunds', require('./routes/refunds'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/analytics', require('./routes/analytics'));


// 404 Route Handler
app.use((req, res) => {
    res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('[Server Error]', err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`[Server] Running on http://localhost:${port}`);
    });
}

module.exports = app;