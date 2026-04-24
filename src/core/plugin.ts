/**
 * @module plugin
 * @description Canonical three-phase Plugin contract for the VisualVS pipeline.
 *
 * Every Plugin MUST implement all three lifecycle methods.
 * The Pipeline engine guarantees:
 *   - `prepare`   is called first; if it returns { skip: true }, execute + teardown are skipped.
 *   - `execute`   performs the atomic core logic.
 *   - `teardown`  is called in a `finally` block, guaranteeing resource release even on failure.
 *
 * Invariants:
 *   - Plugins communicate exclusively through PipelineContext (no direct Plugin-to-Plugin refs).
 *   - Plugins MUST NOT reference vscode.window for UI (progress/notifications belong to the engine).
 *   - All owned resources (connections, file handles) MUST be released in teardown.
 *
 * @cypher-manifest
 * // ── Nodes ──────────────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'plugin', path: 'src/core/plugin.ts', layer: 'core'})
 * MERGE (:Interface {name: 'IPlugin',       module: 'plugin'})
 * MERGE (:Type      {name: 'PrepareResult', module: 'plugin'})
 * MERGE (:Type      {name: 'Logger',        module: 'plugin'})
 * MERGE (:Type      {name: 'ProgressReporter', module: 'plugin'})
 * MERGE (:Class     {name: 'PluginError',   module: 'plugin'})
 * MERGE (:Class     {name: 'BasePlugin',    module: 'plugin', abstract: true})
 * // ── Containment ────────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'plugin'})-[:CONTAINS]->(:Interface {name: 'IPlugin'})
 * MERGE (:Module {name: 'plugin'})-[:CONTAINS]->(:Type      {name: 'PrepareResult'})
 * MERGE (:Module {name: 'plugin'})-[:CONTAINS]->(:Type      {name: 'Logger'})
 * MERGE (:Module {name: 'plugin'})-[:CONTAINS]->(:Class     {name: 'PluginError'})
 * MERGE (:Module {name: 'plugin'})-[:CONTAINS]->(:Class     {name: 'BasePlugin'})
 * // ── Relationships ──────────────────────────────────────────────────────────
 * MERGE (:Class {name: 'BasePlugin'})-[:IMPLEMENTS]->(:Interface {name: 'IPlugin'})
 * MERGE (:Class {name: 'PluginError'})-[:EXTENDS]->(:Class {name: 'Error'})
 */

import { PipelineContext } from './pipeline';

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

/** Scoped progress reporter injected by the Pipeline engine into each Plugin. */
export type Logger = (msg: string) => void;

// ---------------------------------------------------------------------------
// PrepareResult — discriminated union for skip/continue decision
// ---------------------------------------------------------------------------

export type PrepareResult =
    | { skip: false }
    | { skip: true; reason: string };

// ---------------------------------------------------------------------------
// IPlugin — the standard three-phase lifecycle interface
// ---------------------------------------------------------------------------

export interface IPlugin {
    /** Human-readable identifier, used in logs and error reporting. */
    readonly name: string;

    /**
     * Declares which Pipeline stage this plugin belongs to.
     * Used by the engine for registration and progress labeling.
     */
    readonly stage: 'pre' | 'main' | 'post';

    /**
     * PRE-PROCESSING phase.
     * Validate preconditions, acquire resources needed for execute.
     * Return `{ skip: true, reason }` to short-circuit this plugin entirely.
     * Throwing here aborts the entire pipeline with a PluginError.
     */
    prepare(ctx: PipelineContext, log: Logger): Promise<PrepareResult>;

    /**
     * MAIN-PROCESSING phase.
     * Execute the single atomic responsibility of this plugin.
     * Write outputs exclusively via ctx mutations.
     * Throwing here triggers teardown (finally) and propagates as PluginError.
     */
    execute(ctx: PipelineContext, log: Logger): Promise<void>;

    /**
     * POST-PROCESSING phase (finally semantics).
     * Release ALL resources acquired in prepare/execute.
     * Called even if execute threw — MUST NOT throw itself.
     */
    teardown(ctx: PipelineContext, log: Logger): Promise<void>;
}

// ---------------------------------------------------------------------------
// PluginError — structured error with stage attribution
// ---------------------------------------------------------------------------

export class PluginError extends Error {
    constructor(
        public readonly pluginName: string,
        public readonly pluginStage: 'pre' | 'main' | 'post',
        public readonly lifecyclePhase: 'prepare' | 'execute' | 'teardown',
        cause: Error | string
    ) {
        const causeMsg = cause instanceof Error ? cause.message : cause;
        super(`[${pluginStage.toUpperCase()}][${pluginName}][${lifecyclePhase}] ${causeMsg}`);
        this.name = 'PluginError';
        // Preserve original stack if available
        if (cause instanceof Error && cause.stack) {
            this.stack = this.stack + '\nCaused by: ' + cause.stack;
        }
    }
}

// ---------------------------------------------------------------------------
// BasePlugin — convenience abstract class with no-op defaults
// ---------------------------------------------------------------------------

/**
 * Extend BasePlugin instead of implementing IPlugin from scratch
 * when prepare or teardown require no logic (returns skip:false / no-op by default).
 */
export abstract class BasePlugin implements IPlugin {
    abstract readonly name: string;
    abstract readonly stage: 'pre' | 'main' | 'post';

    async prepare(_ctx: PipelineContext, _log: Logger): Promise<PrepareResult> {
        return { skip: false };
    }

    abstract execute(ctx: PipelineContext, log: Logger): Promise<void>;

    async teardown(_ctx: PipelineContext, _log: Logger): Promise<void> {
        // No-op by default. Override to release resources.
    }
}
