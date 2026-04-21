import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, TRACKER_UPSTREAM_FORWARD_STATUSES } from '@/lib/api-error-handler';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { resolveParams } from '@/lib/nextjs-utils';
import { fetchIssueTransitions } from '@/lib/trackerApi';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> | { issueKey: string } }
) {
  try {
    const { issueKey } = await resolveParams(params);

    if (!issueKey) {
      return NextResponse.json(
        { error: 'issueKey is required' },
        { status: 400 }
      );
    }

    const trackerApi = await getTrackerApiFromRequest(request);
    const data = await fetchIssueTransitions(issueKey, trackerApi);

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'fetch transitions', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}
