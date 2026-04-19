import * as vscode from 'vscode';
import { IProcessor, PipelineContext } from './pipeline';
import { K8sManager } from '../utils/k8sManager';
import { AIService } from '../utils/aiService';
import { MemgraphClient } from '../utils/memgraphClient';

export class EnvLoaderPlugin implements IProcessor {
    name = "EnvLoader";
    async execute(context: PipelineContext): Promise<void> {
        context.config = vscode.workspace.getConfiguration('visualvs');
        const editor = vscode.window.activeTextEditor;
        
        // Validation
        const apiKey = context.config.get<string>('ai.apiKey');
        if (!apiKey) {
            context.configError = "AI API Key is missing. Please configure it in settings.";
        }

        if (editor) {
            context.code = editor.document.getText();
            context.languageId = editor.document.languageId;
            context.fileName = editor.document.fileName;
        } else {
            context.code = "";
            context.languageId = "";
            context.fileName = "";
        }
    }
}

export class K8sConnPlugin implements IProcessor {
    name = "K8sConnection";
    async execute(context: PipelineContext): Promise<void> {
        const mode = context.config.get<string>('memgraph.connectionMode') || 'k8s';
        if (mode === 'direct') {
            console.log('VisualVS: Direct connection mode. Skipping K8s discovery.');
            return;
        }

        const podSelector = context.config.get<string>('memgraph.podSelector') || 'app=memgraph';
        const namespace = context.config.get<string>('memgraph.namespace') || '';
        const localPort = context.config.get<number>('memgraph.port') || 7687;
        
        await K8sManager.ensurePortForward(podSelector, localPort, namespace);
    }
}

export class AIGeneratorPlugin implements IProcessor {
    name = "AIGenerator";
    async execute(context: PipelineContext): Promise<void> {
        if (!context.code) return;
        context.cypher = await AIService.generateCypher(context.code, context.config);
    }
}

export class MemgraphIngestPlugin implements IProcessor {
    name = "MemgraphIngest";
    async execute(context: PipelineContext): Promise<void> {
        if (!context.code) return;
        const host = context.config.get<string>('memgraph.host') || 'localhost';
        const localPort = context.config.get<number>('memgraph.port') || 7687;
        const client = new MemgraphClient(host, localPort);
        
        try {
            // Optional: clear graph first
            await client.executeCypher('MATCH (n) DETACH DELETE n');
            
            if (context.cypher) {
                await client.executeCypher(context.cypher);
            }
        } finally {
            await client.close();
        }
    }
}
