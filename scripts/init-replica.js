/**
 * MongoDB Shell Script: Initialize 3-Node Replica Set (rs0)
 * Usage:
 *   mongosh --host localhost:27017 scripts/init-replica.js
 */

print("\n=======================================================");
print("  INITIALIZING MONGODB 3-NODE REPLICA SET (rs0)       ");
print("=======================================================\n");

try {
    const currentStatus = rs.status();
    print("Replica Set 'rs0' is already active.");
    printjson(currentStatus.members.map(m => ({ name: m.name, stateStr: m.stateStr, health: m.health })));
} catch (err) {
    print("Initiating Replica Set configuration...");
    const config = {
        _id: "rs0",
        members: [
            { _id: 0, host: "mongo1:27017", priority: 2 }, // Preferred Primary
            { _id: 1, host: "mongo2:27017", priority: 1 }, // Secondary
            { _id: 2, host: "mongo3:27017", priority: 1 }  // Secondary
        ]
    };

    const res = rs.initiate(config);
    printjson(res);

    print("\nWaiting for Primary election (5 seconds)...");
    sleep(5000);

    print("\nUpdated Replica Set Status:");
    printjson(rs.status().members.map(m => ({ name: m.name, stateStr: m.stateStr, health: m.health })));
}

print("\n✓ Replica Set setup complete.\n");
