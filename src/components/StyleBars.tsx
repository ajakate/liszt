import { StyleScores } from '../types';

const LABELS: Record<string, string> = {
  sentence_length_mean: 'Sentence Length',
  sentence_length_variance: 'Sentence Variation',
  paragraph_length: 'Paragraph Length',
  vocabulary_richness: 'Vocabulary Richness',
  hapax_ratio: 'Rare Word Usage',
  function_word_density: 'Function Word Density',
  dialogue_ratio: 'Dialogue Ratio',
  adverb_density: 'Adverb Density',
  em_dash_frequency: 'Em-Dash Usage',
  exclamation_frequency: 'Exclamation Usage',
  semicolon_frequency: 'Semicolon Usage',
  vocabulary_commonality: 'Vocabulary Commonality',
  latinate_ratio: 'Latinate Vocabulary',
  said_bookism_ratio: '"Said" vs Bookisms',
  intensifier_density: 'Intensifier Usage',
  simile_density: 'Simile Density',
};

export default function StyleBars({ scores }: { scores: StyleScores }) {
  return (
    <div>
      {Object.entries(scores).map(([key, value]) => (
        <div key={key} className="style-bar">
          <span className="label">{LABELS[key] || key}</span>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${(value / 10) * 100}%` }} />
          </div>
          <span className="value">{value}</span>
        </div>
      ))}
    </div>
  );
}
