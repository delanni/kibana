/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSelect,
  EuiText,
  EuiSpacer,
  EuiPage,
  EuiPageBody,
  EuiPageHeader,
  EuiPageSection,
  EuiPanel,
  EuiCallOut,
} from '@elastic/eui';
import type { CoreStart } from '@kbn/core/public';
import useDebounce from 'react-use/lib/useDebounce';
import { DOCUMENT_FIELD_NAME } from '@kbn/lens-plugin/common/constants';
import type { DataView } from '@kbn/data-views-plugin/public';
import type {
  TypedLensByValueInput,
  PersistedIndexPatternLayer,
  XYState,
  DateHistogramIndexPatternColumn,
  DatatableVisualizationState,
  HeatmapVisualizationState,
  GaugeVisualizationState,
  TermsIndexPatternColumn,
  LensPublicStart,
  RangeIndexPatternColumn,
  PieVisualizationState,
  MedianIndexPatternColumn,
  MetricVisualizationState,
} from '@kbn/lens-plugin/public';
import type { ActionExecutionContext } from '@kbn/ui-actions-plugin/public';
import { CodeEditor, HJSON_LANG_ID } from '@kbn/code-editor';
import type { StartDependencies } from './plugin';
import {
  AllOverrides,
  AttributesMenu,
  LensAttributesByType,
  OverridesMenu,
  PanelMenu,
} from './controls';

type RequiredType = 'date' | 'string' | 'number';
type FieldsMap = Record<RequiredType, string>;

function getInitialType(dataView: DataView) {
  return dataView.isTimeBased() ? 'date' : 'number';
}

function getColumnFor(type: RequiredType, fieldName: string, isBucketed: boolean = true) {
  if (type === 'string') {
    return {
      label: `Top values of ${fieldName}`,
      dataType: 'string',
      operationType: 'terms',
      scale: 'ordinal',
      sourceField: fieldName,
      isBucketed: true,
      params: {
        size: 5,
        orderBy: { type: 'alphabetical', fallback: true },
        orderDirection: 'desc',
      },
    } as TermsIndexPatternColumn;
  }
  if (type === 'number') {
    if (isBucketed) {
      return {
        label: fieldName,
        dataType: 'number',
        operationType: 'range',
        sourceField: fieldName,
        isBucketed: true,
        scale: 'interval',
        params: {
          type: 'histogram',
          maxBars: 'auto',
          format: undefined,
          parentFormat: undefined,
          ranges: [
            {
              from: 0,
              to: 1000,
              label: '',
            },
          ],
        },
      } as RangeIndexPatternColumn;
    }
    return {
      label: `Median of ${fieldName}`,
      dataType: 'number',
      operationType: 'median',
      sourceField: fieldName,
      isBucketed: false,
      scale: 'ratio',
    } as MedianIndexPatternColumn;
  }
  return {
    dataType: 'date',
    isBucketed: true,
    label: '@timestamp',
    operationType: 'date_histogram',
    params: { interval: 'auto' },
    scale: 'interval',
    sourceField: fieldName,
  } as DateHistogramIndexPatternColumn;
}

function getDataLayer(
  type: RequiredType,
  field: string,
  isBucketed: boolean = true
): PersistedIndexPatternLayer {
  return {
    columnOrder: ['col1', 'col2'],
    columns: {
      col2: {
        dataType: 'number',
        isBucketed: false,
        label: 'Count of records',
        operationType: 'count',
        scale: 'ratio',
        sourceField: DOCUMENT_FIELD_NAME,
      },
      col1: getColumnFor(type, field, isBucketed),
    },
  };
}

function getBaseAttributes(
  defaultIndexPattern: DataView,
  fields: FieldsMap,
  type?: RequiredType,
  dataLayer?: PersistedIndexPatternLayer
): Omit<TypedLensByValueInput['attributes'], 'visualizationType' | 'state'> & {
  state: Omit<TypedLensByValueInput['attributes']['state'], 'visualization'>;
} {
  const finalType = type ?? getInitialType(defaultIndexPattern);
  const finalDataLayer = dataLayer ?? getDataLayer(finalType, fields[finalType]);
  return {
    title: 'Prefilled from example app',
    references: [
      {
        id: defaultIndexPattern.id!,
        name: 'indexpattern-datasource-current-indexpattern',
        type: 'index-pattern',
      },
      {
        id: defaultIndexPattern.id!,
        name: 'indexpattern-datasource-layer-layer1',
        type: 'index-pattern',
      },
    ],
    state: {
      datasourceStates: {
        formBased: {
          layers: {
            layer1: finalDataLayer,
          },
        },
      },
      filters: [],
      query: { language: 'kuery', query: '' },
    },
  };
}

// Generate a Lens state based on some app-specific input parameters.
// `TypedLensByValueInput` can be used for type-safety - it uses the same interfaces as Lens-internal code.
function getLensAttributesXY(
  defaultIndexPattern: DataView,
  fields: FieldsMap,
  chartType: XYState['preferredSeriesType'],
  color: string
): LensAttributesByType<'lnsXY'> {
  const baseAttributes = getBaseAttributes(defaultIndexPattern, fields);

  const xyConfig: XYState = {
    axisTitlesVisibilitySettings: { x: true, yLeft: true, yRight: true },
    fittingFunction: 'None',
    gridlinesVisibilitySettings: { x: true, yLeft: true, yRight: true },
    layers: [
      {
        accessors: ['col2'],
        layerId: 'layer1',
        layerType: 'data',
        seriesType: chartType,
        xAccessor: 'col1',
        yConfig: [{ forAccessor: 'col2', color }],
      },
    ],
    legend: { isVisible: true, position: 'right' },
    preferredSeriesType: chartType,
    tickLabelsVisibilitySettings: { x: true, yLeft: true, yRight: true },
    valueLabels: 'hide',
  };

  return {
    ...baseAttributes,
    visualizationType: 'lnsXY',
    state: {
      ...baseAttributes.state,
      visualization: xyConfig,
    },
  };
}

function getLensAttributesHeatmap(
  defaultIndexPattern: DataView,
  fields: FieldsMap
): LensAttributesByType<'lnsHeatmap'> {
  const initialType = getInitialType(defaultIndexPattern);
  const dataLayer = getDataLayer(initialType, fields[initialType]);
  const heatmapDataLayer = {
    columnOrder: ['col1', 'col3', 'col2'],
    columns: {
      ...dataLayer.columns,
      col3: getColumnFor('string', fields.string) as TermsIndexPatternColumn,
    },
  };

  const baseAttributes = getBaseAttributes(
    defaultIndexPattern,
    fields,
    initialType,
    heatmapDataLayer
  );

  const heatmapConfig: HeatmapVisualizationState = {
    layerId: 'layer1',
    layerType: 'data',
    shape: 'heatmap',
    xAccessor: 'col1',
    yAccessor: 'col3',
    valueAccessor: 'col2',
    legend: { isVisible: true, position: 'right', type: 'heatmap_legend' },
    gridConfig: {
      isCellLabelVisible: true,
      isYAxisLabelVisible: true,
      isXAxisLabelVisible: true,
      isYAxisTitleVisible: true,
      isXAxisTitleVisible: true,
      type: 'heatmap_grid',
    },
  };

  return {
    ...baseAttributes,
    visualizationType: 'lnsHeatmap',
    state: {
      ...baseAttributes.state,
      visualization: heatmapConfig,
    },
  };
}

function getLensAttributesDatatable(
  defaultIndexPattern: DataView,
  fields: FieldsMap
): LensAttributesByType<'lnsDatatable'> {
  const initialType = getInitialType(defaultIndexPattern);
  const baseAttributes = getBaseAttributes(defaultIndexPattern, fields, initialType);

  const tableConfig: DatatableVisualizationState = {
    layerId: 'layer1',
    layerType: 'data',
    columns: [{ columnId: 'col1' }, { columnId: 'col2' }],
  };

  return {
    ...baseAttributes,
    visualizationType: 'lnsDatatable',
    state: {
      ...baseAttributes.state,
      visualization: tableConfig,
    },
  };
}

function getLensAttributesGauge(
  defaultIndexPattern: DataView,
  fields: FieldsMap,
  shape: GaugeVisualizationState['shape'] = 'horizontalBullet'
): LensAttributesByType<'lnsGauge'> {
  const dataLayer = getDataLayer('number', fields.number, false);
  const gaugeDataLayer = {
    columnOrder: ['col1'],
    columns: {
      col1: dataLayer.columns.col1,
    },
  };

  const baseAttributes = getBaseAttributes(defaultIndexPattern, fields, 'number', gaugeDataLayer);
  const gaugeConfig: GaugeVisualizationState = {
    layerId: 'layer1',
    layerType: 'data',
    shape,
    ticksPosition: 'auto',
    labelMajorMode: 'auto',
    metricAccessor: 'col1',
  };
  return {
    ...baseAttributes,
    visualizationType: 'lnsGauge',
    state: {
      ...baseAttributes.state,
      visualization: gaugeConfig,
    },
  };
}

function getLensAttributesPartition(
  defaultIndexPattern: DataView,
  fields: FieldsMap
): LensAttributesByType<'lnsPie'> {
  const baseAttributes = getBaseAttributes(defaultIndexPattern, fields, 'number');
  const pieConfig: PieVisualizationState = {
    layers: [
      {
        primaryGroups: ['col1'],
        metrics: ['col2'],
        layerId: 'layer1',
        layerType: 'data',
        numberDisplay: 'percent',
        categoryDisplay: 'default',
        legendDisplay: 'show',
      },
    ],
    shape: 'pie',
  };
  return {
    ...baseAttributes,
    visualizationType: 'lnsPie',
    state: {
      ...baseAttributes.state,
      visualization: pieConfig,
    },
  };
}

function getLensAttributesMetric(
  defaultIndexPattern: DataView,
  fields: FieldsMap,
  color: string
): LensAttributesByType<'lnsMetric'> {
  const dataLayer = getDataLayer('string', fields.number, true);
  const baseAttributes = getBaseAttributes(defaultIndexPattern, fields, 'number', dataLayer);
  const metricConfig: MetricVisualizationState = {
    layerId: 'layer1',
    layerType: 'data',
    metricAccessor: 'col2',
    color,
    breakdownByAccessor: 'col1',
  };
  return {
    ...baseAttributes,
    visualizationType: 'lnsMetric',
    state: {
      ...baseAttributes.state,
      visualization: metricConfig,
    },
  };
}

function getFieldsByType(dataView: DataView) {
  const aggregatableFields = dataView.fields.filter((f) => f.aggregatable);
  const fields: Partial<FieldsMap> = {
    string: aggregatableFields.find((f) => f.type === 'string')?.displayName,
    number: aggregatableFields.find((f) => f.type === 'number')?.displayName,
  };
  if (dataView.isTimeBased()) {
    fields.date = dataView.getTimeField().displayName;
  }
  // remove undefined values
  for (const type of ['string', 'number', 'date'] as const) {
    if (typeof fields[type] == null) {
      delete fields[type];
    }
  }
  return fields as FieldsMap;
}

function checkAndParseSO(newSO: string) {
  try {
    return JSON.parse(newSO) as TypedLensByValueInput['attributes'];
  } catch (e) {
    // do nothing
  }
}
let chartCounter = 1;

export const App = (props: {
  core: CoreStart;
  plugins: StartDependencies;
  defaultDataView: DataView;
  stateHelpers: Awaited<ReturnType<LensPublicStart['stateHelperApi']>>;
  preloadedVisualization: TypedLensByValueInput['attributes'];
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
  const [enableExtraAction, setEnableExtraAction] = useState(false);
  const [enableDefaultAction, setEnableDefaultAction] = useState(false);
  const [enableTriggers, toggleTriggers] = useState(false);
  const [loadedCharts, addChartConfiguration] = useState<
    Array<{ id: string; attributes: TypedLensByValueInput['attributes'] }>
  >(
    props.preloadedVisualization
      ? [{ id: 'from_lens', attributes: props.preloadedVisualization }]
      : []
  );
  const [hasParsingError, setErrorFlag] = useState(false);
  const [hasParsingErrorDebounced, setErrorDebounced] = useState(hasParsingError);
  const LensComponent = props.plugins.lens.EmbeddableComponent;
  const LensSaveModalComponent = props.plugins.lens.SaveModalComponent;

  const fields = getFieldsByType(props.defaultDataView);

  const [time, setTime] = useState({
    from: 'now-5d',
    to: 'now',
  });

  const initialColor = '#D6BF57';

  const defaultCharts = [
    {
      id: 'bar_stacked',
      attributes: getLensAttributesXY(props.defaultDataView, fields, 'bar_stacked', initialColor),
    },
    {
      id: 'line',
      attributes: getLensAttributesXY(props.defaultDataView, fields, 'line', initialColor),
    },
    {
      id: 'area',
      attributes: getLensAttributesXY(props.defaultDataView, fields, 'area', initialColor),
    },
    { id: 'pie', attributes: getLensAttributesPartition(props.defaultDataView, fields) },
    { id: 'table', attributes: getLensAttributesDatatable(props.defaultDataView, fields) },
    { id: 'heatmap', attributes: getLensAttributesHeatmap(props.defaultDataView, fields) },
    { id: 'gauge', attributes: getLensAttributesGauge(props.defaultDataView, fields) },
    {
      id: 'metric',
      attributes: getLensAttributesMetric(props.defaultDataView, fields, initialColor),
    },
  ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const charts = useMemo(() => [...defaultCharts, ...loadedCharts], [loadedCharts]);

  const initialAttributes = useMemo(
    () => JSON.stringify(props.preloadedVisualization ?? charts[0].attributes, null, 2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const currentSO = useRef<string>(initialAttributes);
  const [currentValid, saveValidSO] = useState(initialAttributes);
  const switchChartPreset = useCallback(
    (newIndex: number) => {
      const newChart = charts[newIndex];
      const newAttributes = JSON.stringify(newChart.attributes, null, 2);
      currentSO.current = newAttributes;
      saveValidSO(newAttributes);
      // clear the overrides
      setOverrides(undefined);
    },
    [charts]
  );

  const currentAttributes: TypedLensByValueInput['attributes'] = useMemo(() => {
    try {
      return JSON.parse(currentSO.current);
    } catch (e) {
      return JSON.parse(currentValid);
    }
  }, [currentValid, currentSO]);

  const isDisabled = !currentAttributes;

  useDebounce(() => setErrorDebounced(hasParsingError), 500, [hasParsingError]);

  const [overrides, setOverrides] = useState<AllOverrides | undefined>();

  return (
    <EuiPage>
      <EuiPageBody style={{ maxWidth: 1200, margin: '0 auto' }}>
        <EuiPageHeader paddingSize="s" bottomBorder={true} pageTitle="Lens embeddable playground" />
        <EuiPageSection paddingSize="s">
          <EuiFlexGroup
            className="eui-fullHeight"
            gutterSize="none"
            direction="column"
            responsive={false}
          >
            <EuiFlexItem className="eui-fullHeight">
              <EuiFlexGroup className="eui-fullHeight" gutterSize="l">
                <EuiFlexItem grow={3}>
                  <EuiPanel hasShadow={false}>
                    <p>
                      This app embeds a Lens visualization by specifying the configuration. Data
                      fetching and rendering is completely managed by Lens itself.
                    </p>
                    <p>
                      The editor on the right hand side make it possible to paste a Lens attributes
                      configuration, and have it rendered. Presets are available to have a starting
                      configuration, and new presets can be saved as well (not persisted).
                    </p>
                    <p>
                      The Open with Lens button will take the current configuration and navigate to
                      a prefilled editor.
                    </p>
                    <EuiSpacer />
                    <EuiFlexGroup wrap>
                      <EuiFlexItem grow={false}>
                        <AttributesMenu
                          currentSO={currentSO}
                          currentAttributes={currentAttributes}
                          saveValidSO={saveValidSO}
                        />
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <OverridesMenu
                          currentAttributes={currentAttributes}
                          overrides={overrides}
                          setOverrides={setOverrides}
                        />
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <PanelMenu
                          enableTriggers={enableTriggers}
                          toggleTriggers={toggleTriggers}
                          enableDefaultAction={enableDefaultAction}
                          setEnableDefaultAction={setEnableDefaultAction}
                          enableExtraAction={enableExtraAction}
                          setEnableExtraAction={setEnableExtraAction}
                        />
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiButton
                          aria-label="Save visualization into library or embed directly into any dashboard"
                          data-test-subj="lns-example-save"
                          isDisabled={isDisabled}
                          onClick={() => {
                            setIsSaveModalVisible(true);
                          }}
                        >
                          Save Visualization
                        </EuiButton>
                      </EuiFlexItem>
                      {props.defaultDataView?.isTimeBased() ? (
                        <EuiFlexItem grow={false}>
                          <EuiButton
                            aria-label="Change time range"
                            data-test-subj="lns-example-change-time-range"
                            isDisabled={isDisabled}
                            onClick={() => {
                              setTime(
                                time.to === 'now'
                                  ? {
                                      from: '2015-09-18T06:31:44.000Z',
                                      to: '2015-09-23T18:31:44.000Z',
                                    }
                                  : {
                                      from: 'now-5d',
                                      to: 'now',
                                    }
                              );
                            }}
                          >
                            {time.to === 'now' ? 'Change time range' : 'Reset time range'}
                          </EuiButton>
                        </EuiFlexItem>
                      ) : null}
                      <EuiFlexItem grow={false}>
                        <EuiButton
                          aria-label="Open lens in new tab"
                          isDisabled={!props.plugins.lens.canUseEditor()}
                          onClick={() => {
                            props.plugins.lens.navigateToPrefilledEditor(
                              {
                                id: '',
                                timeRange: time,
                                attributes: currentAttributes,
                              },
                              {
                                openInNewTab: true,
                              }
                            );
                          }}
                        >
                          Open in Lens (new tab)
                        </EuiButton>
                      </EuiFlexItem>
                      <EuiFlexItem>
                        <p>State: {isLoading ? 'Loading...' : 'Rendered'}</p>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                    <EuiFlexGroup>
                      <EuiFlexItem>
                        <LensComponent
                          id="myLens"
                          style={{ height: 500 }}
                          timeRange={time}
                          attributes={currentAttributes}
                          overrides={overrides}
                          onLoad={(val) => {
                            setIsLoading(val);
                          }}
                          onBrushEnd={({ range }) => {
                            setTime({
                              from: new Date(range[0]).toISOString(),
                              to: new Date(range[1]).toISOString(),
                            });
                          }}
                          onFilter={(_data) => {
                            // call back event for on filter event
                          }}
                          onTableRowClick={(_data) => {
                            // call back event for on table row click event
                          }}
                          disableTriggers={!enableTriggers}
                          viewMode={'view'}
                          withDefaultActions={enableDefaultAction}
                          extraActions={
                            enableExtraAction
                              ? [
                                  {
                                    id: 'testAction',
                                    type: 'link',
                                    getIconType: () => 'save',
                                    async isCompatible(
                                      context: ActionExecutionContext<object>
                                    ): Promise<boolean> {
                                      return true;
                                    },
                                    execute: async (context: ActionExecutionContext<object>) => {
                                      alert('I am an extra action');
                                      return;
                                    },
                                    getDisplayName: () => 'Extra action',
                                  },
                                ]
                              : undefined
                          }
                        />
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </EuiPanel>
                  {isSaveModalVisible && (
                    <LensSaveModalComponent
                      initialInput={{ attributes: currentAttributes }}
                      onSave={() => {}}
                      onClose={() => setIsSaveModalVisible(false)}
                    />
                  )}
                </EuiFlexItem>
                <EuiFlexItem grow={2}>
                  <EuiPanel hasShadow={false}>
                    <EuiFlexGroup>
                      <EuiFlexItem>
                        <EuiText>
                          <p>Paste or edit here your Lens document</p>
                        </EuiText>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                    <EuiFlexGroup>
                      <EuiFlexItem grow={false}>
                        <EuiSelect
                          options={charts.map(({ id }, i) => ({ value: i, text: id }))}
                          value={undefined}
                          onChange={(e) => switchChartPreset(+e.target.value)}
                          aria-label="Load from a preset"
                          prepend={'Load preset'}
                        />
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiButton
                          aria-label="Save the preset"
                          data-test-subj="lns-example-save"
                          isDisabled={isDisabled || hasParsingError}
                          onClick={() => {
                            const attributes = checkAndParseSO(currentSO.current);
                            if (attributes) {
                              const label = `custom-chart-${chartCounter}`;
                              addChartConfiguration([
                                ...loadedCharts,
                                {
                                  id: label,
                                  attributes,
                                },
                              ]);
                              chartCounter++;
                              alert(`The preset has been saved as "${label}"`);
                            }
                          }}
                        >
                          Save as preset
                        </EuiButton>
                      </EuiFlexItem>
                      {hasParsingErrorDebounced && currentSO.current !== currentValid && (
                        <EuiCallOut title="Error" color="danger" iconType="warning">
                          <p>Check the spec</p>
                        </EuiCallOut>
                      )}
                    </EuiFlexGroup>
                    <EuiFlexGroup style={{ height: '75vh' }} direction="column">
                      <EuiFlexItem>
                        <CodeEditor
                          languageId={HJSON_LANG_ID}
                          options={{
                            fontSize: 14,
                            wordWrap: 'on',
                          }}
                          value={currentSO.current}
                          onChange={(newSO) => {
                            const isValid = Boolean(checkAndParseSO(newSO));
                            setErrorFlag(!isValid);
                            currentSO.current = newSO;
                            if (isValid) {
                              // reset the debounced error
                              setErrorDebounced(isValid);
                              saveValidSO(newSO);
                            }
                          }}
                        />
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </EuiPanel>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPageSection>
      </EuiPageBody>
    </EuiPage>
  );
};
