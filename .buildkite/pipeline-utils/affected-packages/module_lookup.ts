/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import * as JSON5 from 'json5';
import { getKibanaDir } from '../utils';

export interface ModuleLookup {
  /** Relative module directory → module ID (e.g. `"src/core/packages/http/server-internal"` → `"@kbn/core-http-server-internal"`) */
  byDir: Map<string, string>;
  /** Module ID → relative module directory (reverse of byDir) */
  byId: Map<string, string>;
}

let cachedModuleLookup: ModuleLookup | null = null;

export function resetModuleLookupCache(): void {
  cachedModuleLookup = null;
}

/**
 * Discover all Kibana modules by scanning for kibana.jsonc files.
 * Each module's `id` field becomes the lookup value.
 *
 * The result is cached for the lifetime of the process (or until
 * `resetModuleLookupCache()` is called).
 */
export function getModuleLookup(repoRoot?: string): ModuleLookup {
  if (cachedModuleLookup) {
    return cachedModuleLookup;
  }

  const root = repoRoot ?? getKibanaDir();
  const files = discoverKibanaJsoncFiles(root);

  const byDir = new Map<string, string>();
  const byId = new Map<string, string>();

  for (const file of files) {
    if (file.includes('_fixtures_')) {
      continue;
    }
    const dir = path.dirname(file);
    try {
      const content = fs.readFileSync(path.join(root, file), 'utf8');
      const config = JSON5.parse(content);
      if (config.id && typeof config.id === 'string') {
        byDir.set(dir, config.id);
        byId.set(config.id, dir);
      }
    } catch {
      // Skip unreadable/unparseable files
    }
  }

  cachedModuleLookup = { byDir, byId };
  return cachedModuleLookup;
}

/**
 * Find the module that contains a given file path (longest-prefix match).
 */
export function findModuleForPath(filePath: string, repoRoot?: string): string | undefined {
  const lookup = getModuleLookup(repoRoot);
  const normalized = filePath.replace(/\\/g, '/');

  let longestPrefix = '';
  for (const moduleDir of lookup.byDir.keys()) {
    const normalizedDir = moduleDir.replace(/\\/g, '/').replace(/\/$/, '');
    if (normalized === normalizedDir || normalized.startsWith(`${normalizedDir}/`)) {
      if (moduleDir.length > longestPrefix.length) {
        longestPrefix = moduleDir;
      }
    }
  }

  return lookup.byDir.get(longestPrefix);
}

/**
 * Read tsconfig.json kbn_references for a module directory.
 */
export function getModuleDependencies(moduleDir: string, repoRoot?: string): string[] {
  const root = repoRoot ?? getKibanaDir();
  const tsconfigPath = path.join(root, moduleDir, 'tsconfig.json');

  try {
    const content = fs.readFileSync(tsconfigPath, 'utf8');
    const tsconfig = JSON5.parse(content);
    if (Array.isArray(tsconfig?.kbn_references)) {
      return tsconfig.kbn_references.filter((ref: unknown) => typeof ref === 'string');
    }
  } catch {
    // No tsconfig or unparseable
  }

  return [];
}

/**
 * Build a map where each module ID points to the set of modules that depend on it.
 */
export function buildModuleDownstreamGraph(repoRoot?: string): Map<string, Set<string>> {
  const root = repoRoot ?? getKibanaDir();
  const lookup = getModuleLookup(root);
  const downstreamMap = new Map<string, Set<string>>();

  for (const moduleId of lookup.byDir.values()) {
    downstreamMap.set(moduleId, new Set<string>());
  }

  for (const [moduleDir, moduleId] of lookup.byDir.entries()) {
    const deps = getModuleDependencies(moduleDir, root);
    for (const depId of deps) {
      const downstreams = downstreamMap.get(depId);
      if (downstreams) {
        downstreams.add(moduleId);
      }
    }
  }

  return downstreamMap;
}

function discoverKibanaJsoncFiles(root: string): string[] {
  try {
    const output = execSync('git ls-files "*/kibana.jsonc" "kibana.jsonc"', {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const files = output.split('\n').filter(Boolean);
    if (files.length > 0) return files;
  } catch {
    // Not a git repo or git not available – fall through to FS walk
  }

  return walkForKibanaJsonc(root);
}

const IGNORED_DIRS = new Set(['node_modules', '.git', 'target', 'build', 'bazel-out']);

function walkForKibanaJsonc(root: string, relDir = ''): string[] {
  const results: string[] = [];
  const absDir = relDir ? path.join(root, relDir) : root;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name)) {
      const childRel = relDir ? `${relDir}/${entry.name}` : entry.name;
      results.push(...walkForKibanaJsonc(root, childRel));
    } else if (entry.isFile() && entry.name === 'kibana.jsonc') {
      results.push(relDir ? `${relDir}/kibana.jsonc` : 'kibana.jsonc');
    }
  }

  return results;
}
