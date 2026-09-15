const express = require('express');
const router = express.Router();
const Product = require('../models/product');

// CREATE a product
router.post('/', async (req, res) => {
    try {
        const { userId, name, description, price, category, stock, brand, colour } = req.body;
        const newProduct = new Product({ userId, name, description, price, category, stock, brand, colour });
        const savedProduct = await newProduct.save();
        res.status(201).json({ message: 'Product created successfully', product: savedProduct });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Backward-compatible alias for POST /product
router.post('/product', (req, res, next) => {
    req.url = '/';
    router.handle(req, res, next);
});

// GET ALL products (with pagination, category filter, price filter, and text search)
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = { isActive: true };

        if (req.query.category) {
            filter.category = req.query.category.toLowerCase();
        }
        if (req.query.brand) {
            filter.brand = new RegExp(req.query.brand, 'i');
        }
        if (req.query.minPrice || req.query.maxPrice) {
            filter.price = {};
            if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
            if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
        }
        if (req.query.search) {
            filter.$text = { $search: req.query.search };
        }

        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate('userId', 'name email')
                .skip(skip)
                .limit(limit)
                .sort(req.query.sortBy ? { [req.query.sortBy]: req.query.sortOrder === 'asc' ? 1 : -1 } : { createdAt: -1 }),
            Product.countDocuments(filter)
        ]);

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: products
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve products' });
    }
});

// GET ONE product by ID
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('userId', 'name email');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching product' });
    }
});

// UPDATE a product by ID
router.put('/:id', async (req, res) => {
    try {
        const { name, description, price, category, stock, brand, colour, isActive } = req.body;
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            { name, description, price, category, stock, brand, colour, isActive },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error updating product' });
    }
});

// DELETE a product by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting the product' });
    }
});

module.exports = router;

