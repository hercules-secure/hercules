

const initPatterns = () => {
    return {
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
      ]
    };
  }