import axios from 'axios';
import * as vscode from 'vscode';

export class AIService {
    static async generateCypher(code: string, config: vscode.WorkspaceConfiguration): Promise<string> {
        const endpoint = config.get<string>('ai.endpoint') || '';
        const apiKey = config.get<string>('ai.apiKey') || '';
        const model = config.get<string>('ai.model') || 'gpt-4';

        const prompt = `
        Analyze the following source code and extract the function call graph.
        Return ONLY a set of Cypher statements compatible with Memgraph.
        Use node labels :Function and relationship type :CALLS.
        Include property 'name' for each function node.
        
        Example output:
        MERGE (a:Function {name: 'main'})
        MERGE (b:Function {name: 'processData'})
        MERGE (a)-[:CALLS]->(b)

        Code:
        ${code}
        `;

        try {
            const response = await axios.post(endpoint, {
                model: model,
                messages: [
                    { role: "system", content: "You are a code topology expert. You only output Cypher code." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            let cypher = response.data.choices[0].message.content;
            // Basic cleanup to remove markdown code blocks
            cypher = cypher.replace(/```cypher/g, '').replace(/```/g, '').trim();
            return cypher;
        } catch (error: any) {
            throw new Error(`AI Request failed: ${error.message}`);
        }
    }
}
