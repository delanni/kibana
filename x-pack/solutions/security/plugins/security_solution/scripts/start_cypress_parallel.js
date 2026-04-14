/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

// Prevent tsx (loaded by find-cypress-specs) from following tsconfig paths at runtime.
// tsconfig.base.json maps some packages to .d.ts files for TS2883 workarounds, which
// tsx would try to execute as JS.
process.env.TSX_TSCONFIG_PATH = '/dev/null';
require('@kbn/setup-node-env');
require('./run_cypress/parallel').cli();
