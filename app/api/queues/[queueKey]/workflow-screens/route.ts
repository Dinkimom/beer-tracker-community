import { NextRequest, NextResponse } from 'next/server';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { resolveParams } from '@/lib/nextjs-utils';
import { fetchQueueWorkflowScreens } from '@/lib/trackerApi';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ queueKey: string }> | { queueKey: string } }
) {
  try {
    const { queueKey } = await resolveParams(params);

    if (!queueKey) {
      return NextResponse.json(
        { error: 'queueKey is required' },
        { status: 400 }
      );
    }

    const trackerApi = await getTrackerApiFromRequest(request);
    const screens = await fetchQueueWorkflowScreens(queueKey, trackerApi);

    return NextResponse.json(screens);
  } catch (error) {
    console.error('Error fetching workflow screens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow screens' },
      { status: 500 }
    );
  }
}
