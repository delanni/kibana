/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */
import deepEqual from 'react-fast-compare';
import { BehaviorSubject, combineLatest, filter, map, merge, switchMap } from 'rxjs';
import {
  ESQLControlVariable,
  ESQLControlState,
  EsqlControlType,
  ESQLVariableType,
} from '@kbn/esql-types';
import { PublishingSubject, StateComparators } from '@kbn/presentation-publishing';
import { dataService } from '../../services/kibana_services';
import { ControlGroupApi } from '../../control_group/types';
import { getESQLSingleColumnValues } from './utils/get_esql_single_column_values';

function selectedOptionsComparatorFunction(a?: string[], b?: string[]) {
  return deepEqual(a ?? [], b ?? []);
}

export const selectionComparators: StateComparators<
  Pick<
    ESQLControlState,
    | 'selectedOptions'
    | 'availableOptions'
    | 'variableName'
    | 'variableType'
    | 'controlType'
    | 'esqlQuery'
    | 'title'
  >
> = {
  selectedOptions: selectedOptionsComparatorFunction,
  availableOptions: 'referenceEquality',
  variableName: 'referenceEquality',
  variableType: 'referenceEquality',
  controlType: 'referenceEquality',
  esqlQuery: 'referenceEquality',
  title: 'referenceEquality',
};

export function initializeESQLControlSelections(
  initialState: ESQLControlState,
  controlFetch$: ReturnType<ControlGroupApi['controlFetch$']>
) {
  const availableOptions$ = new BehaviorSubject<string[]>(initialState.availableOptions ?? []);
  const selectedOptions$ = new BehaviorSubject<string[]>(initialState.selectedOptions ?? []);
  const hasSelections$ = new BehaviorSubject<boolean>(false); // hardcoded to false to prevent clear action from appearing.
  const variableName$ = new BehaviorSubject<string>(initialState.variableName ?? '');
  const variableType$ = new BehaviorSubject<ESQLVariableType>(
    initialState.variableType ?? ESQLVariableType.VALUES
  );
  const controlType$ = new BehaviorSubject<EsqlControlType>(initialState.controlType ?? '');
  const esqlQuery$ = new BehaviorSubject<string>(initialState.esqlQuery ?? '');
  const title$ = new BehaviorSubject<string | undefined>(initialState.title);

  function setSelectedOptions(next: string[]) {
    if (!selectedOptionsComparatorFunction(selectedOptions$.value, next)) {
      selectedOptions$.next(next);
    }
  }

  // For Values From Query controls, update values on dashboard load/reload
  const fetchSubscription = controlFetch$
    .pipe(
      filter(() => controlType$.getValue() === EsqlControlType.VALUES_FROM_QUERY),
      switchMap(
        async ({ timeRange }) =>
          await getESQLSingleColumnValues({
            query: esqlQuery$.getValue(),
            search: dataService.search.search,
            timeRange,
          })
      )
    )
    .subscribe((result) => {
      if (getESQLSingleColumnValues.isSuccess(result)) {
        availableOptions$.next(result.values);
      }
    });

  // derive ESQL control variable from state.
  const getEsqlVariable = () => ({
    key: variableName$.value,
    value: isNaN(Number(selectedOptions$.value[0]))
      ? selectedOptions$.value[0]
      : Number(selectedOptions$.value[0]),
    type: variableType$.value,
  });
  const esqlVariable$ = new BehaviorSubject<ESQLControlVariable>(getEsqlVariable());
  const variableSubscriptions = combineLatest([
    variableName$,
    variableType$,
    selectedOptions$,
    availableOptions$,
  ]).subscribe(() => esqlVariable$.next(getEsqlVariable()));

  return {
    cleanup: () => {
      variableSubscriptions.unsubscribe();
      fetchSubscription.unsubscribe();
    },
    api: {
      hasSelections$: hasSelections$ as PublishingSubject<boolean | undefined>,
      esqlVariable$: esqlVariable$ as PublishingSubject<ESQLControlVariable>,
    },
    anyStateChange$: merge(
      selectedOptions$,
      availableOptions$,
      variableName$,
      variableType$,
      controlType$,
      esqlQuery$,
      title$
    ).pipe(map(() => undefined)),
    reinitializeState: (lastSaved?: ESQLControlState) => {
      setSelectedOptions(lastSaved?.selectedOptions ?? []);
      availableOptions$.next(lastSaved?.availableOptions ?? []);
      variableName$.next(lastSaved?.variableName ?? '');
      variableType$.next(lastSaved?.variableType ?? ESQLVariableType.VALUES);
      if (lastSaved?.controlType) controlType$.next(lastSaved?.controlType);
      esqlQuery$.next(lastSaved?.esqlQuery ?? '');
      title$.next(lastSaved?.title);
    },
    getLatestState: () => {
      return {
        selectedOptions: selectedOptions$.getValue() ?? [],
        availableOptions: availableOptions$.getValue() ?? [],
        variableName: variableName$.getValue() ?? '',
        variableType: variableType$.getValue() ?? ESQLVariableType.VALUES,
        controlType: controlType$.getValue(),
        esqlQuery: esqlQuery$.getValue() ?? '',
        title: title$.getValue() ?? '',
      };
    },
    internalApi: {
      selectedOptions$: selectedOptions$ as PublishingSubject<string[]>,
      availableOptions$: availableOptions$ as PublishingSubject<string[]>,
      setSelectedOptions,
    },
  };
}
