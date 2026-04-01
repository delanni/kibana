/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export const UNCATEGORIZED_MODULE_ID = '[uncategorized]';

export const SELECTIVE_TESTS_LABEL = 'ci:use-selective-testing';

// TODO: find reasonable set of critical files for unit tests
export const CRITICAL_FILES_JEST_UNIT_TESTS = [
  'scripts/jest.js',
  'scripts/jest_all.js',
  'package.json',
  'yarn.lock',
  'tsconfig.json',
  'src/platform/packages/shared/kbn-test/**/*',
  // '.buildkite/pipeline-utils/affected-packages/**/*.{ts,js,sh}',
];

// TODO: find reasonable set of critical files for integration tests
export const CRITICAL_FILES_JEST_INTEGRATION_TESTS = [
  'scripts/jest_integration.js',
  'scripts/jest_all.js',
  'package.json',
  'yarn.lock',
  'tsconfig.json',
  'src/platform/packages/shared/kbn-test/**/*',
  // '.buildkite/pipeline-utils/affected-packages/**/*.{ts,js,sh}',
];
