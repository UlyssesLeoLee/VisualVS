// Webview render path tests:
//   1. Load REAL dagre from node_modules.
//   2. Load the inline <script> from src/webview/index.html into a sandboxed
//      DOM-lite context with a fake `orb`, fake `acquireVsCodeApi`, and a
//      handful of stubbed elements.
//   3. Drive the message handler via a synthetic `message` event and assert:
//        - layoutNodes returns positioned nodes
//        - orb.data.setup is called with nodes + edges
//        - the Pipeline Log gets entries when 'progress' messages arrive
//        - the analyze button resets when 'progress' fires with stage='done'
//        - 'setData' with welcome data renders a single centered node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dagre = require('dagre');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'webview', 'index.html'), 'utf8');

// Extract the inline <script>...</script> at the bottom of index.html
function extractInlineScript(htmlSrc) {
    const all = [];
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(htmlSrc)) !== null) all.push(m[1]);
    // The webview's main app script is the largest inline block
    return all.sort((a, b) => b.length - a.length)[0];
}

// Minimal DOM stub: just enough surface for the webview script.
function makeElement(id) {
    const el = {
        id,
        children: [],
        innerHTML: '',
        innerText: '',
        title: '',
        value: '',
        offsetWidth: 800,
        offsetHeight: 600,
        style: {},
        classList: {
            _set: new Set(),
            add(...c) { c.forEach(x => this._set.add(x)); },
            remove(...c) { c.forEach(x => this._set.delete(x)); },
            contains(c) { return this._set.has(c); },
            toString() { return [...this._set].join(' '); },
        },
        appendChild(child) { this.children.push(child); return child; },
        setAttribute(k, v) { this[`__attr_${k}`] = v; },
        addEventListener() {},
        scrollHeight: 1000,
        scrollTop: 0,
        contentRect: { width: 800, height: 600 },
    };
    return el;
}

function makeDocument() {
    const elements = new Map();
    const get = (id) => {
        if (!elements.has(id)) elements.set(id, makeElement(id));
        return elements.get(id);
    };
    return {
        getElementById: get,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: (tag) => {
            const el = makeElement('__created_' + tag);
            el.tagName = tag.toUpperCase();
            return el;
        },
        _all: elements,
    };
}

function setupSandbox() {
    const document = makeDocument();
    const orbCalls = { setup: [], render: 0, recenter: 0, settings: [] };
    // Mirror the real Orb 0.2.x surface — `setDefaultStyle`, NOT `setupStyles`.
    // If the webview ever calls a missing method, we want the test to fail.
    const orbInstance = {
        data: {
            setDefaultStyle: (s) => orbCalls.settings.push({ style: s }),
            setup: (g) => orbCalls.setup.push(g),
        },
        view: {
            setSettings: (s) => orbCalls.settings.push(s),
            render: (cb) => { orbCalls.render++; if (cb) cb(); },
            recenter: () => { orbCalls.recenter++; },
        },
        events: { on: () => {} },
    };
    const Orb = function (container) { return orbInstance; };
    Orb.Orb = function (container) { return orbInstance; };

    const messageListeners = [];
    const sentToHost = [];

    const sandbox = {
        document,
        window: {
            addEventListener: (ev, cb) => { if (ev === 'message') messageListeners.push(cb); },
        },
        Orb,
        dagre,
        ResizeObserver: function () { this.observe = () => {}; },
        acquireVsCodeApi: () => ({ postMessage: (m) => sentToHost.push(m) }),
        console,
        setTimeout,
        clearTimeout,
        setImmediate,
    };
    sandbox.window.addEventListener = sandbox.window.addEventListener.bind(sandbox.window);
    return { sandbox, orbCalls, orbInstance, document, messageListeners, sentToHost };
}

function fireMessage(messageListeners, payload) {
    for (const cb of messageListeners) cb({ data: payload });
}

test('webview only calls methods that exist on the real Orb API surface', () => {
    // Spy proxy: records every property access on `orb.data.*` and `orb.view.*`.
    const accessed = { data: new Set(), view: new Set() };
    const noop = () => {};
    function trackingNamespace(name) {
        return new Proxy({}, {
            get(_t, prop) {
                if (typeof prop !== 'string') return undefined;
                accessed[name].add(prop);
                if (prop === 'render') return (cb) => { if (cb) cb(); };
                return noop;
            },
        });
    }
    const trackingOrb = {
        data: trackingNamespace('data'),
        view: trackingNamespace('view'),
        events: { on: () => {} },
    };
    const Orb = function () { return trackingOrb; };
    Orb.Orb = function () { return trackingOrb; };

    const { sandbox, messageListeners } = setupSandbox();
    sandbox.Orb = Orb;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(extractInlineScript(html), ctx);

    // Drive setData so the styling + setup paths run
    fireMessage(messageListeners, {
        type: 'setData',
        data: { nodes: [{ id: 'n1', label: 'n1' }], edges: [] },
    });

    // The real Orb 0.2.x exposes these on `data` and `view`. Anything else the
    // webview touches (other than `setup`/`setDefaultStyle`/`render`/`recenter`/
    // `setSettings`) is suspicious.
    const realDataApi = new Set([
        'setDefaultStyle', 'setup', 'merge', 'remove', 'getNodes', 'getEdges',
        'getNodeById', 'getEdgeById',
    ]);
    const realViewApi = new Set([
        'setSettings', 'getSettings', 'render', 'recenter',
    ]);

    for (const m of accessed.data) {
        assert.ok(realDataApi.has(m),
            `webview called orb.data.${m}() which does NOT exist on the real Orb API. ` +
            `Allowed: ${[...realDataApi].join(', ')}`);
    }
    for (const m of accessed.view) {
        assert.ok(realViewApi.has(m),
            `webview called orb.view.${m}() which does NOT exist on the real Orb API. ` +
            `Allowed: ${[...realViewApi].join(', ')}`);
    }

    // And it must use the right ones for the welcome flow:
    assert.ok(accessed.data.has('setDefaultStyle'),
        'webview must call orb.data.setDefaultStyle for theme application');
    assert.ok(accessed.data.has('setup'),
        'webview must call orb.data.setup to populate the graph');
    assert.ok(accessed.view.has('render'),
        'webview must call orb.view.render to draw');
});

test('webview script loads cleanly with real dagre + fake orb', () => {
    const script = extractInlineScript(html);
    const { sandbox } = setupSandbox();
    const ctx = vm.createContext(sandbox);
    assert.doesNotThrow(() => vm.runInContext(script, ctx));
});

test('layoutNodes uses dagre to position nodes hierarchically', () => {
    const script = extractInlineScript(html);
    const { sandbox } = setupSandbox();
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    const nodes = [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
        { id: 'c', label: 'c' },
    ];
    const edges = [
        { start: 'a', end: 'b' },
        { start: 'b', end: 'c' },
    ];
    const positioned = ctx.layoutNodes(nodes, edges);
    assert.equal(positioned.length, 3);
    for (const n of positioned) {
        assert.equal(typeof n.x, 'number', `node ${n.id} x must be a number`);
        assert.equal(typeof n.y, 'number', `node ${n.id} y must be a number`);
    }
    // a → b → c should be on different rows (y differs)
    const ya = positioned.find(n => n.id === 'a').y;
    const yc = positioned.find(n => n.id === 'c').y;
    assert.notEqual(ya, yc, 'top-bottom layout should put a and c on different ranks');
});

test('layoutNodes falls back to a grid when dagre is missing', () => {
    const script = extractInlineScript(html);
    const { sandbox } = setupSandbox();
    sandbox.dagre = undefined;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    const nodes = [
        { id: 'n1', label: 'n1' },
        { id: 'n2', label: 'n2' },
        { id: 'n3', label: 'n3' },
        { id: 'n4', label: 'n4' },
    ];
    const positioned = ctx.layoutNodes(nodes, []);
    assert.equal(positioned.length, 4);
    for (const n of positioned) {
        assert.equal(typeof n.x, 'number');
        assert.equal(typeof n.y, 'number');
    }
    // 4 nodes in a 2×2 grid should yield two distinct x values and two distinct y values
    const xs = new Set(positioned.map(n => n.x));
    const ys = new Set(positioned.map(n => n.y));
    assert.equal(xs.size, 2, 'grid fallback should produce 2 columns');
    assert.equal(ys.size, 2, 'grid fallback should produce 2 rows');
});

test("setData event renders nodes & edges into the orb", () => {
    const script = extractInlineScript(html);
    const { sandbox, orbCalls, messageListeners } = setupSandbox();
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    const data = {
        nodes: [
            { id: 'fA', label: 'fA', properties: { name: 'fA', fileScope: 'file_test' } },
            { id: 'fB', label: 'fB', properties: { name: 'fB', fileScope: 'file_test' } },
        ],
        edges: [
            { id: 'e1', start: 'fA', end: 'fB', label: 'CALLS', properties: {} },
        ],
    };
    fireMessage(messageListeners, { type: 'setData', data, fetchCypher: 'MATCH (n) RETURN n' });

    assert.ok(orbCalls.setup.length >= 1, 'orb.data.setup must be called for setData');
    const lastSetup = orbCalls.setup[orbCalls.setup.length - 1];
    assert.equal(lastSetup.nodes.length, 2);
    assert.equal(lastSetup.edges.length, 1);
    // Positioned by dagre
    assert.equal(typeof lastSetup.nodes[0].x, 'number');
    assert.equal(typeof lastSetup.nodes[0].y, 'number');
    assert.ok(orbCalls.render >= 1, 'orb.view.render must be called');

    // Cypher input should be populated with the AI-generated fetch query
    const cypherInput = ctx.document.getElementById('cypher-input');
    assert.equal(cypherInput.value, 'MATCH (n) RETURN n');
});

test('progress events append entries to the Pipeline Log', () => {
    const script = extractInlineScript(html);
    const { sandbox, messageListeners } = setupSandbox();
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    fireMessage(messageListeners, { type: 'progress', message: '**开始** Pipeline started', stage: 'pre' });
    fireMessage(messageListeners, { type: 'progress', message: '[FakePre] Done.', stage: 'pre' });
    fireMessage(messageListeners, { type: 'progress', message: '**完成** Pipeline finished', stage: 'post' });

    const logView = ctx.document.getElementById('log-view');
    const childCount = logView.children.length;
    assert.ok(childCount >= 3, `expected ≥3 log entries, got ${childCount}`);
    const messages = logView.children.map(c => c.innerHTML).join('\n');
    assert.match(messages, /\*\*开始\*\* Pipeline started/);
    assert.match(messages, /\*\*完成\*\* Pipeline finished/);
});

test('progress with stage="done" resets the analyze button', () => {
    const script = extractInlineScript(html);
    const { sandbox, messageListeners } = setupSandbox();
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    const btn = ctx.document.getElementById('btn-analyze');
    btn.classList.add('stop-mode');
    btn.innerText = '■ Stop';

    fireMessage(messageListeners, { type: 'progress', message: 'Complete', stage: 'done' });

    assert.ok(!btn.classList.contains('stop-mode'), 'stop-mode should be removed');
    assert.equal(btn.innerText, 'Analyze');
});

test('error event also writes a row into the Pipeline Log', () => {
    const script = extractInlineScript(html);
    const { sandbox, messageListeners } = setupSandbox();
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    fireMessage(messageListeners, {
        type: 'error',
        configError: 'Memgraph not reachable at bolt://localhost:37788 after 3010ms. ECONNREFUSED',
    });

    const logView = ctx.document.getElementById('log-view');
    const text = logView.children.map(c => c.innerHTML).join('\n');
    assert.match(text, /ECONNREFUSED/, 'error reason must appear in Pipeline Log');
    assert.match(text, /\[error\]/, 'log entry must be tagged with the error stage');
});

test('setData with 0 nodes logs a diagnostic instead of silently rendering blank', () => {
    const script = extractInlineScript(html);
    const { sandbox, messageListeners } = setupSandbox();
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    fireMessage(messageListeners, { type: 'setData', data: { nodes: [], edges: [] } });

    const logView = ctx.document.getElementById('log-view');
    const text = logView.children.map(c => c.innerHTML).join('\n');
    assert.match(text, /0 nodes returned/i, 'must explain why the graph is empty');
});

test('script load logs a diagnostic when dagre is missing at startup', () => {
    const script = extractInlineScript(html);
    const { sandbox } = setupSandbox();
    sandbox.dagre = undefined;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    const logView = ctx.document.getElementById('log-view');
    const text = logView.children.map(c => c.innerHTML).join('\n');
    assert.match(text, /dagre not loaded/i, 'startup must log the missing-dagre reason');
});

test('script load logs a diagnostic when Orb is missing', () => {
    const script = extractInlineScript(html);
    const { sandbox } = setupSandbox();
    sandbox.Orb = undefined;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    const logView = ctx.document.getElementById('log-view');
    const text = logView.children.map(c => c.innerHTML).join('\n');
    assert.match(text, /Graph engine \(Orb\) failed to initialize/i,
        'startup must log the missing-Orb reason');
});

test('error message resets the analyze button (no stuck spinner)', () => {
    const script = extractInlineScript(html);
    const { sandbox, messageListeners } = setupSandbox();
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    const btn = ctx.document.getElementById('btn-analyze');
    btn.classList.add('stop-mode');
    btn.innerText = '■ Stop';

    fireMessage(messageListeners, { type: 'error', configError: 'AI API down' });

    assert.ok(!btn.classList.contains('stop-mode'),
        'analyze button must reset on error so the user can retry');
    assert.equal(btn.innerText, 'Analyze');
});

test('initial placeholder node uses flat {id,label} shape (not wrapped under data:)', () => {
    const script = extractInlineScript(html);
    const { sandbox, orbCalls } = setupSandbox();
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    // Trigger the ResizeObserver code path manually — test sandbox uses a stub
    // observer that never fires, but the placeholder node is also visible in
    // the source. Match on what's about to be passed to orb.data.setup.
    const sourceText = script;
    assert.match(sourceText, /id:\s*'test_node_001',\s*label:\s*'Initial Node'/,
        'placeholder node must be FLAT { id, label } — not wrapped under .data');
    assert.doesNotMatch(sourceText, /id:\s*'test_node_001',\s*data:\s*\{/,
        'placeholder must NOT wrap label under .data (Orb expects flat input)');
});

test('welcome setData renders a single centered node from Memgraph', () => {
    const script = extractInlineScript(html);
    const { sandbox, orbCalls, messageListeners } = setupSandbox();
    const ctx = vm.createContext(sandbox);
    vm.runInContext(script, ctx);

    const welcome = {
        nodes: [{
            id: '1',
            label: 'VisualVS Ready',
            properties: { name: 'VisualVS Ready', status: 'Online', message: 'Click Analyze to visualize your code' },
            labels: ['SystemStatus'],
        }],
        edges: [],
    };
    fireMessage(messageListeners, { type: 'setData', data: welcome, isWelcome: true });

    const lastSetup = orbCalls.setup[orbCalls.setup.length - 1];
    assert.equal(lastSetup.nodes.length, 1);
    assert.equal(lastSetup.nodes[0].id, '1');
    assert.equal(lastSetup.nodes[0].label, 'VisualVS Ready');
    assert.equal(lastSetup.edges.length, 0);
    assert.ok(orbCalls.render >= 1, 'render must be called for welcome data');
});
