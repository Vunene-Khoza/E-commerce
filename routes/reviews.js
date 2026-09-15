const express = require('express');
const router = express.Router();
const Review = require('../models/review');

// CREATE a review
router.post('/', async (req, res) => {
    try {
        const { productId, productID, userId, userID, rating, comment } = req.body;

        const newReview = new Review({
            productId: productId || productID,
            userId: userId || userID,
            rating,
            comment
        });

        const savedReview = await newReview.save();
        res.status(201).json({ message: 'Review created successfully', review: savedReview });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'You have already reviewed this product' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Backward-compatible alias for POST /review
router.post('/review', (req, res, next) => {
    req.url = '/';
    router.handle(req, res, next);
});

// GET reviews for a specific product
router.get('/product/:productId', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const sortBy = req.query.sortBy || 'createdAt';

        const reviews = await Review.findByProduct(req.params.productId, page, limit, sortBy);
        const total = await Review.countDocuments({ productId: req.params.productId });

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: reviews
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve product reviews' });
    }
});

// GET ALL reviews (with pagination and rating filter)
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.productId) filter.productId = req.query.productId;
        if (req.query.userId) filter.userId = req.query.userId;
        if (req.query.rating) filter.rating = Number(req.query.rating);

        const [reviews, total] = await Promise.all([
            Review.find(filter)
                .populate('userId', 'name email')
                .populate('productId', 'name price')
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            Review.countDocuments(filter)
        ]);

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: reviews
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve reviews' });
    }
});

// GET ONE review by ID
router.get('/:id', async (req, res) => {
    try {
        const review = await Review.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('productId', 'name price');

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }
        res.status(200).json(review);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching review' });
    }
});

// UPDATE a review by ID
router.put('/:id', async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const updateData = {};
        if (rating !== undefined) updateData.rating = rating;
        if (comment) updateData.comment = comment;

        const updatedReview = await Review.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedReview) {
            return res.status(404).json({ error: 'Review not found' });
        }
        res.status(200).json({ message: 'Review updated successfully', review: updatedReview });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error updating review' });
    }
});

// DELETE a review by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedReview = await Review.findByIdAndDelete(req.params.id);
        if (!deletedReview) {
            return res.status(404).json({ error: 'Review not found' });
        }
        res.status(200).json({ message: 'Review deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting the review' });
    }
});

module.exports = router;

