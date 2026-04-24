/**
 * @module processors
 * @description All VisualVS pipeline plugins, each implementing the IPlugin contract:
 *   prepare()  → guard preconditions / acquire resources
 *   execute()  → single atomic responsibility
 *   teardown() → release all owned resources (finally semantics)
 *
 * Plugin registry (in execution order):
 *
 *   PRE stage:
 *     1. EnvLoaderPlugin    — load config, compute fileScopeHash
 *     2. ASTProcessorPlugin — extract VS Code document symbol outline
 *     3. K8sConnPlugin      — ensure Memgraph port-forward via K8s
 *
 *   MAIN stage:
 *     4. AIGeneratorPlugin  — call AI service, write ctx.cypher
 *
 *   POST stage:
 *     5. MemgraphIngestPlugin — delete stale scope + ingest new Cypher
 *     6. GraphFetchPlugin     — fetch graph data + handle volatile cleanup
 *
 * @cypher-manifest
 * // ── Module node ───────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'processors', path: 'src/core/processors.ts', layer: 'core'})
 * MERGE (:Module {name: 'processors'})-[:IMPORTS]->(:Module {name: 'plugin'})
 * MERGE (:Module {name: 'processors'})-[:IMPORTS]->(:Module {name: 'pipeline'})
 * MERGE (:Module {name: 'processors'})-[:IMPORTS]->(:Module {name: 'aiService',       path: 'src/utils/aiService.ts'})
 * MERGE (:Module {name: 'processors'})-[:IMPORTS]->(:Module {name: 'memgraphClient',  path: 'src/utils/memgraphClient.ts'})
 * MERGE (:Module {name: 'processors'})-[:IMPORTS]->(:Module {name: 'k8sManager',      path: 'src/utils/k8sManager.ts'})
 * // ── Plugin class nodes (stage-tagged) ───────────────────────────────────────────
 * MERGE (:Class {name: 'EnvLoaderPlugin',    module: 'processors', stage: 'pre',  order: 1})
 * MERGE (:Class {name: 'ASTProcessorPlugin', module: 'processors', stage: 'pre',  order: 2})
 * MERGE (:Class {name: 'K8sConnPlugin',      module: 'processors', stage: 'pre',  order: 3})
 * MERGE (:Class {name: 'AIGeneratorPlugin',  module: 'processors', stage: 'main', order: 4})
 * MERGE (:Class {name: 'MemgraphIngestPlugin', module: 'processors', stage: 'post', order: 5})
 * MERGE (:Class {name: 'GraphFetchPlugin',   module: 'processors', stage: 'post', order: 6})
 * // ── Containment ────────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'processors'})-[:CONTAINS]->(:Class {name: 'EnvLoaderPlugin'})
 * MERGE (:Module {name: 'processors'})-[:CONTAINS]->(:Class {name: 'ASTProcessorPlugin'})
 * MERGE (:Module {name: 'processors'})-[:CONTAINS]->(:Class {name: 'K8sConnPlugin'})
 * MERGE (:Module {name: 'processors'})-[:CONTAINS]->(:Class {name: 'AIGeneratorPlugin'})
 * MERGE (:Module {name: 'processors'})-[:CONTAINS]->(:Class {name: 'MemgraphIngestPlugin'})
 * MERGE (:Module {name: 'processors'})-[:CONTAINS]->(:Class {name: 'GraphFetchPlugin'})
 * // ── All plugins implement IPlugin via BasePlugin ─────────────────────────────
 * MERGE (:Class {name: 'EnvLoaderPlugin'})-[:EXTENDS]->(:Class {name: 'BasePlugin'})
 * MERGE (:Class {name: 'ASTProcessorPlugin'})-[:EXTENDS]->(:Class {name: 'BasePlugin'})
 * MERGE (:Class {name: 'K8sConnPlugin'})-[:EXTENDS]->(:Class {name: 'BasePlugin'})
 * MERGE (:Class {name: 'AIGeneratorPlugin'})-[:EXTENDS]->(:Class {name: 'BasePlugin'})
 * MERGE (:Class {name: 'MemgraphIngestPlugin'})-[:EXTENDS]->(:Class {name: 'BasePlugin'})
 * MERGE (:Class {name: 'GraphFetchPlugin'})-[:EXTENDS]->(:Class {name: 'BasePlugin'})
 * // ── External service call edges ───────────────────────────────────────────────
 * MERGE (:Class {name: 'K8sConnPlugin'})-[:CALLS]->(:Class {name: 'K8sManager',      module: 'k8sManager'})
 * MERGE (:Class {name: 'AIGeneratorPlugin'})-[:CALLS]->(:Class {name: 'AIService',    module: 'aiService'})
 * MERGE (:Class {name: 'MemgraphIngestPlugin'})-[:CALLS]->(:Class {name: 'MemgraphClient', module: 'memgraphClient'})
 * MERGE (:Class {name: 'GraphFetchPlugin'})-[:CALLS]->(:Class {name: 'MemgraphClient', module: 'memgraphClient'})
 * // ── Data flow through PipelineContext ───────────────────────────────────────────
 * MERGE (:Class {name: 'EnvLoaderPlugin'})-[:WRITES {field: 'fileScopeHash'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Class {name: 'EnvLoaderPlugin'})-[:WRITES {field: 'configError'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Class {name: 'ASTProcessorPlugin'})-[:WRITES {field: 'astOutline'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Class {name: 'AIGeneratorPlugin'})-[:READS {field: 'astOutline'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Class {name: 'AIGeneratorPlugin'})-[:READS {field: 'codeHash'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Class {name: 'AIGeneratorPlugin'})-[:WRITES {field: 'cypher'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Class {name: 'MemgraphIngestPlugin'})-[:READS {field: 'cypher'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Class {name: 'MemgraphIngestPlugin'})-[:READS {field: 'codeHash'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Class {name: 'GraphFetchPlugin'})-[:WRITES {field: 'graphData'}]->(:Interface {name: 'PipelineContext'})
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { BasePlugin, Logger, PrepareResult } from './plugin';
import { PipelineContext } from './pipeline';
import { K8sManager } from '../utils/k8sManager';
import { AIService } from '../utils/aiService';
import { MemgraphClient } from '../utils/memgraphClient';

// ============================================================================
// PRE PLUGINS
// ============================================================================

// ----------------------------------------------------------------------------
// 1. EnvLoaderPlugin
// ----------------------------------------------------------------------------

/**
 * Responsibility: Load workspace configuration and compute the file scope hash.
 * Outputs: ctx.config (refreshed), ctx.fileScopeHash, ctx.configError (on missing API key)
 */
export class EnvLoaderPlugin extends BasePlugin {
    readonly name = 'EnvLoader';
    readonly stage = 'pre' as const;

    async prepare(_ctx: PipelineContext, log: Logger): Promise<PrepareResult> {
        // Always runs — config loading has no meaningful skip condition.
        log('Checking workspace configuration access...');
        return { skip: false };
    }

    async execute(ctx: PipelineContext, log: Logger): Promise<void> {
        ctx.config = vscode.workspace.getConfiguration('visualvs');

        const apiKey = ctx.config.get<string>('ai.apiKey');
        if (!apiKey) {
            ctx.configError = 'AI API Key is missing. Please configure it in settings.';
            log('Warning: AI API Key not set.');
        }

        // Load Memgraph Auth
        const mgUser = ctx.config.get<string>('visualvs.memgraph.username');
        const mgPass = ctx.config.get<string>('visualvs.memgraph.password');
        if (mgUser && mgPass) {
            ctx.memgraphAuth = { username: mgUser, password: mgPass };
        }

        // Compute hashes
        if (ctx.code) {
            ctx.codeHash = crypto.createHash('sha256').update(ctx.code).digest('hex');
            log(`Code hash computed: ${ctx.codeHash.substring(0, 8)}...`);
        } else {
            ctx.codeHash = 'empty';
        }

        if (ctx.fileName) {
            const hash = crypto.createHash('md5').update(ctx.fileName).digest('hex');
            ctx.fileScopeHash = `file_${hash.substring(0, 8)}`;
            log(`Scope established: ${vscode.workspace.asRelativePath(ctx.fileName)}`);
        } else {
            ctx.fileScopeHash = 'global_scope';
            log('No active file — using global scope.');
        }
    }

    // teardown: no resources acquired → inherited no-op from BasePlugin
}

// ----------------------------------------------------------------------------
// 2. ASTProcessorPlugin
// ----------------------------------------------------------------------------

/**
 * Responsibility: Extract a structural symbol outline from the active document.
 * Outputs: ctx.astOutline
 */
export class ASTProcessorPlugin extends BasePlugin {
    readonly name = 'ASTExtraction';
    readonly stage = 'pre' as const;

    async prepare(ctx: PipelineContext, log: Logger): Promise<PrepareResult> {
        if (!ctx.code || !ctx.fileName) {
            return { skip: true, reason: 'No active document to extract symbols from.' };
        }
        log('Document present — proceeding with symbol extraction.');
        return { skip: false };
    }

    async execute(ctx: PipelineContext, log: Logger): Promise<void> {
        const uri = vscode.Uri.file(ctx.fileName);
        log('Requesting document symbols from VS Code API...');

        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );

            if (symbols && symbols.length > 0) {
                ctx.astOutline = this._formatSymbols(symbols, 0);
                log(`Extracted ${symbols.length} top-level symbols.`);
            } else {
                ctx.astOutline = 'No document symbols found.';
                log('No AST structure found — continuing without outline.');
            }
        } catch (err) {
            // Non-fatal: AST outline is a quality enhancement, not a hard requirement.
            console.error('[VisualVS] Symbol extraction failed:', err);
            ctx.astOutline = 'Extraction failed.';
            log('Symbol extraction failed — continuing without outline.');
        }
    }

    // teardown: no resources acquired → inherited no-op from BasePlugin

    private _formatSymbols(symbols: vscode.DocumentSymbol[], indent: number): string {
        let result = '';
        const pad = '  '.repeat(indent);
        for (const sym of symbols) {
            const kind = vscode.SymbolKind[sym.kind] || 'Unknown';
            result += `${pad}- [${kind}] ${sym.name}\n`;
            if (sym.children?.length > 0) {
                result += this._formatSymbols(sym.children, indent + 1);
            }
        }
        return result;
    }
}

// ----------------------------------------------------------------------------
// 3. K8sConnPlugin
// ----------------------------------------------------------------------------

/**
 * Responsibility: Ensure Memgraph is reachable via K8s port-forward.
 * Skips entirely when connectionMode is 'direct'.
 */
export class K8sConnPlugin extends BasePlugin {
    readonly name = 'K8sConnection';
    readonly stage = 'pre' as const;

    async prepare(ctx: PipelineContext, log: Logger): Promise<PrepareResult> {
        const mode = ctx.config.get<string>('memgraph.connectionMode') || 'k8s';
        if (mode === 'direct') {
            return { skip: true, reason: 'Direct connection mode configured — K8s discovery not needed.' };
        }
        log('K8s mode detected — will ensure port-forward.');
        return { skip: false };
    }

    async execute(ctx: PipelineContext, log: Logger): Promise<void> {
        const podSelector = ctx.config.get<string>('memgraph.podSelector') || 'app=memgraph';
        const namespace   = ctx.config.get<string>('memgraph.namespace') || '';
        const localPort   = ctx.config.get<number>('memgraph.port') || 37788;
        const autoDeploy  = ctx.config.get<boolean>('memgraph.autoDeployK8s') ?? true;

        log(`Ensuring port-forward to ${podSelector}:${localPort}...`);
        await K8sManager.ensurePortForward(podSelector, localPort, namespace, autoDeploy);
        log('Port-forward established.');
    }

    // teardown: port-forward is a background process, not owned here → inherited no-op
}

// ============================================================================
// MAIN PLUGINS
// ============================================================================

// ----------------------------------------------------------------------------
// 4. AIGeneratorPlugin
// ----------------------------------------------------------------------------

/**
 * Responsibility: Call AI service to synthesize Cypher from source code + AST outline.
 * Outputs: ctx.cypher
 */
export class AIGeneratorPlugin extends BasePlugin {
    readonly name = 'AIGenerator';
    readonly stage = 'main' as const;

    async prepare(ctx: PipelineContext, log: Logger): Promise<PrepareResult> {
        if (!ctx.code) {
            return { skip: true, reason: 'No source code in context.' };
        }
        if (ctx.configError) {
            return { skip: true, reason: `Skipping AI: config error present (${ctx.configError})` };
        }

        // --- Cache Check ---
        const persistenceMode = ctx.config.get<string>('visualvs.persistenceMode') || 'persistent';
        if (persistenceMode === 'persistent' && ctx.fileScopeHash !== 'global_scope') {
            const host = ctx.config.get<string>('memgraph.host') || 'localhost';
            const localPort = ctx.config.get<number>('memgraph.port') || 37788;
            const client = new MemgraphClient(
                host, 
                localPort, 
                ctx.memgraphAuth?.username, 
                ctx.memgraphAuth?.password
            );
            try {
                log('Checking cache in Memgraph...');
                const exists = await client.checkScopeHashMatch(ctx.fileScopeHash, ctx.codeHash);
                if (exists) {
                    return { skip: true, reason: 'Cache hit: Same code version already analyzed in database.' };
                }
            } catch (err) {
                log('Cache check failed (database unreachable?), proceeding with AI...');
            } finally {
                await client.close();
            }
        }

        log('Source code present — proceeding with AI generation.');
        return { skip: false };
    }

    async execute(ctx: PipelineContext, log: Logger): Promise<void> {
        log('Requesting graph topology from AI service...');
        ctx.cypher = await AIService.generateCypher(ctx, log);
        log('Cypher statements generated.');
    }

    // teardown: no resources acquired → inherited no-op
}

// ============================================================================
// POST PLUGINS
// ============================================================================

// ----------------------------------------------------------------------------
// 5. MemgraphIngestPlugin
// ----------------------------------------------------------------------------

/**
 * Responsibility: Atomically replace scoped graph data in Memgraph.
 *   1. Delete all nodes matching fileScopeHash (idempotent cleanup)
 *   2. Ingest the freshly generated Cypher statements
 *
 * Owns: MemgraphClient — released in teardown.
 */
export class MemgraphIngestPlugin extends BasePlugin {
    readonly name = 'MemgraphIngest';
    readonly stage = 'post' as const;

    private _client: MemgraphClient | null = null;

    async prepare(ctx: PipelineContext, log: Logger): Promise<PrepareResult> {
        if (!ctx.cypher) {
            return { skip: true, reason: 'No Cypher to ingest — AI generation was skipped or failed.' };
        }
        return { skip: false };
    }

    async execute(ctx: PipelineContext, log: Logger): Promise<void> {
        const host = ctx.config.get<string>('memgraph.host') || 'localhost';
        const localPort = ctx.config.get<number>('memgraph.port') || 37788;
        const client = new MemgraphClient(
            host, 
            localPort, 
            ctx.memgraphAuth?.username, 
            ctx.memgraphAuth?.password
        );

        try {
            log('Ingesting Graph into Memgraph...');
            const pMode = ctx.config.get<string>('visualvs.persistenceMode') || 'persistent';
            
            if (pMode === 'volatile' && ctx.fileScopeHash !== 'global_scope') {
                log(`Volatile mode: Clearing previous scope data for ${ctx.fileScopeHash}...`);
                await client.deleteByScope(ctx.fileScopeHash);
            }

            await client.executeCypherBatched(ctx.cypher!, ctx.fileScopeHash, ctx.codeHash);
            log('Ingest complete.');
        } catch (error: any) {
            throw new Error(`Ingest failed: ${error.message}`);
        } finally {
            await client.close();
        }
    }

    async teardown(_ctx: PipelineContext, log: Logger): Promise<void> {
        if (this._client) {
            log('Closing Memgraph connection.');
            await this._client.close();
            this._client = null;
        }
    }
}

// ----------------------------------------------------------------------------
// 6. GraphFetchPlugin
// ----------------------------------------------------------------------------

/**
 * Responsibility: Fetch the full graph from Memgraph and write to ctx.graphData.
 * Also handles volatile-mode cleanup (delete scope after fetch).
 *
 * Owns: MemgraphClient — released in teardown.
 *
 * Note: This plugin replaces the manual fetch logic that was previously scattered
 *       in extension.ts after pipeline.run() returned.
 */
export class GraphFetchPlugin extends BasePlugin {
    readonly name = 'GraphFetch';
    readonly stage = 'post' as const;

    private _client: MemgraphClient | null = null;

    async prepare(ctx: PipelineContext, log: Logger): Promise<PrepareResult> {
        if (ctx.configError) {
            return { skip: true, reason: `Config error present — skipping graph fetch.` };
        }
        if (!ctx.code) {
            return { skip: true, reason: 'No source code context — nothing to display.' };
        }
        const host      = ctx.config.get<string>('memgraph.host') || 'localhost';
        const localPort = ctx.config.get<number>('memgraph.port') || 37788;
        log(`Opening read connection to Memgraph at ${host}:${localPort}...`);
        this._client = new MemgraphClient(
            host, 
            localPort, 
            ctx.memgraphAuth?.username, 
            ctx.memgraphAuth?.password
        );
        return { skip: false };
    }

    async execute(ctx: PipelineContext, log: Logger): Promise<void> {
        const client = this._client!;
        log('Fetching graph data...');
        ctx.graphData = await client.fetchGraphData();
        log(`Fetched ${ctx.graphData.nodes.length} nodes, ${ctx.graphData.edges.length} edges.`);

        // Volatile mode: purge scoped data after reading (ephemeral analysis)
        const persistenceMode = ctx.config.get<string>('visualvs.persistenceMode') || 'persistent';
        if (persistenceMode === 'volatile') {
            log(`Volatile mode: purging scope [${ctx.fileScopeHash}]...`);
            await client.deleteByScope(ctx.fileScopeHash);
            log('Volatile cleanup complete.');
        }
    }

    async teardown(_ctx: PipelineContext, log: Logger): Promise<void> {
        if (this._client) {
            log('Closing Memgraph read connection.');
            await this._client.close();
            this._client = null;
        }
    }
}
