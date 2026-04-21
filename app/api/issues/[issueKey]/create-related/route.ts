import { NextRequest, NextResponse } from 'next/server';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { resolveParams } from '@/lib/nextjs-utils';
import { CreateRelatedIssueSchema, formatValidationError, validateRequest } from '@/lib/validation';

// Интерфейс для данных новой задачи
interface NewIssueData {
  assignee?: string;
  bizErpTeam?: string[];
  description?: string;
  functionalTeam?: string;
  parent?: string;
  priority?: string;
  queue?: string;
  stage?: string;
  storyPoints?: number;
  summary: string;
  testPoints?: number;
  type?: string;
}

export async function POST(
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

    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(CreateRelatedIssueSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const {
      title,
      storyPoints,
      testPoints,
      sprintId,
      assignee,
      priority,
      functionalTeam,
      productTeam,
      stage,
      parent,
      type,
    } = validation.data;

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    // Сначала получаем исходную задачу для копирования полей
    const { data: sourceIssue } = await trackerApi.get(`/issues/${issueKey}`);

    // Подготавливаем данные для создания новой задачи
    const newIssueData: NewIssueData = {
      summary: title,
    };

    // Описание добавляем только если оно есть
    if (sourceIssue.description) {
      newIssueData.description = sourceIssue.description;
    }

    // Копируем основные поля из исходной задачи (обязательные поля)
    // Используем type guards для безопасного извлечения значений
    const extractStringOrKey = (value: unknown): string | undefined => {
      if (typeof value === 'string') {
        return value;
      }
      if (typeof value === 'object' && value !== null) {
        const obj = value as { key?: string; id?: string };
        return obj.key || obj.id;
      }
      return undefined;
    };

    if (sourceIssue.queue) {
      const queueValue = extractStringOrKey(sourceIssue.queue);
      if (queueValue) {
        newIssueData.queue = queueValue;
      } else {
        return NextResponse.json(
          { error: 'Source issue has no queue' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Source issue has no queue' },
        { status: 400 }
      );
    }

    // Используем явно указанный тип или тип из исходной задачи
    if (type) {
      newIssueData.type = type;
    } else if (sourceIssue.type) {
      const typeValue = extractStringOrKey(sourceIssue.type);
      if (typeValue) {
        newIssueData.type = typeValue;
      } else {
        return NextResponse.json(
          { error: 'Source issue has no type' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Source issue has no type' },
        { status: 400 }
      );
    }

    if (priority) {
      newIssueData.priority = priority;
    } else if (sourceIssue.priority) {
      const priorityValue = extractStringOrKey(sourceIssue.priority);
      if (priorityValue) {
        newIssueData.priority = priorityValue;
      }
    }

    if (assignee) {
      newIssueData.assignee = assignee;
    } else if (sourceIssue.assignee) {
      const assigneeValue = extractStringOrKey(sourceIssue.assignee);
      if (assigneeValue) {
        newIssueData.assignee = assigneeValue;
      }
    }

    if (functionalTeam || sourceIssue.functionalTeam) {
      newIssueData.functionalTeam = functionalTeam || sourceIssue.functionalTeam;
    }

    if (productTeam || sourceIssue.bizErpTeam) {
      newIssueData.bizErpTeam = productTeam || sourceIssue.bizErpTeam;
    }

    if (stage || sourceIssue.stage) {
      newIssueData.stage = stage || sourceIssue.stage;
    }

    if (parent) {
      newIssueData.parent = parent;
    } else if (sourceIssue.parent) {
      const parentValue = extractStringOrKey(sourceIssue.parent);
      if (parentValue) {
        newIssueData.parent = parentValue;
      }
    }

    // Добавляем story points и test points (можем передавать 0)
    if (storyPoints !== undefined && storyPoints !== null) {
      newIssueData.storyPoints = storyPoints;
    }

    if (testPoints !== undefined && testPoints !== null) {
      newIssueData.testPoints = testPoints;
    }

    // Создаем новую задачу
    const { data: newIssue } = await trackerApi.post('/issues', newIssueData);

    // Добавляем задачу в спринт, если указан
    if (sprintId) {
      try {
        // Используем данные из newIssue (если есть поле sprint) или добавляем спринт напрямую
        // Tracker API может вернуть sprint в ответе создания, но если нет - добавляем через patch
        const currentSprints = newIssue.sprint || [];
        const currentSprintIds = Array.isArray(currentSprints)
          ? currentSprints.map((s: string | { id: string }) =>
              typeof s === 'string' ? s : s.id
            )
          : [];

        // Если задача уже не в этом спринте, добавляем
        if (!currentSprintIds.includes(sprintId.toString())) {
          const updatedSprints = [
            ...(Array.isArray(currentSprints)
              ? currentSprints.map((s: string | { id: string }) =>
                  typeof s === 'string' ? { id: s } : { id: s.id }
                )
              : []),
            { id: sprintId.toString() },
          ];

          await trackerApi.patch(`/issues/${newIssue.key}`, {
            sprint: updatedSprints,
          });
        }
      } catch (error) {
        console.error('Failed to add issue to sprint:', error);
        // Не возвращаем ошибку, так как задача уже создана
      }
    }

    // Создаем связь "relates" между исходной и новой задачей
    try {
      await trackerApi.post(`/issues/${issueKey}/links`, {
        relationship: 'relates',
        issue: newIssue.key,
      });
    } catch (error) {
      console.error('Failed to create link:', error);
      // Не возвращаем ошибку, так как задача уже создана
    }

    return NextResponse.json({
      success: true,
      issue: newIssue,
    });
  } catch (error) {
    console.error('Error creating related issue:', error);
    return NextResponse.json(
      { error: 'Failed to create related issue' },
      { status: 500 }
    );
  }
}
