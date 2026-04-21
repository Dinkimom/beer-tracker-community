import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, TRACKER_UPSTREAM_FORWARD_STATUSES } from '@/lib/api-error-handler';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { resolveParams } from '@/lib/nextjs-utils';
import { fetchScreen } from '@/lib/trackerApi';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ screenId: string }> | { screenId: string } }
) {
  try {
    const { screenId } = await resolveParams(params);

    if (!screenId) {
      return NextResponse.json(
        { error: 'screenId is required' },
        { status: 400 }
      );
    }

    const trackerApi = await getTrackerApiFromRequest(request);
    const screen = await fetchScreen(screenId, trackerApi);

    return NextResponse.json(screen);
  } catch (error) {
    return handleApiError(error, 'fetch screen', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}
