const express = require('express');
const router = express.Router();
const Shipping = require('../models/shipping');

// CREATE a shipping record
router.post('/', async (req, res) => {
    try {
        const { orderId, userId, courier, trackingNumber, deliveryAddress, shippingStatus, estimatedDelivery } = req.body;

        const newShipping = new Shipping({
            orderId,
            userId,
            courier: courier || 'DHL',
            trackingNumber: trackingNumber || `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`,
            deliveryAddress,
            shippingStatus: shippingStatus || 'pending',
            estimatedDelivery: estimatedDelivery || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        });

        const savedShipping = await newShipping.save();
        res.status(201).json({ message: 'Shipping created successfully', shipping: savedShipping });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'A shipping record with this orderId or tracking number already exists' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Backward-compatible alias for POST /shipping
router.post('/shipping', (req, res, next) => {
    req.url = '/';
    router.handle(req, res, next);
});

// GET ALL shipping records (with pagination, status and courier filters)
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.userId) filter.userId = req.query.userId;
        if (req.query.orderId) filter.orderId = req.query.orderId;
        if (req.query.courier) filter.courier = req.query.courier;
        if (req.query.shippingStatus) filter.shippingStatus = req.query.shippingStatus;

        const [shippings, total] = await Promise.all([
            Shipping.find(filter)
                .populate('userId', 'name email')
                .populate('orderId', 'total_price status')
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            Shipping.countDocuments(filter)
        ]);

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: shippings
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve shipping records' });
    }
});

// GET ONE shipping by ID
router.get('/:id', async (req, res) => {
    try {
        const shipping = await Shipping.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('orderId', 'total_price status');

        if (!shipping) {
            return res.status(404).json({ message: 'Shipping not found' });
        }
        res.status(200).json(shipping);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching shipping' });
    }
});

// UPDATE shipping by ID
router.put('/:id', async (req, res) => {
    try {
        const { courier, trackingNumber, deliveryAddress, shippingStatus, dispatchedDate, estimatedDelivery, actualDelivery } = req.body;
        const updateData = {};
        if (courier) updateData.courier = courier;
        if (trackingNumber) updateData.trackingNumber = trackingNumber;
        if (deliveryAddress) updateData.deliveryAddress = deliveryAddress;
        if (shippingStatus) updateData.shippingStatus = shippingStatus;
        if (dispatchedDate) updateData.dispatchedDate = dispatchedDate;
        if (estimatedDelivery) updateData.estimatedDelivery = estimatedDelivery;
        if (actualDelivery) updateData.actualDelivery = actualDelivery;

        const updatedShipping = await Shipping.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedShipping) {
            return res.status(404).json({ error: 'Shipping not found' });
        }
        res.status(200).json({ message: 'Shipping updated successfully', shipping: updatedShipping });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error updating shipping' });
    }
});

// DELETE a shipping by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedShipping = await Shipping.findByIdAndDelete(req.params.id);
        if (!deletedShipping) {
            return res.status(404).json({ error: 'Shipping not found' });
        }
        res.status(200).json({ message: 'Shipping deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting the shipping' });
    }
});

module.exports = router;

