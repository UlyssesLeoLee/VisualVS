// Pipeline-level tests: drive the real Pipeline class with mock plugins,
// capture all `report()` calls, and assert the **开始** / **完成** markers
// AND the per-stage progression.
require('./register-vscode.cjs');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Pipeline } = require('../out/core/pipeline.js');
const { BasePlugin } = require('../out/core/plugin.js');

function makePlugin(name, stage, hooks = {}) {
    return new (class extends BasePlugin {
        constructor() { super(); this.name = name; this.stage = stage; }
        async prepare(ctx, log) {
            if (hooks.prepare) await hooks.prepare(ctx, log);
            return { skip: false };
        }
        async execute(ctx, log) {
            if (hooks.execute) await hooks.execute(ctx, log);
        }
        async teardown(ctx, log) {
            if (hooks.teardown) await hooks.teardown(ctx, log);
        }
    })();
}

function makeContext() {
    return {
        code: 'function f() { return 1; }',
        languageId: 'typescript',
        fileName: '/tmp/x.ts',
        fileScopeHash: 'file_abcd1234',
        codeHash: 'codehash',
        config: { get(_k, d) { return d; } },
        extensionUri: { fsPath: '/ext' },
    };
}

test('Pipeline emits **开始** before any stage and **完成** after post stage', async () => {
    const messages = [];
    const report = (msg, stage) => messages.push({ msg, stage });

    const pipeline = new Pipeline()
        .addPre(makePlugin('FakePre', 'pre'))
        .addMain(makePlugin('FakeMain', 'main'))
        .addPost(makePlugin('FakePost', 'post'));

    await pipeline.run(makeContext(), report);

    const all = messages.map(m => m.msg);
    const startIdx = all.findIndex(m => m.includes('**开始**'));
    const finishIdx = all.findIndex(m => m.includes('**完成**'));

    assert.ok(startIdx >= 0, `expected **开始** marker, got: ${JSON.stringify(all)}`);
    assert.ok(finishIdx > startIdx, `expected **完成** marker after **开始**, indices=${startIdx}/${finishIdx}`);

    // Pipeline-level markers should bracket all plugin activity
    const fakePreIdx = all.findIndex(m => m.includes('[FakePre]'));
    const fakePostIdx = all.findIndex(m => m.includes('[FakePost]'));
    assert.ok(startIdx < fakePreIdx, '**开始** should fire before pre stage');
    assert.ok(fakePostIdx < finishIdx, '**完成** should fire after post stage');
});

test('Pipeline runs stages in order: pre → main → post', async () => {
    const order = [];
    const pipeline = new Pipeline()
        .addPre(makePlugin('P1', 'pre', { execute: () => order.push('pre') }))
        .addMain(makePlugin('M1', 'main', { execute: () => order.push('main') }))
        .addPost(makePlugin('Po1', 'post', { execute: () => order.push('post') }));

    await pipeline.run(makeContext(), () => {});
    assert.deepEqual(order, ['pre', 'main', 'post']);
});

test('Pipeline propagates errors as PluginError and still runs teardown', async () => {
    const ran = [];
    const pipeline = new Pipeline()
        .addMain(makePlugin('Boom', 'main', {
            execute: () => { throw new Error('synthetic failure'); },
            teardown: () => { ran.push('teardown'); },
        }));

    await assert.rejects(
        pipeline.run(makeContext(), () => {}),
        /synthetic failure/,
    );
    assert.deepEqual(ran, ['teardown'], 'teardown must run even on execute failure');
});

test('Pipeline aborts cleanly when AbortController.abort() is called', async () => {
    const controller = new AbortController();
    const pipeline = new Pipeline()
        .addPre(makePlugin('Slow', 'pre', {
            execute: async () => {
                controller.abort();
                // Yield so the pipeline notices the signal before the next plugin
                await new Promise(r => setImmediate(r));
            },
        }))
        .addMain(makePlugin('NeverRuns', 'main', {
            execute: () => { throw new Error('should not be reached'); },
        }));

    await assert.rejects(
        pipeline.run(makeContext(), () => {}, controller),
        (err) => err && err.name === 'AbortError',
    );
});
