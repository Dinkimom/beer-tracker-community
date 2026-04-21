/**
 * Агрегаты SP/TP для score-эндпоинта из списка TrackerIssue (снимки в спринте).
 */

import type { TrackerIssue } from '@/types/tracker';

function isQaFunctionalTeam(issue: TrackerIssue): boolean {
  const t = (issue.functionalTeam ?? '').toLowerCase();
  return t.includes('qa') || t.includes('tester');
}

export function isDoneForSprintScore(issue: TrackerIssue): boolean {
  const k = (issue.status?.key ?? issue.statusType?.key ?? '').toLowerCase();
  return k === 'closed' || k === 'done' || k === 'resolved';
}

export function aggregateSprintScorePoints(issues: TrackerIssue[]): {
  qa_done: number;
  qa_left: number;
  sp_done: number;
  sp_left: number;
} {
  let spDone = 0;
  let spLeft = 0;
  let qaDone = 0;
  let qaLeft = 0;
  for (const issue of issues) {
    const done = isDoneForSprintScore(issue);
    const sp = issue.storyPoints ?? 0;
    const tp = issue.testPoints ?? 0;
    if (isQaFunctionalTeam(issue)) {
      if (done) qaDone += tp;
      else qaLeft += tp;
    } else if (done) spDone += sp;
    else spLeft += sp;
  }
  return {
    qa_done: Math.round(qaDone),
    qa_left: Math.round(qaLeft),
    sp_done: Math.round(spDone),
    sp_left: Math.round(spLeft),
  };
}
