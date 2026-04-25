// Minimal vscode stub so we can require() the compiled extension code from node:test.
// Only the surface area touched by pipeline.ts / aiService.ts is implemented.

class CancellationToken {
    constructor() {
        this._listeners = [];
        this.isCancellationRequested = false;
    }
    onCancellationRequested(cb) {
        this._listeners.push(cb);
        return { dispose() {} };
    }
    cancel() {
        this.isCancellationRequested = true;
        for (const cb of this._listeners) {
            try { cb(); } catch {}
        }
    }
}

const ProgressLocation = { Notification: 15, Window: 10, SourceControl: 1 };

const window = {
    async withProgress(_opts, task) {
        const progress = { report() {} };
        const token = new CancellationToken();
        return await task(progress, token);
    },
    createOutputChannel(name) {
        return {
            name,
            lines: [],
            appendLine(line) { this.lines.push(line); },
            append(s) { this.lines.push(s); },
            show() {},
            dispose() {},
        };
    },
};

function getConfiguration(_section) {
    const map = new Map();
    return {
        get(key, dflt) { return map.has(key) ? map.get(key) : dflt; },
        update(key, val) { map.set(key, val); return Promise.resolve(); },
        has(key) { return map.has(key); },
        _set(key, val) { map.set(key, val); },
    };
}

const workspace = {
    getConfiguration,
    asRelativePath(p) { return String(p); },
};

const Uri = {
    file(p) { return { fsPath: p, scheme: 'file', toString() { return `file://${p}`; } }; },
};

const commands = {
    async executeCommand() { return undefined; },
    registerCommand() { return { dispose() {} }; },
};

class Range {
    constructor(...args) { this.args = args; }
}

const SymbolKind = {};

module.exports = {
    window,
    workspace,
    Uri,
    commands,
    ProgressLocation,
    Range,
    SymbolKind,
    CancellationToken,
};
