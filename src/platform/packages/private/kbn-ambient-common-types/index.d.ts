/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * These ambient types are used to define default types for anything which is
 * supported in both server/browser environments.
 */

/**
 * peggy grammars are built automatically on import in both browser/server
 */
declare module '*.peggy' {
  export interface ParserOptions {
    [key: string]: any;
    /**
     * Object that will be attached to the each `LocationRange` object created by
     * the parser. For example, this can be path to the parsed file or even the
     * File object.
     */
    grammarSource?: any;
    startRule?: string;
    tracer?: ParserTracer;
  }

  /**
   * parse `input` using the peggy grammer
   * @param input code to parse
   * @param options parse options
   */
  export function parse(input: string, options?: ParserOptions): any;
}

/**
 * .text files are compiled into CommonJS, exporting a string by default
 */
declare module '*.text' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default content;
}

/**
 * YAML files are loaded as raw strings via asset/source in webpack,
 * the yaml transform in kbn-babel-register for Node runtime,
 * and the raw transform in Jest.
 */
declare module '*.yaml' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default content;
}

declare module '*.yml' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default content;
}

// node-diff3 ships types at index.d.ts but its exports field lacks a `types`
// condition for the `require` path, so bundler module resolution can't find them.
declare module 'node-diff3' {
  interface MergeResult {
    conflict: boolean;
    result: string[];
  }
  interface IMergeOptions {
    excludeFalseConflicts?: boolean;
    stringSeparator?: string | RegExp;
  }
  export function merge<T = string>(
    a: string | T[],
    o: string | T[],
    b: string | T[],
    options?: IMergeOptions
  ): MergeResult;
  export function diff3Merge<T>(
    a: string | T[],
    o: string | T[],
    b: string | T[],
    options?: IMergeOptions
  ): any[];
  export function mergeDiff3<T>(
    a: string | T[],
    o: string | T[],
    b: string | T[],
    options?: IMergeOptions & { label?: { a?: string; o?: string; b?: string } }
  ): MergeResult;
  export function diffComm<T>(buffer1: T[], buffer2: T[]): any[];
  export function diffPatch<T>(buffer1: T[], buffer2: T[]): any[];
  export function patch<T>(buffer: T[], patchResult: any[]): T[];
}
