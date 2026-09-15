const mongoose = require('mongoose');

/**
 * Enterprise MongoDB Database Connector
 * Supports Standalone, Replica Sets (HA & Failover), and Sharded Clusters (Horizontal Scaling).
 */
const connectDB = async () => {
    const connURL = process.env.DATABASE_CONN_URL || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'ecommerce';

    // Enterprise Mongoose Connection Options
    const options = {
        dbName: dbName,
        // Durability: Wait for write acknowledgement from a majority of replica set members
        writeConcern: {
            w: process.env.DB_WRITE_CONCERN || 'majority',
            j: true, // Journal acknowledgement
            wtimeout: 5000 // 5-second write timeout
        },
        // High Availability: Read preference for read-heavy operations
        readPreference: process.env.DB_READ_PREFERENCE || 'secondaryPreferred',
        // Connection pool optimization for concurrent distributed traffic
        maxPoolSize: 50,
        minPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
    };

    try {
        const conn = await mongoose.connect(connURL, options);

        const host = conn.connection.host;
        const port = conn.connection.port;
        console.log(`[Database] Connected to MongoDB: ${host}:${port} (Database: ${dbName})`);

        return conn;
    } catch (error) {
        console.error('[Database] Connection failed:', error.message);
        throw error;
    }
};

/**
 * Inspects cluster topology: checks if running as Standalone, Replica Set, or Sharded Cluster.
 */
const getClusterTopology = async () => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return { status: 'disconnected', type: 'unknown' };
        }

        const adminDb = mongoose.connection.db.admin();

        let isReplicaSet = false;
        let isSharded = false;
        let replicaSetName = null;
        let members = [];
        let shards = [];

        // Check Replica Set status
        try {
            const rsStatus = await adminDb.command({ replSetGetStatus: 1 });
            if (rsStatus && rsStatus.ok === 1) {
                isReplicaSet = true;
                replicaSetName = rsStatus.set;
                members = rsStatus.members.map(m => ({
                    name: m.name,
                    stateStr: m.stateStr,
                    health: m.health
                }));
            }
        } catch (e) {
            // Not running in replica set
        }

        // Check Sharded Cluster status
        try {
            const serverStatus = await adminDb.command({ serverStatus: 1 });
            if (serverStatus && serverStatus.process === 'mongos') {
                isSharded = true;
                try {
                    const shardList = await adminDb.command({ listShards: 1 });
                    if (shardList && shardList.shards) {
                        shards = shardList.shards.map(s => ({ id: s._id, host: s.host }));
                    }
                } catch (se) {}
            }
        } catch (e) {}

        let clusterType = 'Standalone';
        if (isSharded) clusterType = 'Sharded Cluster (mongos)';
        else if (isReplicaSet) clusterType = `Replica Set (${replicaSetName})`;

        return {
            status: 'connected',
            clusterType,
            isReplicaSet,
            isSharded,
            replicaSetName,
            members,
            shards,
            database: mongoose.connection.name
        };
    } catch (err) {
        return {
            status: 'connected',
            clusterType: 'Standalone / Unspecified',
            error: err.message
        };
    }
};

module.exports = {
    connectDB,
    getClusterTopology
};
