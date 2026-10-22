/**
 * These are demo sites built with a prospect's content, so they must never show
 * up in search results. Indexing is OFF unless a deployment sets ALLOW_INDEXING=true.
 *
 * The block is a noindex response header sent to everything EXCEPT the AI crawlers
 * below, so AI tools can still read and analyse the site during a demo. robots.txt
 * deliberately does not disallow search engines: a crawler that is blocked from
 * fetching a page never sees its noindex, and the bare URL can still be listed.
 * Letting it fetch the page and read noindex is the reliable way to keep it out.
 *
 * Shared by app/robots.ts and next.config.ts.
 */
export const INDEXING_ALLOWED = process.env.ALLOW_INDEXING === 'true'

/** User-agent tokens of AI crawlers and assistants that are allowed to read the site. */
export const AI_CRAWLERS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  'ClaudeBot', 'Claude-Web', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'GoogleOther', 'Google-Extended', 'cohere-ai',
]
