/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { TestGroupRunOrderResponse } from '../client';

export type RunGroup = TestGroupRunOrderResponse['types'][0];

export interface FtrConfigsManifest {
  defaultQueue?: string;
  disabled?: string[];
  enabled?: Array<string | { [configPath: string]: { queue: string } }>;
}

/**
 * All process.env-derived inputs to the orchestrator, validated and typed.
 * Built once by `loadRunOrderConfig()` so downstream modules can be pure.
 */
export interface RunOrderConfig {
  unitType: string;
  integrationType: string;
  functionalType: string;

  jestUnitMaxMinutes: number;
  jestIntegrationMaxMinutes: number;
  functionalMaxMinutes: number;

  jestUnitTooLongMinutes: number;
  jestIntegrationTooLongMinutes: number;
  functionalTooLongMinutes: number;

  limitConfigType: string[];
  limitSolutions: string[] | undefined;
  ftrConfigPatterns: string[] | undefined;

  functionalMinimumIsolationMin: number | undefined;

  ftrConfigsRetryCount: number;
  jestConfigsRetryCount: number;

  ftrConfigsDeps: string[];
  jestConfigsDeps: string[];

  jestUnitScript: string;
  jestIntegrationScript: string;
  ftrConfigsScript: string;

  ftrExtraArgs: Record<string, string>;
  envFromLabels: Record<string, string>;

  useSelectiveTesting: boolean;
  prMergeBase: string | undefined;
  prNumber: string | undefined;
  ownBranch: string;
  pipelineSlug: string;
}

export interface FunctionalGroup {
  title: string;
  key: string;
  sortBy: number | string;
  queue: string;
}

export interface FtrRunOrderEntry {
  title: string;
  expectedDurationMin: number;
  names: string[];
}

export type FtrRunOrder = Record<string, FtrRunOrderEntry>;
