const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [1, 'Name is required'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(value) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            },
            message: 'Please provide a valid email address'
        },
        index: true
    },
    phone: {
        type: String,
        required: false,
        trim: true,
        validate: {
            validator: function(value) {
                if (!value) return true;
                return /^\+?[\d\s-()]{10,15}$/.test(value);
            },
            message: 'Please provide a valid phone number'
        }
    },
    gender: {
        type: String,
        required: [true, 'Gender is required'],
        enum: {
            values: ['male', 'female', 'other', 'prefer_not_to_say'],
            message: 'Gender must be one of: male, female, other, prefer_not_to_say'
        },
        lowercase: true
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true,
        maxlength: [200, 'Street address cannot exceed 200 characters']
    },
    country: {
        type: String,
        required: [true, 'Country is required'],
        trim: true,
        uppercase: true,
        validate: {
            validator: function(value) {
                return /^[A-Z]{2}$/.test(value);
            },
            message: 'Country must be a valid 2-letter ISO country code'
        }
    },
    role: {
        type: String,
        enum: ['customer', 'seller', 'admin'],
        default: 'customer'
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    emailVerificationToken: {
        type: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Static method to find active users
userSchema.statics.findActive = function() {
    return this.find({ isActive: true });
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

// Method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    this.emailVerificationToken = token;
    return token;
};

const User = mongoose.model('User', userSchema);

module.exports = User;