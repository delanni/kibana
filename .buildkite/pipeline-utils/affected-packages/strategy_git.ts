/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { execSync } from 'child_process';
import { getKibanaDir } from '../utils';
import { findModuleForPath, buildModuleDownstreamGraph } from './module_lookup';
import { filterIgnoredFiles } from './utils';

export function getAffectedModulesGit(
  mergeBase: string,
  includeDownstream: boolean,
  ignorePatterns: string[] = []
): Set<string> {
  const output = execSync(`git diff --name-only ${mergeBase} HEAD`, {
    cwd: getKibanaDir(),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  const allChanged = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const changedFiles = filterIgnoredFiles(allChanged, ignorePatterns);

  const directlyAffected = new Set<string>();
  for (const file of changedFiles) {
    const moduleId = findModuleForPath(file);
    if (moduleId) {
      directlyAffected.add(moduleId);
    }
  }

  return includeDownstream ? getDownstreamDependents(directlyAffected) : directlyAffected;
}

function getDownstreamDependents(moduleIds: Set<string>): Set<string> {
  const downstreamMap = buildModuleDownstreamGraph();
  const result = new Set<string>(moduleIds);
  const queue = Array.from(moduleIds);
  const visited = new Set<string>(moduleIds);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = downstreamMap.get(current);

    if (dependents) {
      for (const dependent of dependents) {
        if (!visited.has(dependent)) {
          visited.add(dependent);
          queue.push(dependent);
          result.add(dependent);
        }
      }
    }
  }
  return result;
}
