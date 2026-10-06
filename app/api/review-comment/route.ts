import { draftMode } from 'next/headers'
import { handleReviewComment } from '@/lib/review-comment-handler'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const dm = await draftMode()
  return handleReviewComment(request, { isDraftMode: dm.isEnabled })
}
