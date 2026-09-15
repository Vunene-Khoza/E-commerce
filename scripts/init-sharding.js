/**
 * MongoDB Shell Script: Initialize Sharded Cluster & Collections
 * Usage:
 *   mongosh --host localhost:27017 scripts/init-sharding.js
 */

print("\n=======================================================");
print("  INITIALIZING MONGODB ENTERPRISE SHARDED CLUSTER      ");
print("=======================================================\n");

// Step 1: Add Shards to Mongos
print("1. Registering Shards...");
try {
    sh.addShard("shard1rs/shard1-a:27017,shard1-b:27017");
    print("✓ Registered shard1rs");
} catch (e) {
    print("Notice on shard1rs: " + e.message);
}

try {
    sh.addShard("shard2rs/shard2-a:27017,shard2-b:27017");
    print("✓ Registered shard2rs");
} catch (e) {
    print("Notice on shard2rs: " + e.message);
}

// Step 2: Enable Database Sharding
print("\n2. Enabling Sharding on database: ecommerce...");
try {
    sh.enableSharding("ecommerce");
    print("✓ Database sharding enabled.");
} catch (e) {
    print("Notice: " + e.message);
}

// Step 3: Shard Orders with Hashed Shard Key on userId
print("\n3. Sharding 'ecommerce.orders' with Hashed Shard Key { userId: 'hashed' }...");
try {
    sh.shardCollection("ecommerce.orders", { userId: "hashed" });
    print("✓ 'ecommerce.orders' successfully sharded by { userId: 'hashed' }");
} catch (e) {
    print("Notice: " + e.message);
}

// Step 4: Shard Products with Compound Shard Key on category and _id
print("\n4. Sharding 'ecommerce.products' with Compound Shard Key { category: 1, _id: 1 }...");
try {
    sh.shardCollection("ecommerce.products", { category: 1, _id: 1 });
    print("✓ 'ecommerce.products' successfully sharded by { category: 1, _id: 1 }");
} catch (e) {
    print("Notice: " + e.message);
}

// Step 5: Report Sharded Cluster Status
print("\n=======================================================");
print("  SHARDED CLUSTER TOPOLOGY STATUS                     ");
print("=======================================================\n");
sh.status();
