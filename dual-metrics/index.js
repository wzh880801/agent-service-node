const client = require('prom-client');

const generalAppLabels = [
    'tenant_id',
    'namespace',
    'env'
];

let app_registers = {};
let app_metrics = {};
const agent_metric_registry = new client.Registry();

/**
 * 
 * @param {string} app_id
 * @returns {string}
 */
function formatAppId(app_id) {
    if (!app_id || typeof app_id !== typeof '') {
        return;
    }
    return app_id.toLowerCase();
}

/**
 * 
 * @param {string} app_id 
 * @returns {client.Registry}
 */
function getAppRegistry(app_id) {
    const _app_id = formatAppId(app_id);
    if (!app_registers[_app_id]) {
        app_registers[_app_id] = new client.Registry();
    }
    return app_registers[_app_id];
}

/**
 * 
 * @param {string} app_id 
 * @returns 
 */
function getAppMetrics(app_id) {
    const _app_id = formatAppId(app_id);
    const registry = getAppRegistry(app_id);
    if (app_metrics[_app_id]) {
        return app_metrics[_app_id];
    }

    // function
    const function_g_labels = ['function_api_name', 'language', 'is_long_task', 'is_front_end_access_enabled'];
    const function_exec_lables = [].concat(...generalAppLabels).concat(...['exec_result', 'trigger_type']).concat(...function_g_labels);

    const function_exec_total = new client.Counter({
        name: 'function_exec_total',
        help: 'Total number of function executions',
        labelNames: function_exec_lables,
        registers: [registry]
    });

    const function_exec_duration_milliseconds_total = new client.Counter({
        name: 'function_exec_duration_milliseconds_total',
        help: 'Total time cost in milliseconds of function executions',
        labelNames: function_exec_lables,
        registers: [registry]
    });

    const function_exec_duration_milliseconds_histogram = new client.Histogram({
        name: 'function_exec_duration_milliseconds_histogram',
        help: 'A histogram of latencies per execution',
        labelNames: function_exec_lables,
        buckets: [100, 200, 300, 500, 1000, 1500, 2000, 4000, 8000, 10000, 30000, 60000, 300000, 600000, 900000, 3600000, 5400000, 7200000, 9000000],
        registers: [registry]
    });

    const function_exec_duration_milliseconds_summary = new client.Summary({
        name: 'function_exec_duration_milliseconds_summary',
        help: 'A summary of latencies per execution',
        labelNames: function_exec_lables,
        percentiles: [0.25, 0.5, 0.9, 0.95, 0.99, 0.999],
        registers: [registry]

    });

    const function_exec_logs_total = new client.Counter({
        name: 'function_exec_logs_total',
        help: 'Total number of function execution logs',
        labelNames: [].concat(...function_g_labels).concat(...['log_level']).concat(...generalAppLabels),
        registers: [registry]
    });

    const function_total = new client.Gauge({
        name: 'function_total',
        help: 'Count of functions',
        labelNames: [].concat(...generalAppLabels).concat(...['language', 'is_long_task', 'is_front_end_access_enabled']),
        registers: [registry]
    })

    const oapi_g_labels = ['method', 'path', 'version', 'response_code', 'client_id', 'error_code'].concat(...generalAppLabels);
    const oapi_call_total = new client.Counter({
        name: 'oapi_call_total',
        help: 'Total number of Open API calls',
        labelNames: oapi_g_labels,
        registers: [registry]
    });

    const oapi_call_duration_milliseconds_total = new client.Counter({
        name: 'oapi_call_duration_milliseconds_total',
        help: 'Total time cost in milliseconds of Open API calls',
        labelNames: oapi_g_labels,
        registers: [registry]
    });

    const oapi_call_data_in_bytes_total = new client.Counter({
        name: 'oapi_call_data_in_bytes_total',
        help: 'Total bytes of request body',
        labelNames: oapi_g_labels,
        registers: [registry]
    });

    const oapi_call_data_out_bytes_total = new client.Counter({
        name: 'oapi_call_data_out_bytes_total',
        help: 'Total bytes of response body',
        labelNames: oapi_g_labels,
        registers: [registry]
    });

    const oapi_call_duration_milliseconds_histogram = new client.Histogram({
        name: 'oapi_call_duration_milliseconds_histogram',
        help: 'A histogram of latencies per call',
        labelNames: oapi_g_labels,
        buckets: [50, 100, 200, 300, 500, 1000, 1500, 2000, 4000, 8000],
        registers: [registry]
    });

    const oapi_call_duration_milliseconds_summary = new client.Summary({
        name: 'oapi_call_duration_milliseconds_summary',
        help: 'A summary of latencies per call',
        labelNames: oapi_g_labels,
        percentiles: [0.25, 0.5, 0.9, 0.95, 0.99, 0.999],
        registers: [registry]
    });

    app_metrics[_app_id] = {
        oapi_call_total,
        oapi_call_duration_milliseconds_total,
        oapi_call_duration_milliseconds_histogram,
        oapi_call_duration_milliseconds_summary,
        oapi_call_data_in_bytes_total,
        oapi_call_data_out_bytes_total,

        function_exec_total,
        function_exec_duration_milliseconds_total,
        function_exec_duration_milliseconds_histogram,
        function_exec_duration_milliseconds_summary,
        function_exec_logs_total,
        function_total,
    }

    return app_metrics[_app_id];
}

const agent_labels = ['job_name'];
const agent_request_total = new client.Counter({
    name: 'agent_request_total',
    help: 'total count prometheus scraped',
    labelNames: agent_labels,
    registers: [agent_metric_registry]
})

const agent_request_duration_milliseconds_total = new client.Counter({
    name: 'agent_request_duration_milliseconds_total',
    help: 'total time cost to generate the metrics response string',
    labelNames: agent_labels,
    registers: [agent_metric_registry]
})

const agent_response_size_total = new client.Counter({
    name: 'agent_response_size_total',
    help: 'total response size',
    labelNames: agent_labels,
    registers: [agent_metric_registry]
})

module.exports = {

    getAppRegistry,
    getAppMetrics,

    agent_metric_registry,
    agent_metrics: {
        agent_request_total,
        agent_request_duration_milliseconds_total,
        agent_response_size_total
    }
}