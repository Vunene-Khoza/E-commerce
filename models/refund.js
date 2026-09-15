const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: [true, 'Order ID is required'],
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product ID is required']
    },
    refundAmount: {
        type: Number,
        required: [true, 'Refund amount is required'],
        min: [0.01, 'Refund amount must be positive'],
        validate: {
            validator: function(value) {
                return Number.isFinite(value) && value > 0;
            },
            message: 'Refund amount must be a valid positive number'
        }
    },
    refundStatus: {
        type: String,
        required: true,
        enum: {
            values: ['pending', 'approved', 'rejected', 'processed', 'cancelled'],
            message: 'Status must be one of: pending, approved, rejected, processed, cancelled'
        },
        default: 'pending',
        lowercase: true,
        trim: true,
        index: true
    },
    refundReason: {
        type: String,
        required: [true, 'Refund reason is required'],
        trim: true,
        maxlength: [500, 'Refund reason cannot exceed 500 characters'],
        minlength: [5, 'Refund reason must be at least 5 characters']
    },
    requestDate: {
        type: Date,
        default: Date.now
    },
    processedDate: {
        type: Date,
        required: false
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    transactionId: {
        type: String,
        required: false,
        trim: true,
        sparse: true
    },
    notes: {
        type: String,
        required: false,
        trim: true,
        maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Instance method to approve refund
refundSchema.methods.approve = function(processedBy) {
    this.refundStatus = 'approved';
    this.processedBy = processedBy;
    this.processedDate = new Date();
    return this.save();
};

// Instance method to reject refund
refundSchema.methods.reject = function(processedBy, reason) {
    this.refundStatus = 'rejected';
    this.processedBy = processedBy;
    this.processedDate = new Date();
    if (reason) {
        this.notes = this.notes ? `${this.notes}\nRejection reason: ${reason}` : `Rejection reason: ${reason}`;
    }
    return this.save();
};

const Refund = mongoose.model('Refund', refundSchema);

module.exports = Refund;