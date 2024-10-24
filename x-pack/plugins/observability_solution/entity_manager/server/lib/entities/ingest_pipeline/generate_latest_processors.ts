/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EntityDefinition, ENTITY_SCHEMA_VERSION_V1 } from '@kbn/entities-schema';
import {
  initializePathScript,
  cleanScript,
} from '../helpers/ingest_pipeline_script_processor_helpers';
import { generateLatestIndexName } from '../helpers/generate_component_id';
import { isBuiltinDefinition } from '../helpers/is_builtin_definition';

function mapDestinationToPainless(field: string) {
  return `
    ${initializePathScript(field)}
    ctx.${field} = ctx.entity.metadata.${field}.data.keySet();
  `;
}

function createMetadataPainlessScript(definition: EntityDefinition) {
  if (!definition.metadata) {
    return '';
  }

  return definition.metadata.reduce((acc, def) => {
    const destination = def.destination || def.source;
    const optionalFieldPath = destination.replaceAll('.', '?.');
    const next = `
      if (ctx.entity?.metadata?.${optionalFieldPath}.data != null) {
        ${mapDestinationToPainless(destination)}
      }
    `;
    return `${acc}\n${next}`;
  }, '');
}

function liftIdentityFieldsToDocumentRoot(definition: EntityDefinition) {
  return definition.identityFields
    .map((identityField) => {
      const setProcessor = {
        set: {
          field: identityField.field,
          value: `{{entity.identity.${identityField.field}.top_metric.${identityField.field}}}`,
        },
      };

      if (!identityField.field.includes('.')) {
        return [setProcessor];
      }

      return [
        {
          dot_expander: {
            field: identityField.field,
            path: `entity.identity.${identityField.field}.top_metric`,
          },
        },
        setProcessor,
      ];
    })
    .flat();
}

function getCustomIngestPipelines(definition: EntityDefinition) {
  if (isBuiltinDefinition(definition)) {
    return [];
  }

  return [
    {
      pipeline: {
        ignore_missing_pipeline: true,
        name: `${definition.id}@platform`,
      },
    },
    {
      pipeline: {
        ignore_missing_pipeline: true,
        name: `${definition.id}-latest@platform`,
      },
    },
    {
      pipeline: {
        ignore_missing_pipeline: true,
        name: `${definition.id}@custom`,
      },
    },
    {
      pipeline: {
        ignore_missing_pipeline: true,
        name: `${definition.id}-latest@custom`,
      },
    },
  ];
}

export function generateLatestProcessors(definition: EntityDefinition) {
  return [
    {
      set: {
        field: 'event.ingested',
        value: '{{{_ingest.timestamp}}}',
      },
    },
    {
      set: {
        field: 'entity.type',
        value: definition.type,
      },
    },
    {
      set: {
        field: 'entity.definitionId',
        value: definition.id,
      },
    },
    {
      set: {
        field: 'entity.definitionVersion',
        value: definition.version,
      },
    },
    {
      set: {
        field: 'entity.schemaVersion',
        value: ENTITY_SCHEMA_VERSION_V1,
      },
    },
    {
      set: {
        field: 'entity.identityFields',
        value: definition.identityFields.map((identityField) => identityField.field),
      },
    },
    ...(definition.staticFields != null
      ? Object.keys(definition.staticFields).map((field) => ({
          set: { field, value: definition.staticFields![field] },
        }))
      : []),
    ...(definition.metadata != null
      ? [{ script: { source: cleanScript(createMetadataPainlessScript(definition)) } }]
      : []),
    {
      remove: {
        field: 'entity.metadata',
        ignore_missing: true,
      },
    },
    ...liftIdentityFieldsToDocumentRoot(definition),
    {
      remove: {
        field: 'entity.identity',
        ignore_missing: true,
      },
    },
    {
      // This must happen AFTER we lift the identity fields into the root of the document
      set: {
        field: 'entity.displayName',
        value: definition.displayNameTemplate,
      },
    },
    {
      set: {
        field: '_index',
        value: `${generateLatestIndexName(definition)}`,
      },
    },
    ...getCustomIngestPipelines(definition),
  ];
}
