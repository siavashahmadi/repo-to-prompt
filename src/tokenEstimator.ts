/**
 * Estimates the number of LLM tokens in a string.
 * Uses the common heuristic of ~4 characters per token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Formats a token count as a human-readable string with thousands separators.
 */
export function formatTokenCount(count: number): string {
  return `~${count.toLocaleString('en-US')}`;
}
