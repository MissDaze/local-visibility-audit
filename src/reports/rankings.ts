// The benchmark list contains competitors only. A position immediately after
// its last entry means the subject falls below every business in that list.
export function formatBenchmarkRank(rank: number | null, competitors: number): string {
  if (rank === null || competitors === 0) return 'N/A';
  if (rank === competitors + 1) {
    return `Below all ${competitors} benchmark competitor${competitors === 1 ? '' : 's'}`;
  }
  return `#${rank} of ${competitors}`;
}

// Apply the same wording to existing saved reports without changing their data
// or regenerating an audit. Restrict this to the known N+1-of-N ranking form.
export function clarifyBenchmarkRankings(markdown: string): string {
  return markdown.replace(
    /(?:\bat\s+)?#(\d+)\s+(?:out\s+of|of)\s+(\d+)\b(?:\s+(?:benchmark\s+)?competitors?\b)?/gi,
    (match: string, rankText: string, countText: string, offset: number) => {
      const rank = Number(rankText);
      const count = Number(countText);
      if (count < 1 || rank !== count + 1) return match;
      const label = formatBenchmarkRank(rank, count);
      const startsCellOrLine = /(?:^|\n|\|)\s*(?:\*\*)?$/.test(markdown.slice(0, offset));
      return startsCellOrLine ? label : label.charAt(0).toLowerCase() + label.slice(1);
    },
  );
}
