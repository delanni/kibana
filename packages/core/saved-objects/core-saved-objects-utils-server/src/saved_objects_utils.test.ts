/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { mockUuidv4, mockUuidv5 } from './saved_objects_utils.test.mock';

import type { SavedObjectsFindOptions } from '@kbn/core-saved-objects-api-server';
import { SavedObjectsUtils } from './saved_objects_utils';

describe('SavedObjectsUtils', () => {
  const {
    namespaceIdToString,
    namespaceStringToId,
    createEmptyFindResponse,
    generateId,
    isRandomId,
    getConvertedObjectId,
  } = SavedObjectsUtils;

  describe('#namespaceIdToString', () => {
    it('converts `undefined` to default namespace string', () => {
      expect(namespaceIdToString(undefined)).toEqual('default');
    });

    it('leaves other namespace IDs as-is', () => {
      expect(namespaceIdToString('foo')).toEqual('foo');
    });

    it('throws an error when a namespace ID is an empty string', () => {
      expect(() => namespaceIdToString('')).toThrowError('namespace cannot be an empty string');
    });
  });

  describe('#namespaceStringToId', () => {
    it('converts default namespace string to `undefined`', () => {
      expect(namespaceStringToId('default')).toBeUndefined();
    });

    it('leaves other namespace strings as-is', () => {
      expect(namespaceStringToId('foo')).toEqual('foo');
    });

    it('throws an error when a namespace string is falsy', () => {
      const test = (arg: any) =>
        expect(() => namespaceStringToId(arg)).toThrowError('namespace must be a non-empty string');

      test(undefined);
      test(null);
      test('');
    });
  });

  describe('#createEmptyFindResponse', () => {
    it('returns expected result', () => {
      const options = {} as SavedObjectsFindOptions;
      expect(createEmptyFindResponse(options)).toEqual({
        page: 1,
        per_page: 20,
        total: 0,
        saved_objects: [],
      });
    });

    it('handles `page` field', () => {
      const options = { page: 42 } as SavedObjectsFindOptions;
      expect(createEmptyFindResponse(options).page).toEqual(42);
    });

    it('handles `perPage` field', () => {
      const options = { perPage: 42 } as SavedObjectsFindOptions;
      expect(createEmptyFindResponse(options).per_page).toEqual(42);
    });
  });

  describe('#generateId', () => {
    it('returns a valid uuid', () => {
      expect(generateId()).toBe('uuidv4'); // default return value for mockUuidv4
      expect(mockUuidv4).toHaveBeenCalled();
    });
  });

  describe('#isRandomId', () => {
    it('validates uuid correctly', () => {
      expect(isRandomId('c4d82f66-3046-11eb-adc1-0242ac120002')).toBe(true);
      expect(isRandomId('invalid')).toBe(false);
      expect(isRandomId('')).toBe(false);
      expect(isRandomId(undefined)).toBe(false);
    });
  });

  describe('#getConvertedObjectId', () => {
    it('does not change the object ID if namespace is undefined or "default"', () => {
      for (const namespace of [undefined, 'default']) {
        const result = getConvertedObjectId(namespace, 'type', 'oldId');
        expect(result).toBe('oldId');
        expect(mockUuidv5).not.toHaveBeenCalled();
      }
    });

    it('changes the object ID if namespace is defined and not "default"', () => {
      const result = getConvertedObjectId('namespace', 'type', 'oldId');
      expect(result).toBe('uuidv5'); // default return value for mockUuidv5
      expect(mockUuidv5).toHaveBeenCalledWith('namespace:type:oldId', 'DNSUUID');
    });
  });

  describe('#getMigrationFunction', () => {
    it('should return the migration function when it is a function', () => {
      const migration = jest.fn();

      expect(SavedObjectsUtils.getMigrationFunction(migration)).toBe(migration);
    });

    it('should return the migration function when it is a migration object', () => {
      const migration = { transform: jest.fn() };

      expect(SavedObjectsUtils.getMigrationFunction(migration)).toBe(migration.transform);
    });
  });
});
