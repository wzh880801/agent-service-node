export interface IBaseMetricReceivedEvent {
    schema: string,
    event_id: string,
    create_time: string,
    event_type: "apaas.application.metric.reported_v1",
    tenant_key: string,
    app_id: string,
    metrics: Array<IBaseMetric>
}

export interface IOApiMetricReceivedEvent {
    metrics: Array<IOApiMetric>
}

export type MetricName =
    'oapi_call_total' | 'oapi_call_duration_milliseconds_total' | 'oapi_call_duration_milliseconds_histogram' | 'oapi_call_duration_milliseconds_summary' | 'oapi_call_data_in_bytes_total' | 'oapi_call_data_out_bytes_total';

export interface IBaseMetric {
    name: MetricName,
    timestamp: number,
    type: 'counter' | 'gauge' | 'summary' | 'histogram',
    value: number,
    attributes: IBaseMetricAttribute
}

export interface IOApiMetric extends IBaseMetric {
    attributes: IOApiMetricAttribute
}

export interface IBaseMetricAttribute {
    env: 'dev' | 'online',
    namespace: string,
    tenant_id: string
}

export interface IOApiMetricAttribute extends IBaseMetricAttribute {

    client_id: string,

    /**
     * 0 表示成功，其他表示失败
     */
    error_code: string,

    method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT',

    /**
     * api path
     * /api/data/v1/namespaces/package_7a2002__c/globalVariables/LOKI_API_URL
     */
    path: string,

    /**
     * http response status code
     */
    response_code: string,
    version: 'v1' | 'v2'
}