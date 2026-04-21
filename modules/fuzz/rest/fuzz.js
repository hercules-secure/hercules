import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';
import yaml from 'js-yaml';
import { createLogger, format, transports } from 'winston';
import StructureMutator from './structureMutator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = process.env.LOG_DIR || './logs';

// ==================== ЛОГГЕР ====================

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logger = createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }),
    new transports.File({ filename: path.join(LOG_DIR, 'combined.log') })
  ],
});

// ==================== КОНСТАНТЫ ====================

const DEFAULT_OPTIONS = {
  timeout: 5000,
  concurrency: 5,
  maxRetries: 2,
  retryDelay: 1000,
  maxResponseSize: 10 * 1024 * 1024,
  format: 'auto'
};

const INJECTION_PAYLOADS = [
  "' OR 1=1--",
  "<script>alert(1)</script>",
  "; ls -la;",
  "../../../../etc/passwd",
  "' UNION SELECT NULL--",
  "'; DROP TABLE users; --",
  "<img src=x onerror=alert(1)>",
  "${7*7}",
  "'; exec xp_cmdshell('dir'); --"
];

const LARGE_PAYLOAD_VARIANTS = [
  (size = 10000) => 'A'.repeat(size),
  (size = 20000) => 'B'.repeat(size),
  (size = 5000) => '%00'.repeat(size),
  (size = 3000) => '🔥'.repeat(size),
  (size = 10000) => 'A'.repeat(size) + '../'.repeat(1000),
  () => '{"a":' + '"A".repeat(5000)' + '}',
  (size = 1000) => Array(size).fill('x').join('')
];

const ID_BOUNDARY_VALUES = ['999999999999999999999', '-1', '0', '1e309', 'NaN', 'Infinity'];

const RETRYABLE_ERRORS = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'];

const EXPECTED_STATUS = {
  normal: [200, 201, 202, 204],
  injection: [400, 401, 403, 404, 422, 500],
  large: [400, 413, 500],
  mutation: [400, 422, 500],
  header_fuzzing: [400, 401, 403]
};

// ==================== ОСНОВНОЙ КЛАСС ====================

class APIFuzzer {
  constructor(swaggerFile, options = {}) {
    this.swaggerFile = swaggerFile;
    this.baseUrl = options.baseUrl || '';
    this.timeout = options.timeout || DEFAULT_OPTIONS.timeout;
    this.concurrency = options.concurrency || DEFAULT_OPTIONS.concurrency;
    this.maxRetries = options.maxRetries || DEFAULT_OPTIONS.maxRetries;
    this.retryDelay = options.retryDelay || DEFAULT_OPTIONS.retryDelay;
    this.maxResponseSize = options.maxResponseSize || DEFAULT_OPTIONS.maxResponseSize;
    this.format = options.format || DEFAULT_OPTIONS.format;
    
    this.results = [];
    this.spec = null;
    this.testCases = [];
    this.mutator = new StructureMutator();
    this.startTime = null;
    
    this._counters = this._initCounters();
  }

  _initCounters() {
    return {
      rateLimit: {},
      rateLimitRamp: {},
      injection: {},
      header: {},
      large: {},
      mutation: {},
      leak: {},
      resource: {},
      protocol: {},
      boundary: {},
      cache: {},
      timeout: {},
      encoding: {}
    };
  }

  // ==================== ЗАГРУЗКА СПЕЦИФИКАЦИИ ====================

  async loadSpec() {
    const ext = path.extname(this.swaggerFile).toLowerCase();
    const content = fs.readFileSync(this.swaggerFile, 'utf8');

    if (this.format === 'yaml' || ext === '.yaml' || ext === '.yml') {
      this.spec = yaml.load(content);
    } else if (this.format === 'json' || ext === '.json') {
      this.spec = JSON.parse(content);
    } else {
      try { 
        this.spec = JSON.parse(content); 
      } catch { 
        this.spec = yaml.load(content); 
      }
    }

    if (!this.spec.openapi && !this.spec.swagger) {
      throw new Error('Не валидная OpenAPI/Swagger спецификация');
    }

    return this.spec;
  }

  // ==================== РАБОТА СО СХЕМАМИ ====================

  resolveRef(ref) {
    if (!ref?.startsWith('#/')) return null;
    let current = this.spec;
    for (const part of ref.replace('#/', '').split('/')) {
      current = current?.[part];
    }
    return current;
  }

  generatePayload(schema) {
    if (!schema) return null;
    if (schema.$ref) return this.generatePayload(this.resolveRef(schema.$ref));
    if (schema.enum) return faker.helpers.arrayElement(schema.enum);

    switch (schema.type) {
      case 'string': return this._generateString(schema);
      case 'integer': return this._generateInteger(schema);
      case 'number': return this._generateNumber(schema);
      case 'boolean': return faker.datatype.boolean();
      case 'object': return this._generateObject(schema);
      case 'array': return this._generateArray(schema);
      default: return null;
    }
  }

  _generateString(schema) {
    if (schema.format === 'email') return faker.internet.email();
    if (schema.format === 'uuid') return faker.string.uuid();
    if (schema.format === 'date') return faker.date.past().toISOString().split('T')[0];
    if (schema.format === 'date-time') return faker.date.past().toISOString();
    if (schema.minLength && schema.maxLength) {
      const length = faker.number.int({ min: schema.minLength, max: Math.min(schema.maxLength, 100) });
      return faker.string.alphanumeric(length);
    }
    return faker.string.alphanumeric(8);
  }

  _generateInteger(schema) {
    if (schema.minimum && schema.maximum) {
      return faker.number.int({ min: schema.minimum, max: schema.maximum });
    }
    return faker.number.int({ min: 1, max: 1000 });
  }

  _generateNumber(schema) {
    if (schema.minimum && schema.maximum) {
      return faker.number.float({ min: schema.minimum, max: schema.maximum });
    }
    return faker.number.float({ min: 1, max: 1000 });
  }

  _generateObject(schema) {
    if (!schema.properties) return {};
    const obj = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      if (!schema.required || schema.required.includes(k) || Math.random() > 0.3) {
        obj[k] = this.generatePayload(v);
      }
    }
    return Object.keys(obj).length ? obj : { fuzz: faker.string.alphanumeric(6) };
  }

  _generateArray(schema) {
    const minItems = schema.minItems || 1;
    const maxItems = Math.min(schema.maxItems || 3, 5);
    const count = faker.number.int({ min: minItems, max: maxItems });
    return Array(count).fill().map(() => this.generatePayload(schema.items));
  }

  // ==================== URL ОБРАБОТКА ====================

  normalizeUrl(url) { 
    return url.replace(/([^:]\/)\/+/g, "$1"); 
  }

  interpolateUrl(url, params) {
    let result = url;
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, encodeURIComponent(String(v)));
    }
    return result;
  }

  // ==================== ЗАГОЛОВКИ ====================

  getHeaders(operation) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Hercules-Fuzzer/1.0'
    };
    
    const security = operation.security || this.spec.security || [];
    for (const scheme of security) {
      if (scheme.bearerAuth || scheme.apiKeyAuth) {
        headers['Authorization'] = 'Bearer test-token-12345';
      }
      if (scheme.apiKeyAuth?.in === 'header') {
        headers[scheme.apiKeyAuth.name || 'X-API-Key'] = 'test-api-key-12345';
      }
    }
    return headers;
  }

  _getMaliciousHeaders() {
    const headersList = [
      { 'X-Forwarded-For': '127.0.0.1, 192.168.1.1, 10.0.0.1', 'X-Real-IP': '0.0.0.0' },
      { 'X-HTTP-Method-Override': 'POST', 'X-Method-Override': 'DELETE' },
      { 'X-Original-URL': '/admin', 'X-Rewrite-URL': '/admin' },
      { 'X-Request-ID': '<script>alert(1)</script>', 'X-Request-Id': "' OR '1'='1" },
      { 'User-Agent': '"; DROP TABLE users; --', 'Referer': 'javascript:alert(1)' },
      { 'Origin': 'https://evil.com', 'Cookie': 'session=<script>alert(1)</script>' },
      { 'Authorization': 'Bearer <script>alert(1)</script>', 'Content-Type': 'application/xml' },
      { 'Accept': '../etc/passwd', 'Host': 'evil.com' },
      { 'X-API-Key': "' OR '1'='1", 'X-SSRF': 'http://169.254.169.254/latest/meta-data/' }
    ];
    return headersList[Math.floor(Math.random() * headersList.length)];
  }

  _getLargeHeaders() {
    const largeValue = 'A'.repeat(5000);
    return {
      'X-Large-Header': largeValue,
      'X-Buffer-Overflow': 'A'.repeat(10000),
      'X-Malicious': 'X'.repeat(4000) + '../'.repeat(500)
    };
  }

  generateHeaderVariants(baseHeaders) {
    return [
      { ...baseHeaders, ...this._getMaliciousHeaders() },
      { ...baseHeaders, ...this._getLargeHeaders() },
      { ...baseHeaders, 'X-Empty': '', 'X-Null': null },
      { ...baseHeaders, 'X-Duplicate': 'value1', 'X-Duplicate': 'value2' },
      { ...baseHeaders, 'X-Special': '!@#$%^&*()', 'X-Unicode': 'Привет мир 🎉' },
      { ...baseHeaders, 'X-Proto-Inject': 'HTTP/1.1 200 OK\r\n\r\n' },
      { ...baseHeaders, 'X-Path': '../../../../etc/passwd' },
      { ...baseHeaders, 'X-SQL': "' OR '1'='1' --" },
      { ...baseHeaders, 'X-SSRF': 'http://169.254.169.254/' }
    ];
  }

  // ==================== ГЕНЕРАЦИЯ PAYLOAD ====================

  generateNormalPayload(operation) {
    const result = { query: {}, path: {}, body: null };

    for (const param of operation.parameters || []) {
      const value = this.generatePayload(param.schema) ?? 'test';
      if (param.in === 'query') result.query[param.name] = value;
      if (param.in === 'path') result.path[param.name] = value;
      if (param.in === 'body' && param.schema) result.body = this.generatePayload(param.schema);
    }

    if (operation.requestBody) {
      const content = operation.requestBody.content;
      const jsonContent = content?.['application/json'] || content?.['application/merge-patch+json'];
      if (jsonContent?.schema) result.body = this.generatePayload(jsonContent.schema);
    }

    return result;
  }

  generateInjectionPayload(operation, basePathParams = {}) {
    const result = { query: {}, body: null, path: { ...basePathParams } };

    for (const param of operation.parameters || []) {
      const payload = faker.helpers.arrayElement(INJECTION_PAYLOADS);
      if (param.in === 'query') result.query[param.name] = payload;
      if (param.in === 'path') result.path[param.name] = payload;
    }

    // Используем StructureMutator для глубоких инъекций
    if (operation.requestBody || this._hasBodyParam(operation)) {
      const body = this.generateNormalPayload(operation).body;
      if (body && this.mutator) {
        const mutated = JSON.parse(JSON.stringify(body));
        this.mutator.recursiveInject(mutated, 'injection');
        result.body = mutated;
      } else if (body) {
        this._injectIntoObject(body, INJECTION_PAYLOADS);
        result.body = body;
      }
    }

    const hasData = Object.keys(result.query).length > 0 || 
                    Object.keys(result.path).length > 0 || 
                    result.body;
    return hasData ? result : null;
  }

  _hasBodyParam(operation) {
    if (operation.requestBody) return true;
    for (const param of operation.parameters || []) {
      if (param.in === 'body') return true;
    }
    return false;
  }

  _injectIntoObject(obj, injections) {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === 'string') {
        obj[k] = faker.helpers.arrayElement(injections);
      } else if (obj[k] && typeof obj[k] === 'object') {
        this._injectIntoObject(obj[k], injections);
      }
    }
  }

  generateLargePayload(operation) {
    const largeStr = faker.helpers.arrayElement(LARGE_PAYLOAD_VARIANTS)();
    const result = { query: {}, path: {}, body: null };

    for (const param of operation.parameters || []) {
      const isId = param.name.toLowerCase().includes('id');
      
      if (isId) {
        const val = faker.helpers.arrayElement(ID_BOUNDARY_VALUES);
        if (param.in === 'query') result.query[param.name] = val;
        if (param.in === 'path') result.path[param.name] = val;
        continue;
      }

      if (param.in === 'query') result.query[param.name] = largeStr;
      if (param.in === 'path') result.path[param.name] = largeStr;
    }

    // Используем StructureMutator для large payload
    if (operation.requestBody || this._hasBodyParam(operation)) {
      const base = this.generateNormalPayload(operation).body;
      if (base && this.mutator) {
        const mutated = JSON.parse(JSON.stringify(base));
        this.mutator.recursiveInject(mutated, 'large');
        result.body = mutated;
      } else if (base) {
        result.body = this._deepInjectLarge(base, largeStr);
      }
    }

    if (Object.keys(result.query).length === 0 && 
        Object.keys(result.path).length === 0 && !result.body) {
      return { query: {}, path: {}, body: largeStr };
    }

    return result;
  }

  _deepInjectLarge(obj, value, depth = 0) {
    if (depth > 5) return obj;
    if (typeof obj === 'string') return value;
    if (typeof obj === 'number') return 999999999;
    if (typeof obj === 'boolean') return true;
    if (Array.isArray(obj)) {
      return obj.map(item => this._deepInjectLarge(item, value, depth + 1));
    }
    if (typeof obj === 'object' && obj !== null) {
      const newObj = {};
      for (const key of Object.keys(obj)) {
        newObj[key] = this._deepInjectLarge(obj[key], value, depth + 1);
      }
      return newObj;
    }
    return obj;
  }

  generateMutationPayload(operation) {
    const base = this.generateNormalPayload(operation);
    
    if (!base) {
      return { query: {}, path: {}, body: this._randomJunk() };
    }
    
    let mutatedBody = base.body;
    
    // Используем StructureMutator для продвинутой мутации
    if (base.body && this.mutator) {
      try {
        mutatedBody = this.mutator.mutateObjectExtreme(
          JSON.parse(JSON.stringify(base.body))
        );
      } catch (e) {
        mutatedBody = this._mutateObject(base.body);
      }
    } else if (base.body) {
      mutatedBody = this._mutateObject(base.body);
    }
    
    return {
      query: this._mutateObject(base.query),
      path: this._mutateObject(base.path),
      body: mutatedBody || this._randomJunk()
    };
  }

  _mutateObject(obj, depth = 0) {
    if (depth > 5) return obj;
    const actions = ['delete', 'nullify', 'typeChange', 'duplicate', 'random', 'overflow', 'empty'];
    const pick = () => faker.helpers.arrayElement(actions);

    if (Array.isArray(obj)) {
      return obj.map(x => this._mutateObject(x, depth + 1));
    }
    if (typeof obj !== 'object' || obj === null) {
      return this._randomJunk();
    }

    const newObj = {};
    for (const key of Object.keys(obj)) {
      switch (pick()) {
        case 'delete': continue;
        case 'nullify': newObj[key] = null; break;
        case 'typeChange': newObj[key] = this._changeType(obj[key]); break;
        case 'duplicate': newObj[key] = [obj[key], obj[key]]; break;
        case 'random': newObj[key] = this._randomJunk(); break;
        case 'overflow': newObj[key] = 'A'.repeat(10000); break;
        case 'empty': newObj[key] = ''; break;
        default: newObj[key] = this._mutateObject(obj[key], depth + 1);
      }
    }

    if (Math.random() > 0.7) newObj['__proto__'] = { polluted: true };
    if (Math.random() > 0.7) newObj.unexpected_field = this._randomJunk();

    return newObj;
  }

  _changeType(value) {
    if (typeof value === 'string') return 123;
    if (typeof value === 'number') return 'string_instead_of_number';
    if (typeof value === 'boolean') return 'true';
    return '???';
  }

  _randomJunk() {
    return faker.helpers.arrayElement([
      '<script>alert(1)</script>', "' OR 1=1--", '../../../../etc/passwd',
      '', '🔥🔥🔥', null, 999999999, {}, [], true, false, 'null', 'undefined', 'NaN', 'Infinity'
    ]);
  }

  // ==================== ГЕНЕРАЦИЯ ТЕСТОВ ====================

  generateRateLimitTests(operation) {
    const { baseUrl, path: pathUrl, method } = operation;
    const testCases = [];

    for (let i = 0; i < 100; i++) {
      testCases.push({
        id: `${method}_${pathUrl}_rate_rapid_${i}`,
        method, url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
        path: pathUrl, type: 'rate_limit_rapid', delay: 0,
        expectedStatus: [200, 429, 503]
      });
    }

    const delays = [100, 50, 25, 10, 5, 2, 1, 0];
    delays.forEach((delay, i) => {
      testCases.push({
        id: `${method}_${pathUrl}_rate_ramp_${i}`,
        method, url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
        path: pathUrl, type: 'rate_limit_ramp',
        delay, burstSize: 10, expectedStatus: [200, 429, 503]
      });
    });

    return testCases;
  }

  generateTestCases() {
    const testCases = [];
    const paths = this.spec.paths || {};

    for (const [pathUrl, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

        const fullUrl = this.normalizeUrl(`${this.baseUrl}${pathUrl}`);
        const params = this._extractParams(operation);
        const normal = this.generateNormalPayload(operation);
        const baseHeaders = { ...this.getHeaders(operation), ...params.header };
        
        operation.path = pathUrl;
        operation.method = method;
        operation.baseUrl = this.baseUrl;

        // Normal тест
        testCases.push(this._createTestCase({
          id: `${method}_${pathUrl}_normal`, method, url: this.interpolateUrl(fullUrl, params.path),
          path: pathUrl, type: 'normal', queryParams: params.query, headers: baseHeaders,
          body: normal.body, expectedStatus: EXPECTED_STATUS.normal
        }));

        // Header фаззинг
        this.generateHeaderVariants(baseHeaders).forEach((headers, idx) => {
          testCases.push(this._createTestCase({
            id: `${method}_${pathUrl}_headers_${idx}`, method, url: this.interpolateUrl(fullUrl, params.path),
            path: pathUrl, type: 'header_fuzzing', queryParams: params.query,
            headers, body: normal.body, expectedStatus: EXPECTED_STATUS.header_fuzzing,
            headerPayload: headers
          }));
        });

        // Injection тесты (с мутатором)
        const injection = this.generateInjectionPayload(operation, params.path);
        if (injection) {
          testCases.push(this._createTestCase({
            id: `${method}_${pathUrl}_injection`, method, url: this.interpolateUrl(fullUrl, injection.path),
            path: pathUrl, type: 'injection', queryParams: injection.query,
            headers: baseHeaders, body: injection.body, expectedStatus: EXPECTED_STATUS.injection,
            injectionPayload: injection
          }));
        }

        // Large тесты (с мутатором)
        const large = this.generateLargePayload(operation);
        if (large) {
          testCases.push(this._createTestCase({
            id: `${method}_${pathUrl}_large`, method, url: this.interpolateUrl(fullUrl, params.path),
            path: pathUrl, type: 'large', queryParams: large.query,
            headers: baseHeaders, body: large.body, expectedStatus: EXPECTED_STATUS.large,
            largePayload: large
          }));
        }

        // Mutation тесты (с мутатором)
        const mutation = this.generateMutationPayload(operation);
        if (mutation) {
          testCases.push(this._createTestCase({
            id: `${method}_${pathUrl}_mutation`, method, url: this.interpolateUrl(fullUrl, mutation.path),
            path: pathUrl, type: 'mutation', queryParams: mutation.query,
            headers: baseHeaders, body: mutation.body, expectedStatus: EXPECTED_STATUS.mutation,
            mutationPayload: mutation
          }));
        }

        testCases.push(...this.generateRateLimitTests(operation));
      }
    }

    this.testCases = testCases;
    logger.info(`Сгенерировано ${testCases.length} тестов (с использованием StructureMutator)`);
    return testCases;
  }

  _extractParams(operation) {
    const params = { path: {}, query: {}, header: {} };
    for (const param of operation.parameters || []) {
      const value = this.generatePayload(param.schema) ?? (param.required ? 'test' : null);
      if (value !== null && param.in) {
        params[param.in][param.name] = value;
      }
    }
    return params;
  }

  _createTestCase(data) {
    return {
      ...data,
      operation: data.operation || `${data.method}_${data.path.replace(/\//g, '_')}`,
      timestamp: new Date().toISOString()
    };
  }

  // ==================== ВЫПОЛНЕНИЕ ТЕСТОВ ====================

  async executeWithRetry(testCase, retryCount = 0) {
    try {
      return await this._executeRequest(testCase);
    } catch (error) {
      if (retryCount < this.maxRetries && RETRYABLE_ERRORS.includes(error.code)) {
        logger.debug(`Retrying ${testCase.id}, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.executeWithRetry(testCase, retryCount + 1);
      }
      throw error;
    }
  }

  async _executeRequest(testCase) {
    const startTime = Date.now();
    let response = null, error = null;

    try {
      const config = {
        method: testCase.method,
        url: testCase.url,
        timeout: this.timeout,
        headers: testCase.headers,
        validateStatus: () => true,
        maxContentLength: this.maxResponseSize,
        maxBodyLength: this.maxResponseSize,
        decompress: true
      };

      if (testCase.queryParams && Object.keys(testCase.queryParams).length > 0) {
        config.params = testCase.queryParams;
      }
      if (testCase.body) config.data = testCase.body;

      response = await axios(config);
    } catch (err) {
      logger.error('Fuzz error:', err.message);
      error = err;
    }

    const duration = Date.now() - startTime;
    const responseData = this._extractResponseData(response);
    const payload = this._extractPayload(testCase);

    return {
      ...testCase,
      status: response?.status || 0,
      statusText: response?.statusText || error?.code || 'ERROR',
      duration,
      responseSize: responseData?.length || 0,
      responseData,
      error: error?.message,
      timestamp: new Date().toISOString(),
      success: this._isSuccess(response?.status, testCase),
      vulnerabilities: this._detectVulnerabilities(testCase, response),
      payload
    };
  }

  _extractResponseData(response) {
    if (!response?.data) return null;
    try {
      const dataStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      return dataStr.substring(0, 1000);
    } catch {
      return '[Unable to stringify response]';
    }
  }

  _extractPayload(testCase) {
    if (testCase.injectionPayload) return testCase.injectionPayload;
    if (testCase.largePayload) return testCase.largePayload;
    if (testCase.mutationPayload) return testCase.mutationPayload;
    if (testCase.headerPayload) return testCase.headerPayload;
    if (testCase.body || testCase.queryParams) {
      return { body: testCase.body, query: testCase.queryParams, headers: testCase.headers };
    }
    return null;
  }

  _isSuccess(status, testCase) {
    const expected = EXPECTED_STATUS[testCase.type] || [];
    return expected.includes(status);
  }

  // ==================== ОБНАРУЖЕНИЕ УЯЗВИМОСТЕЙ ====================

  _detectVulnerabilities(testCase, response) {
    const vulns = [];
    const resp = response?.data ? JSON.stringify(response.data) : '';
    const status = response?.status || 0;

    if (testCase.type === 'injection') {
      vulns.push(...this._checkInjectionVulnerabilities(testCase, resp, status));
    }

    if (testCase.type === 'header_fuzzing') {
      vulns.push(...this._checkHeaderVulnerabilities(testCase, resp, status));
    }

    if (testCase.type === 'large' && status === 500) {
      vulns.push(this._createVulnerability('DoS via Large Payload', 'high', testCase, resp, 'Server crashed on large payload'));
    }

    if (testCase.type === 'mutation' && status === 500) {
      vulns.push(this._createVulnerability('Crash via Structure Mutation', 'high', testCase, resp, 'Server crashed on malformed structure'));
    }

    if (resp.includes('password') || resp.includes('token') || resp.includes('secret')) {
      vulns.push(this._createVulnerability('Potential Data Leak', 'high', testCase, resp, resp.substring(0, 200)));
    }

    if (testCase.type === 'rate_limit_rapid') {
      const rapidVuln = this._checkRateLimitRapid(testCase, status);
      if (rapidVuln) vulns.push(rapidVuln);
    }

    return vulns;
  }

  _checkInjectionVulnerabilities(testCase, resp, status) {
    const vulns = [];
    const key = `${testCase.path}_${testCase.method}`;
    
    if (!this._counters.injection[key]) {
      this._counters.injection[key] = { sql: false, xss: false, cmd: false, pathTraversal: false };
    }

    const patterns = {
      sql: /SQL syntax|mysql_fetch|ORA-\d{5}|PostgreSQL|SQLite|syntax error|unclosed quotation/i,
      xss: /<script>|alert\(|onerror=|javascript:|onload=/i,
      cmd: /uid=|root:|etc\/passwd|win\.ini|C:\\Windows/i,
      pathTraversal: /\.\.\/|root\.txt|passwd|\.\.\\/i
    };

    if (patterns.sql.test(resp) && !this._counters.injection[key].sql) {
      this._counters.injection[key].sql = true;
      vulns.push(this._createVulnerability('SQL Injection', 'critical', testCase, resp, resp.substring(0, 200)));
    }
    if (patterns.xss.test(resp) && !this._counters.injection[key].xss) {
      this._counters.injection[key].xss = true;
      vulns.push(this._createVulnerability('XSS', 'high', testCase, resp, resp.substring(0, 200)));
    }
    if (patterns.cmd.test(resp) && !this._counters.injection[key].cmd) {
      this._counters.injection[key].cmd = true;
      vulns.push(this._createVulnerability('Command Injection', 'critical', testCase, resp, resp.substring(0, 200)));
    }
    if (patterns.pathTraversal.test(resp) && !this._counters.injection[key].pathTraversal) {
      this._counters.injection[key].pathTraversal = true;
      vulns.push(this._createVulnerability('Path Traversal', 'high', testCase, resp, resp.substring(0, 200)));
    }

    return vulns;
  }

  _checkHeaderVulnerabilities(testCase, resp, status) {
    const vulns = [];
    const key = `${testCase.path}_${testCase.method}_header`;
    
    if (!this._counters.header[key]) {
      this._counters.header[key] = { crashes: 0, reflections: 0, authBypasses: 0 };
    }

    if (status === 500 && this._counters.header[key].crashes++ === 0) {
      vulns.push(this._createVulnerability('Header Injection - Server Crash', 'high', testCase, resp, 'Server crashed on malicious headers'));
    }

    if (testCase.headers && (
        resp.includes(testCase.headers['User-Agent']) || 
        resp.includes(testCase.headers['Referer']))) {
      if (this._counters.header[key].reflections++ === 0) {
        vulns.push(this._createVulnerability('Header Reflection', 'medium', testCase, resp, resp.substring(0, 200)));
      }
    }

    return vulns;
  }

  _checkRateLimitRapid(testCase, status) {
    const key = `${testCase.path}_${testCase.method}_rapid`;
    
    if (!this._counters.rateLimit[key]) {
      this._counters.rateLimit[key] = { success: 0, total: 0, endpoint: testCase.path, method: testCase.method };
    }

    this._counters.rateLimit[key].total++;
    if (status === 200) this._counters.rateLimit[key].success++;

    if (this._counters.rateLimit[key].total === 10) {
      const { success, endpoint, method } = this._counters.rateLimit[key];
      delete this._counters.rateLimit[key];
      
      if (success >= 8) {
        return this._createVulnerability('Missing Rate Limiting', 'medium', testCase, '', 
          `${success} successful requests out of 10 without rate limiting`);
      }
    }
    return null;
  }

  _createVulnerability(type, severity, testCase, snippet, message) {
    return {
      type, severity,
      endpoint: testCase.path,
      method: testCase.method,
      payload: testCase.payload,
      response_status: testCase.status,
      snippet: snippet.substring(0, 200),
      message
    };
  }

  // ==================== ЗАПУСК И ОТЧЕТЫ ====================

  async run() {
    this._counters = this._initCounters();
    this.startTime = Date.now();
    this.results = [];
    
    await this.loadSpec();
    this.generateTestCases();

    const concurrencyLimit = Math.min(this.concurrency, this.testCases.length);
    let currentIndex = 0;
    
    const workers = Array(concurrencyLimit).fill().map(() => this._runWorker(() => currentIndex++));
    await Promise.all(workers);

    return this.getReport();
  }

  async _runWorker(getNextIndex) {
    while (true) {
      const index = getNextIndex();
      if (index >= this.testCases.length) break;
      
      const tc = this.testCases[index];
      try {
        const res = await this.executeWithRetry(tc);
        this.results.push(res);
      } catch (error) {
        logger.error(`Failed ${tc.id}: ${error.message}`);
        this.results.push({ ...tc, status: 0, error: error.message, success: false, timestamp: new Date().toISOString() });
      }
    }
  }

  getReport() {
    const byEndpoint = {};
    const allVulnerabilities = [];
    const failedTests = [];

    for (const r of this.results) {
      if (!byEndpoint[r.path]) {
        byEndpoint[r.path] = { total: 0, vulnerabilities: 0, methods: {} };
      }
      
      byEndpoint[r.path].total++;
      
      const vulnsCount = r.vulnerabilities?.length || 0;
      byEndpoint[r.path].vulnerabilities += vulnsCount;

      if (!byEndpoint[r.path].methods[r.method]) {
        byEndpoint[r.path].methods[r.method] = { total: 0, vulnerabilities: 0 };
      }
      byEndpoint[r.path].methods[r.method].total++;
      byEndpoint[r.path].methods[r.method].vulnerabilities += vulnsCount;

      if (!r.success) {
        failedTests.push({
          endpoint: r.path, method: r.method, type: r.type,
          status: r.status, error: r.error, duration: r.duration,
          payload: r.payload, response: r.responseData, timestamp: r.timestamp
        });
      }

      if (r.vulnerabilities?.length) {
        allVulnerabilities.push(...r.vulnerabilities);
      }
    }

    const uniqueVulnerabilities = this._deduplicateVulnerabilities(allVulnerabilities);
    const uniqueFailedTests = this._deduplicateFailedTests(failedTests);

    return {
      success: true,
      message: 'Фаззинг тестирование завершено',
      summary: {
        total: this.results.length,
        success: this.results.filter(r => r.success).length,
        failed: this.results.filter(r => !r.success).length,
        duration: (Date.now() - this.startTime) / 1000,
        concurrency: this.concurrency,
        timeout: this.timeout,
        endpoints_tested: Object.keys(byEndpoint).length
      },
      byEndpoint,
      vulnerabilities: uniqueVulnerabilities,
      failedTests: uniqueFailedTests,
      timestamp: new Date().toISOString(),
      spec: {
        title: this.spec.info?.title || 'Unknown',
        version: this.spec.info?.version || 'Unknown',
        endpoints: Object.keys(this.spec.paths || {}).length
      }
    };
  }

  _deduplicateVulnerabilities(vulnerabilities) {
    const uniqueMap = new Map();
    for (const vuln of vulnerabilities) {
      const key = `${vuln.endpoint}_${vuln.method}_${vuln.type}_${vuln.severity}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...vuln, count: 1, first_seen: vuln.timestamp, last_seen: vuln.timestamp });
      } else {
        const existing = uniqueMap.get(key);
        existing.count++;
        existing.last_seen = vuln.timestamp;
      }
    }
    return Array.from(uniqueMap.values()).map(v => ({ ...v, duplicate_count: v.count - 1 }));
  }

  _deduplicateFailedTests(failedTests) {
    const uniqueMap = new Map();
    for (const test of failedTests) {
      const key = `${test.endpoint}_${test.method}_${test.type}_${test.status}_${test.error || 'no_error'}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...test, count: 1 });
      } else {
        uniqueMap.get(key).count++;
      }
    }
    return Array.from(uniqueMap.values()).map(t => ({ ...t, duplicate_count: t.count - 1 }));
  }

  saveReport(file) {
    const report = this.getReport();
    const ext = path.extname(file).toLowerCase();
    const content = (ext === '.yaml' || ext === '.yml') 
      ? yaml.dump(report, { indent: 2, lineWidth: -1, noRefs: true })
      : JSON.stringify(report, null, 2);
    fs.writeFileSync(file, content, 'utf8');
    return report;
  }
}

export default APIFuzzer;