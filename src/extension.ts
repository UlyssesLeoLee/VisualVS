/**
 * @module extension
 * @description VS Code extension entry point for VisualVS.
 *   Registers the sidebar WebviewViewProvider and commands.
 *   Owns the top-level pipeline assembly and error routing.
 *
 * @cypher-manifest
 * // ── Module node ───────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'extension', path: 'src/extension.ts', layer: 'entry'})
 * MERGE (:Module {name: 'extension'})-[:IMPORTS]->(:Module {name: 'pipeline'})
 * MERGE (:Module {name: 'extension'})-[:IMPORTS]->(:Module {name: 'plugin'})
 * MERGE (:Module {name: 'extension'})-[:IMPORTS]->(:Module {name: 'processors'})
 * MERGE (:Module {name: 'extension'})-[:IMPORTS]->(:Module {name: 'k8sManager'})
 * // ── Exported functions & classes ────────────────────────────────────────────
 * MERGE (:Function {name: 'activate',   module: 'extension', exported: true})
 * MERGE (:Function {name: 'deactivate', module: 'extension', exported: true})
 * MERGE (:Class    {name: 'VisualVSSidebarProvider', module: 'extension'})
 * // ── Containment ────────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'extension'})-[:CONTAINS]->(:Function {name: 'activate'})
 * MERGE (:Module {name: 'extension'})-[:CONTAINS]->(:Function {name: 'deactivate'})
 * MERGE (:Module {name: 'extension'})-[:CONTAINS]->(:Class    {name: 'VisualVSSidebarProvider'})
 * // ── Relationships ──────────────────────────────────────────────────────────
 * MERGE (:Function {name: 'activate'})-[:CALLS]->(:Class {name: 'VisualVSSidebarProvider'})
 * MERGE (:Class {name: 'VisualVSSidebarProvider'})-[:CALLS]->(:Class {name: 'Pipeline'})
 * MERGE (:Class {name: 'VisualVSSidebarProvider'})-[:USES]->(:Class  {name: 'EnvLoaderPlugin'})
 * MERGE (:Class {name: 'VisualVSSidebarProvider'})-[:USES]->(:Class  {name: 'ASTProcessorPlugin'})
 * MERGE (:Class {name: 'VisualVSSidebarProvider'})-[:USES]->(:Class  {name: 'K8sConnPlugin'})
 * MERGE (:Class {name: 'VisualVSSidebarProvider'})-[:USES]->(:Class  {name: 'AIGeneratorPlugin'})
 * MERGE (:Class {name: 'VisualVSSidebarProvider'})-[:USES]->(:Class  {name: 'MemgraphIngestPlugin'})
 * MERGE (:Class {name: 'VisualVSSidebarProvider'})-[:USES]->(:Class  {name: 'GraphFetchPlugin'})
 * MERGE (:Class {name: 'VisualVSSidebarProvider'})-[:READS {field: 'graphData'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Class {name: 'VisualVSSidebarProvider'})-[:CALLS]->(:Cmd {name: 'vscode.open'})
 * MERGE (:Class {name: 'VisualVSSidebarProvider'})-[:IMPLEMENTS]->(:Interface {name: 'WebviewViewProvider', module: 'vscode'})
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Pipeline, PipelineContext } from './core/pipeline';
import { PluginError } from './core/plugin';
import {
    EnvLoaderPlugin,
    ASTProcessorPlugin,
    K8sConnPlugin,
    AIGeneratorPlugin,
    MemgraphIngestPlugin,
    GraphFetchPlugin
} from './core/processors';
import { K8sManager } from './utils/k8sManager';
import { MemgraphClient } from './utils/memgraphClient';

let sidebarProvider: VisualVSSidebarProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('VisualVS is now active!');

    sidebarProvider = new VisualVSSidebarProvider(context, context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('visualvs-sidebar', sidebarProvider)
    );

    // Notify sidebar when the active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.uri.scheme === 'file') {
            sidebarProvider.setTargetDocument(editor.document);
        }
    }, null, context.subscriptions);

    // Initial state on activation
    if (vscode.window.activeTextEditor?.document.uri.scheme === 'file') {
        sidebarProvider.setTargetDocument(vscode.window.activeTextEditor.document);
    }

    const visualizeCmd = vscode.commands.registerCommand('visualvs.visualize', async () => {
        if (sidebarProvider) {
            await sidebarProvider.runAnalysis();
        }
    });

    const deployCmd = vscode.commands.registerCommand('visualvs.deployMemgraph', async () => {
        const config = vscode.workspace.getConfiguration('visualvs');
        const namespace = config.get<string>('memgraph.namespace') || 'default';
        try {
            await K8sManager.deployMemgraph(namespace);
            vscode.window.showInformationMessage(
                `VisualVS: Triggered Memgraph deployment to namespace '${namespace}'.`
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Deployment failed: ${error.message}`);
        }
    });

    const toggleCmd = vscode.commands.registerCommand('visualvs.toggleWindow', () => {
        vscode.commands.executeCommand('workbench.view.extension.visualvs-explorer');
    });

    // Create a StatusBarItem to act as the toggle button
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(type-hierarchy-sub) VVS";
    statusBarItem.tooltip = "Toggle VVS Control Window";
    statusBarItem.command = 'visualvs.toggleWindow';
    statusBarItem.show();

    const updateVsixCmd = vscode.commands.registerCommand('visualvs.updateFromVsix', async () => {
        const uris = await vscode.workspace.findFiles('visualvs-*.vsix');
        if (uris.length === 0) {
            vscode.window.showErrorMessage('No visualvs-*.vsix files found in the workspace.');
            return;
        }

        // Sort by modified time to get the latest vsix
        uris.sort((a, b) => {
            const statA = fs.statSync(a.fsPath);
            const statB = fs.statSync(b.fsPath);
            return statB.mtime.getTime() - statA.mtime.getTime();
        });

        const latestVsix = uris[0];
        try {
            await vscode.commands.executeCommand('workbench.extensions.installExtension', latestVsix);
            vscode.window.showInformationMessage(`Successfully installed latest plugin: ${path.basename(latestVsix.fsPath)}`);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to install VSIX: ${err.message}`);
        }
    });

    context.subscriptions.push(visualizeCmd, deployCmd, toggleCmd, statusBarItem, updateVsixCmd);
}

// =============================================================================
// VisualVSSidebarProvider
// =============================================================================

class VisualVSSidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _targetDocument?: vscode.TextDocument;

    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly _extensionUri: vscode.Uri
    ) {}

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    public setTargetDocument(doc: vscode.TextDocument) {
        this._targetDocument = doc;
        const fileName = path.basename(doc.fileName);
        this.postMessageToWebview({
            type: 'updateContext',
            currentFile: fileName
        });
    }

    public postMessageToWebview(message: any) {
        this._view?.webview.postMessage(message);
    }

    // -------------------------------------------------------------------------
    // WebviewViewProvider
    // -------------------------------------------------------------------------

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        try {
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [this._extensionUri]
            };

            webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

            // Re-sync state whenever the panel becomes visible again
            webviewView.onDidChangeVisibility(() => {
                if (webviewView.visible) {
                    this._syncState();
                }
            }, null);

            webviewView.webview.onDidReceiveMessage(async (message) => {
                switch (message.type) {
                    case 'visualize':
                        await this.runAnalysis();
                        break;
                    case 'openSettings':
                        vscode.commands.executeCommand('workbench.action.openSettings', 'visualvs');
                        break;
                    case 'selectFile':
                        vscode.window.showOpenDialog({
                            canSelectMany: false,
                            openLabel: 'Select File for Analysis',
                            canSelectFiles: true,
                            canSelectFolders: false
                        }).then(uris => {
                            if (uris?.[0]) {
                                vscode.workspace.openTextDocument(uris[0]).then(doc => {
                                    this.setTargetDocument(doc);
                                });
                            }
                        });
                        break;
                    case 'updatePMode':
                        this._context.globalState.update('persistenceMode', message.mode);
                        break;
                    case 'openNode':
                        this._handleOpenNode(message.data);
                        break;
                    case 'ready':
                        this._syncState();
                        break;
                    case 'testMGConnection':
                        this._handleTestConnection();
                        break;
                }
            });
        } catch (error: any) {
            this._handleWebviewLoadError(webviewView, error);
        }
    }

    // -------------------------------------------------------------------------
    // Core analysis pipeline
    // -------------------------------------------------------------------------

    public async runAnalysis() {
        const doc = this._targetDocument;
        const pMode = this._context.globalState.get<string>('persistenceMode', 'persistent');

        const ctx: PipelineContext = {
            code:          doc ? doc.getText() : '',
            languageId:    doc ? doc.languageId : '',
            fileName:      doc ? doc.fileName : '',
            fileScopeHash: '',
            codeHash:      '',
            config:        vscode.workspace.getConfiguration('visualvs'),
            extensionUri:  this._extensionUri,
        };// GraphFetchPlugin reads ctx.config.get('visualvs.persistenceMode').
        // We write it back so the plugin sees the runtime value, not the stored setting.
        // This is the clean boundary: extension state → PipelineContext → Plugin.
        Object.defineProperty(ctx, '_pMode', { value: pMode, writable: false });

        const pipeline = new Pipeline();

        // PRE stage
        pipeline
            .addPre(new EnvLoaderPlugin())
            .addPre(new ASTProcessorPlugin())
            .addPre(new K8sConnPlugin());

        // MAIN stage
        pipeline
            .addMain(new AIGeneratorPlugin());

        // POST stage
        pipeline
            .addPost(new MemgraphIngestPlugin())
            .addPost(new GraphFetchPlugin());

        try {
            await pipeline.run(ctx, (msg, stage) => {
                this.postMessageToWebview({ type: 'progress', message: msg, stage });
            });

            // ctx.graphData is populated by GraphFetchPlugin
            this.postMessageToWebview({
                type: 'setData',
                data: ctx.graphData ?? { nodes: [], edges: [] },
                configError: ctx.configError,
                currentFile: ctx.fileName ? path.basename(ctx.fileName) : undefined,
                pMode
            });
        } catch (error: any) {
            this._handlePipelineError(error);
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private async _handleOpenNode(data: any) {
        if (!this._targetDocument) return;
        
        const symbolName = data.label; // Expecting function name
        if (!symbolName) return;

        const text = this._targetDocument.getText();
        const lines = text.split('\n');
        let foundLine = -1;

        // Simple heuristic: find line containing "function name" or "name("
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`function ${symbolName}`) || lines[i].includes(`${symbolName}(`)) {
                foundLine = i;
                break;
            }
        }

        if (foundLine !== -1) {
            await vscode.window.showTextDocument(this._targetDocument, {
                preview: true,
                selection: new vscode.Range(foundLine, 0, foundLine, 0)
            });
        }
    }

    private _syncState() {
        const pMode = this._context.globalState.get<string>('persistenceMode', 'persistent');
        const currentFile = this._targetDocument
            ? path.basename(this._targetDocument.fileName)
            : undefined;
        this.postMessageToWebview({ type: 'syncState', pMode, currentFile });
    }

    private _handlePipelineError(error: any) {
        const rawMsg: string = error.message || String(error);
        this.postMessageToWebview({ type: 'error', configError: rawMsg });

        // Route to the most actionable settings page based on error stage/content
        let action = 'Dismiss';
        if (error instanceof PluginError) {
            if (error.pluginStage === 'main') {
                action = 'Open AI Settings';
            } else if (error.pluginStage === 'post' || error.pluginStage === 'pre') {
                action = 'Memgraph Settings';
            }
        } else if (rawMsg.includes('API Key') || rawMsg.includes('401')) {
            action = 'Open AI Settings';
        } else if (rawMsg.toLowerCase().includes('connect') || rawMsg.includes('ECONNREFUSED')) {
            action = 'Memgraph Settings';
        }

        vscode.window.showErrorMessage(`VisualVS Pipeline Error:\n${rawMsg}`, action).then(res => {
            if (res === 'Open AI Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'visualvs.ai');
            } else if (res === 'Memgraph Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'visualvs.memgraph');
            }
        });
    }

    private _handleWebviewLoadError(webviewView: vscode.WebviewView, error: any) {
        console.error('VisualVS webview load error:', error);
        const msg: string = error.message || String(error);

        const actions: string[] = msg.includes('ENOENT') && msg.includes('index.html')
            ? ['Open README']
            : ['Dismiss'];

        vscode.window.showErrorMessage(`VisualVS Webview failed to load: ${msg}`, ...actions)
            .then(selection => {
                if (selection === 'Open README') {
                    vscode.commands.executeCommand(
                        'markdown.showPreview',
                        vscode.Uri.file(path.join(this._extensionUri.fsPath, 'README.md'))
                    );
                }
            });

        webviewView.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: sans-serif; color: #ff5050; padding: 20px; }
                    pre  { background: rgba(255,0,0,0.1); padding: 10px; border-radius: 4px; overflow-x: auto; }
                </style>
            </head>
            <body>
                <h3>VisualVS Webview Crash</h3>
                <p>An error was intercepted during initialization:</p>
                <pre>${error.stack || error.message}</pre>
            </body>
            </html>
        `;
    }

    private async _handleTestConnection() {
        const config = vscode.workspace.getConfiguration('visualvs');
        const host = config.get<string>('memgraph.host') || 'localhost';
        const port = config.get<number>('memgraph.port') || 37788;
        const user = config.get<string>('visualvs.memgraph.username');
        const pass = config.get<string>('visualvs.memgraph.password');

        const client = new MemgraphClient(host, port, user, pass);
        try {
            const status = await client.checkStatus();
            this.postMessageToWebview({
                type: 'mgStatus',
                connected: status.connected,
                nodeCount: status.nodeCount,
                error: status.error
            });
        } finally {
            await client.close();
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'index.html');
        return fs.readFileSync(htmlPath, 'utf8');
    }
}

export function deactivate() {}
