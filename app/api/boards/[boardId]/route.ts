import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { fetchBoardParams } from '@/lib/trackerApi';

/**
 * GET /api/boards/[boardId]
 * Получить параметры доски из Yandex Tracker (колонки и т.д.)
 * Документация: https://yandex.ru/support/tracker/ru/get-board
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const boardIdNum = parseInt(boardId, 10);
    if (isNaN(boardIdNum) || boardIdNum <= 0) {
      return NextResponse.json(
        { error: 'boardId must be a positive number' },
        { status: 400 }
      );
    }

    const trackerApi = await getTrackerApiFromRequest(_request);
    const board = await fetchBoardParams(boardIdNum, trackerApi);
    return NextResponse.json(board);
  } catch (error) {
    return handleApiError(error, 'fetch board params from Tracker');
  }
}
