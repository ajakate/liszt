import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export const AVAILABLE_MODELS = [
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 3.5 (fastest, cheapest)' },
  { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4 (balanced)' },
  { id: 'claude-opus-4-20250514', name: 'Opus 4 (most capable, expensive)' },
];

// Cost per million tokens
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
};

export interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  cost: number;
  model: string;
}

interface AnalysisResult {
  question: string;
  answer: string;
}

interface AnalysisResponse {
  results: AnalysisResult[];
  usage: UsageInfo;
}

function extractJSON(text: string): string {
  let s = text.trim();
  // Strip markdown code blocks
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  // Find the first [ or { and its matching closing bracket
  const start = s.search(/[\[{]/);
  if (start === -1) throw new Error('No JSON found in response');
  const openChar = s[start];
  const closeChar = openChar === '[' ? ']' : '}';
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === openChar) depth++;
    else if (s[i] === closeChar) depth--;
    if (depth === 0) return s.substring(start, i + 1);
  }
  throw new Error('Unterminated JSON in response');
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export function estimateCost(model: string, textLength: number): number {
  // Rough estimate: ~4 chars per token for English text, plus prompt overhead
  const estimatedInputTokens = Math.ceil(textLength / 4) + 500;
  const estimatedOutputTokens = 1000;
  return calculateCost(model, estimatedInputTokens, estimatedOutputTokens);
}

export async function analyzeBook(
  apiKey: string,
  model: string,
  title: string,
  author: string,
  text: string,
  questions: string[]
): Promise<AnalysisResponse> {
  const client = new Anthropic({ apiKey });

  const questionsFormatted = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are analyzing the book "${title}" by ${author}. Based on the text provided, answer each of the following questions. Be specific and give examples from the text where relevant. Keep each answer concise (2-4 sentences).

Questions:
${questionsFormatted}

Respond in JSON format as an array of objects with "question" and "answer" fields. Example:
[{"question": "Does an animal die?", "answer": "Yes, in chapter 3..."}]

Book text:
${text}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const cost = calculateCost(model, response.usage.input_tokens, response.usage.output_tokens);

  return {
    results: JSON.parse(extractJSON(content.text)),
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost,
      model,
    },
  };
}

