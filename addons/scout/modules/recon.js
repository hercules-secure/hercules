// addons/scout/analyzer/recon.js

import http from 'http';
import https from 'https';
import { URL } from 'url';

export async function testOpenPorts(hostname) {
    const findings = [];
    const portsToTest = [
        { port: 80, name: 'HTTP', risk: 'low', protocol: 'http' },
        { port: 443, name: 'HTTPS', risk: 'low', protocol: 'https' },
        { port: 8080, name: 'HTTP-alt', risk: 'medium', protocol: 'http' },
        { port: 8443, name: 'HTTPS-alt', risk: 'medium', protocol: 'https' },
        { port: 3000, name: 'Node.js/React', risk: 'medium', protocol: 'http' },
        { port: 5000, name: 'Flask/Node', risk: 'medium', protocol: 'http' },
        { port: 8000, name: 'Python/Django', risk: 'medium', protocol: 'http' }
    ];
    
    for (const service of portsToTest) {
        const isOpen = await testPort(hostname, service.port, service.protocol);
        if (isOpen) {
            findings.push({
                severity: service.risk,
                message: `Порт ${service.port} (${service.name}) открыт`,
                location: `${hostname}:${service.port}`,
                remediation: `Закройте порт ${service.port} на фаерволе, если он не нужен`
            });
        }
    }
    
    return { issues: findings, openPorts: findings.length };
}

function testPort(hostname, port, protocol) {
    return new Promise((resolve) => {
        const options = {
            hostname: hostname,
            port: port,
            path: '/',
            method: 'HEAD',
            timeout: 3000
        };
        
        const requester = protocol === 'https' ? https : http;
        const req = requester.request(options, (res) => {
            resolve(true);
        });
        
        req.on('error', () => {
            resolve(false);
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
        
        req.end();
    });
}

export async function scanS3Buckets(domain) {
    const findings = [];
    const cleanDomain = domain.split('.')[0];
    const bucketNames = [
        cleanDomain,
        `${cleanDomain}-assets`,
        `${cleanDomain}-static`,
        `${cleanDomain}-files`,
        `${cleanDomain}-data`,
        `${cleanDomain}-public`,
        `${cleanDomain}-backup`,
        `static-${cleanDomain}`,
        `assets-${cleanDomain}`,
        `cdn-${cleanDomain}`
    ];
    
    for (const bucketName of bucketNames) {
        const urls = [
            `https://${bucketName}.s3.amazonaws.com`,
            `https://s3.amazonaws.com/${bucketName}`
        ];
        
        for (const url of urls) {
            try {
                const isOpen = await checkUrl(url);
                if (isOpen) {
                    findings.push({
                        severity: 'critical',
                        message: `Открытый S3 бакет: ${bucketName}`,
                        location: url,
                        remediation: 'Сделайте бакет приватным, используйте bucket policies'
                    });
                }
            } catch (e) {}
        }
    }
    
    return { issues: findings, found: findings.length };
}

function checkUrl(urlString) {
    return new Promise((resolve) => {
        try {
            const parsedUrl = new URL(urlString);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname,
                method: 'HEAD',
                timeout: 3000
            };
            
            const req = protocol.request(options, (res) => {
                resolve(res.statusCode === 200);
            });
            
            req.on('error', () => {
                resolve(false);
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            
            req.end();
        } catch (e) {
            resolve(false);
        }
    });
}

function fetchApi(urlString) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new URL(urlString);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
                },
                timeout: 15000
            };
            
            const req = protocol.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    resolve(data);
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            
            req.end();
        } catch (error) {
            reject(error);
        }
    });
}

export async function scanSubdomains(domain) {
    const findings = [];
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const subdomainsList = [];
    const allSubdomainsSet = new Set();
    
    // Метод 1: HackerTarget API
    try {
        const apiUrl = `https://api.hackertarget.com/hostsearch/?q=${cleanDomain}`;
        const data = await fetchApi(apiUrl);
        if (data && data.trim() && !data.includes('API count exceeded')) {
            const lines = data.trim().split('\n');
            for (const line of lines) {
                if (line.trim() === '') continue;
                const parts = line.split(',');
                if (parts.length >= 1) {
                    let hostname = parts[0].trim();
                    let ip = parts.length > 1 ? parts[1].trim() : '-';
                    
                    if (hostname && hostname.includes(cleanDomain) && !hostname.startsWith('*')) {
                        if (!allSubdomainsSet.has(hostname)) {
                            allSubdomainsSet.add(hostname);
                            subdomainsList.push({ domain: hostname.toLowerCase(), ip: ip });
                        }
                    }
                }
            }
        }
    } catch (error) {}
    
    // Метод 2: CRT.sh (Certificate Transparency)
    try {
        const crtUrl = `https://crt.sh/?q=%.${cleanDomain}&output=json`;
        const data = await fetchApi(crtUrl);
        if (data && data.trim()) {
            let certs = [];
            try {
                let jsonData = data;
                if (data.startsWith(')]}\'')) {
                    jsonData = data.substring(4);
                }
                certs = JSON.parse(jsonData);
            } catch (e) {
                try {
                    const lines = data.split('\n');
                    for (const line of lines) {
                        if (line.trim() && !line.startsWith('<')) {
                            const parts = line.split(',');
                            if (parts.length > 4) {
                                const sub = parts[4]?.replace(/["']/g, '').trim();
                                if (sub && sub.includes(cleanDomain) && !sub.startsWith('*')) {
                                    if (!allSubdomainsSet.has(sub)) {
                                        allSubdomainsSet.add(sub);
                                        subdomainsList.push({ domain: sub, ip: '-' });
                                    }
                                }
                            }
                        }
                    }
                } catch (e2) {}
            }
            
            if (Array.isArray(certs)) {
                for (const cert of certs) {
                    let name = cert.name_value;
                    if (name) {
                        const names = name.split('\n');
                        for (const n of names) {
                            const sub = n.trim().toLowerCase();
                            if (sub && sub.includes(cleanDomain) && !sub.startsWith('*') && sub !== cleanDomain) {
                                if (!allSubdomainsSet.has(sub)) {
                                    allSubdomainsSet.add(sub);
                                    subdomainsList.push({ domain: sub, ip: '-' });
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {}
    
    // Метод 3: AlienVault OTX
    try {
        const otxUrl = `https://otx.alienvault.com/api/v1/indicators/domain/${cleanDomain}/passive_dns`;
        const data = await fetchApi(otxUrl);
        if (data) {
            const parsed = JSON.parse(data);
            if (parsed.passive_dns && Array.isArray(parsed.passive_dns)) {
                for (const record of parsed.passive_dns) {
                    const hostname = record.hostname;
                    if (hostname && hostname.includes(cleanDomain) && !hostname.startsWith('*')) {
                        if (!allSubdomainsSet.has(hostname)) {
                            allSubdomainsSet.add(hostname);
                            subdomainsList.push({ domain: hostname.toLowerCase(), ip: record.address || '-' });
                        }
                    }
                }
            }
        }
    } catch (error) {}
    
    // Метод 4: BufferOver.run
    try {
        const bufferUrl = `https://dns.bufferover.run/dns?q=.${cleanDomain}`;
        const data = await fetchApi(bufferUrl);
        if (data) {
            const parsed = JSON.parse(data);
            if (parsed.FDNS_A && Array.isArray(parsed.FDNS_A)) {
                for (const record of parsed.FDNS_A) {
                    let hostname = record;
                    if (typeof record === 'object') {
                        hostname = record.name || Object.values(record)[0];
                    }
                    if (hostname && typeof hostname === 'string' && hostname.includes(cleanDomain) && !hostname.startsWith('*')) {
                        if (!allSubdomainsSet.has(hostname)) {
                            allSubdomainsSet.add(hostname);
                            subdomainsList.push({ domain: hostname.toLowerCase(), ip: '-' });
                        }
                    }
                }
            }
        }
    } catch (error) {}
    
    // Метод 5: Расширенный список префиксов через DNS
    const commonPrefixes = [
        'www', 'mail', 'ftp', 'webmail', 'smtp', 'pop', 'pop3', 'imap', 'ns1', 'ns2', 'ns3',
        'cpanel', 'whm', 'webdisk', 'cpcalendars', 'cpcontacts', 'autodiscover', 'autoconfig',
        'api', 'rest', 'graphql', 'api2', 'api3', 'apiv1', 'apiv2', 'apiv3',
        'dev', 'staging', 'stage', 'test', 'testing', 'qa', 'uat', 'sandbox', 'demo', 'preprod',
        'development', 'beta', 'alpha', 'nightly', 'trunk', 'legacy',
        'admin', 'administrator', 'admin2', 'manage', 'manager', 'dashboard', 'panel', 'control',
        'console', 'operator', 'sysadmin', 'root', 'superuser', 'system',
        'm', 'mobile', 'mobi', 'wap', 'touch', 'mobile2', 'm2', 'mobileapi',
        'shop', 'store', 'market', 'marketplace', 'checkout', 'payment', 'pay', 'billing',
        'cart', 'order', 'orders', 'checkout2', 'payment2',
        'blog', 'news', 'forum', 'community', 'support', 'help', 'faq', 'docs', 'wiki',
        'knowledgebase', 'kb', 'download', 'downloads', 'upload', 'uploads', 'files', 'media',
        'cdn', 'static', 'assets', 'media2', 'img', 'images', 'css', 'js', 'fonts',
        'video', 'audio', 'stream', 'cache', 'res', 'resources',
        'analytics', 'stats', 'status', 'monitor', 'monitoring', 'health', 'healthcheck',
        'metrics', 'tracking', 'pixel', 'log', 'logs', 'report', 'reports',
        'auth', 'login', 'signin', 'signup', 'register', 'oauth', 'sso', 'saml', 'mfa',
        '2fa', 'security', 'secure', 'verify', 'validation',
        'db', 'mysql', 'postgres', 'mongo', 'redis', 'elastic', 'database', 'sql',
        'search', 'lookup', 'find', 'query', 'solr', 'elasticsearch',
        'webhook', 'hook', 'callback', 'notify', 'notification', 'alert', 'events',
        'remote', 'remote2', 'office', 'exchange', 'outlook', 'lync', 'lyncdiscover',
        'meet', 'conference', 'zoom', 'teams', 'slack', 'chat', 'messenger',
        'socket', 'websocket', 'ws', 'wss', 'push', 'streaming', 'live',
        'export', 'import', 'sync', 'backup', 'backups', 'archive', 'storage',
        'gateway', 'proxy', 'loadbalancer', 'lb', 'router', 'firewall',
        'cloud', 'aws', 'azure', 'gcp', 'google', 'amazon', 'microsoft'
    ];
    
    for (const prefix of commonPrefixes) {
        const subdomain = `${prefix}.${cleanDomain}`;
        if (!allSubdomainsSet.has(subdomain)) {
            try {
                const dnsUrl = `https://dns.google/resolve?name=${subdomain}&type=A`;
                const dnsData = await fetchApi(dnsUrl);
                if (dnsData) {
                    const parsed = JSON.parse(dnsData);
                    if (parsed.Answer && parsed.Answer.length > 0) {
                        const ip = parsed.Answer[0].data;
                        allSubdomainsSet.add(subdomain);
                        subdomainsList.push({ domain: subdomain, ip: ip });
                    }
                }
                await new Promise(r => setTimeout(r, 50));
            } catch (error) {}
        }
    }
    
    // Удаляем дубликаты
    const uniqueSubdomains = [];
    const seen = new Set();
    for (const sub of subdomainsList) {
        if (!seen.has(sub.domain)) {
            seen.add(sub.domain);
            uniqueSubdomains.push(sub);
        }
    }
    
    if (uniqueSubdomains.length > 0) {
        findings.push({
            severity: 'info',
            message: `Найдено ${uniqueSubdomains.length} субдоменов`,
            location: `https://api.hackertarget.com/hostsearch/?q=${cleanDomain}`,
            details: uniqueSubdomains.slice(0, 30).map(s => s.domain).join(', '),
            allSubdomains: uniqueSubdomains,
            remediation: 'Проверьте безопасность всех субдоменов'
        });
    }
    
    return { 
        issues: findings, 
        subdomains: uniqueSubdomains, 
        count: uniqueSubdomains.length 
    };
}