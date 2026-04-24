/**
 * @module memgraphClient
 * @description Bolt-protocol client for Memgraph (neo4j-driver).
 *   Provides scoped write, batched ingest, scoped delete, and full graph read.
 *   Lifecycle: caller owns open (constructor) and close(); sessions are per-operation.
 *
 * @cypher-manifest
 * // ── Module node ───────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'memgraphClient', path: 'src/utils/memgraphClient.ts', layer: 'util'})
 * // ── Class & method nodes ───────────────────────────────────────────────────
 * MERGE (:Class  {name: 'MemgraphClient',       module: 'memgraphClient'})
 * MERGE (:Method {name: 'executeCypher',         class: 'MemgraphClient', access: 'public'})
 * MERGE (:Method {name: 'executeCypherBatched',  class: 'MemgraphClient', access: 'public'})
 * MERGE (:Method {name: 'checkScopeHashMatch',   class: 'MemgraphClient', access: 'public'})
 * MERGE (:Method {name: 'deleteByScope',         class: 'MemgraphClient', access: 'public'})
 * MERGE (:Method {name: 'fetchGraphData',        class: 'MemgraphClient', access: 'public'})
 * MERGE (:Method {name: 'checkStatus',           class: 'MemgraphClient', access: 'public'})
 * MERGE (:Method {name: 'close',                 class: 'MemgraphClient', access: 'public'})
 * // ── Containment ────────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'memgraphClient'})-[:CONTAINS]->(:Class  {name: 'MemgraphClient'})
 * MERGE (:Class  {name: 'MemgraphClient'}) -[:CONTAINS]->(:Method {name: 'executeCypher'})
 * MERGE (:Class  {name: 'MemgraphClient'}) -[:CONTAINS]->(:Method {name: 'executeCypherBatched'})
 * MERGE (:Class  {name: 'MemgraphClient'}) -[:CONTAINS]->(:Method {name: 'checkScopeHashMatch'})
 * MERGE (:Class  {name: 'MemgraphClient'}) -[:CONTAINS]->(:Method {name: 'deleteByScope'})
 * MERGE (:Class  {name: 'MemgraphClient'}) -[:CONTAINS]->(:Method {name: 'fetchGraphData'})
 * MERGE (:Class  {name: 'MemgraphClient'}) -[:CONTAINS]->(:Method {name: 'checkStatus'})
 * MERGE (:Class  {name: 'MemgraphClient'}) -[:CONTAINS]->(:Method {name: 'close'})
 * // ── External dependencies ───────────────────────────────────────────────────
 * MERGE (:Class {name: 'MemgraphClient'})-[:USES]->(:Lib {name: 'neo4j-driver', protocol: 'bolt'})
 * // ── Callers (inbound edges from processors) ─────────────────────────────────
 * MERGE (:Class {name: 'AIGeneratorPlugin'})-[:CALLS]->(:Method {name: 'checkScopeHashMatch'})
 * MERGE (:Class {name: 'MemgraphIngestPlugin'})-[:CALLS]->(:Method {name: 'deleteByScope'})
 * MERGE (:Class {name: 'MemgraphIngestPlugin'})-[:CALLS]->(:Method {name: 'executeCypherBatched'})
 * MERGE (:Class {name: 'MemgraphIngestPlugin'})-[:CALLS]->(:Method {name: 'close'})
 * MERGE (:Class {name: 'GraphFetchPlugin'})-[:CALLS]->(:Method {name: 'fetchGraphData'})
 * MERGE (:Class {name: 'GraphFetchPlugin'})-[:CALLS]->(:Method {name: 'deleteByScope'})
 * MERGE (:Class {name: 'GraphFetchPlugin'})-[:CALLS]->(:Method {name: 'close'})
 * MERGE (:Class {name: 'VisualVSSidebarProvider'})-[:CALLS]->(:Method {name: 'checkStatus'})
 */

import neo4j from 'neo4j-driver';

export class MemgraphClient {
    private driver: any;

    constructor(host: string, port: number, username?: string, password?: string) {
        const auth = (username && password) 
            ? neo4j.auth.basic(username, password) 
            : undefined;

        this.driver = neo4j.driver(
            `bolt://${host}:${port}`, 
            auth,
            { disableLosslessIntegers: true, encrypted: 'ENCRYPTION_OFF' } as any
        );
    }

    async executeCypher(cypher: string): Promise<any> {
        const session = this.driver.session();
        try {
            await session.writeTransaction((tx: any) => tx.run(cypher));
        } finally {
            await session.close();
        }
    }

    async executeCypherBatched(cypherText: string, scopeHash: string, codeHash?: string): Promise<any> {
        const session = this.driver.session();
        try {
            // Split complex multiline/semicolon inputs from AI and run sequentially
            const commands = cypherText.split(';').map(c => c.trim()).filter(c => c.length > 0);
            await session.writeTransaction(async (tx: any) => {
                for (const cmd of commands) {
                    await tx.run(cmd);
                }
                
                // Add a metadata node to track the code hash for this scope
                if (codeHash) {
                    await tx.run(`
                        MERGE (m:ScopeMetadata {fileScope: $scope})
                        SET m.codeHash = $hash, m.lastAnalyzed = datetime()
                    `, { scope: scopeHash, hash: codeHash });
                }
            });
        } finally {
            await session.close();
        }
    }

    async checkScopeHashMatch(scopeHash: string, codeHash: string): Promise<boolean> {
        const session = this.driver.session();
        try {
            const result = await session.readTransaction((tx: any) => 
                tx.run(`MATCH (m:ScopeMetadata {fileScope: $scope, codeHash: $hash}) RETURN m`, { 
                    scope: scopeHash, hash: codeHash 
                })
            );
            return result.records.length > 0;
        } finally {
            await session.close();
        }
    }

    async deleteByScope(scopeHash: string): Promise<void> {
        const session = this.driver.session();
        try {
            await session.writeTransaction((tx: any) => 
                tx.run(`MATCH (n {fileScope: $scope}) DETACH DELETE n`, { scope: scopeHash })
            );
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

                const processNode = (node: any) => {
                    if (!node) return;
                    // Prefer elementId (string) over identity (Integer object)
                    const id = (node.elementId !== undefined) ? String(node.elementId) : node.identity.toString();
                    nodesMap.set(id, { 
                        id: id, 
                        label: node.properties.name || (node.labels && node.labels[0]) || 'Node',
                        properties: node.properties,
                        labels: node.labels
                    });
                };

                processNode(n);
                processNode(m);

                if (r) {
                    const id = (r.elementId !== undefined) ? String(r.elementId) : r.identity.toString();
                    const start = (r.startNodeElementId !== undefined) ? String(r.startNodeElementId) : r.start.toString();
                    const end = (r.endNodeElementId !== undefined) ? String(r.endNodeElementId) : r.end.toString();
                    
                    edges.push({
                        id: id,
                        start: start,
                        end: end,
                        label: r.type,
                        properties: r.properties
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

    async checkStatus(): Promise<{ connected: boolean; nodeCount: number; error?: string }> {
        const session = this.driver.session();
        try {
            const result = await session.readTransaction((tx: any) => 
                tx.run('MATCH (n) RETURN count(n) as cnt')
            );
            const count = result.records[0].get('cnt').low ?? result.records[0].get('cnt');
            return { connected: true, nodeCount: count };
        } catch (err: any) {
            return { connected: false, nodeCount: 0, error: err.message };
        } finally {
            await session.close();
        }
    }

    async close() {
        await this.driver.close();
    }
}
