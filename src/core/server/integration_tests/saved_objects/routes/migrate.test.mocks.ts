/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { mockKibanaMigrator } from '@kbn/core-saved-objects-migration-server-mocks';

export const migratorInstanceMock = mockKibanaMigrator.create();
export const KibanaMigratorMock = jest.fn().mockImplementation(() => migratorInstanceMock);
jest.doMock('@kbn/core-saved-objects-migration-server-internal', () => {
  const actual = jest.requireActual('@kbn/core-saved-objects-migration-server-internal');
  return {
    ...actual,
    KibanaMigrator: KibanaMigratorMock,
  };
});
