const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'Order ID is required'],
        ref: 'Order',
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'User ID is required'],
        ref: 'User',
        index: true
    },
    amount: {
        type: Number,
        required: [true, 'Payment amount is required'],
        min: [0.01, 'Payment amount must be at least 0.01'],
        validate: {
            validator: function(value) {
                return Number.isFinite(value) && value > 0;
            },
            message: 'Payment amount must be a positive number'
        }
    },
    currency: {
        type: String,
        required: [true, 'Currency is required'],
        uppercase: true,
        trim: true,
        enum: {
            values: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'ZAR'],
            message: 'Invalid currency code'
        },
        default: 'ZAR'
    },
    paymentMethod: {
        type: String,
        required: [true, 'Payment method is required'],
        enum: {
            values: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'crypto'],
            message: 'Invalid payment method'
        }
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: {
            values: ['pending', 'completed', 'confirmed', 'failed', 'refunded', 'cancelled'],
            message: 'Invalid payment status'
        },
        default: 'pending',
        index: true
    },
    transactionId: {
        type: String,
        required: [true, 'Transaction ID is required'],
        unique: true,
        trim: true,
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Alias for transactionID (all caps) backwards compatibility
paymentSchema.virtual('transactionID').get(function() {
    return this.transactionId;
});

// Static method to find payments by user with pagination
paymentSchema.statics.findByUser = function(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    return this.find({ userId })
        .populate('orderId', 'total_price status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;