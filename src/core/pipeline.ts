/**
 * @module pipeline
 * @description Three-phase pipeline engine for VisualVS.
 *
 * Execution contract per plugin:
 *   1. prepare()  → if skip, log and continue to next plugin
 *   2. execute()  → atomic core logic
 *   3. teardown() → always runs (finally semantics), even if execute threw
 *
 * Stage ordering: pre → main → post
 *
 * Failure model:
 *   - Any exception from prepare() or execute() is wrapped in PluginError and rethrown.
 *   - teardown() exceptions are swallowed and logged (must not shadow the original error).
 *
 * @cypher-manifest
 * // ── Nodes ──────────────────────────────────────────────────────────────────
 * MERGE (:Module    {name: 'pipeline',        path: 'src/core/pipeline.ts', layer: 'core'})
 * MERGE (:Interface {name: 'PipelineContext',  module: 'pipeline'})
 * MERGE (:Type      {name: 'ProgressReporter', module: 'pipeline'})
 * MERGE (:Class     {name: 'Pipeline',         module: 'pipeline'})
 * // ── Containment ────────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'pipeline'})-[:CONTAINS]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Module {name: 'pipeline'})-[:CONTAINS]->(:Type      {name: 'ProgressReporter'})
 * MERGE (:Module {name: 'pipeline'})-[:CONTAINS]->(:Class     {name: 'Pipeline'})
 * // ── Relationships ──────────────────────────────────────────────────────────
 * MERGE (:Class {name: 'Pipeline'})-[:USES]->(:Interface {name: 'IPlugin'})
 * MERGE (:Class {name: 'Pipeline'})-[:USES]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Class {name: 'Pipeline'})-[:USES]->(:Class     {name: 'PluginError'})
 * MERGE (:Class {name: 'EnvLoaderPlugin'})-[:WRITES {field: 'codeHash'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Module {name: 'pipeline'})-[:IMPORTS]->(:Module {name: 'plugin'})
 */

import * as vscode from 'vscode';
import { IPlugin, Logger, PluginError } from './plugin';

// ---------------------------------------------------------------------------
// PipelineContext — shared mutable state across all plugins
// ---------------------------------------------------------------------------

export interface PipelineContext {
    // Input
    code: string;
    languageId: string;
    fileName: string;
    config: vscode.WorkspaceConfiguration;
    extensionUri: vscode.Uri;

    // Pre-processing outputs
    fileScopeHash: string;
    codeHash: string;
    astOutline?: string;

    // Main-processing outputs
    cypher?: string;

    // Post-processing outputs
    graphData?: { nodes: any[]; edges: any[] };

    // Error signal (set by plugins)
    // Infrastructure (K8s/Memgraph metadata)
    memgraphAuth?: { username?: string; password?: string };
    configError?: string;
}

// ---------------------------------------------------------------------------
// Progress reporting
// ---------------------------------------------------------------------------

/** Full progress callback: message + current stage label. */
export type ProgressReporter = (msg: string, stage?: string) => void;

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export class Pipeline {
    private readonly prePlugins: IPlugin[] = [];
    private readonly mainPlugins: IPlugin[] = [];
    private readonly postPlugins: IPlugin[] = [];

    addPre(p: IPlugin): this { this.prePlugins.push(p); return this; }
    addMain(p: IPlugin): this { this.mainPlugins.push(p); return this; }
    addPost(p: IPlugin): this { this.postPlugins.push(p); return this; }

    async run(
        context: PipelineContext,
        onProgress?: ProgressReporter
    ): Promise<void> {
        const report: ProgressReporter = (msg, stage) => onProgress?.(msg, stage);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'VisualVS Processing',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Pre-processing...' });
            report('Initializing context', 'pre');
            await this._runStage('pre', this.prePlugins, context, report);

            progress.report({ message: 'Main-processing (AI Logic)...' });
            report('Generating graph data', 'main');
            await this._runStage('main', this.mainPlugins, context, report);

            progress.report({ message: 'Post-processing (Data & Visualization)...' });
            report('Ingesting & fetching data', 'post');
            await this._runStage('post', this.postPlugins, context, report);

            report('Complete', 'done');
        });
    }

    // -----------------------------------------------------------------------
    // Private
    // -----------------------------------------------------------------------

    private async _runStage(
        stage: 'pre' | 'main' | 'post',
        plugins: IPlugin[],
        ctx: PipelineContext,
        report: ProgressReporter
    ): Promise<void> {
        for (const plugin of plugins) {
            const log: Logger = (msg) => report(`[${plugin.name}] ${msg}`, stage);

            // --- prepare ---
            let prepareResult;
            try {
                log('Preparing...');
                prepareResult = await plugin.prepare(ctx, log);
            } catch (err: any) {
                throw new PluginError(plugin.name, stage, 'prepare', err);
            }

            if (prepareResult.skip) {
                log(`Skipped: ${prepareResult.reason}`);
                continue;
            }

            // --- execute (with teardown in finally) ---
            let executeError: PluginError | undefined;
            try {
                log('Executing...');
                await plugin.execute(ctx, log);
                log('Done.');
            } catch (err: any) {
                executeError = new PluginError(plugin.name, stage, 'execute', err);
            } finally {
                // teardown MUST run regardless of execute outcome
                try {
                    await plugin.teardown(ctx, log);
                } catch (teardownErr: any) {
                    // Swallow teardown errors to not shadow the original
                    console.error(`[VisualVS] teardown error in ${plugin.name}:`, teardownErr);
                }
            }

            if (executeError) {
                throw executeError;
            }
        }
    }
}
