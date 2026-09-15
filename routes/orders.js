const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/order');
const Product = require('../models/product');
const User = require('../models/user');
const Payment = require('../models/payment');
const Shipping = require('../models/shipping');
const Discount = require('../models/discount');

// =========================================================================
// ENTERPRISE CHECKOUT WITH MONGODB ACID MULTI-DOCUMENT TRANSACTION
// =========================================================================
router.post('/checkout', async (req, res) => {
    const { userId, items, discountCode, paymentMethod, shippingAddress, courier } = req.body;

    if (!userId || !items || !Array.isArray(items) || items.length === 0 || !shippingAddress || !paymentMethod) {
        return res.status(400).json({
            error: 'Missing required checkout fields: userId, items array, shippingAddress, and paymentMethod are required'
        });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    let session = null;
    let useTransaction = false;

    try {
        session = await mongoose.startSession();
        session.startTransaction();
        useTransaction = true;
    } catch (sessionErr) {
        if (session) {
            try { await session.endSession(); } catch (e) {}
            session = null;
        }
        useTransaction = false;
    }

    const executeCheckout = async (activeSession) => {
        const sessionOption = activeSession ? { session: activeSession } : {};

        // 1. Check inventory, deduct stock atomically, and build snapshot items
        const orderItems = [];
        let subtotal = 0;

        for (const item of items) {
            if (!item.productId || !item.quantity || item.quantity <= 0) {
                throw new Error('Invalid cart item: productId and a positive quantity are required');
            }

            const query = Product.findOne({ _id: item.productId, isActive: true });
            if (activeSession) query.session(activeSession);
            const product = await query;

            if (!product) {
                throw new Error(`Product with ID ${item.productId} was not found or is inactive`);
            }

            if (product.stock < item.quantity) {
                throw new Error(`Insufficient inventory for product "${product.name}". Requested: ${item.quantity}, Available: ${product.stock}`);
            }

            // Conditional atomic stock decrement: ensures stock cannot drop below zero
            const stockUpdate = await Product.updateOne(
                { _id: item.productId, stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } },
                sessionOption
            );

            if (stockUpdate.modifiedCount === 0) {
                throw new Error(`Stock reservation conflict for product "${product.name}".`);
            }

            const itemTotal = product.price * item.quantity;
            subtotal += itemTotal;

            orderItems.push({
                productId: product._id,
                name: product.name,
                quantity: item.quantity,
                price: product.price
            });
        }

        // 2. Validate and apply discount code (if provided)
        let discountAmount = 0;
        let appliedDiscount = null;

        if (discountCode) {
            const discQuery = Discount.findOne({ code: discountCode.toUpperCase(), isActive: true });
            if (activeSession) discQuery.session(activeSession);
            const discount = await discQuery;

            if (!discount) {
                throw new Error(`Invalid or inactive discount promo code: ${discountCode}`);
            }

            const now = new Date();
            if (discount.startDate && now < discount.startDate) {
                throw new Error(`Discount code ${discountCode} is not active yet`);
            }
            if (discount.endDate && now > discount.endDate) {
                throw new Error(`Discount code ${discountCode} has expired`);
            }
            if (discount.minOrderAmount && subtotal < discount.minOrderAmount) {
                throw new Error(`Minimum order amount of R${discount.minOrderAmount} required for code ${discountCode}`);
            }
            if (discount.maxUses && discount.usesCount >= discount.maxUses) {
                throw new Error(`Discount code ${discountCode} usage limit has been reached`);
            }

            if (discount.discountType === 'percentage') {
                discountAmount = (subtotal * discount.value) / 100;
            } else if (discount.discountType === 'fixed_amount') {
                discountAmount = Math.min(subtotal, discount.value);
            }

            // Increment discount usage
            await Discount.updateOne(
                { _id: discount._id },
                { $inc: { usesCount: 1 } },
                sessionOption
            );

            appliedDiscount = {
                code: discount.code,
                name: discount.name,
                discountAmount: Number(discountAmount.toFixed(2))
            };
        }

        const finalTotal = Number(Math.max(0, subtotal - discountAmount).toFixed(2));

        // 3. Create Order
        const order = new Order({
            userId: user._id,
            items: orderItems,
            total_price: finalTotal,
            status: 'processing',
            shippingAddress,
            orderDate: new Date()
        });
        const savedOrder = await order.save(sessionOption);

        // 4. Create Payment
        const txnId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const payment = new Payment({
            orderId: savedOrder._id,
            userId: user._id,
            amount: finalTotal,
            currency: 'ZAR',
            paymentMethod,
            paymentStatus: 'completed',
            transactionId: txnId
        });
        const savedPayment = await payment.save(sessionOption);

        // 5. Create Shipping
        const trackingNum = `TRK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const shipping = new Shipping({
            orderId: savedOrder._id,
            userId: user._id,
            courier: courier || 'DHL',
            trackingNumber: trackingNum,
            deliveryAddress: shippingAddress,
            shippingStatus: 'processing',
            estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        });
        const savedShipping = await shipping.save(sessionOption);

        return {
            order: savedOrder,
            payment: savedPayment,
            shipping: savedShipping,
            pricing: {
                subtotal: Number(subtotal.toFixed(2)),
                discountAmount: Number(discountAmount.toFixed(2)),
                finalTotal,
                appliedDiscount
            }
        };
    };

    if (useTransaction && session) {
        try {
            const result = await executeCheckout(session);
            await session.commitTransaction();
            session.endSession();
            return res.status(201).json({
                message: 'Checkout completed successfully with ACID transaction guarantee',
                transactional: true,
                ...result
            });
        } catch (error) {
            try { await session.abortTransaction(); } catch (e) {}
            try { session.endSession(); } catch (e) {}
            return res.status(400).json({
                error: error.message || 'Checkout failed, transaction rolled back',
                rolledBack: true
            });
        }
    } else {
        // Fallback for standalone MongoDB instances without replica set
        try {
            const result = await executeCheckout(null);
            return res.status(201).json({
                message: 'Checkout completed successfully (Standalone Mode)',
                transactional: false,
                ...result
            });
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
});

// CREATE an order (Direct)
router.post('/', async (req, res) => {
    try {
        const { userId, productId, quantity, price, total_price, items, shippingAddress } = req.body;

        let calculatedTotal = total_price;
        if (!calculatedTotal) {
            if (items && Array.isArray(items) && items.length > 0) {
                calculatedTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            } else if (price && quantity) {
                calculatedTotal = price * quantity;
            }
        }

        const newOrder = new Order({
            userId,
            productId,
            quantity: quantity || 1,
            price: price || 0,
            items: items || [],
            total_price: calculatedTotal || 0,
            shippingAddress
        });

        const savedOrder = await newOrder.save();
        res.status(201).json({ message: 'Order created successfully', order: savedOrder });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Backward-compatible alias for POST /order
router.post('/order', (req, res, next) => {
    req.url = '/';
    router.handle(req, res, next);
});


// GET order statistics (aggregation pipeline)
router.get('/stats', async (req, res) => {
    try {
        const stats = await Order.getOrderStats();
        res.status(200).json({ data: stats });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate order statistics' });
    }
});

// GET ALL orders (with pagination, user and status filtering)
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.userId) filter.userId = req.query.userId;
        if (req.query.status) filter.status = req.query.status;

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate('userId', 'name email')
                .populate('productId', 'name price')
                .populate('items.productId', 'name price')
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            Order.countDocuments(filter)
        ]);

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: orders
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve orders' });
    }
});

// GET ONE order by ID
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('userId', 'name email address country')
            .populate('productId', 'name price')
            .populate('items.productId', 'name price');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching order' });
    }
});

// UPDATE an order by ID
router.put('/:id', async (req, res) => {
    try {
        const { status, shippingAddress, total_price } = req.body;
        const updateData = {};
        if (status) updateData.status = status;
        if (shippingAddress) updateData.shippingAddress = shippingAddress;
        if (total_price !== undefined) updateData.total_price = total_price;

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.status(200).json({ message: 'Order updated successfully', order: updatedOrder });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error updating order' });
    }
});

// DELETE an order by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id);
        if (!deletedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.status(200).json({ message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting the order' });
    }
});

module.exports = router;

