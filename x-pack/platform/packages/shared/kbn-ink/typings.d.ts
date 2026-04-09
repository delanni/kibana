/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

// With moduleResolution: "bundler", ink resolves correctly via its package exports.
// The previous `declare module 'ink' { export * from 'ink/build' }` is no longer
// needed and would fail because 'ink/build' is not a public export subpath.
