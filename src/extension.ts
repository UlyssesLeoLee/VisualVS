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
import * as crypto from 'crypto';
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
let activeController: AbortController | undefined;
export const vvsOutputChannel = vscode.window.createOutputChannel('VisualVS Log');


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
            
            const autoMode = context.globalState.get<boolean>('autoMode', false);
            if (autoMode) {
                sidebarProvider.runAnalysis();
            }
        } else {
            sidebarProvider.clearTargetDocument();
        }
    }, null, context.subscriptions);

    // Initial state on activation
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.scheme === 'file') {
        sidebarProvider.setTargetDocument(activeEditor.document);
    } else {
        sidebarProvider.clearTargetDocument();
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

    const toggleCmd = vscode.commands.registerCommand('visualvs.toggleWindow', async () => {
        // Try to focus the specific webview view first.
        // If the panel container is not open, this will open it and focus the view.
        try {
            await vscode.commands.executeCommand('visualvs-sidebar.focus');
        } catch {
            // Fallback: open the panel container
            await vscode.commands.executeCommand('workbench.view.extension.visualvs-panel');
        }
    });

    // Create a StatusBarItem to act as the toggle button
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(sparkle) VisualVS";
    statusBarItem.tooltip = "Start VisualVS Analysis";
    statusBarItem.command = 'visualvs.toggleWindow';
    statusBarItem.show();

    const updateVsixCmd = vscode.commands.registerCommand('visualvs.updateFromVsix', async () => {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Install VSIX',
            filters: {
                'VSIX Extensions': ['vsix']
            },
            title: 'Select VisualVS VSIX File to Install'
        });

        if (!uris || uris.length === 0) {
            return; // User canceled
        }

        const selectedVsix = uris[0];
        try {
            await vscode.commands.executeCommand('workbench.extensions.installExtension', selectedVsix);
            const action = await vscode.window.showInformationMessage(
                `Successfully installed plugin: ${path.basename(selectedVsix.fsPath)}. A window reload is required to apply the update.`,
                'Reload Window'
            );
            if (action === 'Reload Window') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
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
        const fullPath = doc.fileName;
        const autoMode = this._context.globalState.get<boolean>('autoMode', false);
        this.postMessageToWebview({
            type: 'updateContext',
            currentFile: fileName,
            fullPath: fullPath,
            autoMode: autoMode
        });
    }

    public clearTargetDocument() {
        this._targetDocument = undefined;
        this.postMessageToWebview({
            type: 'updateContext',
            currentFile: undefined,
            fullPath: undefined
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
                localResourceRoots: [
                    this._extensionUri,
                    vscode.Uri.file(path.join(this._extensionUri.fsPath, 'src', 'webview', 'lib'))
                ]
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
                    case 'abort':
                        activeController?.abort();
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
                                    // Actually show the document in the editor so `onDidChangeActiveTextEditor`
                                    // doesn't override our selection when focus returns from the dialog.
                                    vscode.window.showTextDocument(doc, { preview: false }).then(() => {
                                        this.setTargetDocument(doc);
                                    });
                                });
                            }
                        });
                        break;
                    case 'updatePMode':
                        this._context.globalState.update('persistenceMode', message.mode);
                        break;
                    case 'updateAutoMode':
                        this._context.globalState.update('autoMode', message.enabled);
                        break;
                    case 'clean':
                        this._handleClean();
                        break;
                    case 'openNode':
                        this._handleOpenNode(message.data);
                        break;
                    case 'ready':
                        this._syncState();
                        this._handleTestConnection(true); // Silent startup check
                        break;
                    case 'testMGConnection':
                        this._handleTestConnection();
                        break;
                    case 'runCustomQuery':
                        this._handleRunCustomQuery(message.cypher);
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
        // Cancel any in-flight analysis before starting a new one
        activeController?.abort();
        activeController = new AbortController();
        const controller = activeController;

        // Priority: Current active editor (if file) > previously selected target
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.scheme === 'file') {
            this._targetDocument = activeEditor.document;
        }
        
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
            }, controller);

            // ctx.graphData is populated by GraphFetchPlugin
            this.postMessageToWebview({
                type: 'setData',
                data: ctx.graphData ?? { nodes: [], edges: [] },
                configError: ctx.configError,
                currentFile: ctx.fileName ? path.basename(ctx.fileName) : undefined,
                fullPath: ctx.fileName ? ctx.fileName : undefined,
                fetchCypher: ctx.fetchCypher,
                pMode
            });
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                // User clicked Stop — silently reset the UI
                this.postMessageToWebview({ type: 'aborted' });
                return;
            }
            this._handlePipelineError(error);
        } finally {
            // Release reference; GC can collect the controller
            if (activeController === controller) {
                activeController = undefined;
            }
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

    private async _handleClean() {
        const doc = this._targetDocument;
        const config = vscode.workspace.getConfiguration('visualvs');
        const host = config.get<string>('memgraph.host') || 'localhost';
        const port = config.get<number>('memgraph.port') || 37788;
        const user = config.get<string>('visualvs.memgraph.username');
        const pass = config.get<string>('visualvs.memgraph.password');

        if (doc) {
            const hash = crypto.createHash('md5').update(doc.fileName).digest('hex');
            const scopeHash = `file_${hash.substring(0, 8)}`;
            const client = new MemgraphClient(host, port, user, pass);
            try {
                vvsOutputChannel.appendLine(`[Clean] Wiping scope ${scopeHash} from Memgraph...`);
                await client.deleteByScope(scopeHash);
                vvsOutputChannel.appendLine(`[Clean] Scope ${scopeHash} wiped.`);
            } catch (err: any) {
                vvsOutputChannel.appendLine(`[Clean] DB cleanup failed: ${err.message}`);
            } finally {
                await client.close();
            }
        }

        this._targetDocument = undefined;
        this.postMessageToWebview({ type: 'updateContext', currentFile: undefined, fullPath: undefined });
        vvsOutputChannel.appendLine('[Clean] Internal state reset.');
    }

    private _syncState() {
        const pMode = this._context.globalState.get<string>('persistenceMode', 'persistent');
        const autoMode = this._context.globalState.get<boolean>('autoMode', false);
        const currentFile = this._targetDocument
            ? path.basename(this._targetDocument.fileName)
            : undefined;
        const fullPath = this._targetDocument
            ? this._targetDocument.fileName
            : undefined;
        this.postMessageToWebview({ type: 'syncState', pMode, autoMode, currentFile, fullPath });
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

    private async _handleTestConnection(silent: boolean = false) {
        const config = vscode.workspace.getConfiguration('visualvs');
        const host = config.get<string>('memgraph.host') || 'localhost';
        const port = config.get<number>('memgraph.port') || 37788;
        const user = config.get<string>('visualvs.memgraph.username');
        const pass = config.get<string>('visualvs.memgraph.password');

        if (!silent) {
            vvsOutputChannel.appendLine(`\n[Test Connection] Starting test for Memgraph at bolt://${host}:${port}`);
            vvsOutputChannel.appendLine(`[Test Connection] Auth: user=${user ? `'${user}'` : 'None'}, password=${pass ? '***' : 'None'}`);
        }

        // Surface a single line into BOTH the OutputChannel and the webview's
        // Pipeline Log so the user can see why the welcome node didn't render.
        const logToPanel = (message: string, stage: 'pre' | 'main' | 'post' | 'error' = 'pre') => {
            vvsOutputChannel.appendLine(`[Welcome] ${message}`);
            this.postMessageToWebview({ type: 'progress', message: `[Welcome] ${message}`, stage });
        };

        const runCheck = async () => {
            const client = new MemgraphClient(host, port, user, pass);
            const startTime = Date.now();
            logToPanel(`Connecting to Memgraph at bolt://${host}:${port}…`, 'pre');
            try {
                const status = await client.checkStatus();
                const duration = Date.now() - startTime;

                if (status.connected) {
                    logToPanel(`Connected in ${duration}ms (existing node count: ${status.nodeCount}).`, 'post');
                    if (!silent) {
                        vscode.window.showInformationMessage(`Memgraph connected successfully in ${duration}ms!`);
                    }

                    try {
                        logToPanel('Creating welcome node (MERGE :SystemStatus)…', 'pre');
                        await client.executeCypher(`
                            MERGE (n:SystemStatus {id: 'visualvs_ready'})
                            SET n.name = 'VisualVS Ready',
                                n.status = 'Online',
                                n.message = 'Click Analyze to visualize your code',
                                n.timestamp = timestamp()
                        `);

                        logToPanel('Fetching welcome node (MATCH :SystemStatus)…', 'main');
                        const graphData = await client.executeGraphQuery(`
                            MATCH (n:SystemStatus {id: 'visualvs_ready'}) RETURN n
                        `);

                        if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
                            const why = `Welcome node not returned by MATCH — Memgraph reachable but query produced 0 nodes. Likely cause: prior DETACH DELETE wiped the database between MERGE and MATCH, or this Memgraph instance does not persist nodes.`;
                            logToPanel(why, 'error');
                            this.postMessageToWebview({ type: 'error', configError: why });
                        } else {
                            this.postMessageToWebview({ type: 'setData', data: graphData, isWelcome: true });
                            logToPanel(`Welcome node rendered (${graphData.nodes.length} node, ${graphData.edges.length} edges).`, 'post');
                            this.postMessageToWebview({
                                type: 'progress',
                                message: '✅ Connected to Memgraph. Ready to analyze.',
                                stage: 'post'
                            });
                        }
                    } catch (e: any) {
                        const reason = e?.stack || e?.message || String(e);
                        const why = `Failed to create / fetch welcome node: ${reason}`;
                        logToPanel(why, 'error');
                        this.postMessageToWebview({ type: 'error', configError: why });
                    }
                } else {
                    const why = `Memgraph not reachable at bolt://${host}:${port} after ${duration}ms. ${status.error || ''}`.trim();
                    logToPanel(why, 'error');
                    this.postMessageToWebview({ type: 'error', configError: why });
                    if (!silent) {
                        vscode.window.showErrorMessage(`Memgraph connection failed. See 'VisualVS Log' output for details.`);
                        vvsOutputChannel.show(true);
                    }
                }

                this.postMessageToWebview({
                    type: 'mgStatus',
                    connected: status.connected,
                    nodeCount: status.nodeCount,
                    error: status.error
                });
            } catch (err: any) {
                const duration = Date.now() - startTime;
                const reason = err?.stack || err?.message || String(err);
                const why = `Unexpected exception while contacting Memgraph after ${duration}ms: ${reason}`;
                logToPanel(why, 'error');
                this.postMessageToWebview({ type: 'error', configError: why });
                if (!silent) {
                    vscode.window.showErrorMessage(`Memgraph connection crashed. See 'VisualVS Log' output for details.`);
                    vvsOutputChannel.show(true);
                }
                this.postMessageToWebview({
                    type: 'mgStatus',
                    connected: false,
                    nodeCount: 0,
                    error: err.message || String(err)
                });
            } finally {
                await client.close();
                logToPanel('Memgraph client closed.', 'post');
            }
        };

        if (silent) {
            await runCheck();
        } else {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `VisualVS: Testing Memgraph on ${host}:${port}`,
                cancellable: false
            }, async () => {
                await runCheck();
            });
        }
    }

    private async _handleRunCustomQuery(cypher: string) {
        const config = vscode.workspace.getConfiguration('visualvs');
        const host = config.get<string>('memgraph.host') || 'localhost';
        const port = config.get<number>('memgraph.port') || 37788;
        const user = config.get<string>('visualvs.memgraph.username');
        const pass = config.get<string>('visualvs.memgraph.password');

        const client = new MemgraphClient(host, port, user, pass);
        try {
            vvsOutputChannel.appendLine(`\n[Custom Query] Executing:\n${cypher}`);
            const data = await client.executeGraphQuery(cypher);
            vvsOutputChannel.appendLine(`[Custom Query] Success: returned ${data.nodes.length} nodes, ${data.edges.length} edges.`);
            
            this.postMessageToWebview({
                type: 'setData',
                data: data,
                message: 'Custom query executed successfully',
                stage: 'done'
            });
            this.postMessageToWebview({ type: 'progress', stage: 'done' });
        } catch (err: any) {
            vvsOutputChannel.appendLine(`[Custom Query] ERROR:\n${err.message || String(err)}`);
            vscode.window.showErrorMessage(`Custom Query failed: ${err.message || String(err)}`);
            this.postMessageToWebview({ type: 'progress', stage: 'done' });
        } finally {
            await client.close();
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'index.html');
        const libDir = path.join(this._extensionUri.fsPath, 'src', 'webview', 'lib');
        const orbUri = webview.asWebviewUri(vscode.Uri.file(path.join(libDir, 'orb.js')));
        const dagreUri = webview.asWebviewUri(vscode.Uri.file(path.join(libDir, 'dagre.min.js')));
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace('__ORB_URI__', orbUri.toString());
        html = html.replace('__DAGRE_URI__', dagreUri.toString());
        return html;
    }
}

export function deactivate() {}
