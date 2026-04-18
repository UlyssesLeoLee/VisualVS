import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Pipeline, PipelineContext } from './core/pipeline';
import { EnvLoaderPlugin, K8sConnPlugin, AIGeneratorPlugin, MemgraphIngestPlugin } from './core/processors';
import { MemgraphClient } from './utils/memgraphClient';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('VisualVS is now active!');

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
            
            // After ingestion, fetch data for visualization
            const localPort = pipelineContext.config.get<number>('memgraph.port') || 7687;
            const client = new MemgraphClient('localhost', localPort);
            const data = await client.fetchGraphData();
            await client.close();

            showWebview(context, data);
        } catch (error: any) {
            vscode.window.showErrorMessage(`VisualVS Error: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

function showWebview(context: vscode.ExtensionContext, data: any) {
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Two);
        currentPanel.webview.postMessage({ type: 'setData', data });
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

    // Send data after a short delay to ensure webview is ready
    setTimeout(() => {
        currentPanel?.webview.postMessage({ type: 'setData', data });
    }, 1000);

    currentPanel.onDidDispose(() => {
        currentPanel = undefined;
    }, null, context.subscriptions);
}

export function deactivate() {}
