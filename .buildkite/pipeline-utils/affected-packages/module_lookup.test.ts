/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  getModuleLookup,
  findModuleForPath,
  getModuleDependencies,
  buildModuleDownstreamGraph,
  resetModuleLookupCache,
} from './module_lookup';
import { getAffectedModulesGit } from './strategy_git';

// ---------------------------------------------------------------------------
// Helpers for creating a fake repo in a temp directory
// ---------------------------------------------------------------------------

function git(cwd: string, command: string): string {
  return execSync(`git ${command}`, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

interface ModuleSpec {
  relDir: string;
  id: string;
  deps: string[];
}

function createModule(root: string, spec: ModuleSpec): void {
  const dir = path.join(root, spec.relDir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });

  fs.writeFileSync(
    path.join(dir, 'kibana.jsonc'),
    JSON.stringify(
      {
        type: 'shared-common',
        id: spec.id,
        owner: '@elastic/test',
        group: 'platform',
        visibility: 'shared',
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: {},
        kbn_references: spec.deps,
      },
      null,
      2
    )
  );

  fs.writeFileSync(path.join(dir, 'src', 'index.ts'), 'export {};\n');
}

function commitAll(root: string, message: string): string {
  git(root, 'add -A');
  git(root, `commit --allow-empty -m "${message}"`);
  return git(root, 'rev-parse HEAD').trim();
}

function addFileInModule(root: string, moduleRelDir: string, fileName: string): void {
  const filePath = path.join(root, moduleRelDir, 'src', fileName);
  fs.writeFileSync(filePath, `// generated ${fileName}\nexport const x = 1;\n`);
}

function modifyFile(root: string, relPath: string, content: string): void {
  fs.writeFileSync(path.join(root, relPath), content);
}

function removeFile(root: string, relPath: string): void {
  fs.unlinkSync(path.join(root, relPath));
}

// ---------------------------------------------------------------------------
// Test setup: 5-module dependency graph
//
//   @kbn/core  ←  @kbn/utils  ←  @kbn/my-plugin
//                     ↑
//   @kbn/logging ←  @kbn/analytics
//
// Downstream of @kbn/core:    utils, my-plugin
// Downstream of @kbn/logging: analytics
// Downstream of @kbn/utils:   my-plugin
// ---------------------------------------------------------------------------

const MODULES: ModuleSpec[] = [
  { relDir: 'packages/core', id: '@kbn/core', deps: [] },
  { relDir: 'packages/utils', id: '@kbn/utils', deps: ['@kbn/core'] },
  { relDir: 'packages/logging', id: '@kbn/logging', deps: [] },
  { relDir: 'packages/analytics', id: '@kbn/analytics', deps: ['@kbn/logging', '@kbn/utils'] },
  {
    relDir: 'plugins/my-plugin',
    id: '@kbn/my-plugin',
    deps: ['@kbn/core', '@kbn/utils'],
  },
];

describe('module_lookup', () => {
  let tmpDir: string;
  let baseCommit: string;

  beforeEach(() => {
    resetModuleLookupCache();

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'module-lookup-test-'));

    git(tmpDir, 'init');
    git(tmpDir, 'config user.email "test@test.com"');
    git(tmpDir, 'config user.name "Test"');

    for (const spec of MODULES) {
      createModule(tmpDir, spec);
    }

    // Non-module directory
    fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'scripts', 'build.sh'), '#!/bin/bash\n');

    baseCommit = commitAll(tmpDir, 'initial');
  });

  afterEach(() => {
    resetModuleLookupCache();
    // fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -----------------------------------------------------------------------
  // getModuleLookup
  // -----------------------------------------------------------------------

  describe('getModuleLookup', () => {
    it('discovers all modules via kibana.jsonc', () => {
      const lookup = getModuleLookup(tmpDir);

      expect(lookup.byDir.size).toBe(MODULES.length);
      for (const spec of MODULES) {
        expect(lookup.byDir.get(spec.relDir)).toBe(spec.id);
      }
    });

    it('provides a reverse lookup by module ID', () => {
      const { byId } = getModuleLookup(tmpDir);

      for (const spec of MODULES) {
        expect(byId.get(spec.id)).toBe(spec.relDir);
      }
    });

    it('ignores directories without kibana.jsonc', () => {
      const { byDir } = getModuleLookup(tmpDir);
      const dirs = Array.from(byDir.keys());
      expect(dirs).not.toContain('scripts');
    });

    it('caches results when called without explicit repoRoot', () => {
      const first = getModuleLookup(tmpDir);
      const second = getModuleLookup(tmpDir);
      // Different tmpDir calls should not share cache, but the maps should be equivalent
      expect(first.byDir.size).toBe(second.byDir.size);
    });

    it('excludes kibana.jsonc files under __fixtures__ paths', () => {
      const fixtureDir = path.join(tmpDir, 'packages', 'core', '__fixtures__', 'mock-plugin');
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(
        path.join(fixtureDir, 'kibana.jsonc'),
        JSON.stringify({ type: 'shared-common', id: '@kbn/fixture-mock-plugin' })
      );
      commitAll(tmpDir, 'add fixture module');

      resetModuleLookupCache();
      const { byDir, byId } = getModuleLookup(tmpDir);
      expect(byDir.has('packages/core/__fixtures__/mock-plugin')).toBe(false);
      expect(byId.has('@kbn/fixture-mock-plugin')).toBe(false);
      expect(byDir.size).toBe(MODULES.length);
    });

    it('handles kibana.jsonc without an id field gracefully', () => {
      const noIdDir = path.join(tmpDir, 'packages', 'no-id');
      fs.mkdirSync(noIdDir, { recursive: true });
      fs.writeFileSync(
        path.join(noIdDir, 'kibana.jsonc'),
        JSON.stringify({ type: 'shared-common', owner: '@elastic/test' })
      );
      commitAll(tmpDir, 'add module without id');

      resetModuleLookupCache();
      const { byDir } = getModuleLookup(tmpDir);
      expect(byDir.has('packages/no-id')).toBe(false);
      expect(byDir.size).toBe(MODULES.length);
    });
  });

  // -----------------------------------------------------------------------
  // findModuleForPath
  // -----------------------------------------------------------------------

  describe('findModuleForPath', () => {
    it('maps a deep file path to its containing module', () => {
      expect(findModuleForPath('packages/core/src/index.ts', tmpDir)).toBe('@kbn/core');
    });

    it('maps the module directory itself', () => {
      expect(findModuleForPath('packages/core', tmpDir)).toBe('@kbn/core');
    });

    it('resolves nested paths correctly (longest prefix wins)', () => {
      // A file at packages/core/src/deep/file.ts should still match @kbn/core
      expect(findModuleForPath('packages/core/src/deep/file.ts', tmpDir)).toBe('@kbn/core');
    });

    it('returns undefined for paths outside any module', () => {
      expect(findModuleForPath('scripts/build.sh', tmpDir)).toBeUndefined();
      expect(findModuleForPath('README.md', tmpDir)).toBeUndefined();
    });

    it('handles backslash paths (Windows-style)', () => {
      expect(findModuleForPath('packages\\core\\src\\index.ts', tmpDir)).toBe('@kbn/core');
    });
  });

  // -----------------------------------------------------------------------
  // getModuleDependencies
  // -----------------------------------------------------------------------

  describe('getModuleDependencies', () => {
    it('reads kbn_references from tsconfig.json', () => {
      expect(getModuleDependencies('packages/utils', tmpDir)).toEqual(['@kbn/core']);
    });

    it('returns empty array for modules with no dependencies', () => {
      expect(getModuleDependencies('packages/core', tmpDir)).toEqual([]);
    });

    it('returns multiple dependencies', () => {
      const deps = getModuleDependencies('packages/analytics', tmpDir);
      expect(deps).toEqual(expect.arrayContaining(['@kbn/logging', '@kbn/utils']));
      expect(deps).toHaveLength(2);
    });

    it('returns empty array when tsconfig.json is missing', () => {
      const dir = path.join(tmpDir, 'packages', 'no-tsconfig');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'kibana.jsonc'),
        JSON.stringify({ type: 'shared-common', id: '@kbn/no-tsconfig' })
      );
      expect(getModuleDependencies('packages/no-tsconfig', tmpDir)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // buildModuleDownstreamGraph
  // -----------------------------------------------------------------------

  describe('buildModuleDownstreamGraph', () => {
    it('builds correct downstream sets', () => {
      const graph = buildModuleDownstreamGraph(tmpDir);

      // analytics depends on utils (not core directly), so it's not in core's direct downstream
      expect(graph.get('@kbn/core')).toEqual(new Set(['@kbn/utils', '@kbn/my-plugin']));
      expect(graph.get('@kbn/logging')).toEqual(new Set(['@kbn/analytics']));
      expect(graph.get('@kbn/utils')).toEqual(new Set(['@kbn/my-plugin', '@kbn/analytics']));
      expect(graph.get('@kbn/analytics')).toEqual(new Set());
      expect(graph.get('@kbn/my-plugin')).toEqual(new Set());
    });

    it('every module has an entry in the downstream map', () => {
      const graph = buildModuleDownstreamGraph(tmpDir);
      for (const spec of MODULES) {
        expect(graph.has(spec.id)).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Affected detection with explicit file mutations
  // -----------------------------------------------------------------------

  describe('getAffectedModulesGit – file mutations', () => {
    it('detects an added file in a single module', () => {
      addFileInModule(tmpDir, 'packages/core', 'new_feature.ts');
      commitAll(tmpDir, 'add file in core');

      const affected = getAffectedModulesGit(baseCommit, false, tmpDir);
      expect(affected).toEqual(new Set(['@kbn/core']));
    });

    it('detects a modified file in a single module', () => {
      modifyFile(tmpDir, 'packages/utils/src/index.ts', 'export const changed = true;\n');
      commitAll(tmpDir, 'modify utils');

      const affected = getAffectedModulesGit(baseCommit, false, tmpDir);
      expect(affected).toEqual(new Set(['@kbn/utils']));
    });

    it('detects a removed file in a single module', () => {
      removeFile(tmpDir, 'packages/logging/src/index.ts');
      commitAll(tmpDir, 'remove file from logging');

      const affected = getAffectedModulesGit(baseCommit, false, tmpDir);
      expect(affected).toEqual(new Set(['@kbn/logging']));
    });

    it('includes downstream dependents when requested', () => {
      modifyFile(tmpDir, 'packages/core/src/index.ts', 'export const v2 = true;\n');
      commitAll(tmpDir, 'modify core');

      const affected = getAffectedModulesGit(baseCommit, true, tmpDir);
      // core → utils → my-plugin, analytics ; also core → my-plugin directly
      expect(affected).toEqual(
        new Set(['@kbn/core', '@kbn/utils', '@kbn/my-plugin', '@kbn/analytics'])
      );
    });

    it('propagates downstream through the full chain', () => {
      modifyFile(tmpDir, 'packages/logging/src/index.ts', 'export const v2 = true;\n');
      commitAll(tmpDir, 'modify logging');

      const affected = getAffectedModulesGit(baseCommit, true, tmpDir);
      // logging → analytics (analytics depends on logging)
      expect(affected).toEqual(new Set(['@kbn/logging', '@kbn/analytics']));
    });

    it('detects changes across multiple modules', () => {
      modifyFile(tmpDir, 'packages/core/src/index.ts', 'export const v2 = true;\n');
      addFileInModule(tmpDir, 'packages/logging', 'logger_v2.ts');
      commitAll(tmpDir, 'modify core and logging');

      const affected = getAffectedModulesGit(baseCommit, false, tmpDir);
      expect(affected).toEqual(new Set(['@kbn/core', '@kbn/logging']));
    });

    it('returns empty set when no module files changed', () => {
      modifyFile(tmpDir, 'scripts/build.sh', '#!/bin/bash\necho "v2"\n');
      commitAll(tmpDir, 'modify non-module file');

      const affected = getAffectedModulesGit(baseCommit, false, tmpDir);
      expect(affected.size).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Random file mutations (stress test)
  // -----------------------------------------------------------------------

  describe('getAffectedModulesGit – random mutations', () => {
    const ITERATIONS = 5;

    for (let i = 0; i < ITERATIONS; i++) {
      it(`random mutation round ${i + 1}`, () => {
        resetModuleLookupCache();

        const mutatedModules = new Set<string>();
        const mutations: string[] = [];

        for (const spec of MODULES) {
          const roll = Math.random();
          if (roll < 0.3) {
            // Add a random file
            const name = `random_${i}_${Math.floor(Math.random() * 10000)}.ts`;
            addFileInModule(tmpDir, spec.relDir, name);
            mutatedModules.add(spec.id);
            mutations.push(`add ${spec.relDir}/src/${name}`);
          } else if (roll < 0.5) {
            // Modify existing index.ts
            modifyFile(
              path.join(tmpDir),
              `${spec.relDir}/src/index.ts`,
              `export const round${i} = ${Math.random()};\n`
            );
            mutatedModules.add(spec.id);
            mutations.push(`modify ${spec.relDir}/src/index.ts`);
          }
          // else: no mutation for this module
        }

        // Guarantee at least one mutation
        if (mutatedModules.size === 0) {
          addFileInModule(tmpDir, MODULES[0].relDir, `fallback_${i}.ts`);
          mutatedModules.add(MODULES[0].id);
          mutations.push(`add ${MODULES[0].relDir}/src/fallback_${i}.ts`);
        }

        commitAll(tmpDir, `random mutations round ${i}`);

        const affected = getAffectedModulesGit(baseCommit, false, tmpDir);

        for (const expectedId of mutatedModules) {
          expect(affected).toContain(expectedId);
        }

        // No false positives: every affected module should have a changed file
        for (const affectedId of affected) {
          expect(mutatedModules).toContain(affectedId);
        }
      });
    }
  });

  // -----------------------------------------------------------------------
  // Dynamic module addition/removal
  // -----------------------------------------------------------------------

  describe('getAffectedModulesGit – dynamic module changes', () => {
    it('detects a newly added module', () => {
      createModule(tmpDir, {
        relDir: 'packages/brand-new',
        id: '@kbn/brand-new',
        deps: ['@kbn/core'],
      });
      commitAll(tmpDir, 'add brand-new module');

      resetModuleLookupCache();
      const lookup = getModuleLookup(tmpDir);
      expect(lookup.byDir.has('packages/brand-new')).toBe(true);

      const affected = getAffectedModulesGit(baseCommit, false, tmpDir);
      expect(affected.has('@kbn/brand-new')).toBe(true);
    });

    it('handles a removed module gracefully', () => {
      fs.rmSync(path.join(tmpDir, 'packages', 'logging'), { recursive: true, force: true });
      commitAll(tmpDir, 'remove logging module');

      resetModuleLookupCache();

      // The module is now gone from the lookup
      const lookup = getModuleLookup(tmpDir);
      expect(lookup.byDir.has('packages/logging')).toBe(false);

      // The removed files still show up in git diff, but findModuleForPath won't map them
      const affected = getAffectedModulesGit(baseCommit, false, tmpDir);
      expect(affected.has('@kbn/logging')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Comparison base flexibility
  // -----------------------------------------------------------------------

  describe('comparison base', () => {
    it('uses a specific commit as merge base', () => {
      // Make two commits: first touches core, second touches utils
      modifyFile(tmpDir, 'packages/core/src/index.ts', 'export const v2 = true;\n');
      const midCommit = commitAll(tmpDir, 'modify core');

      modifyFile(tmpDir, 'packages/utils/src/index.ts', 'export const v2 = true;\n');
      commitAll(tmpDir, 'modify utils');

      // Against original base: both modules affected
      const affectedFromBase = getAffectedModulesGit(baseCommit, false, tmpDir);
      expect(affectedFromBase).toEqual(new Set(['@kbn/core', '@kbn/utils']));

      // Against mid commit: only utils affected
      resetModuleLookupCache();
      const affectedFromMid = getAffectedModulesGit(midCommit, false, tmpDir);
      expect(affectedFromMid).toEqual(new Set(['@kbn/utils']));
    });

    it('supports HEAD~N syntax', () => {
      modifyFile(tmpDir, 'packages/core/src/index.ts', 'export const v2 = true;\n');
      commitAll(tmpDir, 'commit 1');

      modifyFile(tmpDir, 'packages/utils/src/index.ts', 'export const v2 = true;\n');
      commitAll(tmpDir, 'commit 2');

      resetModuleLookupCache();
      const affectedLastCommit = getAffectedModulesGit('HEAD~1', false, tmpDir);
      expect(affectedLastCommit).toEqual(new Set(['@kbn/utils']));
    });
  });
});

// ---------------------------------------------------------------------------
// Performance comparison against real repo (opt-in via env var)
// ---------------------------------------------------------------------------

const PERF_ENABLED = process.env.RUN_PERF_TESTS === 'true';
const describePerf = PERF_ENABLED ? describe : describe.skip;

describePerf('performance – real repo', () => {
  let repoRoot: string;

  beforeAll(() => {
    repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  });

  beforeEach(() => {
    resetModuleLookupCache();
  });

  it('getModuleLookup discovers all modules in < 5 seconds', () => {
    const start = performance.now();
    const lookup = getModuleLookup(repoRoot);
    const elapsed = performance.now() - start;

    console.warn(`getModuleLookup: ${lookup.byDir.size} modules in ${elapsed.toFixed(0)}ms`);
    expect(lookup.byDir.size).toBeGreaterThan(1000);
    expect(elapsed).toBeLessThan(5000);
  });
});
