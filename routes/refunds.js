const express = require('express');
const router = express.Router();
const Refund = require('../models/refund');

// CREATE a refund request
router.post('/', async (req, res) => {
    try {
        const { orderId, userId, productId, refundAmount, refundReason, notes } = req.body;

        const newRefund = new Refund({
            orderId,
            userId,
            productId,
            refundAmount,
            refundReason,
            notes,
            refundStatus: 'pending',
            requestDate: new Date()
        });

        const savedRefund = await newRefund.save();
        res.status(201).json({ message: 'Refund request created successfully', refund: savedRefund });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Backward-compatible alias for POST /refund
router.post('/refund', (req, res, next) => {
    req.url = '/';
    router.handle(req, res, next);
});

// GET ALL refunds (with pagination, user, order, and status filters)
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.userId) filter.userId = req.query.userId;
        if (req.query.orderId) filter.orderId = req.query.orderId;
        if (req.query.refundStatus) filter.refundStatus = req.query.refundStatus;

        const [refunds, total] = await Promise.all([
            Refund.find(filter)
                .populate('userId', 'name email')
                .populate('orderId', 'total_price status')
                .populate('productId', 'name price')
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            Refund.countDocuments(filter)
        ]);

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: refunds
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve refunds' });
    }
});

// GET ONE refund by ID
router.get('/:id', async (req, res) => {
    try {
        const refund = await Refund.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('orderId', 'total_price status')
            .populate('productId', 'name price');

        if (!refund) {
            return res.status(404).json({ message: 'Refund not found' });
        }
        res.status(200).json(refund);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching refund' });
    }
});

// UPDATE / APPROVE / REJECT a refund by ID
router.put('/:id', async (req, res) => {
    try {
        const { refundStatus, refundAmount, refundReason, notes, processedBy, transactionId } = req.body;
        const updateData = {};
        if (refundStatus) updateData.refundStatus = refundStatus;
        if (refundAmount !== undefined) updateData.refundAmount = refundAmount;
        if (refundReason) updateData.refundReason = refundReason;
        if (notes) updateData.notes = notes;
        if (processedBy) updateData.processedBy = processedBy;
        if (transactionId) updateData.transactionId = transactionId;
        if (refundStatus === 'approved' || refundStatus === 'rejected' || refundStatus === 'processed') {
            updateData.processedDate = new Date();
        }

        const updatedRefund = await Refund.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedRefund) {
            return res.status(404).json({ error: 'Refund not found' });
        }
        res.status(200).json({ message: 'Refund updated successfully', refund: updatedRefund });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error updating refund' });
    }
});

// DELETE a refund by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedRefund = await Refund.findByIdAndDelete(req.params.id);
        if (!deletedRefund) {
            return res.status(404).json({ error: 'Refund not found' });
        }
        res.status(200).json({ message: 'Refund deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting the refund' });
    }
});

module.exports = router;

