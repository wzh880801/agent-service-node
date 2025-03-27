
import * as fs from 'fs';
import * as moment from 'moment-timezone';
import * as axios from 'axios';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

const sensitive_words = [
    'username', 'password', 'pass', 'passcode',
    'client_secret', 'clientSecret',
    'app_id', 'app_secret',
    'at', 'rt', 'token', 'accesstoken', 'refreshtoken', 'access_token', 'refresh_token',
    'phoneNumber', 'apikey', 'selfApikey', 'uid'];

export class LogHelper {

    private traceId: string = uuidv4().replace(/-/g, '');
    private labels: ILabel = { source: __filename };
    private metadatas: IMetadata = {};

    private __initLabels: ILabel = {};
    private __initMetadatas: IMetadata = {};

    private logPath: string = "/var/logs";

    private lokiUrl: string = "";
    private lokiAuthCode: string | undefined | null = "";

    reportToLoki: boolean = true;

    private scriptFileName: string = __filename;
    private isSingleAppendMode: boolean = false;

    private serviceName: string = "my_service";

    constructor(trace_id?: string | undefined | null) {
        this.traceId = uuidv4().replace(/-/g, '');
        if (trace_id) {
            this.traceId = trace_id;
        }
    }

    private getBJDate(): string {
        return moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
    }

    private getFileNumber(): number {
        if (!fs.existsSync(this.logPath)) {
            fs.mkdirSync(this.logPath, { recursive: true });
            return 0;
        }

        var files = fs.readdirSync(this.logPath);
        var currentDate = this.getBJDate();
        var maxNumber = 0;
        for (const file of files) {
            var match = file.match(new RegExp("^" + currentDate + "-([0-9]+)\\.txt$"));
            if (match) {
                var number = parseInt(match[1], 10);
                if (number > maxNumber) {
                    maxNumber = number;
                }
            }
        }
        return maxNumber;
    }

    private getLogFileName(): string {
        var currentDate = this.getBJDate();
        var number = this.getFileNumber();

        var log_file = this.logPath + "/" + currentDate + "-" + String(number).padStart(3, '0') + ".txt";

        // 检查文件大小
        if (fs.existsSync(log_file)) {
            var stats = fs.statSync(log_file);
            if (stats.size >= 10 * 1024 * 1024) { // 10MB
                number++;
                return this.logPath + "/" + currentDate + "-" + String(number).padStart(3, '0') + ".txt";
            }
        }

        return log_file;
    }

    setServiceName(service_name: string): this {
        this.serviceName = service_name ? service_name : 'my_service';
        return this;
    }

    getTraceid(): string {
        return this.traceId;
    }

    /**
     * 使用新的 trace_id 但保留其他配置
     */
    new(): this {
        this.traceId = uuidv4().replace(/-/g, '');
        return this;
    }

    /**
     * 记录打印日志的文件路径
     * @param filename 传参 __filename 即可
     */
    useFile(filename: string): this {
        if (filename) {
            this.labels['source'] = filename;
            this.scriptFileName = filename;
        }
        return this;
    }

    /**
     * 调用此方法后，后续的 append 方法只生效一次
     */
    useSingleAppendMode(): this {
        this.isSingleAppendMode = true;
        return this;
    }

    /**
     * 使用默认配置，即 config、append、useSingleAppendMode 方法造成的属性变更都无效，仅对本次调用生效
     * trace_id 会使用之前实例的值
     */
    default(): LogHelper {
        let logger = new LogHelper(this.traceId);
        logger.reportToLoki = this.reportToLoki;
        logger.setPath(this.logPath);
        logger.lokiUrl = this.lokiUrl;
        logger.lokiAuthCode = this.lokiAuthCode;
        logger.useFile(this.scriptFileName);
        logger.isSingleAppendMode = false;
        logger.setServiceName(this.serviceName);
        return logger;
    }

    /**
     * 不上报日志到 Loki
     */
    noReport(): this {
        this.reportToLoki = false;
        return this;
    }

    /**
     * 上报日志到 Loki
     */
    withReport(): this {
        this.reportToLoki = true;
        return this;
    }

    /**
     * 
     * @param path 日志文件保存路径
     */
    setPath(path: string): this {
        if (path) {
            this.logPath = path;
        }
        if (!fs.existsSync(this.logPath)) {
            fs.mkdirSync(this.logPath, { recursive: true });
        }

        return this;
    }

    /**
     * 
     * @param url Loki api url
     * @param auth_code optional, Loki 验证信息
     * @returns 
     */
    setLoki(url: string, auth_code: string | undefined | null): this {
        if (!url) {
            throw new Error(`loki url can not be empty`);
        }
        this.lokiUrl = url;
        this.lokiAuthCode = auth_code;
        return this;
    }

    /**
     * 
     * @param trace_id 使用指定的 trace_id 创建日志记录器实例
     * @returns 
     */
    useTraceId(trace_id: string): this {
        this.traceId = trace_id;
        return this;
    }

    /**
     * 
     * @param trace_id 使用指定的 trace_id 创建日志记录器实例
     * @returns 
     */
    getlogger(trace_id: string): this {
        this.traceId = trace_id;
        return this;
    }

    /**
     * 设置初始化 labels 和 metadatas，设置后，后续的日志都会追加对应信息
     * @param labels 
     * @param metadatas 
     * @returns 
     */
    config(labels: ILabel | undefined | null, metadatas: IMetadata | undefined | null): this {
        if (labels) {
            this.labels = labels;
            this.__initLabels = labels;
        }
        if (metadatas) {
            this.metadatas = metadatas;
            this.__initMetadatas = metadatas;
        }
        return this;
    }

    /**
     * 打印日志时，追加对应的 labels 和 metadatas，如果 调用了 useSingleAppendMode 再只生效一次
     * @param labels 
     * @param metadatas 
     * @returns 
     */
    append(labels: ILabel | undefined | null, metadatas: IMetadata | undefined | null): this {
        if (labels) {
            this.labels = {
                ...this.labels,
                ...labels
            };
            if (!this.isSingleAppendMode) {
                this.__initLabels = {
                    ...this.__initLabels,
                    ...labels
                };
            }
        }

        if (metadatas) {
            this.metadatas = {
                ...this.metadatas,
                ...metadatas
            };
            if (!this.isSingleAppendMode) {
                this.__initMetadatas = {
                    ...this.__initMetadatas,
                    ...labels
                };
            }
        }
        return this;
    }

    private clean(): void {
        if (this.isSingleAppendMode) {
            this.labels = {};
            this.config(this.__initLabels, this.__initMetadatas);
            this.useFile(this.scriptFileName);
        }
    }

    info(log_obj: any): void {
        this.log('INFO', this.traceId, this.labels, this.metadatas, log_obj);

        this.clean();
    }

    warn(log_obj: any): void {
        this.log('WARN', this.traceId, this.labels, this.metadatas, log_obj);

        this.clean();
    }

    error(log_obj: any): void {
        if (log_obj instanceof Error) {
            this.log('ERROR', this.traceId, this.labels, this.metadatas, JSON.parse(JSON.stringify(log_obj, Object.getOwnPropertyNames(log_obj))));
        } else {
            this.log('ERROR', this.traceId, this.labels, this.metadatas, log_obj);
        }

        this.clean();
    }

    debug(log_obj: any): void {
        this.log('DEBUG', this.traceId, this.labels, this.metadatas, log_obj);

        this.clean();
    }

    /**
     * 
     * @param words 增加敏感词列表
     * @returns 
     */
    addSensitiveWords(words: Array<string>): this {
        if (words.length === 0) {
            return this;
        }

        words.forEach(v => {
            if (sensitive_words.indexOf(v) === -1) {
                sensitive_words.push(v);
            }
        })

        return this;
    }

    private report_log(
        ts: number,
        level: LogLevel,
        labels: ILabel | undefined,
        metadatas: IMetadata | undefined,
        log_obj: any,
        callback: (data: string, err: Error | undefined | null) => void): void {

        if (!this.lokiUrl) {
            throw new Error(`Please set loki api push url first!`);
        }

        let _level = "info";
        let ext = '-';
        if (typeof level === typeof "" && level) {
            if (['info', 'warn', 'error', 'debug'].indexOf(level.toLowerCase()) !== -1) {
                _level = level.toLowerCase();
            }
            else {
                ext = level;
            }
        }

        let _ts = ts;
        let __labels = { ...labels };
        if (labels && labels.__timestamp__) {
            _ts = parseInt(labels.__timestamp__);
            delete __labels['__timestamp__'];
        }

        const logs = {
            streams: [
                {
                    stream: {
                        language: "NodeJS",
                        level: _level,
                        ext: ext,
                        file: __filename,
                        service_name: this.serviceName,
                        platform: os.platform(),
                        hostname: os.hostname(),
                        mac: getMacAddress(),
                        ...__labels
                    },
                    values: [{}]
                },
            ],
        };

        const values: any[] = [
            (_ts * 1000000).toString(),
            typeof log_obj === typeof {} ? JSON.stringify(log_obj) : `${log_obj}`,
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
        }).then(response => {
            if (callback) {
                callback(response.data, undefined);
            }

        }).catch(err => {
            if (callback) {
                callback('', err);
            }

            this.log('error', '', undefined, undefined, {
                info: 'report log to loki error',
                msg: err.message,
                stack: err.stack,
                logs
            }, false)
        })
    }

    private batch_report_log(
        logs: LogEntity[],
        callback: (data: string, err: Error | undefined | null) => void): void {

        if (!this.lokiUrl) {
            throw new Error(`Please set loki api push url first!`);
        }

        const logs_inserted = {
            streams: [{}]
        };
        logs_inserted.streams = [];

        const common_info = {
            platform: os.platform(),
            hostname: os.hostname(),
            mac: getMacAddress(),
            file: __filename,
            service_name: this.serviceName,
        }

        for (const log of logs) {

            const {
                ts,
                level,
                labels,
                metadatas,
                log_obj } = log;

            let _level = "info";
            let ext = '-';
            if (typeof level === typeof "" && level && ['info', 'warn', 'error', 'debug'].indexOf(level.toLowerCase()) !== -1) {
                _level = level.toLowerCase();
            }

            let _ts = ts;
            let _labels = { ...labels };
            if (labels && labels.__timestamp__) {
                _ts = parseInt(labels.__timestamp__);
                delete _labels['__timestamp__'];
            }

            const values: any[] = [
                (_ts * 1000000).toString(),
                typeof log_obj === typeof {} ? JSON.stringify(log_obj) : `${log_obj}`,
            ];

            if (typeof metadatas === typeof {} && metadatas) {
                values.push(metadatas);
            }

            const log_stream = {
                stream: {
                    level: _level,
                    ext: ext,
                    ..._labels,
                    ...common_info
                },
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
        }).then(response => {
            if (callback) {
                callback(response.data, undefined);
            }

        }).catch(err => {
            if (callback) {
                callback('', err);
            }

            this.log('error', '', undefined, undefined, {
                info: 'report log to loki error',
                msg: err.message,
                stack: err.stack,
                logs: logs_inserted
            }, false)
        })
    }

    // 新增异步队列
    private asyncLogsQueue: any[] = [];
    private isProcessing: boolean = false;

    private async processQueue() {
        if (this.isProcessing || this.asyncLogsQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        const perLogQueue: any[] = [];
        while (perLogQueue.length < 50 && this.asyncLogsQueue.length > 0) {
            perLogQueue.push(this.asyncLogsQueue.shift());
        }

        try {
            await new Promise((resolve) => {
                this.batch_report_log(perLogQueue, (data, err) => {
                    if (err) {
                        console.error('Report log error:', err);
                    }
                    resolve(data);
                });
            });
        } catch (error) {
            console.error('Queue processing error:', error);
        } finally {
            this.isProcessing = false;
            this.processQueue.call(this);
        }
    }

    private log(log_level: LogLevel, trace_id: string, labels: ILabel | undefined, metadatas: IMetadata | undefined, log_obj: any, is_report_log: boolean = true): void {
        const ts_bj = get_bj_time();

        let log_str = '';
        let _log_obj = desensitive(log_obj);

        if (typeof _log_obj === typeof {}) {
            log_str = JSON.stringify({
                ..._log_obj,
                __trace_id: trace_id,
                __labels: labels,
                __metadatas: metadatas
            });
        }
        else {
            log_str = `log=${_log_obj}`;
            log_str = `${log_str}\ttrace_id=${typeof trace_id === typeof '' ? trace_id : ''}`;
            log_str = `${log_str}\tlabels=${typeof labels === typeof {} && labels ? JSON.stringify(labels) : ''}`;
            log_str = `${log_str}\tmetadatas=${typeof metadatas === typeof {} && metadatas ? JSON.stringify(metadatas) : ''}`;
        }

        console.log(`${ts_bj}\t${log_level}\t${log_str && log_str.length > 150 ? (log_str.substring(0, 150) + '...') : log_str}`);

        if (!fs.existsSync(this.logPath)) {
            fs.mkdirSync(this.logPath, { recursive: true });
        }

        const log_file = this.getLogFileName();
        fs.appendFile(log_file, `${ts_bj}\t${log_level}\t${log_str}\n`, (err) => {
            if (err) {
                console.log(err);
            }
        })

        if (!is_report_log || !this.reportToLoki) {
            return;
        }

        let __metadatas: IMetadata = { trace_id: trace_id };

        if (metadatas && typeof metadatas === typeof {}) {
            __metadatas = {
                ...metadatas,
                ...__metadatas,
            }
        }

        // 将请求放入队列
        this.asyncLogsQueue.push({ ts: new Date().getTime(), level: log_level, labels, metadatas: __metadatas, log_obj: _log_obj });
        this.processQueue.call(this);
    }
}

function getMacAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        if (iface && iface.length > 0) {
            for (const config of iface) {
                if (!config.internal && config.mac !== '00:00:00:00:00:00') {
                    return config.mac;
                }
            }
        }
    }
    return '--';
}

interface ILabel {
    [key: string]: string
}

interface IMetadata {
    [key: string]: string
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function desensitive(log_obj: any): typeof log_obj {
    if (typeof log_obj === typeof '' && log_obj.length >= 100000) {
        return `[log too long]${log_obj.substring(0, 50)}...`;
    }

    let _log_obj = {};
    if (typeof log_obj === typeof '' && log_obj.indexOf('{') === -1) {
        return log_obj;
    } else if (typeof log_obj === typeof 0 || typeof log_obj === typeof true) {
        return log_obj;
    }
    else if (log_obj && typeof log_obj === typeof {}) {
        // 深拷贝
        _log_obj = JSON.parse(JSON.stringify(log_obj));
    } else {
        return try_parse_and_desensitive(log_obj);
    }

    replace_senitive_value(_log_obj);

    return _log_obj;
}

function replace_senitive_value(obj: any): void {
    if (typeof obj !== typeof {} || typeof obj === 'undefined' || obj === null) {
        return;
    }

    Object.keys(obj).forEach(k => {
        const v = obj[k];
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
    })
}

/**
 * 是否包含敏感词
 * @param {string} key 
 * @returns {boolean}
 */
function is_sensitive_key(key: string) {
    if (!key) {
        return false;
    }

    const lower_key = key.toLowerCase();
    for (let i = 0; i < sensitive_words.length; i++) {
        const w = sensitive_words[i].toLowerCase();
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
function try_parse_and_desensitive(str: string) {
    let desensitive_str = '';

    let results = parse_str(str);
    for (let i = 0; i < results.length; i++) {
        const l = results[i];
        if (l.is_json) {
            try {
                let v = JSON.parse(l.str);
                desensitive_str += JSON.stringify(desensitive(v));
            }
            catch (err) {
                // console.error(err);
                console.error(`[Error] ${err.message}. raw string is ` + l.str);

                desensitive_str += l.str;
            }
        } else {
            desensitive_str += l.str;
        }
    }
    return desensitive_str;
}

interface IParseResult {
    is_json: boolean,
    str: string, start:
    number,
    end: number
}

/**
 * 
 * @param {string} raw_str 
 * @returns {Array<IParseResult>}
 */
function parse_str(raw_str: string) {

    if (typeof raw_str !== typeof '') {
        return [];
    }

    let results: Array<IParseResult> = [];

    let start = -1, end = -1;
    let left = 0, right = 0;

    for (let i = 0; i < raw_str.length; i++) {
        const letter = raw_str[i];
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

            let json1 = raw_str.substring(start, end + 1);
            // console.log(json1);

            results.push({
                is_json: true,
                str: json1,
                start: start,
                end: end
            })

            start = -1;
            end = -1;
            left = 0;
            right = 0;
        }
    }

    let _final_result: Array<IParseResult> = [];

    if (results.length > 0) {
        for (let i = 0; i < results.length; i++) {
            const l = results[i];
            if (i > 0) {
                _final_result.push(results[i]);
                const ll = results[i - 1];
                if (l.start - 1 > ll.end) {
                    _final_result.push({
                        is_json: false,
                        str: raw_str.substring(ll.end + 1, l.start),
                        start: ll.end + 1,
                        end: l.start - 1
                    })
                }
            }
            else if (l.start > 0) {
                _final_result.push({
                    is_json: false,
                    str: raw_str.substring(0, l.start),
                    start: 0,
                    end: l.start - 1
                })
                _final_result.push(results[i]);
            }
            else {
                _final_result.push(results[i])
            }
        }

        const last = results[results.length - 1];
        if (last.end + 1 < raw_str.length) {
            _final_result.push({
                is_json: false,
                str: raw_str.substring(last.end + 1, raw_str.length),
                start: last.end + 1,
                end: raw_str.length
            })
        }
    }
    else {
        return [{
            is_json: false,
            str: raw_str,
            start: 0,
            end: raw_str ? raw_str.length - 1 : 0
        }]
    }

    // console.log(results)
    // console.log('--->')
    // console.log(_final_result);

    return _final_result;
}

interface LogEntity {
    ts: number,
    level: LogLevel,
    labels: ILabel | undefined,
    metadatas: IMetadata | undefined,
    log_obj: any,
}