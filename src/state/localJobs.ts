// Browser-local saved jobs for the consumer app. Designs are stored in
// localStorage so end users can save/open jobs without an account or server.
import type { Design } from '../model/types';

export interface LocalJob {
  id: number;
  name: string;
  updatedAt: string; // ISO timestamp
  design: Design;
}

const KEY = 'cabdesign-local-jobs';

function readAll(): LocalJob[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as LocalJob[];
    return Array.isArray(list) ? list.filter((j) => j && typeof j.id === 'number' && j.design) : [];
  } catch {
    return [];
  }
}

function writeAll(jobs: LocalJob[]) {
  localStorage.setItem(KEY, JSON.stringify(jobs));
}

/** Newest first. */
export function listLocalJobs(): LocalJob[] {
  return readAll().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function getLocalJob(id: number): LocalJob | null {
  return readAll().find((j) => j.id === id) ?? null;
}

export function createLocalJob(name: string, design: Design): LocalJob {
  const jobs = readAll();
  const job: LocalJob = { id: Date.now(), name, updatedAt: new Date().toISOString(), design };
  jobs.push(job);
  writeAll(jobs);
  return job;
}

export function updateLocalJob(id: number, name: string, design: Design): LocalJob | null {
  const jobs = readAll();
  const job = jobs.find((j) => j.id === id);
  if (!job) return null;
  job.name = name;
  job.design = design;
  job.updatedAt = new Date().toISOString();
  writeAll(jobs);
  return job;
}

export function renameLocalJob(id: number, name: string): void {
  const jobs = readAll();
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  job.name = name;
  job.updatedAt = new Date().toISOString();
  writeAll(jobs);
}

export function deleteLocalJob(id: number): void {
  writeAll(readAll().filter((j) => j.id !== id));
}
