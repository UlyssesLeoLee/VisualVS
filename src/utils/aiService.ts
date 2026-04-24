/**
 * @module aiService
 * @description OpenAI-compatible HTTP client for Cypher graph generation.
 *   Implements exponential-backoff retry for rate-limit and server errors.
 *
 * @cypher-manifest
 * // ── Module node ───────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'aiService', path: 'src/utils/aiService.ts', layer: 'util'})
 * MERGE (:Module {name: 'aiService'})-[:IMPORTS]->(:Module {name: 'pipeline'})
 * // ── Class & method nodes ───────────────────────────────────────────────────
 * MERGE (:Class    {name: 'AIService',      module: 'aiService'})
 * MERGE (:Method   {name: 'generateCypher', module: 'aiService', class: 'AIService', static: true})
 * // ── Containment ────────────────────────────────────────────────────────────
 * MERGE (:Module {name: 'aiService'})-[:CONTAINS]->(:Class  {name: 'AIService'})
 * MERGE (:Class  {name: 'AIService'}) -[:CONTAINS]->(:Method {name: 'generateCypher'})
 * // ── Relationships ──────────────────────────────────────────────────────────
 * MERGE (:Method {name: 'generateCypher'})-[:READS {field: 'code'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Method {name: 'generateCypher'})-[:READS {field: 'astOutline'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Method {name: 'generateCypher'})-[:READS {field: 'fileScopeHash'}]->(:Interface {name: 'PipelineContext'})
 * MERGE (:Method {name: 'generateCypher'})-[:CALLS]->(:Lib {name: 'axios', type: 'http_client'})
 * MERGE (:Class  {name: 'AIGeneratorPlugin'})-[:CALLS]->(:Method {name: 'generateCypher'})
 */

import axios from 'axios';
import * as vscode from 'vscode';
import { PipelineContext } from '../core/pipeline';

export class AIService {
    static async generateCypher(context: PipelineContext, onProgress: (msg: string) => void): Promise<string> {
        const endpoint = context.config.get<string>('ai.endpoint') || '';
        const apiKey = context.config.get<string>('ai.apiKey') || '';
        const model = context.config.get<string>('ai.model') || 'gpt-4';

        const outlineStr = context.astOutline ? `\nRefer to this AST outline to ground your analysis:\n${context.astOutline}\n` : '';

        const prompt = `Analyze the following source code and extract the call graph.
Return ONLY valid Cypher statements for Memgraph. No explanation, no markdown fences.
Use labels :Function and relationship :CALLS.
Every node MUST have property fileScope: '${context.fileScopeHash}'.
${context.astOutline ? `AST Outline:\n${context.astOutline}\n` : ''}
Code:
${context.code.slice(0, 8000)}`;
// Truncate code to 8000 chars to avoid hitting context limits

        const maxRetries = 3;
        let attempt = 0;
        let baseDelay = 1000; // 1 second

        while (attempt < maxRetries) {
            try {
                if (attempt > 0) {
                    onProgress(`Retrying AI Service (Attempt ${attempt + 1}/${maxRetries})...`);
                }
                const response = await axios.post(endpoint, {
                    model: model,
                    messages: [
                        { role: "system", content: "You are a code topology expert. Output only Cypher statements, no markdown, no explanation." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 2048
                }, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 120000 // 120s for large models like Qwen 122B
                });

                if (typeof response.data === 'string' && response.data.trim().toLowerCase().startsWith('<!doctype html>')) {
                    throw new Error(`The AI Endpoint returned an HTML Webpage instead of a JSON API response!\n\n💡 FIX: You entered the URL of a Browser UI (like NextChat/Ollama frontend) instead of the actual API route.\n\nPlease go to settings and append the correct API path to your Endpoint.\n• For ChatGPT-Next-Web: your-url/api/openai/v1/chat/completions\n• For Ollama API: your-url/v1/chat/completions\n• For OpenAI native: https://api.openai.com/v1/chat/completions`);
                }

                if (!response.data || !response.data.choices || response.data.choices.length === 0) {
                    const apiError = response.data?.error?.message || JSON.stringify(response.data);
                    throw new Error(`API returned no JSON choices. Details: ${apiError}`);
                }

                let cypher = response.data.choices[0].message.content;
                cypher = cypher.replace(/```cypher/g, '').replace(/```/g, '').trim();
                return cypher;
            } catch (error: any) {
                attempt++;
                const isRateLimit = error.response?.status === 429;
                const isServerError = error.response?.status >= 500;
                const isTimeout = error.code === 'ECONNABORTED';
                
                if (attempt >= maxRetries || (!isRateLimit && !isServerError && !isTimeout)) {
                    const detail = error.response?.data?.error?.message || error.message;
                    throw new Error(`AI Request failed after ${attempt} attempts: ${detail}`);
                }
                
                const delayMs = baseDelay * Math.pow(2, attempt - 1);
                onProgress(`Network issue (${error.message}). Waiting ${delayMs}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        throw new Error('AI Generation failed');
    }
}
