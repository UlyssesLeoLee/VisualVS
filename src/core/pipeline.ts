import * as vscode from 'vscode';

export interface PipelineContext {
    code: string;
    languageId: string;
    fileName: string;
    cypher?: string;
    config: vscode.WorkspaceConfiguration;
    extensionUri: vscode.Uri;
    [key: string]: any;
}

export interface IProcessor {
    name: string;
    execute(context: PipelineContext): Promise<void>;
}

export class Pipeline {
    private preProcessors: IProcessor[] = [];
    private mainProcessors: IProcessor[] = [];
    private postProcessors: IProcessor[] = [];

    addPre(p: IProcessor) { this.preProcessors.push(p); }
    addMain(p: IProcessor) { this.mainProcessors.push(p); }
    addPost(p: IProcessor) { this.postProcessors.push(p); }

    async run(context: PipelineContext): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "VisualVS Processing",
            cancellable: false
        }, async (progress) => {
            
            progress.report({ message: "Pre-processing..." });
            for (const p of this.preProcessors) {
                await p.execute(context);
            }

            progress.report({ message: "Main-processing (AI Logic)..." });
            for (const p of this.mainProcessors) {
                await p.execute(context);
            }

            progress.report({ message: "Post-processing (Data & Visualization)..." });
            for (const p of this.postProcessors) {
                await p.execute(context);
            }
        });
    }
}
