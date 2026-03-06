import { StyleScores } from '../types';

const LABELS: Record<string, string> = {
  prose_density: 'Prose Density',
  dialogue_ratio: 'Dialogue Ratio',
  sentence_length: 'Sentence Length',
  vocabulary_complexity: 'Vocabulary Complexity',
  tone_lightness: 'Tone Lightness',
  pacing: 'Pacing',
  metaphor_usage: 'Metaphor Usage',
  emotional_intensity: 'Emotional Intensity',
  formality: 'Formality',
  descriptiveness: 'Descriptiveness',
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
