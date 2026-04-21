import { NextRequest, NextResponse } from 'next/server';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { resolveParams } from '@/lib/nextjs-utils';
import { fetchField, getTransitionScreenFields } from '@/lib/trackerApi';

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params:
      | Promise<{ issueKey: string; transitionId: string }>
      | { issueKey: string; transitionId: string };
  }
) {
  try {
    const { issueKey, transitionId } = await resolveParams(params);

    if (!issueKey || !transitionId) {
      return NextResponse.json(
        { error: 'issueKey and transitionId are required' },
        { status: 400 }
      );
    }

    const trackerApi = await getTrackerApiFromRequest(request);
    const raw = await getTransitionScreenFields(issueKey, transitionId, trackerApi);

    // Обогащаем схемой и options для select-полей
    const fields = raw
      ? await Promise.all(
          raw.map(async (f) => {
            const schema = await fetchField(f.id, trackerApi);
            const opts =
              schema?.optionsProvider?.type === 'FixedListOptionsProvider'
                ? schema.optionsProvider?.values
                : undefined;
            return {
              id: f.id,
              display: schema?.name ?? f.display,
              required: schema?.schema?.required ?? f.required,
              schemaType: schema?.schema?.type,
              options: Array.isArray(opts) ? opts : undefined,
            };
          })
        )
      : [];

    return NextResponse.json({ fields });
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; data?: unknown }; message?: string };
    console.error('Error fetching transition fields:', {
      message: err?.message,
      status: err?.response?.status,
      data: err?.response?.data,
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch transition fields',
        details: err?.response?.data ?? err?.message,
      },
      { status: 500 }
    );
  }
}
