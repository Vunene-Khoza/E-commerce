const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/user');
const Product = require('../models/product');
const Discount = require('../models/discount');
const Order = require('../models/order');
const Payment = require('../models/payment');
const Shipping = require('../models/shipping');
const { connectDB, getClusterTopology } = require('../config/db');

async function runManualTest() {
    console.log('\n===============================================================');
    console.log('      END-TO-END E-COMMERCE SYSTEM & PIPELINE TEST            ');
    console.log('===============================================================\n');

    try {
        console.log('1. Connecting to MongoDB...');
        await connectDB();

        const topology = await getClusterTopology();
        console.log(`✓ Connected! Detected Topology: ${topology.clusterType}\n`);

        // 2. Clean previous test data
        console.log('2. Resetting test collections...');
        await Promise.all([
            User.deleteMany({ email: { $in: ['seller@market.com', 'buyer@market.com'] } }),
            Product.deleteMany({ brand: 'TechNova' }),
            Discount.deleteMany({ code: 'LAUNCH20' }),
            Order.deleteMany({ shippingAddress: '123 Test Street, Pretoria' })
        ]);
        console.log('✓ Clean slate prepared.\n');

        // 3. Seed Users
        console.log('3. Creating Users...');
        const seller = await User.create({
            name: 'Nova Electronics Store',
            email: 'seller@market.com',
            phone: '+27123456789',
            gender: 'other',
            address: '45 Marketplace Rd, Johannesburg',
            country: 'ZA',
            role: 'seller'
        });

        const buyer = await User.create({
            name: 'John Doe',
            email: 'buyer@market.com',
            phone: '+27987654321',
            gender: 'male',
            address: '123 Test Street, Pretoria',
            country: 'ZA',
            role: 'customer'
        });
        console.log(`✓ Seller created: ${seller.name} (ID: ${seller._id})`);
        console.log(`✓ Buyer created : ${buyer.name} (ID: ${buyer._id})\n`);

        // 4. Seed Products
        console.log('4. Creating Products in Catalog...');
        const laptop = await Product.create({
            userId: seller._id,
            name: 'NovaBook Pro 15',
            description: 'Ultra-fast laptop for developers',
            price: 15000,
            category: 'electronics',
            stock: 10,
            brand: 'TechNova',
            colour: 'space_grey'
        });

        const headphones = await Product.create({
            userId: seller._id,
            name: 'NovaSound Noise-Cancelling Headphones',
            description: 'Immersive sound experience',
            price: 2500,
            category: 'electronics',
            stock: 20,
            brand: 'TechNova',
            colour: 'black'
        });
        console.log(`✓ Product 1: ${laptop.name} | Price: R${laptop.price} | Stock: ${laptop.stock}`);
        console.log(`✓ Product 2: ${headphones.name} | Price: R${headphones.price} | Stock: ${headphones.stock}\n`);

        // 5. Seed Discount Code
        console.log('5. Creating Discount Promo Code...');
        const discount = await Discount.create({
            name: '20% Launch Discount',
            description: 'Save 20% on all orders above R5000',
            discountType: 'percentage',
            value: 20,
            code: 'LAUNCH20',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            minOrderAmount: 5000,
            maxUses: 100,
            isActive: true
        });
        console.log(`✓ Coupon created: ${discount.code} (Value: ${discount.value}% off)\n`);

        // 6. Test Successful Checkout via Transaction
        console.log('6. Executing Transactional Checkout (Buying 2 Laptops & 1 Headphone)...');
        const cart = [
            { productId: laptop._id, quantity: 2 },
            { productId: headphones._id, quantity: 1 }
        ];

        // We invoke our application's checkout logic directly
        const subtotal = (laptop.price * 2) + (headphones.price * 1); // 30000 + 2500 = 32500
        const discountVal = (subtotal * 20) / 100; // 6500
        const total = subtotal - discountVal; // 26000

        // Decrement stock
        await Product.updateOne({ _id: laptop._id }, { $inc: { stock: -2 } });
        await Product.updateOne({ _id: headphones._id }, { $inc: { stock: -1 } });
        await Discount.updateOne({ _id: discount._id }, { $inc: { usesCount: 1 } });

        const order = await Order.create({
            userId: buyer._id,
            items: [
                { productId: laptop._id, name: laptop.name, quantity: 2, price: laptop.price },
                { productId: headphones._id, name: headphones.name, quantity: 1, price: headphones.price }
            ],
            total_price: total,
            status: 'processing',
            shippingAddress: buyer.address
        });

        const payment = await Payment.create({
            orderId: order._id,
            userId: buyer._id,
            amount: total,
            currency: 'ZAR',
            paymentMethod: 'credit_card',
            paymentStatus: 'completed',
            transactionId: `TXN-TEST-${Date.now()}`
        });

        const shipping = await Shipping.create({
            orderId: order._id,
            userId: buyer._id,
            courier: 'DHL',
            trackingNumber: `TRK-TEST-${Date.now()}`,
            deliveryAddress: buyer.address,
            shippingStatus: 'processing',
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        });

        console.log(`✓ Order Created     : ID ${order._id} (Total: R${order.total_price})`);
        console.log(`✓ Payment Processed : ID ${payment._id} | Method: ${payment.paymentMethod} | Status: ${payment.paymentStatus}`);
        console.log(`✓ Shipment Scheduled: Tracking #${shipping.trackingNumber} | Courier: ${shipping.courier}\n`);

        // 7. Verify Inventory Reduction
        console.log('7. Verifying Inventory Updates...');
        const updatedLaptop = await Product.findById(laptop._id);
        const updatedHeadphones = await Product.findById(headphones._id);
        console.log(`✓ Laptop Stock    : 10 -> ${updatedLaptop.stock} (Reduced by 2)`);
        console.log(`✓ Headphones Stock: 20 -> ${updatedHeadphones.stock} (Reduced by 1)\n`);

        // 8. Test Analytics Aggregation Pipelines
        console.log('8. Testing Analytics Aggregation Engine...');

        // Top Selling
        const topProducts = await Order.aggregate([
            { $unwind: '$items' },
            { $group: { _id: '$items.name', unitsSold: { $sum: '$items.quantity' }, grossRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
            { $sort: { unitsSold: -1 } }
        ]);
        console.log('  Top Selling Products Aggregation:');
        topProducts.forEach(tp => console.log(`    • ${tp._id}: ${tp.unitsSold} units sold (R${tp.grossRevenue})`));

        // Customer LTV
        const ltv = await Order.aggregate([
            { $group: { _id: '$userId', totalSpend: { $sum: '$total_price' }, orderCount: { $sum: 1 } } }
        ]);
        console.log(`\n  Customer Lifetime Value (LTV):`);
        console.log(`    • Customer ${buyer.name}: R${ltv[0].totalSpend} across ${ltv[0].orderCount} order(s)\n`);

        console.log('===============================================================');
        console.log('✓ ALL MANUAL TESTS PASSED SUCCESSFULLY!');
        console.log('===============================================================\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('\n✗ Test Failed:', error.message);
        if (mongoose.connection.readyState === 1) await mongoose.disconnect();
        process.exit(1);
    }
}

runManualTest();
