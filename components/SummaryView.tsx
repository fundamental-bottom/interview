import type { SummaryBlock, SummaryDocument } from '@/lib/types';

function Block({ block }: { block: SummaryBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return <p>{block.text}</p>;
    case 'bullets':
      return block.items.length === 0 ? (
        <p className="muted">Nothing detected.</p>
      ) : (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'qa':
      return block.pairs.length === 0 ? (
        <p className="muted">No Q&amp;A detected.</p>
      ) : (
        <div>
          {block.pairs.map((pair, i) => (
            <div className="qa-pair" key={i}>
              <div className="q">Q: {pair.question}</div>
              <div>A: {pair.answer}</div>
            </div>
          ))}
        </div>
      );
    case 'actionItems':
      return block.items.length === 0 ? (
        <p className="muted">No action items detected.</p>
      ) : (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>
              {item.description}
              <span className="owner-chip">{item.owner}</span>
            </li>
          ))}
        </ul>
      );
  }
}

export function SummaryView({ summary }: { summary: SummaryDocument }) {
  return (
    <div>
      {summary.sections.map((section) => (
        <div key={section.title}>
          <h3>{section.title}</h3>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>
      ))}
    </div>
  );
}
