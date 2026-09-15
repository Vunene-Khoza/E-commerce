const express = require('express');
const router = express.Router();
const User = require('../models/user');

// CREATE a user
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, gender, address, country, role } = req.body;
        const newUser = new User({ name, email, phone, gender, address, country, role });
        const savedUser = await newUser.save();
        res.status(201).json({ message: 'User created successfully', user: savedUser });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'A user with this email already exists' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Backward-compatible alias for POST /user
router.post('/user', (req, res, next) => {
    req.url = '/';
    router.handle(req, res, next);
});

// GET ALL users (with pagination)
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.role) filter.role = req.query.role;
        if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

        const [users, total] = await Promise.all([
            User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
            User.countDocuments(filter)
        ]);

        res.status(200).json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: users
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve users' });
    }
});

// GET ONE user by ID
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching user' });
    }
});

// UPDATE a user by ID
router.put('/:id', async (req, res) => {
    try {
        const { name, email, phone, gender, address, country, role, isActive } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, phone, gender, address, country, role, isActive },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error updating user' });
    }
});

// DELETE a user by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting user' });
    }
});

module.exports = router;

