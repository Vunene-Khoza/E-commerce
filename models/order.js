const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: { type: String },
    quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity must be at least 1']
    },
    price: {
        type: Number,
        required: true,
        min: [0, 'Price cannot be negative']
    }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'User ID is required'],
        ref: 'User',
        index: true
    },
    // Optional legacy single-product support for backwards compatibility
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        index: true
    },
    quantity: {
        type: Number,
        min: [1, 'Quantity must be at least 1'],
        default: 1
    },
    price: {
        type: Number,
        min: [0, 'Price cannot be negative']
    },
    // Embedded items array for realistic e-commerce multiple item orders
    items: [orderItemSchema],
    total_price: {
        type: Number,
        required: [true, 'Total price is required'],
        min: [0, 'Total price cannot be negative']
    },
    status: {
        type: String,
        enum: {
            values: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
            message: 'Status must be one of: pending, processing, shipped, delivered, cancelled'
        },
        default: 'pending',
        index: true
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    shippingAddress: {
        type: String,
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual alias for totalPrice
orderSchema.virtual('totalPrice').get(function() {
    return this.total_price;
});

orderSchema.virtual('orderAgeInDays').get(function() {
    return Math.floor((Date.now() - (this.createdAt || this.orderDate)) / (1000 * 60 * 60 * 24));
});

// Instance method to update order status
orderSchema.methods.updateStatus = function(newStatus) {
    this.status = newStatus;
    return this.save();
};

// Static method to find orders by user
orderSchema.statics.findByUser = function(userId) {
    return this.find({ userId })
        .populate('productId', 'name price')
        .populate('items.productId', 'name price')
        .sort({ createdAt: -1 });
};

// Static method to get order statistics
orderSchema.statics.getOrderStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalRevenue: { $sum: '$total_price' }
            }
        }
    ]);
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;