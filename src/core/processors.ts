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
        if (!editor) throw new Error("No active editor found");
        
        context.code = editor.document.getText();
        context.languageId = editor.document.languageId;
        context.fileName = editor.document.fileName;
    }
}

export class K8sConnPlugin implements IProcessor {
    name = "K8sConnection";
    async execute(context: PipelineContext): Promise<void> {
        const podSelector = context.config.get<string>('memgraph.podSelector') || 'app=memgraph';
        const localPort = context.config.get<number>('memgraph.port') || 7687;
        
        await K8sManager.ensurePortForward(podSelector, localPort);
    }
}

export class AIGeneratorPlugin implements IProcessor {
    name = "AIGenerator";
    async execute(context: PipelineContext): Promise<void> {
        context.cypher = await AIService.generateCypher(context.code, context.config);
    }
}

export class MemgraphIngestPlugin implements IProcessor {
    name = "MemgraphIngest";
    async execute(context: PipelineContext): Promise<void> {
        const localPort = context.config.get<number>('memgraph.port') || 7687;
        const client = new MemgraphClient('localhost', localPort);
        
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
