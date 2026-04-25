
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

const AI_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const AI_KEY      = "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";
const AI_MODEL    = "meta/llama-3.1-405b-instruct"; // Common NVIDIA NIM model

async function testNVAPI() {
    console.log('Testing NVAPI Key...');
    console.log(`Endpoint: ${AI_ENDPOINT}`);
    console.log(`Model:    ${AI_MODEL}`);

    const baseURL = AI_ENDPOINT.replace(/\/chat\/completions\/?$/, '');
    
    // Set env var for LangChain
    process.env.OPENAI_API_KEY = AI_KEY;

    const model = new ChatOpenAI({
        modelName: AI_MODEL,
        openAIApiKey: AI_KEY,
        configuration: { 
            baseURL, 
            defaultHeaders: { 
                'Authorization': `Bearer ${AI_KEY}` 
            } 
        },
        temperature: 0.1,
        maxTokens: 512,
        timeout: 60_000,
    });

    const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
            'You are a code topology expert. Output only Cypher statements, no markdown, no explanation.'
        ),
        HumanMessagePromptTemplate.fromTemplate(
            `Analyze this code and return 1-3 Cypher MERGE statements using :Function nodes and :CALLS edges.
Every node MUST have fileScope: 'test_scope'.
Code:
{code}`
        ),
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const SAMPLE_CODE = `
function greet(name) { return \`Hello, \${name}\`; }
function main() { console.log(greet('world')); }
`;

    try {
        console.log('Sending request to NVAPI...');
        const result = await chain.invoke({ code: SAMPLE_CODE });
        console.log('--- Result ---');
        console.log(result);
        console.log('--------------');
        console.log('✅ NVAPI Test PASSED');
    } catch (error) {
        console.error('❌ NVAPI Test FAILED');
        console.error(error);
        process.exit(1);
    }
}

testNVAPI();
