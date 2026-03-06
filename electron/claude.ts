import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export const AVAILABLE_MODELS = [
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 3.5 (fastest, cheapest)' },
  { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4 (balanced)' },
  { id: 'claude-opus-4-20250514', name: 'Opus 4 (most capable, expensive)' },
];

interface AnalysisResult {
  question: string;
  answer: string;
}

interface StyleProfile {
  scores: Record<string, number>;
  description: string;
}

export async function analyzeBook(
  apiKey: string,
  model: string,
  title: string,
  author: string,
  text: string,
  questions: string[]
): Promise<AnalysisResult[]> {
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

  // Parse JSON from response, handling potential markdown code blocks
  let jsonText = content.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(jsonText);
}

export async function generateStyleProfile(
  apiKey: string,
  model: string,
  title: string,
  author: string,
  text: string
): Promise<StyleProfile> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a literary style analyst. Analyze the writing style of this book: "${title}" by ${author}.

Rate the following dimensions on a scale of 1-10 and provide a brief overall style description (2-3 sentences).

Dimensions to rate:
- prose_density: 1=sparse/minimal, 10=dense/ornate
- dialogue_ratio: 1=almost no dialogue, 10=dialogue-heavy
- sentence_length: 1=very short sentences, 10=very long complex sentences
- vocabulary_complexity: 1=simple everyday words, 10=advanced/literary vocabulary
- tone_lightness: 1=very dark/serious, 10=very light/humorous
- pacing: 1=very slow/contemplative, 10=very fast/action-packed
- metaphor_usage: 1=literal/straightforward, 10=heavily figurative
- emotional_intensity: 1=restrained/subtle, 10=intense/dramatic
- formality: 1=very casual/conversational, 10=very formal/literary
- descriptiveness: 1=minimal description, 10=richly detailed

Respond in JSON format:
{
  "scores": {
    "prose_density": 7,
    "dialogue_ratio": 5,
    ...
  },
  "description": "A brief 2-3 sentence description of the overall writing style."
}

Book text:
${text}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  let jsonText = content.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(jsonText);
}
