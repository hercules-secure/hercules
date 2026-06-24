/**
 * Модуль анализа лицензий для SCA
 * Улучшенная версия с поддержкой Maven Central API и расширенным парсингом
 */

import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import { createHash } from 'crypto';

class LicenseAnalyzer {
    constructor(options = {}) {
        this.licenseCache = new Map();
        this.projectRoot = options.projectRoot || process.cwd();
        this.timeout = options.timeout || 8000;
        
        // Кэш для API запросов
        this.apiCache = new Map();
        
        // База знаний лицензий
        this.licenseDatabase = this.initLicenseDatabase();
        
        // Политики по умолчанию
        this.policies = options.licensePolicies || {
            forbidden: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
            restricted: ['LGPL-2.1', 'LGPL-3.0', 'MPL-2.0'],
            permitted: ['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC', 'Unlicense', 'CC0-1.0', 'EPL-2.0', 'CDDL-1.0']
        };
        
        // Маппинг популярных Go модулей
        this.knownGoLicenses = {
            'golang.org/x/': 'BSD-3-Clause',
            'go.uber.org/': 'MIT',
            'go.opentelemetry.io/': 'Apache-2.0',
            'gopkg.in/yaml.v2': 'Apache-2.0',
            'gopkg.in/yaml.v3': 'MIT',
            'github.com/gogo/': 'BSD-3-Clause',
            'github.com/golang/': 'BSD-3-Clause',
            'github.com/google/': 'BSD-3-Clause',
            'github.com/prometheus/': 'Apache-2.0',
            'github.com/grpc-ecosystem/': 'Apache-2.0',
            'github.com/coreos/': 'Apache-2.0',
            'github.com/stretchr/': 'MIT',
            'github.com/spf13/': 'MIT',
            'github.com/gin-gonic/': 'MIT',
        };
        
        // Маппинг популярных Maven компонентов (groupId -> license)
        this.knownMavenLicenses = {
            // Apache Foundation
            'org.apache.logging.log4j': 'Apache-2.0',
            'org.apache.logging': 'Apache-2.0',
            'org.apache.commons': 'Apache-2.0',
            'org.apache.httpcomponents': 'Apache-2.0',
            'org.apache.kafka': 'Apache-2.0',
            'org.apache.zookeeper': 'Apache-2.0',
            'org.apache.camel': 'Apache-2.0',
            'org.apache.spark': 'Apache-2.0',
            'org.apache.hadoop': 'Apache-2.0',
            
            // Spring
            'org.springframework': 'Apache-2.0',
            'org.springframework.boot': 'Apache-2.0',
            'org.springframework.security': 'Apache-2.0',
            'org.springframework.data': 'Apache-2.0',
            'org.springframework.cloud': 'Apache-2.0',
            
            // Bouncy Castle
            'org.bouncycastle': 'MIT',
            
            // PostgreSQL
            'org.postgresql': 'BSD-2-Clause',
            
            // MySQL
            'com.mysql': 'GPL-2.0',
            'mysql:mysql-connector-java': 'GPL-2.0',
            
            // Jackson
            'com.fasterxml.jackson.core': 'Apache-2.0',
            'com.fasterxml.jackson.datatype': 'Apache-2.0',
            'com.fasterxml.jackson.module': 'Apache-2.0',
            
            // Google
            'com.google.guava': 'Apache-2.0',
            'com.google.code.gson': 'Apache-2.0',
            'com.google.protobuf': 'BSD-3-Clause',
            'com.google.errorprone': 'Apache-2.0',
            
            // H2 Database
            'com.h2database': 'MPL-2.0',
            
            // Hibernate
            'org.hibernate': 'LGPL-2.1',
            'org.hibernate.validator': 'Apache-2.0',
            
            // JetBrains annotations
            'org.jetbrains': 'Apache-2.0',
            'org.jetbrains.kotlin': 'Apache-2.0',
            
            // SLF4J
            'org.slf4j': 'MIT',
            
            // JUnit
            'org.junit.jupiter': 'EPL-2.0',
            'org.junit.platform': 'EPL-2.0',
            'junit:junit': 'EPL-1.0',
            
            // Mockito
            'org.mockito': 'MIT',
            
            // AssertJ
            'org.assertj': 'Apache-2.0',
            
            // Lombok
            'org.projectlombok': 'MIT',
            
            // Netty
            'io.netty': 'Apache-2.0',
            
            // Undertow
            'io.undertow': 'Apache-2.0',
            
            // Elasticsearch
            'org.elasticsearch': 'Apache-2.0',
            
            // MongoDB
            'org.mongodb': 'Apache-2.0',
            
            // Redis
            'redis.clients': 'Apache-2.0',
            
            // Caffeine
            'com.github.ben-manes.caffeine': 'Apache-2.0',
            
            // AspectJ
            'org.aspectj': 'EPL-1.0',
            
            // JWT
            'io.jsonwebtoken': 'Apache-2.0',
        };
        
        // Специфичные маппинги для артефактов с нестандартной лицензией
        this.knownMavenArtifactLicenses = {
            'com.h2database:h2': 'MPL-2.0',
            'org.postgresql:postgresql': 'BSD-2-Clause',
            'org.bouncycastle:bcprov-jdk15on': 'MIT',
            'org.bouncycastle:bcpkix-jdk15on': 'MIT',
            'org.bouncycastle:bcutil-jdk15on': 'MIT',
            'commons-collections:commons-collections': 'Apache-2.0',
            'commons-io:commons-io': 'Apache-2.0',
            'commons-lang:commons-lang': 'Apache-2.0',
            'org.apache.commons:commons-lang3': 'Apache-2.0',
            'org.apache.commons:commons-text': 'Apache-2.0',
            'com.google.guava:guava': 'Apache-2.0',
            'com.fasterxml.jackson.core:jackson-databind': 'Apache-2.0',
            'com.fasterxml.jackson.core:jackson-core': 'Apache-2.0',
            'com.fasterxml.jackson.core:jackson-annotations': 'Apache-2.0',
            'org.yaml:snakeyaml': 'Apache-2.0',
            'org.apache.logging.log4j:log4j-core': 'Apache-2.0',
            'org.apache.logging.log4j:log4j-api': 'Apache-2.0',
        };
    }
    
    initLicenseDatabase() {
        return {
            'MIT': {
                name: 'MIT License',
                risk: 'LOW',
                commercial: true,
                requiresAttribution: true,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: false,
                color: '#2ecc71',
                description: 'Простая разрешительная лицензия'
            },
            'Apache-2.0': {
                name: 'Apache License 2.0',
                risk: 'LOW',
                commercial: true,
                requiresAttribution: true,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: true,
                color: '#2ecc71',
                description: 'Разрешительная лицензия с патентной оговоркой'
            },
            'BSD-2-Clause': {
                name: 'BSD 2-Clause License',
                risk: 'LOW',
                commercial: true,
                requiresAttribution: true,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: false,
                color: '#2ecc71',
                description: 'Простая разрешительная лицензия'
            },
            'BSD-3-Clause': {
                name: 'BSD 3-Clause License',
                risk: 'LOW',
                commercial: true,
                requiresAttribution: true,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: false,
                color: '#2ecc71',
                description: 'Разрешительная лицензия с запретом на использование имени'
            },
            'ISC': {
                name: 'ISC License',
                risk: 'LOW',
                commercial: true,
                requiresAttribution: true,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: false,
                color: '#2ecc71',
                description: 'Разрешительная лицензия, похожая на MIT'
            },
            'MPL-2.0': {
                name: 'Mozilla Public License 2.0',
                risk: 'MEDIUM',
                commercial: true,
                requiresAttribution: true,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: true,
                color: '#f39c12',
                description: 'Weak copyleft — требует открытия изменений в отдельных файлах'
            },
            'EPL-1.0': {
                name: 'Eclipse Public License 1.0',
                risk: 'MEDIUM',
                commercial: true,
                requiresAttribution: true,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: true,
                color: '#f39c12',
                description: 'Weak copyleft с патентной оговоркой'
            },
            'EPL-2.0': {
                name: 'Eclipse Public License 2.0',
                risk: 'MEDIUM',
                commercial: true,
                requiresAttribution: true,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: true,
                color: '#f39c12',
                description: 'Weak copyleft, более совместима с GPL'
            },
            'CDDL-1.0': {
                name: 'Common Development and Distribution License 1.0',
                risk: 'MEDIUM',
                commercial: true,
                requiresAttribution: true,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: true,
                color: '#f39c12',
                description: 'Weak copyleft, похожа на MPL'
            },
            'GPL-2.0': {
                name: 'GNU General Public License v2.0',
                risk: 'HIGH',
                commercial: false,
                requiresAttribution: true,
                requiresSourceDisclosure: true,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: false,
                color: '#e74c3c',
                description: 'Copyleft лицензия, требующая открытия кода'
            },
            'GPL-3.0': {
                name: 'GNU General Public License v3.0',
                risk: 'HIGH',
                commercial: false,
                requiresAttribution: true,
                requiresSourceDisclosure: true,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: true,
                color: '#e74c3c',
                description: 'Copyleft лицензия с патентной оговоркой'
            },
            'AGPL-3.0': {
                name: 'GNU Affero General Public License v3.0',
                risk: 'CRITICAL',
                commercial: false,
                requiresAttribution: true,
                requiresSourceDisclosure: true,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: true,
                color: '#c0392b',
                description: 'Сетевая copyleft лицензия — SaaS требует открытия кода'
            },
            'NOASSERTION': {
                name: 'No License Specified',
                risk: 'UNKNOWN',
                commercial: null,
                requiresAttribution: null,
                requiresSourceDisclosure: null,
                allowsDistribution: null,
                allowsModification: null,
                allowsPatentUse: null,
                color: '#95a5a6',
                description: 'Лицензия не указана — требуется юридическая проверка'
            }
        };
    }
    
    // ============ УЛУЧШЕННЫЕ МЕТОДЫ ДЛЯ MAVEN ============
    
    /**
     * Получение лицензии через Maven Central API (улучшенная версия)
     */
    async getLicenseFromMaven(component) {
        const [groupId, artifactId] = component.name.split(':');
        
        if (!groupId || !artifactId) {
            return { license: null, method: null };
        }
        
        // 1. Сначала проверяем известные маппинги
        const artifactKey = `${groupId}:${artifactId}`;
        if (this.knownMavenArtifactLicenses[artifactKey]) {
            const license = this.knownMavenArtifactLicenses[artifactKey];
            const normalized = this.normalizeLicenseName(license);
            if (normalized !== 'NOASSERTION') {
                return { license: normalized, method: 'maven_known_artifact' };
            }
        }
        
        // 2. Проверяем маппинг по groupId
        for (const [prefix, license] of Object.entries(this.knownMavenLicenses)) {
            if (groupId.startsWith(prefix)) {
                const normalized = this.normalizeLicenseName(license);
                if (normalized !== 'NOASSERTION') {
                    return { license: normalized, method: 'maven_known_group' };
                }
            }
        }
        
        // 3. Запрашиваем Maven Central API
        const searchUrl = `https://search.maven.org/solrsearch/select?q=g:${encodeURIComponent(groupId)}+AND+a:${encodeURIComponent(artifactId)}+AND+v:${encodeURIComponent(component.version)}&rows=1&wt=json`;
        const data = await this.fetchUrl(searchUrl);
        
        if (data) {
            try {
                const result = JSON.parse(data);
                const docs = result.response?.docs;
                
                if (docs && docs.length > 0) {
                    const doc = docs[0];
                    
                    // Пробуем license
                    if (doc.license) {
                        const normalized = this.normalizeLicenseName(doc.license);
                        if (normalized !== 'NOASSERTION') {
                            return { license: normalized, method: 'maven_central_api' };
                        }
                    }
                    
                    // Некоторые артефакты хранят лицензию в отдельном поле
                    if (doc.licenses) {
                        const licenses = typeof doc.licenses === 'string' ? doc.licenses.split(',') : [doc.licenses];
                        for (const lic of licenses) {
                            const normalized = this.normalizeLicenseName(lic);
                            if (normalized !== 'NOASSERTION') {
                                return { license: normalized, method: 'maven_central_api' };
                            }
                        }
                    }
                }
            } catch (e) {
                // Ошибка парсинга
            }
        }
        
        // 4. Пробуем получить полный POM файл
        const pomUrl = `https://repo1.maven.org/maven2/${groupId.replace(/\./g, '/')}/${artifactId}/${component.version}/${artifactId}-${component.version}.pom`;
        const pomContent = await this.fetchUrl(pomUrl);
        
        if (pomContent) {
            const license = this.parseLicenseFromPom(pomContent);
            if (license !== 'NOASSERTION') {
                return { license, method: 'maven_pom_parse' };
            }
        }
        
        return { license: null, method: null };
    }
    
    /**
     * Парсинг лицензии из POM файла
     */
    parseLicenseFromPom(pomContent) {
        if (!pomContent) return 'NOASSERTION';
        
        // Ищем тег <license>
        const licensePatterns = [
            /<license>\s*<name>([^<]+)<\/name>/i,
            /<licenses>\s*<license>\s*<name>([^<]+)<\/name>/i,
            /<project\.licenses\[0\]\.name>([^<]+)</i,
        ];
        
        for (const pattern of licensePatterns) {
            const match = pomContent.match(pattern);
            if (match) {
                const licenseName = match[1];
                const normalized = this.normalizeLicenseName(licenseName);
                if (normalized !== 'NOASSERTION') {
                    return normalized;
                }
            }
        }
        
        // Ищем SPDX идентификатор
        const spdxMatch = pomContent.match(/<license>\s*<spdxLicenseId>([^<]+)<\/spdxLicenseId>/i);
        if (spdxMatch) {
            const normalized = this.normalizeLicenseName(spdxMatch[1]);
            if (normalized !== 'NOASSERTION') {
                return normalized;
            }
        }
        
        return 'NOASSERTION';
    }
    
    /**
     * Получение лицензии через proxy.golang.org (улучшенная версия)
     */
    async getLicenseFromGoProxy(component) {
        // 1. Сначала проверяем известные маппинги
        const nameLicense = this.getLicenseByName(component.name);
        if (nameLicense) {
            const normalized = this.normalizeLicenseName(nameLicense);
            if (normalized !== 'NOASSERTION') {
                return { license: normalized, method: 'go_known_mapping' };
            }
        }
        
        // 2. Пробуем .mod файл
        const modUrl = `https://proxy.golang.org/${component.name}/@v/${component.version}.mod`;
        const modContent = await this.fetchUrl(modUrl);
        
        if (modContent) {
            // Ищем комментарий с лицензией
            const licenseMatch = modContent.match(/\/\/\s*(?:license|licence|SPDX-License-Identifier):\s*(\S+)/i);
            if (licenseMatch) {
                const normalized = this.normalizeLicenseName(licenseMatch[1]);
                if (normalized !== 'NOASSERTION') {
                    return { license: normalized, method: 'go_proxy_mod' };
                }
            }
            
            // Некоторые модули пишут license в поле module
            const moduleMatch = modContent.match(/^module\s+\S+\s*\/\/\s*(?:license|licence):\s*(\S+)/im);
            if (moduleMatch) {
                const normalized = this.normalizeLicenseName(moduleMatch[1]);
                if (normalized !== 'NOASSERTION') {
                    return { license: normalized, method: 'go_proxy_module' };
                }
            }
        }
        
        // 3. Пробуем найти файл LICENSE
        const licenseFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING'];
        
        for (const licenseFile of licenseFiles) {
            const fileUrl = `https://proxy.golang.org/${component.name}/@v/${component.version}/${licenseFile}`;
            const content = await this.fetchUrl(fileUrl);
            
            if (content) {
                const license = this.parseLicenseFromText(content);
                if (license !== 'NOASSERTION') {
                    return { license, method: 'go_proxy_file' };
                }
            }
        }
        
        return { license: null, method: null };
    }
    
    /**
     * Получение лицензии через PyPI (улучшенная версия)
     */
    async getLicenseFromPyPI(component) {
        const url = `https://pypi.org/pypi/${component.name}/${component.version}/json`;
        const data = await this.fetchUrl(url);
        
        if (data) {
            try {
                const pkg = JSON.parse(data);
                let license = pkg.info?.license;
                
                if (license && license !== 'UNKNOWN') {
                    const normalized = this.normalizeLicenseName(license);
                    if (normalized !== 'NOASSERTION') {
                        return { license: normalized, method: 'pypi_api' };
                    }
                }
                
                // Некоторые пакеты указывают классификатор
                const classifiers = pkg.info?.classifiers || [];
                for (const classifier of classifiers) {
                    if (classifier.includes('License :: OSI Approved ::')) {
                        const licenseName = classifier.split('::').pop().trim();
                        const normalized = this.normalizeLicenseName(licenseName);
                        if (normalized !== 'NOASSERTION') {
                            return { license: normalized, method: 'pypi_classifier' };
                        }
                    }
                }
            } catch (e) {
                // Ошибка парсинга JSON
            }
        }
        
        return { license: null, method: null };
    }
    
    /**
     * Получение лицензии через npm registry (улучшенная версия)
     */
    async getLicenseFromNpm(component) {
        const url = `https://registry.npmjs.org/${component.name}/${component.version}`;
        const data = await this.fetchUrl(url);
        
        if (data) {
            try {
                const pkg = JSON.parse(data);
                let license = pkg.license;
                
                if (license) {
                    if (typeof license === 'string') {
                        const normalized = this.normalizeLicenseName(license);
                        if (normalized !== 'NOASSERTION') {
                            return { license: normalized, method: 'npm_registry' };
                        }
                    } else if (license.type) {
                        const normalized = this.normalizeLicenseName(license.type);
                        if (normalized !== 'NOASSERTION') {
                            return { license: normalized, method: 'npm_registry' };
                        }
                    }
                }
                
                // Проверяем licenses (массив)
                if (pkg.licenses && pkg.licenses.length > 0) {
                    const license = pkg.licenses[0].type || pkg.licenses[0].name;
                    if (license) {
                        const normalized = this.normalizeLicenseName(license);
                        if (normalized !== 'NOASSERTION') {
                            return { license: normalized, method: 'npm_registry_array' };
                        }
                    }
                }
            } catch (e) {
                // Ошибка парсинга JSON
            }
        }
        
        return { license: null, method: null };
    }
    
    /**
     * Получение лицензии через crates.io (улучшенная версия)
     */
    async getLicenseFromCratesIo(component) {
        const url = `https://crates.io/api/v1/crates/${component.name}/${component.version}`;
        const data = await this.fetchUrl(url);
        
        if (data) {
            try {
                const pkg = JSON.parse(data);
                const license = pkg.versions?.[0]?.license;
                
                if (license) {
                    // crates.io может возвращать несколько лицензий через / или OR
                    const licenses = license.split(/[/ ]+OR[/ ]+/i);
                    // Берем наиболее разрешительную
                    const priority = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC'];
                    for (const prefLicense of priority) {
                        if (licenses.some(l => l.includes(prefLicense))) {
                            return { license: prefLicense, method: 'crates_io_api' };
                        }
                    }
                    const firstLicense = licenses[0];
                    const normalized = this.normalizeLicenseName(firstLicense);
                    if (normalized !== 'NOASSERTION') {
                        return { license: normalized, method: 'crates_io_api' };
                    }
                }
            } catch (e) {
                // Ошибка парсинга JSON
            }
        }
        
        return { license: null, method: null };
    }
    
    /**
     * Fallback: определение по имени модуля
     */
    getLicenseByName(moduleName) {
        for (const [prefix, license] of Object.entries(this.knownGoLicenses)) {
            if (moduleName.startsWith(prefix)) {
                return license;
            }
        }
        return null;
    }
    
    /**
     * HTTP запрос с таймаутом и ретраями
     */
    async fetchUrl(url, retries = 2) {
        if (this.apiCache.has(url)) {
            return this.apiCache.get(url);
        }
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            const result = await this._fetchUrlOnce(url);
            if (result !== null) {
                this.apiCache.set(url, result);
                return result;
            }
            // Ждем перед ретраем
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        return null;
    }
    
    _fetchUrlOnce(url) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve(null);
            }, this.timeout);
            
            const request = https.get(url, (res) => {
                // Обрабатываем редиректы
                if (res.statusCode === 301 || res.statusCode === 302) {
                    const redirectUrl = res.headers.location;
                    if (redirectUrl) {
                        clearTimeout(timeout);
                        request.destroy();
                        this._fetchUrlOnce(redirectUrl).then(resolve);
                        return;
                    }
                }
                
                let data = '';
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    clearTimeout(timeout);
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        resolve(null);
                    }
                });
            });
            
            request.on('error', () => {
                clearTimeout(timeout);
                resolve(null);
            });
            
            request.setTimeout(this.timeout, () => {
                request.destroy();
                resolve(null);
            });
        });
    }
    
    /**
     * Парсинг лицензии из текста файла (расширенный)
     */
    parseLicenseFromText(text) {
        if (!text) return 'NOASSERTION';
        
        const patterns = [
            { name: 'MIT', regex: /MIT\s+License|Permission is hereby granted, free of charge, to any person obtaining a copy/i, priority: 1 },
            { name: 'Apache-2.0', regex: /Apache\s+License\s+Version\s+2\.0|Licensed under the Apache License, Version 2\.0/i, priority: 1 },
            { name: 'BSD-3-Clause', regex: /Redistribution and use in source and binary forms, with or without modification.*?(?:Neither the name|contributors may be used)/is, priority: 1 },
            { name: 'BSD-2-Clause', regex: /Redistribution and use in source and binary forms, with or without modification.*?(?!Neither the name)/is, priority: 1 },
            { name: 'GPL-3.0', regex: /GNU\s+GENERAL\s+PUBLIC\s+LICENSE\s+Version\s+3/i, priority: 2 },
            { name: 'GPL-2.0', regex: /GNU\s+GENERAL\s+PUBLIC\s+LICENSE\s+Version\s+2/i, priority: 2 },
            { name: 'AGPL-3.0', regex: /GNU\s+AFFERO\s+GENERAL\s+PUBLIC\s+LICENSE\s+Version\s+3/i, priority: 2 },
            { name: 'ISC', regex: /ISC\s+License|Permission to use, copy, modify, and\/or distribute this software for any purpose/i, priority: 1 },
            { name: 'MPL-2.0', regex: /Mozilla\s+Public\s+License\s+Version\s+2\.0/i, priority: 2 },
            { name: 'EPL-2.0', regex: /Eclipse\s+Public\s+License\s+Version\s+2\.0/i, priority: 2 },
        ];
        
        // Сортируем по приоритету и находим первое совпадение
        const sorted = [...patterns].sort((a, b) => a.priority - b.priority);
        for (const pattern of sorted) {
            if (pattern.regex.test(text)) {
                return pattern.name;
            }
        }
        
        return 'NOASSERTION';
    }
    
    /**
     * Нормализация названия лицензии (расширенная)
     */
    normalizeLicenseName(license) {
        if (!license) return 'NOASSERTION';
        
        const licenseStr = String(license).trim().toUpperCase();
        
        const synonyms = {
            'MIT': ['MIT', 'MIT LICENSE', 'MIT LICENCE', 'EXPAT', 'MIT-0', 'MIT-STYLE'],
            'Apache-2.0': ['APACHE', 'APACHE-2.0', 'APACHE20', 'APACHE 2.0', 'APACHE2', 'APACHE-2', 'APACHE V2', 'APACHE 2'],
            'GPL-2.0': ['GPL-2.0', 'GPL2', 'GPL 2.0', 'GPLV2', 'GNU GENERAL PUBLIC LICENSE V2', 'GNU GENERAL PUBLIC LICENSE VERSION 2'],
            'GPL-3.0': ['GPL-3.0', 'GPL3', 'GPL 3.0', 'GPLV3', 'GNU GENERAL PUBLIC LICENSE V3', 'GNU GENERAL PUBLIC LICENSE VERSION 3'],
            'AGPL-3.0': ['AGPL-3.0', 'AGPL', 'AGPL3', 'AGPL 3.0', 'AFFERO GENERAL PUBLIC LICENSE'],
            'BSD-2-Clause': ['BSD-2-CLAUSE', 'BSD2', 'BSD 2-CLAUSE', 'SIMPLIFIED BSD', 'BSD 2-CLAUSE LICENSE', 'BSD-STYLE'],
            'BSD-3-Clause': ['BSD-3-CLAUSE', 'BSD3', 'BSD 3-CLAUSE', 'REVISED BSD', 'BSD', 'BSD LICENSE', '3-CLAUSE BSD'],
            'ISC': ['ISC', 'ISC LICENSE'],
            'MPL-2.0': ['MPL-2.0', 'MPL2', 'MOZILLA', 'MOZILLA PUBLIC LICENSE'],
            'EPL-1.0': ['EPL-1.0', 'EPL1', 'ECLIPSE PUBLIC LICENSE', 'ECLIPSE PUBLIC LICENSE - V 1.0'],
            'EPL-2.0': ['EPL-2.0', 'EPL2', 'ECLIPSE PUBLIC LICENSE 2.0'],
            'CDDL-1.0': ['CDDL-1.0', 'CDDL1', 'COMMON DEVELOPMENT AND DISTRIBUTION LICENSE'],
            'Unlicense': ['UNLICENSE', 'PUBLIC DOMAIN', 'UNLICENSED'],
            'CC0-1.0': ['CC0', 'CC0-1.0', 'CREATIVE COMMONS ZERO']
        };
        
        for (const [canonical, variants] of Object.entries(synonyms)) {
            if (variants.includes(licenseStr) || variants.some(v => licenseStr.includes(v))) {
                return canonical;
            }
        }
        
        return 'NOASSERTION';
    }
    
    /**
     * Получение информации о лицензии
     */
    getLicenseInfo(licenseName) {
        const normalized = this.normalizeLicenseName(licenseName);
        const info = this.licenseDatabase[normalized] || this.licenseDatabase['NOASSERTION'];
        
        return {
            ...info,
            originalName: licenseName,
            normalizedName: normalized
        };
    }
    
    /**
     * Проверка политик
     */
    checkPolicy(component, projectType = 'open_source') {
        const licenseInfo = this.getLicenseInfo(component.license);
        const violations = [];
        
        // Проверка на запрещенные лицензии
        if (this.policies.forbidden.includes(licenseInfo.normalizedName)) {
            violations.push({
                type: 'FORBIDDEN_LICENSE',
                severity: 'CRITICAL',
                message: `Компонент ${component.name} использует запрещенную лицензию ${licenseInfo.normalizedName}`,
                recommendation: 'Замените компонент на альтернативу с разрешительной лицензией'
            });
        } else if (this.policies.restricted.includes(licenseInfo.normalizedName)) {
            violations.push({
                type: 'RESTRICTED_LICENSE',
                severity: 'MEDIUM',
                message: `Компонент ${component.name} использует ограничительную лицензию ${licenseInfo.normalizedName}`,
                recommendation: 'Проверьте условия использования (требования к открытию измененных файлов)'
            });
        }
        
        // Для коммерческих проектов
        if (projectType === 'commercial' && licenseInfo.commercial === false) {
            violations.push({
                type: 'COMMERCIAL_RESTRICTION',
                severity: 'HIGH',
                message: `Компонент ${component.name} (${licenseInfo.normalizedName}) нельзя использовать в коммерческом проекте`,
                recommendation: 'Получите специальное разрешение или замените компонент'
            });
        }
        
        // Неизвестная лицензия
        if (licenseInfo.normalizedName === 'NOASSERTION') {
            violations.push({
                type: 'UNKNOWN_LICENSE',
                severity: 'MEDIUM',
                message: `У компонента ${component.name} не указана лицензия или не удалось определить`,
                recommendation: 'Проверьте лицензию вручную перед использованием'
            });
        }
        
        return violations;
    }
    
    /**
     * Анализ компонентов с автоматическим определением лицензий
     */
    async analyzeComponents(components, projectType = 'open_source') {
        const results = {
            timestamp: new Date().toISOString(),
            summary: {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                info: 0
            },
            components: [],
            violations: [],
            recommendations: [],
            detectionStats: {
                maven_known_artifact: 0,
                maven_known_group: 0,
                maven_central_api: 0,
                maven_pom_parse: 0,
                go_known_mapping: 0,
                go_proxy_mod: 0,
                go_proxy_file: 0,
                npm_registry: 0,
                pypi_api: 0,
                crates_io_api: 0,
                name_mapping: 0,
                none: 0
            }
        };
        
        for (const component of components) {
            results.summary.total++;
            
            // Определяем лицензию
            const detection = await this.detectLicense(component);
            const licenseInfo = this.getLicenseInfo(detection.license);
            
            // Обновляем статистику
            if (detection.detectionMethod) {
                results.detectionStats[detection.detectionMethod] = 
                    (results.detectionStats[detection.detectionMethod] || 0) + 1;
            }
            
            const violations = this.checkPolicy(
                { ...component, license: detection.license }, 
                projectType
            );
            
            const componentResult = {
                name: component.name,
                version: component.version,
                ecosystem: component.ecosystem,
                originalLicense: component.license || 'NOASSERTION',
                detectedLicense: detection.license,
                detectionMethod: detection.detectionMethod,
                normalizedLicense: licenseInfo.normalizedName,
                risk: licenseInfo.risk,
                commercial: licenseInfo.commercial,
                requiresAttribution: licenseInfo.requiresAttribution,
                requiresSourceDisclosure: licenseInfo.requiresSourceDisclosure,
                violations: violations.map(v => v.type),
                severity: violations.length > 0 ? violations[0].severity : 'NONE'
            };
            
            results.components.push(componentResult);
            
            for (const violation of violations) {
                results.violations.push({
                    ...violation,
                    component: component.name,
                    version: component.version,
                    ecosystem: component.ecosystem,
                    license: detection.license
                });
                
                switch (violation.severity) {
                    case 'CRITICAL': results.summary.critical++; break;
                    case 'HIGH': results.summary.high++; break;
                    case 'MEDIUM': results.summary.medium++; break;
                    case 'LOW': results.summary.low++; break;
                    default: results.summary.info++; break;
                }
            }
        }
        
        // Подсчет успешности определения
        const detected = results.summary.total - results.detectionStats.none;
        results.detectionSuccess = results.summary.total > 0 ? (detected / results.summary.total * 100).toFixed(1) : '100.0';
        
        // Генерация рекомендаций
        if (results.summary.critical > 0) {
            results.recommendations.push('КРИТИЧЕСКИЕ ПРОБЛЕМЫ: Немедленно замените компоненты с запрещенными лицензиями');
        }
        if (results.summary.high > 0) {
            results.recommendations.push('ВЫСОКИЙ РИСК: Проверьте совместимость лицензий с вашим проектом');
        }
        if (results.summary.medium > 0) {
            results.recommendations.push('СРЕДНИЙ РИСК: Уточните условия использования компонентов с ограничительными или неизвестными лицензиями');
        }
        if (parseFloat(results.detectionSuccess) < 90) {
            results.recommendations.push(`НИЗКИЙ УРОВЕНЬ ОБНАРУЖЕНИЯ (${results.detectionSuccess}%): Добавьте маппинги для неизвестных компонентов`);
        }
        
        return results;
    }
}

export { LicenseAnalyzer };