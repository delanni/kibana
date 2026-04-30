/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export interface FtrSelectiveResult {
  /** Narrowed map (same shape as input). When `applied` is false, this is the original map unchanged. */
  ftrConfigsByQueue: Map<string, string[]>;
  /** True when the narrowing was safe to apply and produced a non-empty subset. */
  applied: boolean;
  /** Human-readable explanation for logging. */
  reason: string;
}

/**
 * Narrow the set of FTR configs to only those whose "test territory" was touched
 * by the PR. Bails out (returns the input map unchanged with `applied=false`)
 * whenever the diff includes any file outside FTR test territory, or when the
 * narrowed set would be empty.
 *
 * "Test territory" is the directory tree rooted at the deepest ancestor of a
 * changed file that DIRECTLY contains an FTR config file. Anything alongside
 * or below such a directory is considered colocated. Files that have no
 * config-bearing directory among their ancestors are treated as non-test
 * source — we bail out and let the full suite run.
 */
export function filterFtrConfigsBySelectiveTesting({
  ftrConfigsByQueue,
  prChangedFiles,
}: {
  ftrConfigsByQueue: Map<string, string[]>;
  prChangedFiles: string[];
}): FtrSelectiveResult {
  if (prChangedFiles.length === 0) {
    return { ftrConfigsByQueue, applied: false, reason: 'no changed files' };
  }

  const allConfigs = collectAllConfigs(ftrConfigsByQueue);
  if (allConfigs.length === 0) {
    return { ftrConfigsByQueue, applied: false, reason: 'no FTR configs to narrow' };
  }

  const configDirs = collectConfigDirs(allConfigs);
  const matchedRoots = new Set<string>();

  for (const file of prChangedFiles) {
    const root = findTestRoot(file, configDirs);
    if (!root) {
      return {
        ftrConfigsByQueue,
        applied: false,
        reason: `non-test file changed: ${file}`,
      };
    }
    matchedRoots.add(root);
  }

  const narrowed = narrowByRoots(ftrConfigsByQueue, matchedRoots);
  const narrowedCount = countConfigs(narrowed);

  if (narrowedCount === 0) {
    return { ftrConfigsByQueue, applied: false, reason: 'narrowed set is empty' };
  }

  return {
    ftrConfigsByQueue: narrowed,
    applied: true,
    reason: `kept ${narrowedCount}/${allConfigs.length} FTR configs across ${narrowed.size} queue(s)`,
  };
}

/**
 * Walk ancestors of `file` from deepest to shallowest. Return the first
 * directory (with trailing `/`) that DIRECTLY contains an FTR config file.
 * Returns undefined when no such ancestor exists, indicating the file is
 * non-test source.
 */
function findTestRoot(file: string, configDirs: Set<string>): string | undefined {
  const normalized = normalizePath(file);

  let dir = parentDir(normalized);
  while (dir !== undefined) {
    if (configDirs.has(dir)) {
      return `${dir}/`;
    }
    if (dir === '') break;
    dir = parentDir(dir);
  }
  return undefined;
}

function collectConfigDirs(allConfigs: string[]): Set<string> {
  const dirs = new Set<string>();
  for (const cfg of allConfigs) {
    const parent = parentDir(cfg);
    if (parent !== undefined) dirs.add(parent);
  }
  return dirs;
}

function narrowByRoots(
  ftrConfigsByQueue: Map<string, string[]>,
  matchedRoots: Set<string>
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const [queue, configs] of ftrConfigsByQueue) {
    const kept = configs.filter((cfg) => isUnderAnyRoot(cfg, matchedRoots));
    if (kept.length > 0) {
      result.set(queue, kept);
    }
  }
  return result;
}

function isUnderAnyRoot(configPath: string, roots: Set<string>): boolean {
  const normalized = normalizePath(configPath);
  for (const root of roots) {
    if (root === '' || normalized.startsWith(root)) {
      return true;
    }
  }
  return false;
}

function collectAllConfigs(ftrConfigsByQueue: Map<string, string[]>): string[] {
  const all: string[] = [];
  for (const configs of ftrConfigsByQueue.values()) {
    for (const c of configs) all.push(normalizePath(c));
  }
  return all;
}

function countConfigs(map: Map<string, string[]>): number {
  let n = 0;
  for (const v of map.values()) n += v.length;
  return n;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function parentDir(p: string): string | undefined {
  const idx = p.lastIndexOf('/');
  if (idx < 0) return p === '' ? undefined : '';
  return p.slice(0, idx);
}
