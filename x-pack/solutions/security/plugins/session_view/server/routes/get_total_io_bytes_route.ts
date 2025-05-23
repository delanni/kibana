/* * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { schema } from '@kbn/config-schema';
import { transformError } from '@kbn/securitysolution-es-utils';
import { IRouter, Logger } from '@kbn/core/server';
import { EVENT_ACTION } from '@kbn/rule-data-utils';
import {
  GET_TOTAL_IO_BYTES_ROUTE,
  TOTAL_BYTES_CAPTURED_PROPERTY,
  ENTRY_SESSION_ENTITY_ID_PROPERTY,
  TIMESTAMP_PROPERTY,
} from '../../common/constants';

export const registerGetTotalIOBytesRoute = (router: IRouter, logger: Logger) => {
  router.versioned
    .get({
      access: 'internal',
      path: GET_TOTAL_IO_BYTES_ROUTE,
      security: {
        authz: {
          enabled: false,
          reason: `This route delegates authorization to Elasticsearch and it's not tied to a Kibana privilege.`,
        },
      },
    })
    .addVersion(
      {
        version: '1',
        validate: {
          request: {
            query: schema.object({
              index: schema.string(),
              sessionEntityId: schema.string(),
              sessionStartTime: schema.string(),
            }),
          },
        },
      },
      async (context, request, response) => {
        const client = (await context.core).elasticsearch.client.asCurrentUser;
        const { index, sessionEntityId, sessionStartTime } = request.query;

        try {
          const search = await client.search({
            index: [index],
            query: {
              bool: {
                must: [
                  { term: { [ENTRY_SESSION_ENTITY_ID_PROPERTY]: sessionEntityId } },
                  { term: { [EVENT_ACTION]: 'text_output' } },
                  {
                    range: {
                      // optimization to prevent data before this session from being hit.
                      [TIMESTAMP_PROPERTY]: {
                        gte: sessionStartTime,
                      },
                    },
                  },
                ],
              },
            },
            size: 0,
            aggs: {
              total_bytes_captured: {
                sum: {
                  field: TOTAL_BYTES_CAPTURED_PROPERTY,
                },
              },
            },
          });

          const agg: any = search.aggregations?.total_bytes_captured;

          return response.ok({ body: { total: agg?.value || 0 } });
        } catch (err) {
          const error = transformError(err);
          logger.error(`Failed to fetch total io bytes: ${err}`);

          // unauthorized
          if (err?.meta?.statusCode === 403) {
            return response.ok({ body: { total: 0 } });
          }

          return response.customError({
            body: { message: error.message },
            statusCode: error.statusCode,
          });
        }
      }
    );
};
