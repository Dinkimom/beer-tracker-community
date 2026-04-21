import { NextRequest, NextResponse } from 'next/server';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { resolveParams } from '@/lib/nextjs-utils';
import { fetchField } from '@/lib/trackerApi';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> | { fieldId: string } }
) {
  try {
    const { fieldId } = await resolveParams(params);

    if (!fieldId) {
      return NextResponse.json(
        { error: 'fieldId is required' },
        { status: 400 }
      );
    }

    const trackerApi = await getTrackerApiFromRequest(request);
    const field = await fetchField(fieldId, trackerApi);

    if (!field) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    return NextResponse.json(field);
  } catch (error) {
    console.error('Error fetching field:', error);
    return NextResponse.json(
      { error: 'Failed to fetch field' },
      { status: 500 }
    );
  }
}
