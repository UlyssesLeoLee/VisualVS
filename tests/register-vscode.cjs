// Hook node's resolver so `require('vscode')` and the langchain modules
// resolve to local stubs.
const Module = require('module');
const path = require('path');

const stubs = {
    'vscode':                            path.resolve(__dirname, 'vscode-stub.cjs'),
    '@langchain/openai':                 path.resolve(__dirname, 'langchain-stubs.cjs'),
    '@langchain/core/prompts':           path.resolve(__dirname, 'langchain-stubs.cjs'),
    '@langchain/core/output_parsers':    path.resolve(__dirname, 'langchain-stubs.cjs'),
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return origResolve.call(this, request, parent, ...rest);
};
