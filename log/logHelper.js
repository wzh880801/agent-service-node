"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
exports.__esModule = true;
var fs = require("fs");
var moment = require("moment-timezone");
var axios = require("axios");
var os = require("os");
var uuid_1 = require("uuid");
var sensitive_words = [
    'username', 'password', 'pass', 'passcode',
    'client_secret', 'clientSecret',
    'app_id', 'app_secret',
    'at', 'rt', 'token', 'accesstoken', 'refreshtoken', 'access_token', 'refresh_token',
    'phoneNumber', 'apikey', 'selfApikey', 'uid'
];
var LogHelper = /** @class */ (function () {
    function LogHelper(trace_id) {
        this.traceId = uuid_1.v4().replace(/-/g, '');
        this.labels = { source: __filename };
        this.metadatas = {};
        this.__initLabels = {};
        this.__initMetadatas = {};
        this.logPath = "/var/logs";
        this.lokiUrl = "";
        this.lokiAuthCode = "";
        this.reportToLoki = true;
        this.scriptFileName = __filename;
        this.isSingleAppendMode = false;
        this.serviceName = "my_service";
        this.traceId = uuid_1.v4().replace(/-/g, '');
        if (trace_id) {
            this.traceId = trace_id;
        }
    }
    LogHelper.prototype.setServiceName = function (service_name) {
        this.serviceName = service_name ? service_name : 'my_service';
        return this;
    };
    LogHelper.prototype.getTraceid = function () {
        return this.traceId;
    };
    /**
     * 使用新的 trace_id 但保留其他配置
     */
    LogHelper.prototype["new"] = function () {
        this.traceId = uuid_1.v4().replace(/-/g, '');
        return this;
    };
    /**
     * 记录打印日志的文件路径
     * @param filename 传参 __filename 即可
     */
    LogHelper.prototype.useFile = function (filename) {
        if (filename) {
            this.labels['source'] = filename;
            this.scriptFileName = filename;
        }
        return this;
    };
    /**
     * 调用此方法后，后续的 append 方法只生效一次
     */
    LogHelper.prototype.useSingleAppendMode = function () {
        this.isSingleAppendMode = true;
        return this;
    };
    /**
     * 使用默认配置，即 config、append、useSingleAppendMode 方法造成的属性变更都无效，仅对本次调用生效
     */
    LogHelper.prototype["default"] = function () {
        var logger = new LogHelper(this.traceId);
        logger.reportToLoki = this.reportToLoki;
        logger.setPath(this.logPath);
        logger.lokiUrl = this.lokiUrl;
        logger.lokiAuthCode = this.lokiAuthCode;
        logger.useFile(this.scriptFileName);
        logger.isSingleAppendMode = false;
        logger.setServiceName(this.serviceName);
        return logger;
    };
    /**
     * 不上报日志的 Loki
     */
    LogHelper.prototype.noReport = function () {
        this.reportToLoki = false;
        return this;
    };
    /**
     * 上报日志到 Loki
     */
    LogHelper.prototype.withReport = function () {
        this.reportToLoki = true;
        return this;
    };
    /**
     *
     * @param path 日志文件保存路径
     */
    LogHelper.prototype.setPath = function (path) {
        if (path) {
            this.logPath = path;
        }
        if (!fs.existsSync(this.logPath)) {
            fs.mkdirSync(this.logPath, { recursive: true });
        }
        return this;
    };
    /**
     *
     * @param url Loki api url
     * @param auth_code optional, Loki 验证信息
     * @returns
     */
    LogHelper.prototype.setLoki = function (url, auth_code) {
        if (!url) {
            throw new Error("loki url can not be empty");
        }
        this.lokiUrl = url;
        this.lokiAuthCode = auth_code;
        return this;
    };
    /**
     *
     * @param trace_id 使用指定的 trace_id 创建日志记录器实例
     * @returns
     */
    LogHelper.prototype.useTraceId = function (trace_id) {
        this.traceId = trace_id;
        return this;
    };
    /**
     *
     * @param trace_id 使用指定的 trace_id 创建日志记录器实例
     * @returns
     */
    LogHelper.prototype.getlogger = function (trace_id) {
        this.traceId = trace_id;
        return this;
    };
    /**
     * 设置初始化 labels 和 metadatas，设置后，后续的日志都会追加对应信息
     * @param labels
     * @param metadatas
     * @returns
     */
    LogHelper.prototype.config = function (labels, metadatas) {
        if (labels) {
            this.labels = labels;
            this.__initLabels = labels;
        }
        if (metadatas) {
            this.metadatas = metadatas;
            this.__initMetadatas = metadatas;
        }
        return this;
    };
    /**
     * 打印日志时，追加对应的 labels 和 metadatas，如果 调用了 useSingleAppendMode 再只生效一次
     * @param labels
     * @param metadatas
     * @returns
     */
    LogHelper.prototype.append = function (labels, metadatas) {
        if (labels) {
            this.labels = __assign({}, this.labels, labels);
            if (!this.isSingleAppendMode) {
                this.__initLabels = __assign({}, this.__initLabels, labels);
            }
        }
        if (metadatas) {
            this.metadatas = __assign({}, this.metadatas, metadatas);
            if (!this.isSingleAppendMode) {
                this.__initMetadatas = __assign({}, this.__initMetadatas, labels);
            }
        }
        return this;
    };
    LogHelper.prototype.clean = function () {
        if (this.isSingleAppendMode) {
            this.labels = {};
            this.config(this.__initLabels, this.__initMetadatas);
            this.useFile(this.scriptFileName);
        }
    };
    LogHelper.prototype.info = function (log_obj) {
        this.log('INFO', this.traceId, this.labels, this.metadatas, log_obj);
        this.clean();
    };
    LogHelper.prototype.warn = function (log_obj) {
        this.log('WARN', this.traceId, this.labels, this.metadatas, log_obj);
        this.clean();
    };
    LogHelper.prototype.error = function (log_obj) {
        if (log_obj instanceof Error) {
            this.log('ERROR', this.traceId, this.labels, this.metadatas, JSON.parse(JSON.stringify(log_obj, Object.getOwnPropertyNames(log_obj))));
        }
        else {
            this.log('ERROR', this.traceId, this.labels, this.metadatas, log_obj);
        }
        this.clean();
    };
    LogHelper.prototype.debug = function (log_obj) {
        this.log('DEBUG', this.traceId, this.labels, this.metadatas, log_obj);
        this.clean();
    };
    /**
     *
     * @param words 增加敏感词列表
     * @returns
     */
    LogHelper.prototype.addSensitiveWords = function (words) {
        if (words.length === 0) {
            return this;
        }
        words.forEach(function (v) {
            if (sensitive_words.indexOf(v) === -1) {
                sensitive_words.push(v);
            }
        });
        return this;
    };
    LogHelper.prototype.report_log = function (ts, level, labels, metadatas, log_obj, callback) {
        var _this = this;
        if (!this.lokiUrl) {
            throw new Error("Please set loki api push url first!");
        }
        var _level = "info";
        var ext = '-';
        if (typeof level === typeof "" && level) {
            if (['info', 'warn', 'error', 'debug'].indexOf(level.toLowerCase()) !== -1) {
                _level = level.toLowerCase();
            }
            else {
                ext = level;
            }
        }
        var logs = {
            streams: [
                {
                    stream: __assign({ language: "NodeJS", level: _level, ext: ext, file: __filename, service_name: this.serviceName, platform: os.platform(), hostname: os.hostname(), mac: getMacAddress() }, labels),
                    values: [{}]
                },
            ]
        };
        var values = [
            (ts * 1000000).toString(),
            typeof log_obj === typeof {} ? JSON.stringify(log_obj) : "" + log_obj,
        ];
        if (typeof metadatas === typeof {} && metadatas) {
            values.push(metadatas);
        }
        logs.streams[0].values = [values];
        axios["default"]({
            url: this.lokiUrl,
            method: "post",
            headers: {
                "Content-Type": "application/json",
                "X-Auth": this.lokiAuthCode
            },
            timeout: 3000,
            data: logs
        }).then(function (response) {
            if (callback) {
                callback(response.data, undefined);
            }
        })["catch"](function (err) {
            if (callback) {
                callback('', err);
            }
            _this.log('error', '', undefined, undefined, {
                info: 'report log to loki error',
                msg: err.message,
                stack: err.stack,
                logs: logs
            }, false);
        });
    };
    LogHelper.prototype.log = function (log_level, trace_id, labels, metadatas, log_obj, is_report_log) {
        if (is_report_log === void 0) { is_report_log = true; }
        var ts_bj = get_bj_time();
        var log_str = '';
        var _log_obj = desensitive(log_obj);
        if (typeof _log_obj === typeof {}) {
            log_str = JSON.stringify(__assign({}, _log_obj, { __trace_id: trace_id, __labels: labels, __metadatas: metadatas }));
        }
        else {
            log_str = "log=" + _log_obj;
            log_str = log_str + "\ttrace_id=" + (typeof trace_id === typeof '' ? trace_id : '');
            log_str = log_str + "\tlabels=" + (typeof labels === typeof {} && labels ? JSON.stringify(labels) : '');
            log_str = log_str + "\tmetadatas=" + (typeof metadatas === typeof {} && metadatas ? JSON.stringify(metadatas) : '');
        }
        console.log(ts_bj + "\t" + log_level + "\t" + (log_str && log_str.length > 150 ? (log_str.substring(0, 150) + '...') : log_str));
        if (!fs.existsSync(this.logPath)) {
            fs.mkdirSync(this.logPath, { recursive: true });
        }
        var log_file = this.logPath + "/" + moment().format('YYYY-MM-DD') + ".txt";
        fs.appendFile(log_file, ts_bj + "\t" + log_level + "\t" + log_str + "\n", function (err) {
            if (err) {
                console.log(err);
            }
        });
        if (!is_report_log || !this.reportToLoki) {
            return;
        }
        var __metadatas = { trace_id: trace_id };
        if (metadatas && typeof metadatas === typeof {}) {
            __metadatas = __assign({}, metadatas, __metadatas);
        }
        this.report_log(new Date(ts_bj).getTime(), log_level, labels, __metadatas, _log_obj, function (data, err) {
        });
    };
    return LogHelper;
}());
exports.LogHelper = LogHelper;
function getMacAddress() {
    var interfaces = os.networkInterfaces();
    for (var _i = 0, _a = Object.values(interfaces); _i < _a.length; _i++) {
        var iface = _a[_i];
        if (iface && iface.length > 0) {
            for (var _b = 0, iface_1 = iface; _b < iface_1.length; _b++) {
                var config = iface_1[_b];
                if (!config.internal && config.mac !== '00:00:00:00:00:00') {
                    return config.mac;
                }
            }
        }
    }
    return '--';
}
function desensitive(log_obj) {
    if (typeof log_obj === typeof '' && log_obj.length >= 100000) {
        return "[log too long]" + log_obj.substring(0, 50) + "...";
    }
    var _log_obj = {};
    if (typeof log_obj === typeof '' && log_obj.indexOf('{') === -1) {
        return log_obj;
    }
    else if (typeof log_obj === typeof 0 || typeof log_obj === typeof true) {
        return log_obj;
    }
    else if (log_obj && typeof log_obj === typeof {}) {
        // 深拷贝
        _log_obj = JSON.parse(JSON.stringify(log_obj));
    }
    else {
        return try_parse_and_desensitive(log_obj);
    }
    replace_senitive_value(_log_obj);
    return _log_obj;
}
function replace_senitive_value(obj) {
    if (typeof obj !== typeof {} || typeof obj === 'undefined' || obj === null) {
        return;
    }
    Object.keys(obj).forEach(function (k) {
        var v = obj[k];
        if (typeof v === typeof {} && typeof v !== 'undefined') {
            replace_senitive_value(v);
        }
        else if (is_sensitive_key(k)) {
            if (typeof v === typeof '' && v.length > 6) {
                obj[k] = v.substring(0, v.length - 6) + "******";
            }
            else {
                obj[k] = "******";
            }
        }
    });
}
/**
 * 是否包含敏感词
 * @param {string} key
 * @returns {boolean}
 */
function is_sensitive_key(key) {
    if (!key) {
        return false;
    }
    var lower_key = key.toLowerCase();
    for (var i = 0; i < sensitive_words.length; i++) {
        var w = sensitive_words[i].toLowerCase();
        if (lower_key === w) {
            return true;
        }
    }
    return false;
}
/**
 *
 * @returns {string} 返回 2023-10-24T00:00:00.000+08:00 这样的日期字符串
 */
function get_bj_time() {
    // const bj_now = new Date().getTime() + 8 * 3600 * 1000;
    // return new Date(bj_now).toISOString().replace('Z', '+08:00');
    return moment().tz("Asia/Shanghai").format('yyyy-MM-DDTHH:mm:ss.SSS+08:00');
}
/**
 *
 * @param {string} str
 * @returns {string}
 */
function try_parse_and_desensitive(str) {
    var desensitive_str = '';
    var results = parse_str(str);
    for (var i = 0; i < results.length; i++) {
        var l = results[i];
        if (l.is_json) {
            try {
                var v = JSON.parse(l.str);
                desensitive_str += JSON.stringify(desensitive(v));
            }
            catch (err) {
                console.error(err);
                console.log("[Error]raw string is " + l.str);
                desensitive_str += l.str;
            }
        }
        else {
            desensitive_str += l.str;
        }
    }
    return desensitive_str;
}
/**
 *
 * @param {string} raw_str
 * @returns {Array<IParseResult>}
 */
function parse_str(raw_str) {
    if (typeof raw_str !== typeof '') {
        return [];
    }
    var results = [];
    var start = -1, end = -1;
    var left = 0, right = 0;
    for (var i = 0; i < raw_str.length; i++) {
        var letter = raw_str[i];
        if (letter === '{') {
            left++;
            if (start === -1) {
                start = i;
            }
        }
        else if (letter === '}') {
            right++;
        }
        if (left === right && right > 0) {
            end = i;
        }
        if (left === right && right > 0 && end > 0) {
            // console.log('---')
            // console.log(`start=${start} end=${end}`)
            var json1 = raw_str.substring(start, end + 1);
            // console.log(json1);
            results.push({
                is_json: true,
                str: json1,
                start: start,
                end: end
            });
            start = -1;
            end = -1;
            left = 0;
            right = 0;
        }
    }
    var _final_result = [];
    if (results.length > 0) {
        for (var i = 0; i < results.length; i++) {
            var l = results[i];
            if (i > 0) {
                _final_result.push(results[i]);
                var ll = results[i - 1];
                if (l.start - 1 > ll.end) {
                    _final_result.push({
                        is_json: false,
                        str: raw_str.substring(ll.end + 1, l.start),
                        start: ll.end + 1,
                        end: l.start - 1
                    });
                }
            }
            else if (l.start > 0) {
                _final_result.push({
                    is_json: false,
                    str: raw_str.substring(0, l.start),
                    start: 0,
                    end: l.start - 1
                });
                _final_result.push(results[i]);
            }
            else {
                _final_result.push(results[i]);
            }
        }
        var last = results[results.length - 1];
        if (last.end + 1 < raw_str.length) {
            _final_result.push({
                is_json: false,
                str: raw_str.substring(last.end + 1, raw_str.length),
                start: last.end + 1,
                end: raw_str.length
            });
        }
    }
    else {
        return [{
                is_json: false,
                str: raw_str,
                start: 0,
                end: raw_str ? raw_str.length - 1 : 0
            }];
    }
    // console.log(results)
    // console.log('--->')
    // console.log(_final_result);
    return _final_result;
}
