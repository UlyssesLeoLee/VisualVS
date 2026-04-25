"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const memgraphClient_1 = require("../src/utils/memgraphClient");
async function runAutoVerify() {
    console.log('--- Automated Memgraph Data Verification ---');
    const host = 'localhost';
    const port = 37788;
    const client = new memgraphClient_1.MemgraphClient(host, port);
    try {
        console.log(`Checking connection to bolt://${host}:${port}...`);
        const status = await client.checkStatus();
        if (!status.connected) {
            console.error('❌ FAILED: Cannot connect to Memgraph. Is the tunnel/container running?');
            process.exit(1);
        }
        console.log(`✅ Connected. Current node count: ${status.nodeCount}`);
        console.log('Verifying visualvs_ready node existence...');
        const query = "MATCH (n:SystemStatus {id: 'visualvs_ready'}) RETURN n";
        const result = await client.executeGraphQuery(query);
        if (result.nodes.length > 0) {
            console.log('✅ SUCCESS: "visualvs_ready" node found in database!');
            console.log('Node details:', JSON.stringify(result.nodes[0], null, 2));
        }
        else {
            console.warn('⚠️  WARNING: "visualvs_ready" node not found. Attempting to create it...');
            const createQuery = `
                MERGE (n:SystemStatus {id: 'visualvs_ready'})
                SET n.label = 'VisualVS Ready', n.status = 'Online', n.timestamp = timestamp()
                RETURN n
            `;
            const created = await client.executeGraphQuery(createQuery);
            if (created.nodes.length > 0) {
                console.log('✅ SUCCESS: Node created successfully.');
            }
            else {
                console.error('❌ FAILED: Could not create or retrieve node.');
                process.exit(1);
            }
        }
        console.log('\n--- Verification Finished Successfully ---');
    }
    catch (err) {
        console.error('❌ ERROR during verification:', err);
        process.exit(1);
    }
    finally {
        await client.close();
    }
}
runAutoVerify();
//# sourceMappingURL=verify_memgraph.js.map