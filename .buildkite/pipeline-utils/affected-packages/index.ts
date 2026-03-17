/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { findModuleForPath } from './module_lookup';
import { getAffectedModulesGit } from './strategy_git';
import { getAffectedProjectsMoon } from './strategy_moon';

export interface AffectedPackagesConfig {
  strategy: 'git' | 'moon' | 'disabled';
  includeDownstream: boolean;
  logging: boolean;
  /** Glob patterns for changed files to exclude before module resolution (git strategy only). */
  ignorePatterns: string[];
}

/**
 * Returns affected package IDs, or null when filtering should be skipped
 * (strategy disabled, no merge base, or detection error).
 */
export async function getAffectedPackages(
  mergeBase: string | undefined,
  config: AffectedPackagesConfig = getConfigFromEnv()
): Promise<Set<string> | null> {
  const log = config.logging ? console.warn : () => {};

  if (config.strategy === 'disabled') {
    log('Affected package filtering is disabled');
    return null;
  }

  if (!mergeBase) {
    log('No merge base found - skipping filtering');
    return null;
  }

  log('--- Detecting Affected Packages');

  try {
    const affectedPackages =
      config.strategy === 'git'
        ? getAffectedModulesGit(mergeBase, config.includeDownstream, config.ignorePatterns)
        : getAffectedProjectsMoon(mergeBase, config.includeDownstream);

    if (affectedPackages.size === 0) {
      log('Warning: No affected packages found');
    }

    return affectedPackages;
  } catch (error) {
    console.error('Error during affected package detection:', error);
    return null;
  }
}

/**
 * Filter file paths to only those belonging to affected packages.
 * Returns all files when `affectedPackages` is null (filtering disabled).
 */
export function filterFilesByPackages(
  files: string[],
  affectedPackages: Set<string> | null
): string[] {
  if (affectedPackages === null) {
    return files;
  }
  if (affectedPackages.size === 0) {
    return [];
  }

  return files.filter((filePath) => {
    const moduleId = findModuleForPath(filePath);
    return !moduleId || affectedPackages.has(moduleId);
  });
}

function getConfigFromEnv(): AffectedPackagesConfig {
  const strategy = (process.env.AFFECTED_STRATEGY || 'git') as 'git' | 'moon' | 'disabled';
  const includeDownstream = process.env.AFFECTED_DOWNSTREAM !== 'false';
  const logging = process.env.AFFECTED_LOGGING !== 'false';
  const ignorePatterns = (process.env.AFFECTED_IGNORE || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  return { strategy, includeDownstream, logging, ignorePatterns };
}
