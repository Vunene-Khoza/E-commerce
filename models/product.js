const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Seller/User ID is required'],
        index: true
    },
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        minlength: [2, 'Product name must be at least 2 characters'],
        maxlength: [200, 'Product name cannot exceed 200 characters'],
        index: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters'],
        default: ''
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative'],
        validate: {
            validator: function(value) {
                return Number.isFinite(value) && value >= 0;
            },
            message: 'Price must be a valid positive number'
        },
        index: true
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: {
            values: ['electronics', 'clothing', 'home', 'books', 'toys', 'sports', 'beauty', 'automotive', 'food', 'health'],
            message: 'Category must be one of the predefined values'
        },
        lowercase: true,
        index: true
    },
    stock: {
        type: Number,
        required: [true, 'Stock is required'],
        min: [0, 'Stock cannot be negative'],
        default: 0
    },
    brand: {
        type: String,
        required: [true, 'Brand is required'],
        trim: true,
        maxlength: [100, 'Brand name cannot exceed 100 characters'],
        index: true
    },
    colour: {
        type: String,
        required: [true, 'Colour is required'],
        lowercase: true,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Text index for search performance
productSchema.index({ name: 'text', brand: 'text', description: 'text' });

// Compound index for category and price queries
productSchema.index({ category: 1, price: 1 });

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
    if (this.stock === 0) return 'out_of_stock';
    if (this.stock <= 10) return 'low_stock';
    return 'in_stock';
});

// Static method to find active products
productSchema.statics.findActive = function() {
    return this.find({ isActive: true });
};

// Static method to find by category
productSchema.statics.findByCategory = function(category) {
    return this.find({ category: category.toLowerCase(), isActive: true });
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;