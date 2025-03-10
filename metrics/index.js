const client = require('prom-client');

const generalAppLabels = [
    'tenant_id',
    'namespace',
    'env'
];

// function
const function_g_labels = ['function_api_name', 'language', 'is_long_task', 'is_front_end_access_enabled'];
const function_exec_lables = [].concat(...generalAppLabels).concat(...['exec_result', 'trigger_type']).concat(...function_g_labels);

const function_exec_total = new client.Counter({
    name: 'function_exec_total',
    help: 'Total number of function executions',
    labelNames: function_exec_lables
});

const function_exec_duration_milliseconds_total = new client.Counter({
    name: 'function_exec_duration_milliseconds_total',
    help: 'Total time cost in milliseconds of function executions',
    labelNames: function_exec_lables
});

const function_exec_duration_milliseconds_histogram = new client.Histogram({
    name: 'function_exec_duration_milliseconds_histogram',
    help: 'A histogram of latencies per execution',
    labelNames: function_exec_lables,
    buckets: [100, 200, 300, 500, 1000, 1500, 2000, 4000, 8000, 10000, 30000, 60000, 300000, 600000, 900000, 3600000, 5400000, 7200000, 9000000]
});

const function_exec_duration_milliseconds_summary = new client.Summary({
    name: 'function_exec_duration_milliseconds_summary',
    help: 'A summary of latencies per execution',
    labelNames: function_exec_lables,
    percentiles: [0.25, 0.5, 0.9, 0.95, 0.99, 0.999],

});

const function_exec_logs_total = new client.Counter({
    name: 'function_exec_logs_total',
    help: 'Total number of function execution logs',
    labelNames: [].concat(...function_g_labels).concat(...['log_level']).concat(...generalAppLabels)
});

const function_total = new client.Gauge({
    name: 'function_total',
    help: 'Count of functions',
    labelNames: [].concat(...generalAppLabels).concat(...['language', 'is_long_task', 'is_front_end_access_enabled'])
})

// // data
// const data_g_labels = [];
// const data_exec_lables = [].concat(...generalAppLabels).concat(...data_query_source).concat(...data_query_source_ext).concat(...data_g_labels).concat(...['source']);
// const data_exec_completed_lables = [].concat(...data_exec_lables).concat(...['exec_result', 'response_code']);

// const data_engine_query_total = new client.Counter({
//     name: 'data_engine_query_total',
//     help: 'Total number of data queries',
//     labelNames: data_exec_completed_lables
// });

// const data_engine_query_duration_milliseconds_total = new client.Counter({
//     name: 'data_engine_query_duration_milliseconds_total',
//     help: 'Total time cost in milliseconds of data queries',
//     labelNames: data_exec_completed_lables
// });

// const data_engine_query_duration_milliseconds_histogram = new client.Histogram({
//     name: 'data_engine_query_duration_milliseconds_histogram',
//     help: 'A histogram of latencies per query',
//     labelNames: data_exec_completed_lables,
//     buckets: [300, 500, 1000, 1500, 2000, 4000, 8000, 10000]
// });

// const data_engine_query_duration_milliseconds_summary = new client.Summary({
//     name: 'data_engine_query_duration_milliseconds_summary',
//     help: 'A summary of latencies per query',
//     labelNames: data_exec_completed_lables,
//     percentiles: [0.25, 0.5, 0.9, 0.95, 0.99, 0.999]
// });

// // const data_engine_query_executing_count = new client.Gauge({
// //     name: 'data_engine_query_executing_count',
// //     help: 'help info of data_engine_query_executing_count',
// //     labelNames: data_exec_lables
// // });

// const data_engine_objects_total = new client.Gauge({
//     name: 'data_engine_objects_total',
//     help: 'Count of objects',
//     labelNames: [].concat(...generalAppLabels).concat(...['object_type'])
// });

// const data_engine_fields_total = new client.Gauge({
//     name: 'data_engine_fields_total',
//     help: 'Count of fields',
//     labelNames: [].concat(...generalAppLabels).concat(...['object_api_name', 'object_type', 'field_type', 'field_data_type', 'field_is_encrypted'])
// });

// const data_engine_records_total = new client.Gauge({
//     name: 'data_engine_records_total',
//     help: 'Count of data records',
//     labelNames: [].concat(...generalAppLabels).concat(...['object_api_name', 'object_type'])
// });

// const data_engine_storage_data_total = new client.Gauge({
//     name: 'data_engine_storage_data_total',
//     help: 'Total amount of DB storage',
//     labelNames: [].concat(...generalAppLabels).concat(...['object_api_name', 'object_type'])
// });

// const data_engine_storage_file_total = new client.Gauge({
//     name: 'data_engine_storage_file_total',
//     help: 'Total amount of file storage',
//     labelNames: [].concat(...generalAppLabels).concat(...['object_api_name', 'object_type'])
// });

const oapi_g_labels = ['method', 'path', 'version', 'response_code', 'client_id', 'error_code'].concat(...generalAppLabels);
const oapi_call_total = new client.Counter({
    name: 'oapi_call_total',
    help: 'Total number of Open API calls',
    labelNames: oapi_g_labels
});

const oapi_call_duration_milliseconds_total = new client.Counter({
    name: 'oapi_call_duration_milliseconds_total',
    help: 'Total time cost in milliseconds of Open API calls',
    labelNames: oapi_g_labels
});

const oapi_call_data_in_bytes_total = new client.Counter({
    name: 'oapi_call_data_in_bytes_total',
    help: 'Total bytes of request body',
    labelNames: oapi_g_labels
});

const oapi_call_data_out_bytes_total = new client.Counter({
    name: 'oapi_call_data_out_bytes_total',
    help: 'Total bytes of response body',
    labelNames: oapi_g_labels
});

const oapi_call_duration_milliseconds_histogram = new client.Histogram({
    name: 'oapi_call_duration_milliseconds_histogram',
    help: 'A histogram of latencies per call',
    labelNames: oapi_g_labels,
    buckets: [50, 100, 200, 300, 500, 1000, 1500, 2000, 4000, 8000]
});

const oapi_call_duration_milliseconds_summary = new client.Summary({
    name: 'oapi_call_duration_milliseconds_summary',
    help: 'A summary of latencies per call',
    labelNames: oapi_g_labels,
    percentiles: [0.25, 0.5, 0.9, 0.95, 0.99, 0.999]
});

// const deployLables = ['deploy_result'].concat(generalAppLabels);
// const function_deploy_total = new client.Counter({
//     name: 'function_deploy_total',
//     help: 'Total number of cloud function deployments',
//     labelNames: deployLables
// });

// const function_deploy_duration_milliseconds_total = new client.Counter({
//     name: 'function_deploy_duration_milliseconds_total',
//     help: 'Total time cost in milliseconds of cloud function deployments',
//     labelNames: deployLables
// });

// const function_deploy_duration_milliseconds_histogram = new client.Histogram({
//     name: 'function_deploy_duration_milliseconds_histogram',
//     help: 'A histogram of latencies per deployment',
//     labelNames: deployLables,
//     buckets: [15000, 30000, 60000, 120000, 240000, 360000]
// });

// const function_deploy_duration_milliseconds_summary = new client.Summary({
//     name: 'function_deploy_duration_milliseconds_summary',
//     help: 'A summary of latencies per deployment',
//     labelNames: deployLables,
//     percentiles: [0.25, 0.5, 0.9, 0.95, 0.99, 0.999]
// });

/**
 * page metrics
 */
const page_labels = ['page_api_name', 'builder_version', 'page_type'];
const page_query_result_lables = ['query_result', 'query_api_name'];
const page_operate_labels = ['component_id', 'operate_type'];

const page_load_count_total = new client.Counter({
    name: 'page_load_count_total',
    help: 'Total number of page loads',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels)
});

// 2025-02-13 沟通更新：
// 这个指标依赖 builder performance sdk 升级，是 builder 定制的一个指标，一期可以接受先不提供，先提供一个 FCP 和 LCP 指标（行业标准）
// const page_load_duration_milliseconds_total = new client.Counter({
//     name: 'page_load_duration_milliseconds_total',
//     help: 'Total time cost in milliseconds of page loads',
//     labelNames: [].concat(...generalAppLabels).concat(...page_labels)
// });

const page_load_lcp_duration_milliseconds_total = new client.Counter({
    name: 'page_load_lcp_duration_milliseconds_total',
    help: 'Total time cost in milliseconds of page Largest Contentful Paint during page loading',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels)
});

const page_load_lcp_duration_milliseconds_summary = new client.Summary({
    name: 'page_load_lcp_duration_milliseconds_summary',
    help: 'A summary of Largest Contentful Paint',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels),
    percentiles: [0.25, 0.5, 0.9, 0.95, 0.99, 0.999]
});

const page_load_lcp_duration_milliseconds_histogram = new client.Histogram({
    name: 'page_load_lcp_duration_milliseconds_histogram',
    help: 'A histogram of Largest Contentful Paint',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels),
    buckets: [50, 100, 200, 300, 500, 1000, 1500, 2000, 4000, 8000, 10000, 12000, 16000, 20000, 30000]
});

const page_load_fcp_duration_milliseconds_total = new client.Counter({
    name: 'page_load_fcp_duration_milliseconds_total',
    help: 'Total time cost in milliseconds of page load First Contentful Paint',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels)
});

const page_load_fcp_duration_milliseconds_summary = new client.Summary({
    name: 'page_load_fcp_duration_milliseconds_summary',
    help: 'A summary of First Contentful Paint',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels),
    percentiles: [0.25, 0.5, 0.9, 0.95, 0.99, 0.999]
});

const page_load_fcp_duration_milliseconds_histogram = new client.Histogram({
    name: 'page_load_fcp_duration_milliseconds_histogram',
    help: 'A histogram of First Contentful Paint',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels),
    buckets: [50, 100, 200, 300, 500, 1000, 1500, 2000, 4000, 8000, 10000, 12000, 16000, 20000, 30000]
});

const page_js_error_count_total = new client.Counter({
    name: 'page_js_error_count_total',
    help: 'Total number of CUSTOM JS errors',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels)
});

const page_query_count_total = new client.Counter({
    name: 'page_query_count_total',
    help: 'Total number of page queries',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels).concat(...page_query_result_lables)
});

const page_query_duration_milliseconds_total = new client.Counter({
    name: 'page_query_duration_milliseconds_total',
    help: 'Total time cost in milliseconds of page queries',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels).concat(...page_query_result_lables)
});

const page_query_duration_milliseconds_summary = new client.Summary({
    name: 'page_query_duration_milliseconds_summary',
    help: 'A summary of page query durations',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels).concat(...page_query_result_lables),
    percentiles: [0.25, 0.5, 0.9, 0.95, 0.99, 0.999]
});

const page_query_duration_milliseconds_histogram = new client.Histogram({
    name: 'page_query_duration_milliseconds_histogram',
    help: 'A histogram of page query durations',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels).concat(...page_query_result_lables),
    buckets: [50, 100, 200, 300, 500, 1000, 1500, 2000, 4000, 8000, 10000, 12000, 16000, 20000, 30000]
});

const page_operate_count_total = new client.Counter({
    name: 'page_operate_count_total',
    help: 'Total number of page operations',
    labelNames: [].concat(...generalAppLabels).concat(...page_labels).concat(...page_operate_labels)
});

const agent_labels = ['job_name'];
const agent_request_total = new client.Counter({
    name: 'agent_request_total',
    help: 'total count prometheus scraped',
    labelNames: agent_labels
})

const agent_request_duration_milliseconds_total = new client.Counter({
    name: 'agent_request_duration_milliseconds_total',
    help: 'total time cost to generate the metrics response string',
    labelNames: agent_labels
})

const agent_response_size_total = new client.Counter({
    name: 'agent_response_size_total',
    help: 'total response size',
    labelNames: agent_labels
})

module.exports = {
    client,

    metrics: {
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
        
        page_load_count_total,
        page_load_lcp_duration_milliseconds_total,
        page_load_lcp_duration_milliseconds_summary,
        page_load_lcp_duration_milliseconds_histogram,
        page_load_fcp_duration_milliseconds_total,
        page_load_fcp_duration_milliseconds_summary,
        page_load_fcp_duration_milliseconds_histogram,
        page_js_error_count_total,
        page_query_count_total,
        page_query_duration_milliseconds_total,
        page_query_duration_milliseconds_summary,
        page_query_duration_milliseconds_histogram,
        page_operate_count_total,

        agent_request_total,
        agent_request_duration_milliseconds_total,
        agent_response_size_total
    }
}