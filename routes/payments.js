const express = require('express');
const router = express.Router();
const Payment = require('../models/payment');

// CREATE a payment
router.post('/', async (req, res) => {
    try {
        const { orderId, userId, amount, currency, paymentMethod, paymentMethods, paymentStatus, transactionId, transactionID } = req.body;

        const newPayment = new Payment({
            orderId,
            userId,
            amount,
            currency: currency || 'ZAR',
            paymentMethod: paymentMethod || paymentMethods,
            paymentStatus: paymentStatus || 'pending',
            transactionId: transactionId || transactionID || `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`
        });

        const savedPayment = await newPayment.save();
        res.status(201).json({ message: 'Payment created successfully', payment: savedPayment });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Backward-compatible alias for POST /payment
router.post('/payment', (req, res, next) => {
    req.url = '/';
    router.handle(req, res, next);
});

// GET ALL payments (with pagination and status filtering)
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.userId) filter.userId = req.query.userId;
        if (req.query.orderId) filter.orderId = req.query.orderId;
        if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

        const [payments, total] = await Promise.all([
            Payment.find(filter)
                .populate('userId', 'name email')
                .populate('orderId', 'total_price status')
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            Payment.countDocuments(filter)
        ]);

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: payments
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve payments' });
    }
});

// GET ONE payment by ID
router.get('/:id', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('orderId', 'total_price status');

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }
        res.status(200).json(payment);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching payment' });
    }
});

// UPDATE a payment by ID
router.put('/:id', async (req, res) => {
    try {
        const { amount, currency, paymentMethod, paymentStatus } = req.body;
        const updateData = {};
        if (amount !== undefined) updateData.amount = amount;
        if (currency) updateData.currency = currency;
        if (paymentMethod) updateData.paymentMethod = paymentMethod;
        if (paymentStatus) updateData.paymentStatus = paymentStatus;

        const updatedPayment = await Payment.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedPayment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        res.status(200).json({ message: 'Payment updated successfully', payment: updatedPayment });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error updating payment' });
    }
});

// DELETE a payment by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedPayment = await Payment.findByIdAndDelete(req.params.id);
        if (!deletedPayment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        res.status(200).json({ message: 'Payment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting the payment' });
    }
});

module.exports = router;

