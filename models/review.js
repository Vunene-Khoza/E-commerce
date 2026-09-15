const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product ID is required'],
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true,
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required'],
        min: [1, 'Rating must be at least 1'],
        max: [5, 'Rating cannot exceed 5'],
        validate: {
            validator: function(value) {
                return Number.isInteger(value) || (value % 0.5 === 0);
            },
            message: 'Rating must be a whole number or half number (e.g., 1, 1.5, 2, etc.)'
        }
    },
    comment: {
        type: String,
        required: [true, 'Comment is required'],
        trim: true,
        maxlength: [1000, 'Review comment cannot exceed 1000 characters'],
        minlength: [10, 'Review comment must be at least 10 characters']
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound index: one review per user per product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

// Static method to find reviews by product with pagination
reviewSchema.statics.findByProduct = function(productId, page = 1, limit = 10, sortBy = 'createdAt') {
    const skip = (page - 1) * limit;
    return this.find({ productId })
        .populate('userId', 'name email')
        .sort({ [sortBy]: -1 })
        .skip(skip)
        .limit(limit);
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;