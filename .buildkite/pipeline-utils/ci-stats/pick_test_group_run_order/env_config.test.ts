/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

jest.mock('#pipeline-utils', () => ({
  getRequiredEnv: (name: string) => process.env[name] ?? `MISSING_${name}`,
  collectEnvFromLabels: () => ({}),
}));

jest.mock('../../affected-packages', () => ({
  SELECTIVE_TESTS_LABEL: 'ci:selective-tests',
}));

import { MAX_MINUTES, RETRIES } from './const';
import { loadRunOrderConfig } from './env_config';

const TYPE_ENV = {
  TEST_GROUP_TYPE_UNIT: 'unit-type',
  TEST_GROUP_TYPE_INTEGRATION: 'integration-type',
  TEST_GROUP_TYPE_FUNCTIONAL: 'functional-type',
  BUILDKITE_BRANCH: 'main',
  BUILDKITE_PIPELINE_SLUG: 'kibana-pull-request',
};

describe('loadRunOrderConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...TYPE_ENV } as NodeJS.ProcessEnv;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('applies sensible defaults when nothing is set', () => {
    const cfg = loadRunOrderConfig();

    expect(cfg.unitType).toBe('unit-type');
    expect(cfg.jestUnitMaxMinutes).toBe(MAX_MINUTES.JEST_UNIT_DEFAULT);
    expect(cfg.jestIntegrationMaxMinutes).toBe(MAX_MINUTES.JEST_INTEGRATION_DEFAULT);
    expect(cfg.functionalMaxMinutes).toBe(MAX_MINUTES.FUNCTIONAL_DEFAULT);
    expect(cfg.jestUnitTooLongMinutes).toBe(MAX_MINUTES.TOO_LONG);
    expect(cfg.jestIntegrationTooLongMinutes).toBe(MAX_MINUTES.TOO_LONG);
    expect(cfg.functionalTooLongMinutes).toBe(MAX_MINUTES.TOO_LONG);
    expect(cfg.limitConfigType).toEqual(['unit', 'integration', 'functional']);
    expect(cfg.limitSolutions).toBeUndefined();
    expect(cfg.ftrConfigPatterns).toBeUndefined();
    expect(cfg.functionalMinimumIsolationMin).toBeUndefined();
    expect(cfg.ftrConfigsRetryCount).toBe(RETRIES.FTR);
    expect(cfg.jestConfigsRetryCount).toBe(RETRIES.JEST);
    expect(cfg.ftrConfigsDeps).toEqual(['build']);
    expect(cfg.jestConfigsDeps).toEqual([]);
    expect(cfg.useSelectiveTesting).toBe(false);
  });

  it('parses CSV envs and trims whitespace', () => {
    process.env.LIMIT_CONFIG_TYPE = 'unit, integration ';
    process.env.FTR_CONFIG_PATTERNS = 'a, b,c';

    const cfg = loadRunOrderConfig();

    expect(cfg.limitConfigType).toEqual(['unit', 'integration']);
    expect(cfg.ftrConfigPatterns).toEqual(['a', 'b', 'c']);
  });

  it('parses numeric envs', () => {
    process.env.JEST_UNIT_MAX_MINUTES = '12.5';
    process.env.FTR_CONFIGS_RETRY_COUNT = '3';
    process.env.FUNCTIONAL_MINIMUM_ISOLATION_MIN = '7';

    const cfg = loadRunOrderConfig();

    expect(cfg.jestUnitMaxMinutes).toBe(12.5);
    expect(cfg.ftrConfigsRetryCount).toBe(3);
    expect(cfg.functionalMinimumIsolationMin).toBe(7);
  });

  it.each([
    ['JEST_UNIT_MAX_MINUTES', 'invalid JEST_UNIT_MAX_MINUTES'],
    ['JEST_INTEGRATION_MAX_MINUTES', 'invalid JEST_INTEGRATION_MAX_MINUTES'],
    ['FUNCTIONAL_MAX_MINUTES', 'invalid FUNCTIONAL_MAX_MINUTES'],
    ['FUNCTIONAL_MINIMUM_ISOLATION_MIN', 'invalid FUNCTIONAL_MINIMUM_ISOLATION_MIN'],
    ['FTR_CONFIGS_RETRY_COUNT', 'invalid FTR_CONFIGS_RETRY_COUNT'],
    ['JEST_CONFIGS_RETRY_COUNT', 'invalid JEST_CONFIGS_RETRY_COUNT'],
  ])('throws for NaN %s', (envName, errFragment) => {
    process.env[envName] = 'not-a-number';
    expect(() => loadRunOrderConfig()).toThrow(new RegExp(errFragment));
  });

  it('rejects unknown LIMIT_SOLUTIONS values', () => {
    process.env.LIMIT_SOLUTIONS = 'observability,not-a-solution';
    expect(() => loadRunOrderConfig()).toThrow('Unsupported LIMIT_SOLUTIONS value');
  });

  it('accepts known LIMIT_SOLUTIONS values', () => {
    process.env.LIMIT_SOLUTIONS = 'observability, security';
    const cfg = loadRunOrderConfig();
    expect(cfg.limitSolutions).toEqual(['observability', 'security']);
  });

  it('treats empty FTR_CONFIGS_DEPS as explicit empty list', () => {
    process.env.FTR_CONFIGS_DEPS = '';
    const cfg = loadRunOrderConfig();
    expect(cfg.ftrConfigsDeps).toEqual([]);
  });

  it('treats unset FTR_CONFIGS_DEPS as default ["build"]', () => {
    delete process.env.FTR_CONFIGS_DEPS;
    const cfg = loadRunOrderConfig();
    expect(cfg.ftrConfigsDeps).toEqual(['build']);
  });

  it('detects selective testing label', () => {
    process.env.GITHUB_PR_LABELS = 'foo,ci:selective-tests,bar';
    const cfg = loadRunOrderConfig();
    expect(cfg.useSelectiveTesting).toBe(true);
  });
});
