/**
 * @module aiService
 * @description Optimized LangChain client for Cypher generation.
 *   Uses LangChain's JsonOutputParser for robust schema extraction without the 
 *   heavy overhead of Tool Calling (withStructuredOutput).
 */

import { ChatOpenAI } from '@langchain/openai';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { PipelineContext } from '../core/pipeline';

export interface CypherGenerationResult {
    thoughts: string[];
    writeCypher: string;
    fetchCypher: string;
}

const SYSTEM_TEMPLATE = 'You are a code topology expert. You only output valid JSON representing Cypher queries.';

const HUMAN_TEMPLATE_BASE = 
`Analyze the following source code and extract the code topology (call graph, dependencies).
{format_instructions}

Graph Modeling Rules:
1. "thoughts": Step-by-step reasoning (e.g. "Identified class A", "Function B calls C"). Must be the first field in JSON.
2. "writeCypher": A single string of Cypher statements to ingest the graph.
   - Use MERGE instead of CREATE to prevent duplicate nodes.
   - Every node MUST include the property fileScope: "%FILE_SCOPE_HASH%".
   - Use standard labels like :Class, :Function, :Variable.
   - Use standard relationship types like :CALLS, :DEFINES, :DEPENDS_ON.
   - Always use SINGLE QUOTES for string literal values in Cypher to avoid JSON escaping conflicts.
   - Separate multiple MERGE statements with spaces.
3. "fetchCypher": A Cypher MATCH query to retrieve exactly the ingested nodes and edges, filtered by fileScope: "%FILE_SCOPE_HASH%".

Example JSON Output:
{{
  "thoughts": ["Analyzing...", "Found class Parser and function parse().", "Generating Cypher..."],
  "writeCypher": "MERGE (c:Class {{name:'Parser', fileScope:'%FILE_SCOPE_HASH%'}}) MERGE (f:Function {{name:'parse', fileScope:'%FILE_SCOPE_HASH%'}}) MERGE (c)-[:DEFINES]->(f)",
  "fetchCypher": "MATCH (n {{fileScope:'%FILE_SCOPE_HASH%'}}) OPTIONAL MATCH (n)-[r]->(m {{fileScope:'%FILE_SCOPE_HASH%'}}) RETURN n, r, m"
}}

{astSection}
Code:
{code}`;

export class AIService {
    private static buildModel(endpoint: string, apiKey: string, modelName: string): ChatOpenAI {
        const baseURL = endpoint.replace(/\/chat\/completions\/?$/, '');
        const prevKey = process.env.OPENAI_API_KEY;
        process.env.OPENAI_API_KEY = apiKey || 'sk-placeholder';

        const model = new ChatOpenAI({
            modelName,
            openAIApiKey: apiKey || 'sk-placeholder',
            configuration: {
                baseURL,
                defaultHeaders: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
            },
            temperature: 0.1,
            maxTokens: 2048,
            timeout: 90_000,
        });

        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;

        return model;
    }

    static async generateCypher(
        context: PipelineContext,
        onProgress: (msg: string) => void,
    ): Promise<CypherGenerationResult> {
        const endpoint  = context.config.get<string>('ai.endpoint') || 'https://api.openai.com/v1/chat/completions';
        const apiKey    = context.config.get<string>('ai.apiKey')   || '';
        const modelName = context.config.get<string>('ai.model')    || 'gpt-4';

        if (!apiKey && endpoint.includes('api.openai.com')) {
            throw new Error('API Key missing for OpenAI endpoint.');
        }

        const astSection = context.astOutline ? `AST Outline:\n${context.astOutline}\n` : '';
        const model = AIService.buildModel(endpoint, apiKey, modelName);
        
        // Use LangChain's built-in robust JSON parser
        const parser = new JsonOutputParser<CypherGenerationResult>();
        const formatInstructions = parser.getFormatInstructions();

        // Pre-substitute all dynamic content to avoid LangChain's f-string parser
        // choking on { } characters that appear naturally in source code.
        const humanTemplate = HUMAN_TEMPLATE_BASE
            .replace(/%FILE_SCOPE_HASH%/g, context.fileScopeHash)
            .replace('{format_instructions}', formatInstructions)
            .replace('{astSection}', astSection)
            .replace('{code}', context.code.slice(0, 10000));

        // Build messages directly — no LangChain template parsing of user content
        const messages = [
            { role: 'system' as const, content: SYSTEM_TEMPLATE },
            { role: 'user' as const, content: humanTemplate },
        ];

        try {
            onProgress(`**开始** AI request → ${endpoint} (model=${modelName})`);
            onProgress(`📂 Scope: ${context.fileScopeHash} | File: ${context.fileName} | Code: ${context.code.length} chars`);
            const startedAt = Date.now();

            const stream = await model.stream(messages, 
                context.abortSignal ? { signal: context.abortSignal } : undefined);

            let rawText = '';
            let chunkCount = 0;

            for await (const chunk of stream) {
                chunkCount++;
                const token = chunk.content?.toString() || '';
                rawText += token;
            }

            const elapsed = Date.now() - startedAt;
            onProgress(`AI responded in ${elapsed}ms (${chunkCount} chunks, ${rawText.length} chars)`);

            // Parse the accumulated JSON response
            let parsed: CypherGenerationResult;
            try {
                parsed = await parser.parse(rawText);
            } catch (parseErr: any) {
                onProgress(`⚠ JSON parse failed, attempting extraction...`);
                // Try to extract JSON from markdown code fences or partial output
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error(`Failed to parse AI response as JSON: ${parseErr.message}\nRaw: ${rawText.slice(0, 500)}`);
                }
            }

            // Log thoughts
            if (parsed.thoughts && Array.isArray(parsed.thoughts)) {
                for (const thought of parsed.thoughts) {
                    onProgress(`🤔 ${thought}`);
                }
            }

            const normalize = (val: any) => Array.isArray(val) ? val.join(';\n') : (val || '');
            const writeCypher = normalize(parsed.writeCypher);
            const fetchCypher = normalize(parsed.fetchCypher)
                || `MATCH (n {fileScope: '${context.fileScopeHash}'}) OPTIONAL MATCH (n)-[r]->(m {fileScope: '${context.fileScopeHash}'}) RETURN n, r, m`;

            if (!writeCypher) {
                throw new Error('AI returned no writeCypher (empty response).');
            }

            onProgress(`**完成** writeCypher=${writeCypher.length} chars`);

            return {
                thoughts: parsed.thoughts || [],
                writeCypher,
                fetchCypher,
            };

        } catch (error: any) {
            if (error?.name === 'AbortError') throw error;
            const detail = error?.response?.data
                ? JSON.stringify(error.response.data)
                : (error?.body || '');
            console.error('AI generation failed:', error);
            throw new Error(`AI Analysis failed: ${error.message || String(error)}${detail ? `\nDetails: ${detail}` : ''}`);
        }
    }
}
