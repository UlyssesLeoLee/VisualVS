// Stubs for @langchain/* so AIService can be tested without a network call.
// We model the chain as: prompt.pipe(model).pipe(parser) → has .stream(input, opts).
// stream() yields the canned chunks set by setNextChunks().

let _nextChunks = [];
let _lastInput = null;
let _lastSignal = null;

function setNextChunks(chunks) { _nextChunks = chunks; }
function getLastInput() { return _lastInput; }
function getLastSignal() { return _lastSignal; }

class FakeRunnable {
    pipe() { return this; }
    async stream(input, opts) {
        _lastInput = input;
        _lastSignal = opts && opts.signal;
        const chunks = _nextChunks;
        // Async generator that yields each chunk and respects abort
        return (async function* () {
            for (const c of chunks) {
                if (opts && opts.signal && opts.signal.aborted) {
                    const err = new Error('aborted'); err.name = 'AbortError';
                    throw err;
                }
                await new Promise(r => setImmediate(r));
                yield c;
            }
        })();
    }
}

class ChatOpenAI extends FakeRunnable {
    constructor(opts) { super(); this.opts = opts; }
}

class ChatPromptTemplate extends FakeRunnable {
    static fromMessages() { return new ChatPromptTemplate(); }
}

class SystemMessagePromptTemplate {
    static fromTemplate(t) { return { template: t }; }
}
class HumanMessagePromptTemplate {
    static fromTemplate(t) { return { template: t }; }
}

class JsonOutputParser extends FakeRunnable {
    getFormatInstructions() { return 'FORMAT_INSTRUCTIONS'; }
}

module.exports = {
    // Hooks for tests
    __setNextChunks: setNextChunks,
    __getLastInput: getLastInput,
    __getLastSignal: getLastSignal,
    // Module surfaces consumed by aiService.ts
    ChatOpenAI,
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    JsonOutputParser,
};
