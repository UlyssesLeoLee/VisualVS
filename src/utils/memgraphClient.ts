import neo4j from 'neo4j-driver';

export class MemgraphClient {
    private driver: any;

    constructor(host: string, port: number) {
        this.driver = neo4j.driver(
            `bolt://${host}:${port}`, 
            neo4j.auth.basic('', ''),
            { encrypted: 'ENCRYPTED_OFF', trust: 'TRUST_ALL_CERTIFICATES' }
        );
    }

    async executeCypher(cypher: string): Promise<any> {
        const session = this.driver.session();
        try {
            // Split cypher by lines or semicolons if necessary, 
            // but usually a well-formed cypher script works in one run for simple nodes.
            // For safety, we execute as as single transaction.
            await session.writeTransaction((tx: any) => tx.run(cypher));
        } finally {
            await session.close();
        }
    }

    async fetchGraphData(): Promise<{ nodes: any[], edges: any[] }> {
        const session = this.driver.session();
        try {
            const result = await session.readTransaction((tx: any) => 
                tx.run('MATCH (n)-[r]->(m) RETURN n, r, m UNION MATCH (n) WHERE NOT (n)--() RETURN n, null as r, null as m')
            );
            
            const nodesMap = new Map();
            const edges: any[] = [];

            result.records.forEach((record: any) => {
                const n = record.get('n');
                const r = record.get('r');
                const m = record.get('m');

                if (n) nodesMap.set(n.identity.toString(), { id: n.identity.toString(), label: n.properties.name || 'Node' });
                if (m) nodesMap.set(m.identity.toString(), { id: m.identity.toString(), label: m.properties.name || 'Node' });
                if (r) {
                    edges.push({
                        id: r.identity.toString(),
                        start: r.start.toString(),
                        end: r.end.toString(),
                        label: r.type
                    });
                }
            });

            return {
                nodes: Array.from(nodesMap.values()),
                edges: edges
            };
        } finally {
            await session.close();
        }
    }

    async close() {
        await this.driver.close();
    }
}
