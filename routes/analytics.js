const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const Product = require('../models/product');
const User = require('../models/user');
const Shipping = require('../models/shipping');

// =========================================================================
// AGGREGATION 1: TOP SELLING PRODUCTS
// Demonstrates: $match, $unwind, $group, $lookup, $project, $sort, $limit
// =========================================================================
router.get('/top-selling-products', async (req, res) => {
    try {
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

        const topProducts = await Order.aggregate([
            { $match: { status: { $nin: ['cancelled'] } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productId',
                    unitsSold: { $sum: '$items.quantity' },
                    revenueGenerated: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $project: {
                    productId: '$_id',
                    name: '$product.name',
                    category: '$product.category',
                    brand: '$product.brand',
                    currentPrice: '$product.price',
                    currentStock: '$product.stock',
                    unitsSold: 1,
                    revenueGenerated: { $round: ['$revenueGenerated', 2] }
                }
            },
            { $sort: { unitsSold: -1, revenueGenerated: -1 } },
            { $limit: limit }
        ]);

        res.status(200).json({
            count: topProducts.length,
            data: topProducts
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to compute top selling products' });
    }
});

// =========================================================================
// AGGREGATION 2: REVENUE AND VOLUME BY PRODUCT CATEGORY
// Demonstrates: $unwind, $lookup, $group with $addToSet and $size
// =========================================================================
router.get('/revenue-by-category', async (req, res) => {
    try {
        const categoryStats = await Order.aggregate([
            { $match: { status: { $nin: ['cancelled'] } } },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $group: {
                    _id: '$product.category',
                    totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                    totalUnitsSold: { $sum: '$items.quantity' },
                    distinctOrders: { $addToSet: '$_id' }
                }
            },
            {
                $project: {
                    category: '$_id',
                    totalRevenue: { $round: ['$totalRevenue', 2] },
                    totalUnitsSold: 1,
                    orderCount: { $size: '$distinctOrders' }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        res.status(200).json({
            data: categoryStats
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to compute revenue by category' });
    }
});

// =========================================================================
// AGGREGATION 3: LOW STOCK / INVENTORY HEALTH ALERT
// Demonstrates: $match with conditionals, $project with $cond, $sort
// =========================================================================
router.get('/low-stock-alert', async (req, res) => {
    try {
        const threshold = parseInt(req.query.threshold) || 10;

        const lowStockProducts = await Product.aggregate([
            {
                $match: {
                    isActive: true,
                    stock: { $lte: threshold }
                }
            },
            {
                $project: {
                    name: 1,
                    category: 1,
                    brand: 1,
                    price: 1,
                    stock: 1,
                    status: {
                        $cond: {
                            if: { $eq: ['$stock', 0] },
                            then: 'OUT_OF_STOCK',
                            else: 'LOW_STOCK'
                        }
                    }
                }
            },
            { $sort: { stock: 1, name: 1 } }
        ]);

        res.status(200).json({
            threshold,
            count: lowStockProducts.length,
            data: lowStockProducts
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to retrieve low stock alerts' });
    }
});

// =========================================================================
// AGGREGATION 4: CUSTOMER LIFETIME VALUE (LTV) & RETENTION
// Demonstrates: $group by customer, $avg, $max, $lookup User profile
// =========================================================================
router.get('/customer-ltv', async (req, res) => {
    try {
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

        const customerLTV = await Order.aggregate([
            { $match: { status: { $nin: ['cancelled'] } } },
            {
                $group: {
                    _id: '$userId',
                    totalSpend: { $sum: '$total_price' },
                    orderCount: { $sum: 1 },
                    averageOrderValue: { $avg: '$total_price' },
                    lastOrderDate: { $max: '$createdAt' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    userId: '$_id',
                    name: '$user.name',
                    email: '$user.email',
                    country: '$user.country',
                    totalSpend: { $round: ['$totalSpend', 2] },
                    orderCount: 1,
                    averageOrderValue: { $round: ['$averageOrderValue', 2] },
                    lastOrderDate: 1
                }
            },
            { $sort: { totalSpend: -1 } },
            { $limit: limit }
        ]);

        res.status(200).json({
            count: customerLTV.length,
            data: customerLTV
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to compute customer LTV' });
    }
});

// =========================================================================
// AGGREGATION 5: EXECUTIVE DASHBOARD METRICS SUMMARY
// =========================================================================
router.get('/dashboard-summary', async (req, res) => {
    try {
        const [revenueStats, totalCustomers, totalProducts, pendingShipments] = await Promise.all([
            Order.aggregate([
                { $match: { status: { $nin: ['cancelled'] } } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$total_price' },
                        totalOrders: { $sum: 1 },
                        avgOrderValue: { $avg: '$total_price' }
                    }
                }
            ]),
            User.countDocuments({ isActive: true }),
            Product.countDocuments({ isActive: true }),
            Shipping.countDocuments({ shippingStatus: { $in: ['pending', 'processing', 'in_transit'] } })
        ]);

        const stats = revenueStats[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };

        res.status(200).json({
            metrics: {
                totalRevenue: Number(stats.totalRevenue.toFixed(2)),
                totalOrders: stats.totalOrders,
                averageOrderValue: Number(stats.avgOrderValue.toFixed(2)),
                activeCustomers: totalCustomers,
                activeProducts: totalProducts,
                pendingDeliveries: pendingShipments
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to generate dashboard summary' });
    }
});

module.exports = router;
