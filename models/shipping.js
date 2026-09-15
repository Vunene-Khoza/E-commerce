const mongoose = require('mongoose');

const shippingSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: [true, 'Order ID is required'],
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    courier: {
        type: String,
        required: [true, 'Courier is required'],
        enum: {
            values: ['DHL', 'FedEx', 'UPS', 'USPS', 'Royal_Mail', 'DPD', 'Hermes', 'TNT', 'Amazon_Logistics', 'Canada_Post', 'Australia_Post', 'PostNL', 'La_Poste'],
            message: 'Invalid courier service'
        },
        default: 'DHL'
    },
    trackingNumber: {
        type: String,
        required: [true, 'Tracking number is required'],
        unique: true,
        trim: true,
        uppercase: true,
        index: true,
        validate: {
            validator: function(v) {
                return v && v.length >= 8 && v.length <= 50;
            },
            message: 'Tracking number must be between 8 and 50 characters'
        }
    },
    shippingStatus: {
        type: String,
        required: true,
        enum: {
            values: ['pending', 'processing', 'dispatched', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned', 'cancelled', 'delayed', 'shipped'],
            message: 'Invalid shipping status'
        },
        default: 'pending',
        index: true
    },
    dispatchedDate: {
        type: Date,
        index: true
    },
    estimatedDelivery: {
        type: Date,
        index: true
    },
    actualDelivery: {
        type: Date,
        index: true
    },
    deliveryAddress: {
        type: String,
        required: [true, 'Delivery address is required'],
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Static method to find shipments by user
shippingSchema.statics.findByUser = function(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    return this.find({ userId })
        .populate('orderId', 'total_price status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
};

const Shipping = mongoose.model('Shipping', shippingSchema);

module.exports = Shipping;