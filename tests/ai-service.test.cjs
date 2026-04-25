// AI service tests using the langchain stub: assert **开始**/**完成** markers,
// per-thought streaming, AbortError propagation, and empty-response handling.
require('./register-vscode.cjs');

const test = require('node:test');
const assert = require('node:assert/strict');
const { AIService } = require('../out/utils/aiService.js');
const lcStub = require('./langchain-stubs.cjs');

function makeContext(overrides = {}) {
    const cfg = new Map(Object.entries({
        'ai.endpoint': 'https://api.example.test/v1/chat/completions',
        'ai.apiKey':   'sk-test',
        'ai.model':    'gpt-4-test',
        ...overrides.config,
    }));
    return {
        code: 'function f() { g(); } function g() {}',
        languageId: 'typescript',
        fileName: '/tmp/x.ts',
        fileScopeHash: 'file_deadbeef',
        codeHash: 'codehash',
        astOutline: '- [Function] f\n- [Function] g',
        config: { get: (k, d) => cfg.has(k) ? cfg.get(k) : d },
        extensionUri: { fsPath: '/ext' },
        abortSignal: overrides.abortSignal,
    };
}

test('AIService.generateCypher emits **开始** and **完成** progress markers', async () => {
    lcStub.__setNextChunks([
        { thoughts: ['Scanning'] },
        { thoughts: ['Scanning', 'Found f'] },
        { thoughts: ['Scanning', 'Found f', 'Linking'],
          writeCypher: "MERGE (a:Function {name:'f'}) MERGE (b:Function {name:'g'}) MERGE (a)-[:CALLS]->(b)",
          fetchCypher: "MATCH (n) RETURN n" },
    ]);

    const messages = [];
    const result = await AIService.generateCypher(makeContext(), (m) => messages.push(m));

    const startIdx = messages.findIndex(m => m.includes('**开始**'));
    const finishIdx = messages.findIndex(m => m.includes('**完成**'));
    assert.ok(startIdx >= 0, `expected **开始** marker, got: ${JSON.stringify(messages)}`);
    assert.ok(finishIdx > startIdx, `expected **完成** after **开始**, got indices ${startIdx}/${finishIdx}`);

    // Per-thought updates should appear between markers
    const thoughtMsgs = messages.filter(m => m.startsWith('🤔'));
    assert.equal(thoughtMsgs.length, 3, `expected 3 streamed thoughts, got: ${JSON.stringify(thoughtMsgs)}`);

    // writeCypher / fetchCypher round-trip
    assert.match(result.writeCypher, /MERGE \(a:Function \{name:'f'\}\)/);
    assert.equal(result.fetchCypher, 'MATCH (n) RETURN n');
});

test('AIService.generateCypher throws when AI returns no writeCypher', async () => {
    lcStub.__setNextChunks([{ thoughts: ['nothing useful'] }]);
    await assert.rejects(
        AIService.generateCypher(makeContext(), () => {}),
        /AI Analysis failed: AI returned no writeCypher/,
    );
});

test('AIService.generateCypher throws when API key missing for OpenAI endpoint', async () => {
    await assert.rejects(
        AIService.generateCypher(makeContext({ config: { 'ai.apiKey': '', 'ai.endpoint': 'https://api.openai.com/v1/chat/completions' } }), () => {}),
        /API Key missing/,
    );
});

test('AIService.generateCypher propagates AbortError unwrapped', async () => {
    lcStub.__setNextChunks([{ thoughts: ['t1'] }, { thoughts: ['t1','t2'], writeCypher: 'M' }]);
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(
        AIService.generateCypher(makeContext({ abortSignal: ac.signal }), () => {}),
        (err) => err && err.name === 'AbortError',
    );
});

test('AIService.generateCypher synthesises a fallback fetchCypher when AI omits it', async () => {
    lcStub.__setNextChunks([
        { thoughts: ['x'], writeCypher: "MERGE (n:Function {name:'x', fileScope:'file_deadbeef'})" },
    ]);
    const result = await AIService.generateCypher(makeContext(), () => {});
    assert.match(result.fetchCypher, /fileScope:\s*'file_deadbeef'/);
});
