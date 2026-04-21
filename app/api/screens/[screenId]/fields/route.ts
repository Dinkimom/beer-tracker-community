import { NextRequest, NextResponse } from 'next/server';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { resolveParams } from '@/lib/nextjs-utils';
import { fetchField, fetchScreen } from '@/lib/trackerApi';

export interface TransitionFieldEnriched {
  display: string;
  id: string;
  /** Фиксированный список значений для select (FixedListOptionsProvider) */
  options?: string[];
  required: boolean;
  schemaType?: string; // user, string, date, float, integer, array...
}

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

    // 1. Получаем экран
    const screen = await fetchScreen(screenId, trackerApi);
    const elements = screen.elements ?? [];

    const fieldIds: Array<{ id: string; display: string; required: boolean }> =
      elements.length > 0
        ? elements.map((el) => ({
            id: el.field.id,
            display: el.field.display || el.field.id,
            required: el.required,
          }))
        : [{ id: 'comment', display: 'Комментарий', required: true }];

    // 2. Для каждого поля запрашиваем схему (schema.type, required, optionsProvider.values)
    const fields: TransitionFieldEnriched[] = await Promise.all(
      fieldIds.map(async (f) => {
        const schema = await fetchField(f.id, trackerApi);
        const opts = schema?.optionsProvider?.type === 'FixedListOptionsProvider'
          ? schema.optionsProvider?.values
          : undefined;
        return {
          id: f.id,
          display: schema?.name || f.display,
          required: schema?.schema?.required ?? f.required,
          schemaType: schema?.schema?.type,
          options: Array.isArray(opts) ? opts : undefined,
        };
      })
    );

    return NextResponse.json({ fields });
  } catch (error) {
    console.error('Error fetching screen fields:', error);
    return NextResponse.json(
      { error: 'Failed to fetch screen fields' },
      { status: 500 }
    );
  }
}
