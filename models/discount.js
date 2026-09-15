const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Discount name is required'],
        trim: true,
        minlength: [3, 'Discount name must be at least 3 characters'],
        maxlength: [100, 'Discount name cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    discountType: {
        type: String,
        required: [true, 'Discount type is required'],
        enum: {
            values: ['percentage', 'fixed_amount', 'buy_x_get_y', 'free_shipping'],
            message: 'Discount type must be one of: percentage, fixed_amount, buy_x_get_y, free_shipping'
        },
        lowercase: true
    },
    value: {
        type: Number,
        required: [true, 'Discount value is required'],
        min: [0, 'Discount value cannot be negative'],
        validate: {
            validator: function(value) {
                if (this.discountType === 'percentage') {
                    return value >= 0 && value <= 100;
                }
                return value >= 0;
            },
            message: 'Percentage discount must be between 0 and 100'
        }
    },
    code: {
        type: String,
        required: [true, 'Discount code is required'],
        unique: true,
        uppercase: true,
        trim: true,
        minlength: [3, 'Discount code must be at least 3 characters'],
        maxlength: [20, 'Discount code cannot exceed 20 characters'],
        validate: {
            validator: function(value) {
                return /^[A-Z0-9_-]+$/.test(value);
            },
            message: 'Discount code can only contain uppercase letters, numbers, hyphens, and underscores'
        },
        index: true
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required'],
        default: Date.now
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required'],
        validate: {
            validator: function(value) {
                return !this.startDate || value > this.startDate;
            },
            message: 'End date must be after start date'
        }
    },
    minOrderAmount: {
        type: Number,
        min: [0, 'Minimum order amount cannot be negative'],
        default: 0
    },
    maxUses: {
        type: Number,
        min: [1, 'Maximum uses must be at least 1'],
        default: null // null means unlimited
    },
    usesCount: {
        type: Number,
        default: 0,
        min: 0
    },
    usesPerUser: {
        type: Number,
        min: [1, 'Uses per user must be at least 1'],
        default: 1
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Static method to find active discounts
discountSchema.statics.findActive = function() {
    const now = new Date();
    return this.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
    });
};

// Static method to find by promo code
discountSchema.statics.findByCode = function(code) {
    return this.findOne({ code: code.toUpperCase(), isActive: true });
};

const Discount = mongoose.model('Discount', discountSchema);

module.exports = Discount;