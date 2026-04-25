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

    // Abort signal — set by Pipeline.run(); plugins may check it for early exit
    abortSignal?: AbortSignal;

    // Pre-processing outputs
    fileScopeHash: string;
    codeHash: string;
    astOutline?: string;

    // Main-processing outputs
    cypher?: string;       // WRITE Cypher (MERGE/CREATE) — consumed by MemgraphIngestPlugin
    fetchCypher?: string;  // READ Cypher (MATCH) — sent to Webview Cypher editor after analysis

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
        onProgress?: ProgressReporter,
        controller?: AbortController
    ): Promise<void> {
        const report: ProgressReporter = (msg, stage) => onProgress?.(msg, stage);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'VisualVS Processing',
            cancellable: true
        }, async (progress, token) => {
            // Bridge VS Code cancellation token → AbortController
            if (controller) {
                token.onCancellationRequested(() => controller.abort());
            }
            // Expose signal on context so plugins can poll it directly
            if (controller) {
                context.abortSignal = controller.signal;
            }

            const signal = controller?.signal;

            const checkAbort = () => {
                if (signal?.aborted) {
                    throw new DOMException('Pipeline aborted by user', 'AbortError');
                }
            };

            report('**开始** Pipeline started', 'pre');

            progress.report({ message: 'Pre-processing...' });
            report('Initializing context', 'pre');
            checkAbort();
            await this._runStage('pre', this.prePlugins, context, report, signal);

            progress.report({ message: 'Main-processing (AI Logic)...' });
            report('Generating graph data', 'main');
            checkAbort();
            await this._runStage('main', this.mainPlugins, context, report, signal);

            progress.report({ message: 'Post-processing (Data & Visualization)...' });
            report('Ingesting & fetching data', 'post');
            checkAbort();
            await this._runStage('post', this.postPlugins, context, report, signal);

            report('**完成** Pipeline finished', 'post');
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
        report: ProgressReporter,
        signal?: AbortSignal
    ): Promise<void> {
        for (const plugin of plugins) {
            // Check abort before each plugin
            if (signal?.aborted) {
                throw new DOMException('Pipeline aborted by user', 'AbortError');
            }

            const log: Logger = (msg) => report(`[${plugin.name}] ${msg}`, stage);

            // --- prepare ---
            let prepareResult;
            try {
                log('Preparing...');
                prepareResult = await plugin.prepare(ctx, log);
            } catch (err: any) {
                if (err?.name === 'AbortError') { throw err; }
                throw new PluginError(plugin.name, stage, 'prepare', err);
            }

            if (prepareResult.skip) {
                log(`Skipped: ${prepareResult.reason}`);
                continue;
            }

            // --- execute (with teardown in finally) ---
            let executeError: Error | undefined;
            try {
                log('Executing...');
                await plugin.execute(ctx, log);
                log('Done.');
            } catch (err: any) {
                // AbortError propagates unwrapped so extension.ts can silently swallow it
                executeError = err?.name === 'AbortError'
                    ? err
                    : new PluginError(plugin.name, stage, 'execute', err);
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
