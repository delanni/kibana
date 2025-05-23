/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AssetCriticalityRecord } from '../../api/entity_analytics/asset_criticality';

export type CriticalityLevel = AssetCriticalityRecord['criticality_level'];

export type CriticalityLevelWithUnassigned = CriticalityLevel | 'unassigned';

interface BaseAssetCriticalityUpsert {
  idField: AssetCriticalityRecord['id_field'];
  idValue: AssetCriticalityRecord['id_value'];
}

export interface AssetCriticalityUpsert extends BaseAssetCriticalityUpsert {
  criticalityLevel: AssetCriticalityRecord['criticality_level'];
}

export interface AssetCriticalityUpsertForBulkUpload extends BaseAssetCriticalityUpsert {
  criticalityLevel: AssetCriticalityRecord['criticality_level'] | 'unassigned';
}

export * from '../../api/entity_analytics/asset_criticality';
