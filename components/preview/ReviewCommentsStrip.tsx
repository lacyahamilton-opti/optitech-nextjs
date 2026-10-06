import { getReviewComments, reviewHistoryEnabled } from '@/lib/review-comments'
import { ReviewCommentsPanel } from '@/components/preview/ReviewCommentsPanel'

/**
 * ReviewCommentsStrip — server component shown to CMS authors alongside
 * ExternalPreviewLinkPanel. Fetches external reviewer comments (newest first)
 * and hands them to the client panel. Renders nothing when KV is not
 * configured or there are no comments. Reviewer names/emails are self-reported
 * and unverified.
 */
export async function ReviewCommentsStrip({ contentKey }: { contentKey: string }) {
  // Stored under the dash-less lowercase key (matches validateReviewInput).
  const key = contentKey.replace(/-/g, '').toLowerCase()
  if (!key || !reviewHistoryEnabled()) return null
  const comments = await getReviewComments(key)
  if (comments.length === 0) return null

  return (
    <ReviewCommentsPanel
      comments={comments.map(c => ({
        id:          c.id,
        name:        c.name,
        email:       c.email,
        comment:     c.comment,
        ver:         c.ver,
        path:        c.path,
        submittedAt: c.submittedAt,
      }))}
    />
  )
}
