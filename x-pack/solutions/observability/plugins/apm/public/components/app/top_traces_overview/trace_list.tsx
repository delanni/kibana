/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiIcon,
  EuiScreenReaderOnly,
  EuiToolTip,
  RIGHT_ALIGNMENT,
  useEuiFontSize,
} from '@elastic/eui';
import { usePerformanceContext } from '@kbn/ebt-tools';
import type { TypeOf } from '@kbn/typed-react-router-config';
import { i18n } from '@kbn/i18n';
import React, { useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { useApmRouter } from '../../../hooks/use_apm_router';
import type { ApmRoutes } from '../../routing/apm_route_config';
import {
  asMillisecondDuration,
  asTransactionRate,
  asTransactionValue,
} from '../../../../common/utils/formatters';
import { useApmParams } from '../../../hooks/use_apm_params';
import type { FetcherResult } from '../../../hooks/use_fetcher';
import { FETCH_STATUS } from '../../../hooks/use_fetcher';
import type { APIReturnType } from '../../../services/rest/create_call_apm_api';
import { truncate } from '../../../utils/style';
import { EmptyMessage } from '../../shared/empty_message';
import { ImpactBar } from '../../shared/impact_bar';
import { TransactionDetailLink } from '../../shared/links/apm/transaction_detail_link';
import type { ITableColumn } from '../../shared/managed_table';
import { ManagedTable } from '../../shared/managed_table';
import { ServiceLink } from '../../shared/links/apm/service_link';
import { TruncateWithTooltip } from '../../shared/truncate_with_tooltip';
import { NOT_AVAILABLE_LABEL } from '../../../../common/i18n';

const StyledTransactionLink = styled(TransactionDetailLink)`
  font-size: ${() => useEuiFontSize('s').fontSize};
  ${truncate('100%')};
`;

interface Props {
  response: FetcherResult<APIReturnType<'GET /internal/apm/traces'>>;
}

type TraceGroup = Required<Props['response']>['data']['items'][number];

export function getTraceListColumns({
  query,
  link,
}: {
  query: TypeOf<ApmRoutes, '/traces'>['query'];
  link: (
    path: '/services/{serviceName}/transactions/view',
    params: {
      path: { serviceName: string };
      query: TypeOf<ApmRoutes, '/services/{serviceName}/transactions/view'>['query'];
    }
  ) => string;
}): Array<ITableColumn<TraceGroup>> {
  return [
    {
      field: 'transactionName',
      name: i18n.translate('xpack.apm.tracesTable.nameColumnLabel', {
        defaultMessage: 'Name',
      }),
      width: '40%',
      sortable: true,
      render: (_: string, { serviceName, transactionName, transactionType }: TraceGroup) => (
        <EuiToolTip content={transactionName} anchorClassName="eui-textTruncate">
          <StyledTransactionLink
            transactionName={transactionName}
            href={link('/services/{serviceName}/transactions/view', {
              path: { serviceName },
              query: {
                ...query,
                transactionName,
                transactionType,
                serviceGroup: '',
                showCriticalPath: false,
              },
            })}
          >
            {transactionName}
          </StyledTransactionLink>
        </EuiToolTip>
      ),
    },
    {
      field: 'serviceName',
      name: i18n.translate('xpack.apm.tracesTable.originatingServiceColumnLabel', {
        defaultMessage: 'Originating service',
      }),
      sortable: true,
      render: (_: string, { serviceName, agentName, transactionType }) => (
        <TruncateWithTooltip
          data-test-subj="apmTraceListAppLink"
          text={serviceName || NOT_AVAILABLE_LABEL}
          content={
            <ServiceLink
              agentName={agentName}
              query={{ ...query, transactionType, serviceGroup: '' }}
              serviceName={serviceName}
            />
          }
        />
      ),
    },
    {
      field: 'averageResponseTime',
      name: i18n.translate('xpack.apm.tracesTable.avgResponseTimeColumnLabel', {
        defaultMessage: 'Latency (avg.)',
      }),
      sortable: true,
      dataType: 'number',
      render: (_, { averageResponseTime }) => asMillisecondDuration(averageResponseTime),
    },
    {
      field: 'transactionsPerMinute',
      name: i18n.translate('xpack.apm.tracesTable.tracesPerMinuteColumnLabel', {
        defaultMessage: 'Traces per minute',
      }),
      sortable: true,
      dataType: 'number',
      render: (_, { transactionsPerMinute }) => (
        <>
          <span aria-hidden="true">{asTransactionRate(transactionsPerMinute)}</span>
          <EuiScreenReaderOnly>
            <span>
              {asTransactionValue(transactionsPerMinute)}{' '}
              {i18n.translate(
                'xpack.apm.tracesTable.tracesPerMinuteColumn.screenReaderAbbreviation',
                {
                  defaultMessage: 'traces per minute',
                }
              )}
            </span>
          </EuiScreenReaderOnly>
        </>
      ),
    },
    {
      field: 'impact',
      name: (
        <EuiToolTip
          content={i18n.translate('xpack.apm.tracesTable.impactColumnDescription', {
            defaultMessage:
              'The most used and slowest endpoints in your service. Calculated by multiplying latency by throughput.',
          })}
        >
          <>
            {i18n.translate('xpack.apm.tracesTable.impactColumnLabel', {
              defaultMessage: 'Impact',
            })}{' '}
            <EuiIcon size="s" color="subdued" type="question" className="eui-alignTop" />
          </>
        </EuiToolTip>
      ),
      align: RIGHT_ALIGNMENT,
      sortable: true,
      render: (_, { impact }) => <ImpactBar value={impact} />,
    },
  ];
}

const noItemsMessage = (
  <EmptyMessage
    heading={i18n.translate('xpack.apm.tracesTable.notFoundLabel', {
      defaultMessage: 'No traces found for this query',
    })}
  />
);

export function TraceList({ response }: Props) {
  const { data: { items } = { items: [] }, status } = response;
  const { onPageReady } = usePerformanceContext();

  const {
    query,
    query: { rangeFrom, rangeTo },
  } = useApmParams('/traces');
  const { link } = useApmRouter();

  const traceListColumns = useMemo(() => getTraceListColumns({ query, link }), [query, link]);

  useEffect(() => {
    if (status === FETCH_STATUS.SUCCESS) {
      onPageReady({
        meta: { rangeFrom, rangeTo },
      });
    }
  }, [status, onPageReady, rangeFrom, rangeTo]);

  return (
    <ManagedTable
      isLoading={status === FETCH_STATUS.LOADING}
      error={status === FETCH_STATUS.FAILURE}
      columns={traceListColumns}
      items={items}
      initialSortField="impact"
      initialSortDirection="desc"
      noItemsMessage={noItemsMessage}
      initialPageSize={25}
    />
  );
}
