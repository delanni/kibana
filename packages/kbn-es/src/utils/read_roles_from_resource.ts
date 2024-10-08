/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import fs from 'fs';
import { extname } from 'path';
import { safeLoad as loadYaml } from 'js-yaml';

export const readRolesFromResource = (resourcePath: string) => {
  if (!fs.existsSync(resourcePath) || extname(resourcePath) !== '.yml') {
    throw new Error(`${resourcePath} does not exist or not a yml file`);
  }
  const data = loadYaml(fs.readFileSync(resourcePath, 'utf8'));
  if (typeof data === 'object' && data !== null) {
    return Object.keys(data);
  } else {
    throw new Error(`expected ${resourcePath} file to parse to an object`);
  }
};

export const readRolesDescriptorsFromResource = (resourcePath: string) => {
  if (!fs.existsSync(resourcePath) || extname(resourcePath) !== '.yml') {
    throw new Error(`${resourcePath} does not exist or not a yml file`);
  }
  const data = loadYaml(fs.readFileSync(resourcePath, 'utf8'));
  if (typeof data === 'object' && data !== null) {
    return data;
  } else {
    throw new Error(`expected ${resourcePath} file to parse to an object`);
  }
};
