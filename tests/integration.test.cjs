// End-to-end: Pipeline (real) + fake AI plugin + fake Memgraph fetch plugin
// → captured via the webview message handler (real index.html script) →
// asserts the graph renders and the log shows **开始** / **完成**.
require('./register-vscode.cjs');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dagre = require('dagre');

const { Pipeline } = require('../out/core/pipeline.js');
const { BasePlugin } = require('../out/core/plugin.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'webview', 'index.html'), 'utf8');

function extractInlineScript(htmlSrc) {
    const all = [];
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(htmlSrc)) !== null) all.push(m[1]);
    return all.sort((a, b) => b.length - a.length)[0];
}

function makeElement(id) {
    const el = {
        id, children: [], innerHTML: '', innerText: '', title: '', value: '',
        offsetWidth: 800, offsetHeight: 600, style: {},
        classList: { _set: new Set(), add(...c){c.forEach(x=>this._set.add(x))}, remove(...c){c.forEach(x=>this._set.delete(x))}, contains(c){return this._set.has(c)} },
        appendChild(c){this.children.push(c);return c}, setAttribute(){}, addEventListener(){}, scrollHeight: 1000, scrollTop: 0,
        contentRect: { width: 800, height: 600 },
    };
    return el;
}
function makeDocument() {
    const elements = new Map();
    return {
        getElementById: (id) => { if (!elements.has(id)) elements.set(id, makeElement(id)); return elements.get(id); },
        querySelector: () => null, querySelectorAll: () => [],
        createElement: (tag) => { const el = makeElement('__c_' + tag); el.tagName = tag.toUpperCase(); return el; },
    };
}
function setupWebviewSandbox() {
    const document = makeDocument();
    const orbCalls = { setup: [], render: 0 };
    const orbInstance = {
        data: { setDefaultStyle: () => {}, setup: (g) => orbCalls.setup.push(g) },
        view: { setSettings: () => {}, render: (cb) => { orbCalls.render++; if (cb) cb(); }, recenter: () => {} },
        events: { on: () => {} },
    };
    const Orb = function(){return orbInstance}; Orb.Orb = function(){return orbInstance};
    const messageListeners = [];
    const sandbox = {
        document,
        window: { addEventListener: (ev, cb) => { if (ev==='message') messageListeners.push(cb); } },
        Orb, dagre, ResizeObserver: function(){this.observe=()=>{}},
        acquireVsCodeApi: () => ({ postMessage: () => {} }),
        console, setTimeout, clearTimeout, setImmediate,
    };
    return { sandbox, orbCalls, document, messageListeners };
}

function makeFakeAIPlugin(reportThoughts = ['Scanning', 'Found f', 'Linking']) {
    return new (class extends BasePlugin {
        constructor() { super(); this.name = 'AIGenerator'; this.stage = 'main'; }
        async prepare(_ctx, _log) { return { skip: false }; }
        async execute(ctx, log) {
            log('**开始** AI request → mock-endpoint (model=mock)');
            for (const t of reportThoughts) log(`🤔 ${t}`);
            ctx.cypher = "MERGE (a:Function {name:'f', fileScope:'file_test'}) MERGE (b:Function {name:'g', fileScope:'file_test'}) MERGE (a)-[:CALLS]->(b)";
            ctx.fetchCypher = `MATCH (n {fileScope:'file_test'})-[r]->(m) RETURN n, r, m`;
            log(`**完成** AI response in 7ms (chunks=3, writeCypher=${ctx.cypher.length} chars)`);
        }
    })();
}
function makeFakeIngestPlugin() {
    return new (class extends BasePlugin {
        constructor() { super(); this.name = 'MemgraphIngest'; this.stage = 'post'; }
        async prepare(ctx) { return { skip: !ctx.cypher }; }
        async execute(_ctx, log) { log('Ingest complete (mock).'); }
    })();
}
function makeFakeFetchPlugin() {
    return new (class extends BasePlugin {
        constructor() { super(); this.name = 'GraphFetch'; this.stage = 'post'; }
        async prepare() { return { skip: false }; }
        async execute(ctx, log) {
            ctx.graphData = {
                nodes: [
                    { id: 'fA', label: 'f', properties: { name: 'f', fileScope: 'file_test' } },
                    { id: 'fB', label: 'g', properties: { name: 'g', fileScope: 'file_test' } },
                ],
                edges: [
                    { id: 'e1', start: 'fA', end: 'fB', label: 'CALLS', properties: {} },
                ],
            };
            log(`Fetched ${ctx.graphData.nodes.length} nodes, ${ctx.graphData.edges.length} edges.`);
        }
    })();
}

test('end-to-end: Pipeline → mocked AI → fake Memgraph → webview renders graph + log', async () => {
    const ctx = {
        code: 'function f(){g()} function g(){}', languageId: 'typescript',
        fileName: '/tmp/x.ts', fileScopeHash: 'file_test', codeHash: 'h',
        config: { get: (_k, d) => d }, extensionUri: { fsPath: '/ext' },
    };

    // Wire pipeline progress messages straight into the webview's message handler
    const wv = setupWebviewSandbox();
    const vctx = vm.createContext(wv.sandbox);
    vm.runInContext(extractInlineScript(html), vctx);

    const pipeline = new Pipeline()
        .addMain(makeFakeAIPlugin())
        .addPost(makeFakeIngestPlugin())
        .addPost(makeFakeFetchPlugin());

    const allReports = [];
    const onProgress = (message, stage) => {
        allReports.push({ message, stage });
        // Mirror the extension's host: forward as a 'progress' postMessage to the webview
        for (const cb of wv.messageListeners) cb({ data: { type: 'progress', message, stage } });
    };

    await pipeline.run(ctx, onProgress);

    // After pipeline finishes, the extension would post setData. Simulate that.
    for (const cb of wv.messageListeners) {
        cb({ data: { type: 'setData', data: ctx.graphData, fetchCypher: ctx.fetchCypher } });
    }

    // 1) Pipeline-level markers
    assert.ok(allReports.some(r => r.message.includes('**开始**')), 'pipeline must emit **开始**');
    assert.ok(allReports.some(r => r.message.includes('**完成**')), 'pipeline must emit **完成**');

    // 2) AI-level markers came through too
    assert.ok(allReports.some(r => r.message.includes('AI request →')), 'AI start marker should be present');
    assert.ok(allReports.some(r => r.message.includes('AI response in')), 'AI finish marker should be present');

    // 3) Webview's Pipeline Log got entries
    const logView = vctx.document.getElementById('log-view');
    const logText = logView.children.map(c => c.innerHTML).join('\n');
    assert.match(logText, /\*\*开始\*\*/, 'log view should contain **开始** entry');
    assert.match(logText, /\*\*完成\*\*/, 'log view should contain **完成** entry');
    assert.match(logText, /AI request →/, 'log view should contain AI start');
    assert.match(logText, /AI response in/, 'log view should contain AI finish');
    assert.match(logText, /Fetched 2 nodes, 1 edges/, 'log view should contain fetch summary');

    // 4) Orb received the graph
    assert.ok(wv.orbCalls.setup.length >= 1, 'orb.data.setup must be invoked at least once');
    const setup = wv.orbCalls.setup[wv.orbCalls.setup.length - 1];
    assert.equal(setup.nodes.length, 2);
    assert.equal(setup.edges.length, 1);
    assert.equal(setup.edges[0].start, 'fA');
    assert.equal(setup.edges[0].end, 'fB');
    // dagre laid them out
    assert.equal(typeof setup.nodes[0].x, 'number');
    assert.equal(typeof setup.nodes[0].y, 'number');

    // 5) Cypher editor populated with the AI fetch query
    const cypherInput = vctx.document.getElementById('cypher-input');
    assert.match(cypherInput.value, /MATCH \(n \{fileScope:'file_test'\}\)/);

    // 6) Analyze button was reset (stage='done' fired during pipeline tail)
    const btn = vctx.document.getElementById('btn-analyze');
    assert.ok(!btn.classList.contains('stop-mode'), 'analyze button should not be stuck in stop-mode');
});
