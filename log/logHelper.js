"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogHelper = void 0;
var fs = require("fs");
var moment = require("moment-timezone");
var axios = require("axios");
var os = require("os");
var uuid_1 = require("uuid");
var crypto_1 = require("crypto");
var sensitive_words = [
    'username', 'password', 'pass', 'passcode',
    'client_secret', 'clientSecret',
    'app_id', 'app_secret',
    'at', 'rt', 'token', 'accesstoken', 'refreshtoken', 'access_token', 'refresh_token',
    'phoneNumber', 'apikey', 'selfApikey', 'uid'
];
var LogHelper = /** @class */ (function () {
    function LogHelper(trace_id) {
        this.traceId = (0, uuid_1.v4)().replace(/-/g, '');
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
        // 新增异步队列
        this.asyncLogsQueue = [];
        this.isProcessing = false;
        this.traceId = (0, uuid_1.v4)().replace(/-/g, '');
        if (trace_id) {
            this.traceId = trace_id;
        }
    }
    LogHelper.prototype.getBJDate = function () {
        return moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
    };
    LogHelper.prototype.getFileNumber = function () {
        if (!fs.existsSync(this.logPath)) {
            fs.mkdirSync(this.logPath, { recursive: true });
            return 0;
        }
        var files = fs.readdirSync(this.logPath);
        var currentDate = this.getBJDate();
        var maxNumber = 0;
        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
            var file = files_1[_i];
            var match = file.match(new RegExp("^" + currentDate + "-([0-9]+)\\.txt$"));
            if (match) {
                var number = parseInt(match[1], 10);
                if (number > maxNumber) {
                    maxNumber = number;
                }
            }
        }
        return maxNumber;
    };
    LogHelper.prototype.getLogFileName = function () {
        var currentDate = this.getBJDate();
        var number = this.getFileNumber();
        var log_file = this.logPath + "/" + currentDate + "-" + String(number).padStart(3, '0') + ".txt";
        // 检查文件大小
        if (fs.existsSync(log_file)) {
            var stats = fs.statSync(log_file);
            if (stats.size >= 8 * 1024 * 1024) { // 8MB
                number++;
                return this.logPath + "/" + currentDate + "-" + String(number).padStart(3, '0') + ".txt";
            }
        }
        return log_file;
    };
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
    LogHelper.prototype.new = function () {
        this.traceId = (0, uuid_1.v4)().replace(/-/g, '');
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
     * trace_id 会使用之前实例的值
     */
    LogHelper.prototype.default = function () {
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
     * 不上报日志到 Loki
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
            this.labels = __assign(__assign({}, this.labels), labels);
            if (!this.isSingleAppendMode) {
                this.__initLabels = __assign(__assign({}, this.__initLabels), labels);
            }
        }
        if (metadatas) {
            this.metadatas = __assign(__assign({}, this.metadatas), metadatas);
            if (!this.isSingleAppendMode) {
                this.__initMetadatas = __assign(__assign({}, this.__initMetadatas), labels);
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
        var _ts = ts;
        var __labels = __assign({}, labels);
        if (labels && labels.__timestamp__) {
            _ts = parseInt(labels.__timestamp__);
            delete __labels['__timestamp__'];
        }
        var logs = {
            streams: [
                {
                    stream: __assign({ language: "NodeJS", level: _level, ext: ext, file: __filename, service_name: this.serviceName, platform: os.platform(), hostname: os.hostname(), mac: getMacAddress() }, __labels),
                    values: [{}]
                },
            ],
        };
        var values = [
            (_ts * 1000000).toString(),
            typeof log_obj === typeof {} ? JSON.stringify(log_obj) : "".concat(log_obj),
        ];
        if (typeof metadatas === typeof {} && metadatas) {
            values.push(metadatas);
        }
        logs.streams[0].values = [values];
        axios.default({
            url: this.lokiUrl,
            method: "post",
            headers: {
                "Content-Type": "application/json",
                "X-Auth": this.lokiAuthCode,
            },
            timeout: 3000,
            data: logs,
        }).then(function (response) {
            if (callback) {
                callback(response.data, undefined);
            }
        }).catch(function (err) {
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
    LogHelper.prototype.batch_report_log = function (logs, callback) {
        var _this = this;
        if (!this.lokiUrl) {
            throw new Error("Please set loki api push url first!");
        }
        var logs_inserted = {
            streams: [{}]
        };
        logs_inserted.streams = [];
        var common_info = {
            platform: os.platform(),
            hostname: os.hostname(),
            mac: getMacAddress(),
            file: __filename,
            service_name: this.serviceName,
        };
        for (var _i = 0, logs_1 = logs; _i < logs_1.length; _i++) {
            var log = logs_1[_i];
            var ts = log.ts, level = log.level, labels = log.labels, metadatas = log.metadatas, log_obj = log.log_obj;
            var _level = "info";
            var ext = '-';
            if (typeof level === typeof "" && level && ['info', 'warn', 'error', 'debug'].indexOf(level.toLowerCase()) !== -1) {
                _level = level.toLowerCase();
            }
            var _ts = ts;
            var _labels = __assign({}, labels);
            if (labels && labels.__timestamp__) {
                _ts = parseInt(labels.__timestamp__);
                delete _labels['__timestamp__'];
            }
            var values = [
                (_ts * 1000000 + (0, crypto_1.randomInt)(1, 100000)).toString(),
                typeof log_obj === typeof {} ? JSON.stringify(log_obj) : "".concat(log_obj),
            ];
            if (typeof metadatas === typeof {} && metadatas) {
                values.push(metadatas);
            }
            var log_stream = {
                stream: __assign(__assign({ level: _level, ext: ext }, _labels), common_info),
                values: [values]
            };
            logs_inserted.streams.push(log_stream);
        }
        axios.default({
            url: this.lokiUrl,
            method: "post",
            headers: {
                "Content-Type": "application/json",
                "X-Auth": this.lokiAuthCode,
            },
            timeout: 3000,
            data: logs_inserted,
        }).then(function (response) {
            if (callback) {
                callback(response.data, undefined);
            }
        }).catch(function (err) {
            if (callback) {
                callback('', err);
            }
            _this.log('error', '', undefined, undefined, {
                info: 'report log to loki error',
                msg: err.message,
                stack: err.stack,
                logs: logs_inserted
            }, false);
        });
    };
    LogHelper.prototype.processQueue = function () {
        return __awaiter(this, void 0, void 0, function () {
            var perLogQueue, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isProcessing || this.asyncLogsQueue.length === 0) {
                            return [2 /*return*/];
                        }
                        this.isProcessing = true;
                        perLogQueue = [];
                        while (perLogQueue.length < 50 && this.asyncLogsQueue.length > 0) {
                            perLogQueue.push(this.asyncLogsQueue.shift());
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, new Promise(function (resolve) {
                                _this.batch_report_log(perLogQueue, function (data, err) {
                                    if (err) {
                                        console.error('Report log error:', err);
                                    }
                                    resolve(data);
                                });
                            })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Queue processing error:', error_1);
                        return [3 /*break*/, 5];
                    case 4:
                        this.isProcessing = false;
                        this.processQueue.call(this);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    LogHelper.prototype.log = function (log_level, trace_id, labels, metadatas, log_obj, is_report_log) {
        if (is_report_log === void 0) { is_report_log = true; }
        var ts_bj = get_bj_time();
        var log_str = '';
        var _log_obj = desensitive(log_obj);
        if (typeof _log_obj === typeof {}) {
            log_str = JSON.stringify(__assign(__assign({}, _log_obj), { __trace_id: trace_id, __labels: labels, __metadatas: metadatas }));
        }
        else {
            log_str = "log=".concat(_log_obj);
            log_str = "".concat(log_str, "\ttrace_id=").concat(typeof trace_id === typeof '' ? trace_id : '');
            log_str = "".concat(log_str, "\tlabels=").concat(typeof labels === typeof {} && labels ? JSON.stringify(labels) : '');
            log_str = "".concat(log_str, "\tmetadatas=").concat(typeof metadatas === typeof {} && metadatas ? JSON.stringify(metadatas) : '');
        }
        console.log("".concat(ts_bj, "\t").concat(log_level, "\t").concat(log_str && log_str.length > 150 ? (log_str.substring(0, 150) + '...') : log_str));
        if (!fs.existsSync(this.logPath)) {
            fs.mkdirSync(this.logPath, { recursive: true });
        }
        var log_file = this.getLogFileName();
        fs.appendFile(log_file, "".concat(ts_bj, "\t").concat(log_level, "\t").concat(log_str, "\n"), function (err) {
            if (err) {
                console.log(err);
            }
        });
        if (!is_report_log || !this.reportToLoki) {
            return;
        }
        var __metadatas = { trace_id: trace_id };
        if (metadatas && typeof metadatas === typeof {}) {
            __metadatas = __assign(__assign({}, metadatas), __metadatas);
        }
        // 将请求放入队列
        this.asyncLogsQueue.push({ ts: new Date().getTime(), level: log_level, labels: labels, metadatas: __metadatas, log_obj: _log_obj });
        this.processQueue.call(this);
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
        return "[log too long]".concat(log_obj.substring(0, 50), "...");
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
                // console.error(err);
                console.error("[Error] ".concat(err.message, ". raw string is ") + l.str);
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
