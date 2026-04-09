/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

// With moduleResolution: "bundler", @a2a-js/sdk/server resolves correctly via its
// package exports. The previous `declare module '@a2a-js/sdk/server' { export * from
// '@a2a-js/sdk/dist/server' }` is no longer needed and would fail because
// '@a2a-js/sdk/dist/server' is not a public export subpath.
