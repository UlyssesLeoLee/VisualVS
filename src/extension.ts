import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Pipeline, PipelineContext } from './core/pipeline';
import { EnvLoaderPlugin, K8sConnPlugin, AIGeneratorPlugin, MemgraphIngestPlugin } from './core/processors';
import { MemgraphClient } from './utils/memgraphClient';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('VisualVS is now active!');

    // Register Sidebar Provider
    const sidebarProvider = new VisualVSSidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("visualvs-sidebar", sidebarProvider)
    );

    // Listen to file changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (currentPanel && editor) {
            currentPanel.webview.postMessage({ 
                type: 'updateContext', 
                currentFile: path.basename(editor.document.fileName) 
            });
        }
    }, null, context.subscriptions);

    let disposable = vscode.commands.registerCommand('visualvs.visualize', async () => {
        const pipeline = new Pipeline();
        pipeline.addPre(new EnvLoaderPlugin());
        pipeline.addPre(new K8sConnPlugin());
        pipeline.addMain(new AIGeneratorPlugin());
        pipeline.addPost(new MemgraphIngestPlugin());

        const pipelineContext: PipelineContext = {
            code: '',
            languageId: '',
            fileName: '',
            config: vscode.workspace.getConfiguration('visualvs'),
            extensionUri: context.extensionUri
        };

        try {
            await pipeline.run(pipelineContext);
            
            let data = { nodes: [], edges: [] };
            if (pipelineContext.code && !pipelineContext.configError) {
                const host = pipelineContext.config.get<string>('memgraph.host') || 'localhost';
                const localPort = pipelineContext.config.get<number>('memgraph.port') || 7687;
                const client = new MemgraphClient(host, localPort);
                data = await client.fetchGraphData();
                await client.close();
            }

            showWebview(context, data, pipelineContext.configError, pipelineContext.fileName ? path.basename(pipelineContext.fileName) : undefined);
        } catch (error: any) {
            if (currentPanel) {
                currentPanel.webview.postMessage({ type: 'error', configError: error.message });
            } else {
                vscode.window.showErrorMessage(`VisualVS Error: ${error.message}`);
                showWebview(context, { nodes: [], edges: [] }, error.message);
            }
        }
    });

    context.subscriptions.push(disposable);
}

class VisualVSSidebarProvider implements vscode.WebviewViewProvider {
    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'visualize':
                    vscode.commands.executeCommand('visualvs.visualize');
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <style>
                    body { font-family: sans-serif; padding: 20px; color: var(--vscode-foreground); }
                    button { 
                        width: 100%; padding: 10px; cursor: pointer; 
                        background: #4facfe; color: white; border: none; border-radius: 4px;
                        font-weight: bold;
                    }
                    button:hover { background: #00f2fe; }
                    .info { font-size: 0.9rem; color: var(--vscode-descriptionForeground); margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="info">Visualize your code topology with AI and Memgraph.</div>
                <button onclick="visualize()">Launch Visualization</button>
                <script>
                    const vscode = acquireVsCodeApi();
                    function visualize() {
                        vscode.postMessage({ type: 'visualize' });
                    }
                </script>
            </body>
            </html>`;
    }
}

function showWebview(context: vscode.ExtensionContext, data: any, configError?: string, currentFile?: string) {
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Two);
        currentPanel.webview.postMessage({ type: 'setData', data, configError, currentFile });
        return;
    }

    currentPanel = vscode.window.createWebviewPanel(
        'visualvsGraph',
        'VisualVS Topology',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview'))]
        }
    );

    const htmlPath = path.join(context.extensionPath, 'src', 'webview', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    currentPanel.webview.html = html;

    currentPanel.webview.onDidReceiveMessage(message => {
        switch (message.type) {
            case 'visualize':
                vscode.commands.executeCommand('visualvs.visualize');
                break;
            case 'openSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'visualvs');
                break;
        }
    }, null, context.subscriptions);

    setTimeout(() => {
        currentPanel?.webview.postMessage({ type: 'setData', data, configError, currentFile });
    }, 1000);

    currentPanel.onDidDispose(() => {
        currentPanel = undefined;
    }, null, context.subscriptions);
}

export function deactivate() {}
