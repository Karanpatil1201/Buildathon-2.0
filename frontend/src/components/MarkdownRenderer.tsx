import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Parse inline elements (bold, italic, inline code)
  const renderInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Inline code: `code`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(
          <code
            key={`code-${keyIdx++}`}
            className="font-mono text-[11.5px] px-1.5 py-0.5 rounded-md bg-[#F0EAE1] text-[#71845B] border border-[#D8C9AE] font-medium"
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Bold: **bold**
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        parts.push(
          <strong key={`bold-${keyIdx++}`} className="font-semibold text-[#292A26]">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Italic: *italic* or _italic_
      const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1/);
      if (italicMatch) {
        parts.push(
          <em key={`italic-${keyIdx++}`} className="italic text-[#77766E]">
            {italicMatch[2]}
          </em>
        );
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Regular text up to the next special char
      const nextSpecial = remaining.search(/[`*_]/);
      if (nextSpecial === -1) {
        parts.push(remaining);
        break;
      } else if (nextSpecial > 0) {
        parts.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      } else {
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      }
    }

    return parts;
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2.5 space-y-1.5 pl-4 list-disc marker:text-[#71845B]">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = () => {
    if (inTable && tableHeaders.length > 0) {
      elements.push(
        <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-xl border border-[#D8C9AE]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F0EAE1] border-b border-[#D8C9AE] text-[#77766E] uppercase font-sans text-[11px] tracking-wider">
                {tableHeaders.map((th, i) => (
                  <th key={i} className="py-2.5 px-3.5 font-semibold">{th.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8C9AE]/50 bg-[#FFFCF6]">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[#F0EAE1]/60 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2.5 px-3.5 text-[#292A26] font-sans text-xs leading-normal">
                      {renderInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Table row detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());

      // Check if separator line (e.g. |---|---|)
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // Blank line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      flushList();
      elements.push(
        <h4 key={`h4-${i}`} className="text-xs font-semibold text-[#71845B] uppercase tracking-wider mt-3 mb-1 font-sans">
          {renderInline(trimmed.slice(5))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-semibold text-[#292A26] mt-3 mb-1.5 flex items-center gap-1.5 font-sans">
          <span className="w-1.5 h-1.5 rounded-full bg-[#71845B] shrink-0" />
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-semibold text-[#292A26] mt-4 mb-2 font-sans tracking-tight">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${i}`} className="text-lg font-bold text-[#292A26] mt-4 mb-2 font-sans tracking-tight">
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-3 border-[#D8C9AE]" />);
      continue;
    }

    // Bullet items: - or *
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (bulletMatch) {
      inList = true;
      listItems.push(
        <li key={`li-${i}`} className="text-[13px] text-[#292A26] leading-relaxed font-sans">
          {renderInline(bulletMatch[1])}
        </li>
      );
      continue;
    }

    // Numbered items: 1. item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      flushList();
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-2 my-1 text-[13px] text-[#292A26] font-sans">
          <span className="font-mono tabular-nums text-[#71845B] font-semibold shrink-0">{numMatch[1]}.</span>
          <span className="leading-relaxed">{renderInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-[13.5px] text-[#292A26] leading-[1.6] my-1.5 font-sans">
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();
  flushTable();

  return <div className="space-y-1">{elements}</div>;
};
