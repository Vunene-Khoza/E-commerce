const express = require('express');
const router = express.Router();
const Discount = require('../models/discount');

// CREATE a discount
router.post('/', async (req, res) => {
    try {
        const { name, description, discountType, value, code, startDate, endDate, minOrderAmount, maxUses, usesPerUser, isActive, inActive } = req.body;

        const newDiscount = new Discount({
            name,
            description,
            discountType,
            value,
            code,
            startDate: startDate || new Date(),
            endDate,
            minOrderAmount,
            maxUses,
            usesPerUser,
            isActive: isActive !== undefined ? isActive : (inActive !== undefined ? !inActive : true)
        });

        const savedDiscount = await newDiscount.save();
        res.status(201).json({ message: 'Discount created successfully', discount: savedDiscount });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'A discount with this code already exists' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Backward-compatible alias for POST /discount
router.post('/discount', (req, res, next) => {
    req.url = '/';
    router.handle(req, res, next);
});

// VALIDATE & GET discount by promo code
router.get('/code/:code', async (req, res) => {
    try {
        const discount = await Discount.findByCode(req.params.code);
        if (!discount) {
            return res.status(404).json({ message: 'Promo code invalid or inactive' });
        }
        const now = new Date();
        if (discount.startDate && now < discount.startDate) {
            return res.status(400).json({ message: 'Promo code is not active yet' });
        }
        if (discount.endDate && now > discount.endDate) {
            return res.status(400).json({ message: 'Promo code has expired' });
        }
        if (discount.maxUses && discount.usesCount >= discount.maxUses) {
            return res.status(400).json({ message: 'Promo code usage limit reached' });
        }
        res.status(200).json({ valid: true, discount });
    } catch (error) {
        res.status(500).json({ error: 'Error validating promo code' });
    }
});

// GET ALL discounts (with pagination and active filter)
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

        const [discounts, total] = await Promise.all([
            Discount.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
            Discount.countDocuments(filter)
        ]);

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: discounts
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve discounts' });
    }
});

// GET ONE discount by ID
router.get('/:id', async (req, res) => {
    try {
        const discount = await Discount.findById(req.params.id);
        if (!discount) {
            return res.status(404).json({ message: 'Discount not found' });
        }
        res.status(200).json(discount);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching discount' });
    }
});

// UPDATE a discount by ID
router.put('/:id', async (req, res) => {
    try {
        const { name, description, discountType, value, code, startDate, endDate, minOrderAmount, maxUses, usesPerUser, isActive } = req.body;

        const updatedDiscount = await Discount.findByIdAndUpdate(
            req.params.id,
            { name, description, discountType, value, code, startDate, endDate, minOrderAmount, maxUses, usesPerUser, isActive },
            { new: true, runValidators: true }
        );

        if (!updatedDiscount) {
            return res.status(404).json({ error: 'Discount not found' });
        }
        res.status(200).json({ message: 'Discount updated successfully', discount: updatedDiscount });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error updating discount' });
    }
});

// DELETE a discount by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedDiscount = await Discount.findByIdAndDelete(req.params.id);
        if (!deletedDiscount) {
            return res.status(404).json({ error: 'Discount not found' });
        }
        res.status(200).json({ message: 'Discount deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting the discount' });
    }
});

module.exports = router;

