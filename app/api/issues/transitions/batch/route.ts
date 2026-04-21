import { NextRequest, NextResponse } from 'next/server';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { fetchTransitionsBatch } from '@/lib/trackerApi';

/**
 * POST /api/issues/transitions/batch
 * Body: { issueKeys: string[] }
 * Returns: { [issueKey]: TransitionItem[] }
 *
 * Один запрос вместо N — загружает transitions для всех задач спринта.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const issueKeys = Array.isArray(body?.issueKeys) ? body.issueKeys : [];
    const keys = issueKeys.filter((k: unknown) => typeof k === 'string');

    if (keys.length === 0) {
      return NextResponse.json({});
    }

    const trackerApi = await getTrackerApiFromRequest(request);
    const data = await fetchTransitionsBatch(keys, trackerApi);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching transitions batch:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transitions batch' },
      { status: 500 }
    );
  }
}
