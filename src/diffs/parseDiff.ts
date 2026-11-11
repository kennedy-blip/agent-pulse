import type { DiffFile, DiffHunk, DiffLine } from '../types';

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

/** Parses the hunk section of a unified diff (lines starting with `@@`, ` `, `+`, `-`). */
export function parseHunks(patch: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  for (const raw of patch.replace(/^\n/, '').replace(/\n$/, '').split('\n')) {
    const m = HUNK_RE.exec(raw);
    if (m) {
      oldNo = Number(m[1]);
      newNo = Number(m[2]);
      current = { header: raw, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current || raw.startsWith('\\')) continue;
    const marker = raw[0];
    const content = raw.slice(1);
    let line: DiffLine;
    if (marker === '+') {
      line = { type: 'add', oldNo: null, newNo: newNo++, content };
    } else if (marker === '-') {
      line = { type: 'del', oldNo: oldNo++, newNo: null, content };
    } else {
      line = { type: 'ctx', oldNo: oldNo++, newNo: newNo++, content };
    }
    current.lines.push(line);
  }
  return hunks;
}

export function makeFile(path: string, patch: string, status: DiffFile['status'] = 'modified'): DiffFile {
  return { path, status, hunks: parseHunks(patch) };
}

export function diffStats(files: DiffFile[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const f of files) {
    for (const h of f.hunks) {
      for (const l of h.lines) {
        if (l.type === 'add') additions += 1;
        else if (l.type === 'del') deletions += 1;
      }
    }
  }
  return { additions, deletions };
}

export interface SplitRow {
  left: (DiffLine & { idx: number }) | null;
  right: (DiffLine & { idx: number }) | null;
}

/** Pairs deletions with following additions so they render side-by-side. */
export function toSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === 'ctx') {
      rows.push({ left: { ...line, idx: i }, right: { ...line, idx: i } });
      i += 1;
      continue;
    }
    const dels: Array<DiffLine & { idx: number }> = [];
    const adds: Array<DiffLine & { idx: number }> = [];
    while (i < lines.length && lines[i].type === 'del') {
      dels.push({ ...lines[i], idx: i });
      i += 1;
    }
    while (i < lines.length && lines[i].type === 'add') {
      adds.push({ ...lines[i], idx: i });
      i += 1;
    }
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k += 1) rows.push({ left: dels[k] ?? null, right: adds[k] ?? null });
  }
  return rows;
}
