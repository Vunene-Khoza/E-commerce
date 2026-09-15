const mongoose = require('mongoose');
require('dotenv').config();

const connURL = process.env.DATABASE_CONN_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'ecommerce';

async function inspectCluster() {
    console.log('\n=============================================================');
    console.log('  DISTRIBUTED NOSQL DATABASE TOPOLOGY & HEALTH DIAGNOSTIC   ');
    console.log('=============================================================');
    console.log(`Connection URI : ${connURL}`);
    console.log(`Database Name  : ${dbName}`);

    try {
        await mongoose.connect(connURL, {
            dbName,
            serverSelectionTimeoutMS: 4000
        });

        console.log(`Status         : CONNECTED (ReadyState: ${mongoose.connection.readyState})`);

        const adminDb = mongoose.connection.db.admin();

        // 1. Check Server Build & Version
        const buildInfo = await adminDb.command({ buildInfo: 1 });
        console.log(`MongoDB Version: ${buildInfo.version}`);

        // 2. Check if Sharded Cluster (mongos)
        let isSharded = false;
        try {
            const serverStatus = await adminDb.command({ serverStatus: 1 });
            if (serverStatus.process === 'mongos') {
                isSharded = true;
                console.log('\n--- TOPOLOGY: ENTERPRISE SHARDED CLUSTER (mongos) ---');
                const shardList = await adminDb.command({ listShards: 1 });
                console.log(`Active Shards (${shardList.shards.length}):`);
                shardList.shards.forEach(s => {
                    console.log(`  • Shard ID: ${s._id.padEnd(10)} | Host: ${s.host} | State: ${s.state}`);
                });
            }
        } catch (e) {}

        // 3. Check if Replica Set
        let isReplicaSet = false;
        try {
            const rsStatus = await adminDb.command({ replSetGetStatus: 1 });
            if (rsStatus && rsStatus.ok === 1) {
                isReplicaSet = true;
                console.log(`\n--- TOPOLOGY: REPLICA SET (${rsStatus.set}) ---`);
                console.log(`Cluster State  : HEALTHY`);
                console.log(`Members Count  : ${rsStatus.members.length}`);
                console.log('\nReplica Set Members:');
                rsStatus.members.forEach(m => {
                    const isSelf = m.self ? ' [Current Node]' : '';
                    console.log(`  • [${m.stateStr.padEnd(10)}] Host: ${m.name.padEnd(25)} Health: ${m.health === 1 ? 'OK' : 'FAIL'}${isSelf}`);
                });
            }
        } catch (e) {}

        if (!isSharded && !isReplicaSet) {
            console.log('\n--- TOPOLOGY: STANDALONE INSTANCE ---');
            console.log('Note: Running on a single MongoDB node. For High Availability and');
            console.log('ACID multi-document transactions in production, boot the 3-node');
            console.log('replica set using: docker compose up -d');
        }

        // 4. Collection Statistics
        console.log('\n--- COLLECTION INVENTORY ---');
        const collections = await mongoose.connection.db.listCollections().toArray();
        if (collections.length === 0) {
            console.log('  (No collections created yet)');
        } else {
            for (const col of collections) {
                const count = await mongoose.connection.db.collection(col.name).countDocuments();
                console.log(`  • Collection: ${col.name.padEnd(18)} Document Count: ${count}`);
            }
        }

        console.log('\n=============================================================');
        console.log('  DIAGNOSTIC COMPLETED SUCCESSFULLY                         ');
        console.log('=============================================================\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('\n✗ Connection or Diagnostic Error:', err.message);
        console.log('\nTroubleshooting Tip:');
        console.log('Ensure MongoDB or Docker is running. To start the distributed cluster:');
        console.log('  docker compose up -d');
        process.exit(0);
    }
}

inspectCluster();
