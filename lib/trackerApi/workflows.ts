/**
 * Tracker API: воркфлоу, экраны, поля, переходы (только сервер).
 */

import type { AxiosInstance } from 'axios';

import { apiCache, cacheKeys } from '../cache';
import { requireTrackerAxiosForApiRoute } from '../trackerAxiosFactory';

import { TRACKER_V3_BASE, WORKFLOW_CACHE_TTL, TRANSITIONS_BATCH_CONCURRENCY } from './constants';

interface WorkflowStepAction {
  id: string;
  key?: string;
  name?: string;
  screen?: { id: string };
  target?: { key?: string };
}
interface WorkflowStep {
  actions?: WorkflowStepAction[];
  metaAction?: WorkflowStepAction;
  status?: { key?: string };
}
interface ScreenElement {
  field: { id: string; display?: string };
  required: boolean;
}

function extractScreenElements(data: Record<string, unknown>): ScreenElement[] {
  const from = (d: Record<string, unknown>): ScreenElement[] => {
    if (Array.isArray(d.elements) && d.elements.length > 0) {
      return d.elements as ScreenElement[];
    }
    const columns = d.columns as Array<{ rows?: Array<{ elements?: ScreenElement[] }> }> | undefined;
    if (Array.isArray(columns)) {
      const out: ScreenElement[] = [];
      for (const col of columns) {
        for (const row of col.rows ?? []) {
          if (Array.isArray(row.elements)) out.push(...row.elements);
        }
      }
      return out;
    }
    return [];
  };
  let els = from(data);
  if (els.length === 0 && data.content && typeof data.content === 'object') {
    els = from(data.content as Record<string, unknown>);
  }
  return els;
}

export interface TrackerFieldSchema {
  id: string;
  key?: string;
  name?: string;
  optionsProvider?: {
    type?: string;
    values?: string[];
  };
  schema?: { type?: string; required?: boolean; items?: string };
}

export interface TransitionField {
  display: string;
  id: string;
  required: boolean;
}

export interface TransitionItem {
  display?: string;
  id: string;
  screen?: { id: string; display?: string };
  to: { key: string; display?: string };
}

export async function fetchQueueWorkflows(
  queueKey: string,
  axiosInstance?: AxiosInstance
): Promise<Record<string, Array<{ id: string; key: string; display?: string }>>> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const { data } = await api.get<Record<string, Array<{ id: string; key: string; display?: string }>>>(
    `${TRACKER_V3_BASE}/queues/${queueKey}/workflows`
  );
  return data;
}

export async function fetchWorkflow(
  workflowId: string,
  axiosInstance?: AxiosInstance
): Promise<{ steps: WorkflowStep[] }> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const { data } = await api.get<{ steps: WorkflowStep[] }>(
    `${TRACKER_V3_BASE}/workflows/${workflowId}`
  );
  return data;
}

export async function fetchField(
  fieldId: string,
  axiosInstance?: AxiosInstance
): Promise<TrackerFieldSchema | null> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const cacheKey = cacheKeys.field(fieldId);
  const cached = apiCache.get<TrackerFieldSchema>(cacheKey);
  if (cached) return cached;
  try {
    const { data } = await api.get<TrackerFieldSchema>(`${TRACKER_V3_BASE}/fields/${fieldId}`);
    apiCache.set(cacheKey, data, WORKFLOW_CACHE_TTL);
    return data;
  } catch {
    return null;
  }
}

export async function fetchScreen(
  screenId: string,
  axiosInstance?: AxiosInstance
): Promise<{ elements: ScreenElement[] }> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const { data } = await api.get<Record<string, unknown>>(
    `${TRACKER_V3_BASE}/screens/${screenId}`
  );
  const elements = extractScreenElements(data ?? {});
  return { elements };
}

export async function fetchIssueTransitions(
  issueKey: string,
  axiosInstance?: AxiosInstance
): Promise<TransitionItem[]> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const { data } = await api.get<TransitionItem[]>(
    `${TRACKER_V3_BASE}/issues/${issueKey}/transitions`
  );
  return data;
}

export async function getTransitionScreenFields(
  issueKey: string,
  transitionId: string,
  axiosInstance?: AxiosInstance
): Promise<TransitionField[] | null> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);

  const transitions = await fetchIssueTransitions(issueKey, api);
  const transition = transitions.find((t) => t.id === transitionId);
  const screenId = transition?.screen?.id;

  if (!screenId) return null;

  const screenCacheKey = cacheKeys.screen(String(screenId));
  let screen = apiCache.get<{ elements: ScreenElement[] }>(screenCacheKey);
  if (!screen) {
    screen = await fetchScreen(String(screenId), api);
    apiCache.set(screenCacheKey, screen, WORKFLOW_CACHE_TTL);
  }

  if (!screen?.elements?.length) return null;

  return screen.elements.map((el) => ({
    id: el.field.id,
    display: el.field.display || el.field.id,
    required: el.required,
  }));
}

export async function fetchQueueWorkflowScreens(
  queueKey: string,
  axiosInstance?: AxiosInstance
): Promise<Record<string, Record<string, TransitionField[]>>> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const cacheKey = cacheKeys.queueWorkflowScreens(queueKey);
  const cached = apiCache.get<Record<string, Record<string, TransitionField[]>>>(cacheKey);
  if (cached) return cached;

  const result: Record<string, Record<string, TransitionField[]>> = {};

  const workflows = await fetchQueueWorkflows(queueKey, api);
  for (const [workflowId, typeList] of Object.entries(workflows)) {
    if (!typeList?.length) continue;

    const workflow =
      apiCache.get<{ steps: WorkflowStep[] }>(cacheKeys.workflow(workflowId)) ??
      (await fetchWorkflow(workflowId, api));
    apiCache.set(cacheKeys.workflow(workflowId), workflow, WORKFLOW_CACHE_TTL);

    const transitionScreens: Record<string, TransitionField[]> = {};

    for (const step of workflow.steps || []) {
      const targets: WorkflowStepAction[] = [
        ...(step.actions ?? []),
        ...(step.metaAction ? [step.metaAction] : []),
      ];
      for (const action of targets) {
        if (!action?.id || !action.screen?.id) continue;
        const transitionKey = action.key || action.id;

        const screenId = String(action.screen.id);
        const screen =
          apiCache.get<{ elements: ScreenElement[] }>(cacheKeys.screen(screenId)) ??
          (await fetchScreen(screenId, api));
        apiCache.set(cacheKeys.screen(screenId), screen, WORKFLOW_CACHE_TTL);

        if (screen?.elements?.length) {
          const fields = screen.elements.map((el) => ({
            id: el.field.id,
            display: el.field.display || el.field.id,
            required: el.required,
          }));
          transitionScreens[transitionKey] = fields;
          const targetMeta = action.target?.key ? `${action.target.key}Meta` : null;
          if (targetMeta && transitionKey !== targetMeta) {
            transitionScreens[targetMeta] = fields;
          }
        }
      }
    }

    for (const t of typeList) {
      if (t?.key) result[t.key] = transitionScreens;
    }
  }

  apiCache.set(cacheKey, result, WORKFLOW_CACHE_TTL);
  return result;
}

export async function fetchTransitionsBatch(
  issueKeys: string[],
  axiosInstance?: AxiosInstance
): Promise<Record<string, TransitionItem[]>> {
  if (issueKeys.length === 0) return {};
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const result: Record<string, TransitionItem[]> = {};
  const uniqueKeys = [...new Set(issueKeys)];

  for (let i = 0; i < uniqueKeys.length; i += TRANSITIONS_BATCH_CONCURRENCY) {
    const batch = uniqueKeys.slice(i, i + TRANSITIONS_BATCH_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (key) => {
        const data = await api.get<TransitionItem[]>(
          `${TRACKER_V3_BASE}/issues/${key}/transitions`
        );
        return { key, list: data.data };
      })
    );
    settled.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) {
        result[r.value.key] = r.value.list;
      }
    });
  }
  return result;
}
