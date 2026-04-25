/**
 * Integration Test: VisualVS — Memgraph & AI (LangChain)
 * ──────────────────────────────────────────────────────
 * Run:
 *   $env:AI_ENDPOINT = "http://..."
 *   $env:AI_KEY      = "sk-..."
 *   $env:AI_MODEL    = "gpt-4"             # optional
 *   $env:MG_HOST     = "localhost"         # optional
 *   $env:MG_PORT     = "37788"             # optional
 *   node scripts/it_test.mjs
 */

import neo4j        from 'neo4j-driver';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

// ── Config ────────────────────────────────────────────────────────────────────
const AI_ENDPOINT = process.env.AI_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
const AI_KEY      = process.env.AI_KEY      || '';
const AI_MODEL    = process.env.AI_MODEL    || 'gpt-4';
const MG_HOST     = process.env.MG_HOST     || 'localhost';
const MG_PORT     = parseInt(process.env.MG_PORT || '37788', 10);
const MG_USER     = process.env.MG_USER     || '';
const MG_PASS     = process.env.MG_PASS     || '';

// openai SDK v6+ reads from process.env.OPENAI_API_KEY at model construction AND
// at request time (withStructuredOutput creates new internal clients).
// Set once globally for the entire test run — test scripts don't need paranoid cleanup.
if (AI_KEY) { process.env.OPENAI_API_KEY = AI_KEY; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const PASS = (msg) => console.log(`  ✅  ${msg}`);
const FAIL = (msg) => console.error(`  ❌  ${msg}`);
const INFO = (msg) => console.log(`  ℹ️   ${msg}`);

let failCount = 0;
async function test(name, fn) {
    process.stdout.write(`\n▶ ${name}\n`);
    try {
        await fn();
    } catch (e) {
        FAIL(`${name} threw: ${e.message}`);
        failCount++;
    }
}

// ── SUITE 1 — Memgraph ────────────────────────────────────────────────────────
async function suiteMemgraph() {
    console.log('\n══════════════════════════════════════════');
    console.log(' SUITE 1 — Memgraph Connectivity (Bolt)');
    console.log('══════════════════════════════════════════');

    const auth   = (MG_USER && MG_PASS) ? neo4j.auth.basic(MG_USER, MG_PASS) : undefined;
    const driver = neo4j.driver(
        `bolt://${MG_HOST}:${MG_PORT}`,
        auth,
        { disableLosslessIntegers: true, encrypted: 'ENCRYPTION_OFF' }
    );

    await test('1-1  Ping (RETURN 1)', async () => {
        const s = driver.session();
        try {
            const r = await s.readTransaction(tx => tx.run('RETURN 1 AS ok'));
            const val = r.records[0].get('ok');
            if (val !== 1) throw new Error(`Expected 1, got ${val}`);
            PASS(`Ping OK — Bolt connected to ${MG_HOST}:${MG_PORT}`);
        } finally {
            await s.close();
        }
    });

    await test('1-2  Node count (MATCH (n) RETURN count(n))', async () => {
        const s = driver.session();
        try {
            const r   = await s.readTransaction(tx => tx.run('MATCH (n) RETURN count(n) AS cnt'));
            const cnt = r.records[0].get('cnt');
            PASS(`Node count = ${cnt}`);
        } finally {
            await s.close();
        }
    });

    const SCOPE = `it_test_scope_${Date.now()}`;

    await test('1-3  Write :Function nodes', async () => {
        const s = driver.session();
        try {
            await s.writeTransaction(tx => tx.run(`
                MERGE (:Function {name: 'foo', fileScope: $scope})
                MERGE (:Function {name: 'bar', fileScope: $scope})
            `, { scope: SCOPE }));
            PASS('Write OK');
        } finally {
            await s.close();
        }
    });

    await test('1-4  Write :CALLS relationship', async () => {
        const s = driver.session();
        try {
            await s.writeTransaction(tx => tx.run(`
                MATCH (a:Function {name:'foo', fileScope:$scope})
                MATCH (b:Function {name:'bar', fileScope:$scope})
                MERGE (a)-[:CALLS]->(b)
            `, { scope: SCOPE }));
            PASS('Relationship write OK');
        } finally {
            await s.close();
        }
    });

    await test('1-5  Read graph back (MATCH (n)-[r]->(m))', async () => {
        const s = driver.session();
        try {
            const r = await s.readTransaction(tx => tx.run(`
                MATCH (n:Function {fileScope:$scope})-[rel:CALLS]->(m:Function {fileScope:$scope})
                RETURN n.name AS caller, m.name AS callee, type(rel) AS rel
            `, { scope: SCOPE }));
            if (r.records.length === 0) throw new Error('No CALLS edge found');
            const row = r.records[0];
            PASS(`Read OK — ${row.get('caller')} -[${row.get('rel')}]-> ${row.get('callee')}`);
        } finally {
            await s.close();
        }
    });

    await test('1-6  Cleanup (DETACH DELETE by scope)', async () => {
        const s = driver.session();
        try {
            await s.writeTransaction(tx => tx.run(
                'MATCH (n {fileScope: $scope}) DETACH DELETE n',
                { scope: SCOPE }
            ));
            PASS('Cleanup OK');
        } finally {
            await s.close();
        }
    });

    await driver.close();
}

// ── SUITE 2 — LangChain AI ────────────────────────────────────────────────────
async function suiteAI() {
    console.log('\n══════════════════════════════════════════');
    console.log(' SUITE 2 — LangChain AI (ChatOpenAI)');
    console.log('══════════════════════════════════════════');

    if (!AI_KEY) {
        console.log('  ⚠️  AI_KEY not set — skipping AI suite (set $env:AI_KEY to enable)');
        return;
    }

    const baseURL = AI_ENDPOINT.replace(/\/chat\/completions\/?$/, '');
    INFO(`Endpoint : ${baseURL}`);
    INFO(`Model    : ${AI_MODEL}`);

    // SDK v6+ reads from env, not constructor arg
    const _prevKey2 = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = AI_KEY || 'sk-placeholder';
    const model = new ChatOpenAI({
        modelName: AI_MODEL,
        openAIApiKey: AI_KEY,
        configuration: { baseURL, defaultHeaders: { 'Authorization': `Bearer ${AI_KEY}` } },
        temperature: 0.1,
        maxTokens: 512,
        timeout: 60_000,
    });
    if (_prevKey2 === undefined) { delete process.env.OPENAI_API_KEY; } else { process.env.OPENAI_API_KEY = _prevKey2; }

    const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
            'You are a code topology expert. Output only Cypher statements, no markdown, no explanation.'
        ),
        HumanMessagePromptTemplate.fromTemplate(
            `Analyze this code and return 1-3 Cypher MERGE statements using :Function nodes and :CALLS edges.
Every node MUST have fileScope: 'test_scope'.
Code:
{code}`
        ),
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const SAMPLE_CODE = `
function greet(name) { return \`Hello, \${name}\`; }
function main() { console.log(greet('world')); }
`;

    await test('2-1  LangChain chain invoke', async () => {
        const raw    = await chain.invoke({ code: SAMPLE_CODE });
        const cypher = raw.replace(/\`\`\`cypher/gi, '').replace(/\`\`\`/g, '').trim();
        if (!cypher.toUpperCase().includes('MERGE') && !cypher.toUpperCase().includes('CREATE')) {
            throw new Error(`Response does not look like Cypher:\n${cypher}`);
        }
        PASS('AI responded with Cypher');
        INFO(`\n--- Cypher output ---\n${cypher}\n---`);
        return cypher;
    });
}

// ── SUITE 3 — End-to-End: AI → Memgraph ──────────────────────────────────────
async function suiteE2E() {
    console.log('\n══════════════════════════════════════════');
    console.log(' SUITE 3 — End-to-End: AI → Memgraph');
    console.log('══════════════════════════════════════════');

    if (!AI_KEY) {
        console.log('  ⚠️  AI_KEY not set — skipping E2E suite');
        return;
    }

    const SCOPE = `e2e_test_${Date.now()}`;
    const baseURL = AI_ENDPOINT.replace(/\/chat\/completions\/?$/, '');

    // SDK v6+ reads from env, not constructor arg
    const _prevKey3 = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = AI_KEY || 'sk-placeholder';
    const model = new ChatOpenAI({
        modelName: AI_MODEL,
        openAIApiKey: AI_KEY,
        configuration: { baseURL, defaultHeaders: { 'Authorization': `Bearer ${AI_KEY}` } },
        temperature: 0.1,
        maxTokens: 512,
        timeout: 60_000,
    });
    if (_prevKey3 === undefined) { delete process.env.OPENAI_API_KEY; } else { process.env.OPENAI_API_KEY = _prevKey3; }

    const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
            'You are a code topology expert. Output only Cypher statements, no markdown, no explanation.'
        ),
        HumanMessagePromptTemplate.fromTemplate(
            `Return 1-3 Cypher MERGE statements using :Function nodes and :CALLS edges.
Every node MUST have fileScope: '{scope}'.
Code: {code}`
        ),
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    let cypherStatements = '';

    await test('3-1  Generate Cypher via AI', async () => {
        const raw = await chain.invoke({
            scope: SCOPE,
            code: `function alpha() { beta(); }\nfunction beta() { console.log('hi'); }`,
        });
        cypherStatements = raw.replace(/```cypher/gi, '').replace(/```/g, '').trim();
        if (!cypherStatements) throw new Error('Empty AI response');
        PASS(`Got ${cypherStatements.split(';').filter(s=>s.trim()).length} statement(s)`);
        INFO(`Cypher:\n${cypherStatements}`);
    });

    await test('3-2  Ingest AI Cypher → Memgraph', async () => {
        if (!cypherStatements) throw new Error('No Cypher from Step 3-1');
        const auth   = (MG_USER && MG_PASS) ? neo4j.auth.basic(MG_USER, MG_PASS) : undefined;
        const driver = neo4j.driver(
            `bolt://${MG_HOST}:${MG_PORT}`,
            auth,
            { disableLosslessIntegers: true, encrypted: 'ENCRYPTION_OFF' }
        );
        try {
            const s = driver.session();
            try {
                const commands = cypherStatements.split(';').map(c=>c.trim()).filter(c=>c);
                await s.writeTransaction(async tx => {
                    for (const cmd of commands) { await tx.run(cmd); }
                });
                PASS(`Ingested ${commands.length} statement(s)`);
            } finally {
                await s.close();
            }

            // Verify nodes exist with our scope
            const s2 = driver.session();
            try {
                const r = await s2.readTransaction(tx =>
                    tx.run('MATCH (n {fileScope:$scope}) RETURN count(n) AS cnt', { scope: SCOPE })
                );
                const cnt = r.records[0].get('cnt');
                PASS(`Verified ${cnt} node(s) with fileScope=${SCOPE}`);
                if (cnt === 0) throw new Error('AI Cypher did not include fileScope — check prompt');
            } finally {
                await s2.close();
            }

            // Cleanup
            const s3 = driver.session();
            try {
                await s3.writeTransaction(tx =>
                    tx.run('MATCH (n {fileScope:$scope}) DETACH DELETE n', { scope: SCOPE })
                );
                PASS('E2E cleanup done');
            } finally {
                await s3.close();
            }
        } finally {
            await driver.close();
        }
    });
}

// ── SUITE 4 — Structured Output (writeCypher + fetchCypher) + Graph Display ──
async function suiteStructuredOutput() {
    console.log('\n══════════════════════════════════════════');
    console.log(' SUITE 4 — Structured Output + Graph Display');
    console.log('══════════════════════════════════════════');

    if (!AI_KEY) {
        console.log('  ⚠️  AI_KEY not set — skipping Suite 4');
        return;
    }

    const SCOPE = `structured_test_${Date.now()}`;
    const baseURL = AI_ENDPOINT.replace(/\/chat\/completions\/?$/, '');

    // Build model same way as production code (env var injection for SDK v6+)
    const prevKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = AI_KEY || 'sk-placeholder';

    const model = new ChatOpenAI({
        modelName: AI_MODEL,
        openAIApiKey: AI_KEY,
        configuration: {
            baseURL,
            defaultHeaders: AI_KEY ? { 'Authorization': `Bearer ${AI_KEY}` } : {},
        },
        temperature: 0.1,
        maxTokens: 4096,
        timeout: 120_000,
    });

    if (prevKey === undefined) {
        delete process.env.OPENAI_API_KEY;
    } else {
        process.env.OPENAI_API_KEY = prevKey;
    }

    const { JsonOutputParser } = await import('@langchain/core/output_parsers');
    const parser = new JsonOutputParser();
    const formatInstructions = parser.getFormatInstructions();

    const { ChatPromptTemplate: CPT, SystemMessagePromptTemplate: SYS, HumanMessagePromptTemplate: HUM } = await import('@langchain/core/prompts');

    const structuredPrompt = CPT.fromMessages([
        SYS.fromTemplate('You are a code topology expert. You only output valid JSON representing Cypher queries.'),
        HUM.fromTemplate(`Analyze the following source code and extract the call graph.
{format_instructions}

Requirements:
1. "writeCypher": Cypher MERGE statements to ingest. Use :Function and :CALLS. Every node MUST have fileScope: '{scope}'.
2. "fetchCypher": A MATCH query to fetch ONLY nodes with fileScope: '{scope}'.
Code: {code}`),
    ]);

    const SAMPLE_CODE = `function alpha() { beta(); }\nfunction beta() { console.log('done'); }`;

    let writeCypher = '';
    let fetchCypher = '';

    await test('4-1  JsonOutputParser: writeCypher + fetchCypher generated', async () => {
        const chain = structuredPrompt.pipe(model).pipe(parser);
        const result = await chain.invoke({ scope: SCOPE, code: SAMPLE_CODE, format_instructions: formatInstructions });

        const normalize = (v) => Array.isArray(v) ? v.join(';\n') : (v || '');
        writeCypher = normalize(result.writeCypher);
        fetchCypher = normalize(result.fetchCypher);

        if (!writeCypher) throw new Error('writeCypher is empty');
        if (!fetchCypher) throw new Error('fetchCypher is empty');
        if (!writeCypher.toUpperCase().includes('MERGE') && !writeCypher.toUpperCase().includes('CREATE')) {
            throw new Error(`writeCypher does not look like Cypher:\n${writeCypher}`);
        }
        if (!fetchCypher.toUpperCase().includes('MATCH')) {
            throw new Error(`fetchCypher does not look like a MATCH query:\n${fetchCypher}`);
        }

        PASS(`writeCypher: OK (${writeCypher.length} chars)`);
        PASS(`fetchCypher: OK (${fetchCypher.length} chars)`);
        INFO(`writeCypher:\n${writeCypher}`);
        INFO(`fetchCypher:\n${fetchCypher}`);
    });

    // Test graph display pipeline: ingest → fetch via fetchCypher → verify nodes/edges
    await test('4-2  Ingest writeCypher into Memgraph', async () => {
        if (!writeCypher) throw new Error('No writeCypher from 4-1');
        const auth   = (MG_USER && MG_PASS) ? neo4j.auth.basic(MG_USER, MG_PASS) : undefined;
        const driver = neo4j.driver(`bolt://${MG_HOST}:${MG_PORT}`, auth, { disableLosslessIntegers: true, encrypted: 'ENCRYPTION_OFF' });
        try {
            const s = driver.session();
            try {
                const cmds = writeCypher.split(';').map(c => c.trim()).filter(c => c);
                await s.writeTransaction(async tx => {
                    for (const cmd of cmds) { await tx.run(cmd); }
                });
                PASS(`Ingested ${cmds.length} statement(s)`);
            } finally { await s.close(); }
        } finally { await driver.close(); }
    });

    await test('4-3  Fetch graph via AI-generated fetchCypher → verify nodes/edges visible', async () => {
        if (!fetchCypher) throw new Error('No fetchCypher from 4-1');
        const auth   = (MG_USER && MG_PASS) ? neo4j.auth.basic(MG_USER, MG_PASS) : undefined;
        const driver = neo4j.driver(`bolt://${MG_HOST}:${MG_PORT}`, auth, { disableLosslessIntegers: true, encrypted: 'ENCRYPTION_OFF' });

        try {
            const s = driver.session();
            try {
                const result = await s.readTransaction(tx => tx.run(fetchCypher));

                const nodesMap = new Map();
                const edges = [];

                result.records.forEach(record => {
                    record.keys.forEach(key => {
                        const val = record.get(key);
                        if (!val) return;
                        if (val.labels) {
                            const id = String(val.elementId ?? val.identity);
                            nodesMap.set(id, { label: val.properties.name || val.labels[0] });
                        }
                        if (val.type) {
                            edges.push({ type: val.type });
                        }
                    });
                });

                const nodes = Array.from(nodesMap.values());
                if (nodes.length === 0) throw new Error('fetchCypher returned 0 nodes — graph would be blank');

                PASS(`fetchCypher returned ${nodes.length} node(s), ${edges.length} edge(s) — graph display OK`);
                INFO(`Nodes: ${nodes.map(n => n.label).join(', ')}`);
                INFO(`Edges: ${edges.map(e => e.type).join(', ') || '(none yet)'}`);
            } finally { await s.close(); }
        } finally { await driver.close(); }
    });

    await test('4-4  Cleanup structured test scope', async () => {
        const auth   = (MG_USER && MG_PASS) ? neo4j.auth.basic(MG_USER, MG_PASS) : undefined;
        const driver = neo4j.driver(`bolt://${MG_HOST}:${MG_PORT}`, auth, { disableLosslessIntegers: true, encrypted: 'ENCRYPTION_OFF' });
        try {
            const s = driver.session();
            try {
                await s.writeTransaction(tx =>
                    tx.run('MATCH (n {fileScope:$scope}) DETACH DELETE n', { scope: SCOPE })
                );
                PASS('Cleanup OK');
            } finally { await s.close(); }
        } finally { await driver.close(); }
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   VisualVS Integration Test              ║');
    console.log('╚══════════════════════════════════════════╝');
    INFO(`Memgraph  : bolt://${MG_HOST}:${MG_PORT}`);
    INFO(`AI EP     : ${AI_ENDPOINT}`);
    INFO(`AI Model  : ${AI_MODEL}`);
    INFO(`AI Key    : ${AI_KEY ? AI_KEY.slice(0,8)+'...' : '(not set)'}`);

    await suiteMemgraph();
    await suiteAI();
    await suiteE2E();
    await suiteStructuredOutput();

    console.log('\n══════════════════════════════════════════');
    if (failCount === 0) {
        console.log(' 🎉  All tests passed!');
    } else {
        console.log(` 💥  ${failCount} test(s) FAILED`);
        process.exit(1);
    }
    console.log('══════════════════════════════════════════\n');
})();
