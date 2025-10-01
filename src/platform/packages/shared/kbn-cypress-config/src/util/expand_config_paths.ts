/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import path from 'node:path';
import * as fs from 'node:fs';

type ConfigValue = string | number | boolean | null | ConfigObject | ConfigValue[];
interface ConfigObject {
  [key: string]: ConfigValue;
}

/**
 * Given an object, recursively expand any path containing tokens:
 *  - $kibanaRoot / $repoRoot - expands to the root of the Kibana project
 *  - $projectRoot - expands to the root of the current cypress project
 */
export function expandConfigPaths(configObject: ConfigObject): ConfigObject {
  const kibanaRoot = findPackageJsonWith({
    name: 'kibana',
  });
  const projectRoot = findPackageJsonWith({
    scripts: 'junit:merge',
  });

  function expand(value: ConfigValue): ConfigObject | ConfigValue {
    if (typeof value === 'string') {
      return value
        .replace(/\$kibanaRoot/g, kibanaRoot)
        .replace(/\$repoRoot/g, kibanaRoot)
        .replace(/\$projectRoot/g, projectRoot);
    } else if (Array.isArray(value)) {
      return value.map(expand);
    } else if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [key, expand(val as ConfigValue)])
      ) as ConfigObject;
    }

    return value;
  }

  return expand(configObject) as ConfigObject;
}

function findPackageJsonWith(matcher: Record<string, unknown>, searchRoot = process.cwd()): string {
  const rootDir = searchRoot.split(path.sep)[0] + path.sep;

  let isMatch = false;
  let currentDir = searchRoot;
  while (currentDir !== rootDir) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(currentDir, `package.json`), 'utf8'));
      for (const [key, value] of Object.entries(matcher)) {
        if (pkg[key] === value) {
          isMatch = true;
          break;
        } else if (typeof pkg[key] === 'object' && typeof value === 'string') {
          // just match for having the key
          if (value in pkg[key]) {
            isMatch = true;
            break;
          }
        }
      }
      if (isMatch) {
        return currentDir;
      }
    } catch {
      // ignore
    }
    currentDir = path.dirname(currentDir);
  }

  if (isMatch) {
    return currentDir;
  }

  throw new Error(`Could not find package.json with ${JSON.stringify(matcher)}`);
}
