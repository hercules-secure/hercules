/**
 * Модуль анализа лицензий для SCA
 * Подключается к основному скрипту через import
 */

class LicenseAnalyzer {
    constructor(options = {}) {
        this.licenseCache = new Map();
        this.licenseViolations = [];
        
        // База знаний лицензий
        this.licenseDatabase = this.initLicenseDatabase();
        
        // Политики по умолчанию
        this.policies = options.licensePolicies || {
            forbidden: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
            restricted: ['LGPL-2.1', 'LGPL-3.0', 'MPL-2.0'],
            permitted: ['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC', 'Unlicense', 'CC0-1.0']
        };
        
        this.priorityMap = {
            'AGPL-3.0': 10,
            'GPL-3.0': 9,
            'GPL-2.0': 8,
            'LGPL-3.0': 7,
            'LGPL-2.1': 6,
            'MPL-2.0': 5,
            'Apache-2.0': 3,
            'BSD-3-Clause': 2,
            'BSD-2-Clause': 2,
            'MIT': 1,
            'ISC': 1
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
                description: 'Разрешительная лицензия с патентной оговоркой'
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
                description: 'Сетевая copyleft лицензия - SaaS требует открытия кода'
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
                description: 'Разрешительная лицензия, похожая на MIT'
            },
            'LGPL-2.1': {
                name: 'GNU Lesser General Public License v2.1',
                risk: 'MEDIUM',
                commercial: true,
                requiresAttribution: true,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: false,
                description: 'Copyleft с исключением для динамической линковки'
            },
            'LGPL-3.0': {
                name: 'GNU Lesser General Public License v3.0',
                risk: 'MEDIUM',
                commercial: true,
                requiresAttribution: true,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: true,
                description: 'Copyleft с исключением для динамической линковки'
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
                description: 'Weak copyleft, только измененные файлы'
            },
            'Unlicense': {
                name: 'The Unlicense',
                risk: 'LOW',
                commercial: true,
                requiresAttribution: false,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: false,
                description: 'Public domain dedication'
            },
            'CC0-1.0': {
                name: 'Creative Commons Zero v1.0',
                risk: 'LOW',
                commercial: true,
                requiresAttribution: false,
                requiresSourceDisclosure: false,
                allowsDistribution: true,
                allowsModification: true,
                allowsPatentUse: false,
                description: 'Public domain'
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
                description: 'Лицензия не указана - требуется юридическая проверка'
            }
        };
    }
    
    normalizeLicenseName(license) {
        if (!license) return 'NOASSERTION';
        
        const licenseStr = String(license).trim().toUpperCase();
        
        const synonyms = {
            'MIT': ['MIT', 'MIT LICENSE', 'MIT LICENCE', 'EXPAT'],
            'Apache-2.0': ['APACHE', 'APACHE-2.0', 'APACHE20', 'APACHE 2.0', 'APACHE2'],
            'GPL-2.0': ['GPL-2.0', 'GPL2', 'GPL 2.0', 'GPLV2'],
            'GPL-3.0': ['GPL-3.0', 'GPL3', 'GPL 3.0', 'GPLV3'],
            'AGPL-3.0': ['AGPL-3.0', 'AGPL', 'AGPL3', 'AGPL 3.0'],
            'BSD-2-Clause': ['BSD-2-CLAUSE', 'BSD2', 'BSD 2-CLAUSE', 'SIMPLIFIED BSD'],
            'BSD-3-Clause': ['BSD-3-CLAUSE', 'BSD3', 'BSD 3-CLAUSE', 'REVISED BSD'],
            'ISC': ['ISC'],
            'LGPL-2.1': ['LGPL-2.1', 'LGPL21', 'LGPL 2.1', 'LESSER GPL'],
            'LGPL-3.0': ['LGPL-3.0', 'LGPL3', 'LGPL 3.0'],
            'MPL-2.0': ['MPL-2.0', 'MPL2', 'MOZILLA'],
            'Unlicense': ['UNLICENSE', 'PUBLIC DOMAIN'],
            'CC0-1.0': ['CC0', 'CC0-1.0', 'CREATIVE COMMONS ZERO']
        };
        
        for (const [canonical, variants] of Object.entries(synonyms)) {
            if (variants.includes(licenseStr) || variants.some(v => licenseStr.includes(v))) {
                return canonical;
            }
        }
        
        return 'NOASSERTION';
    }
    
    getLicenseInfo(licenseName) {
        const normalized = this.normalizeLicenseName(licenseName);
        const info = this.licenseDatabase[normalized] || this.licenseDatabase['NOASSERTION'];
        
        return {
            ...info,
            originalName: licenseName,
            normalizedName: normalized
        };
    }
    
    checkCompatibility(license1, license2) {
        const info1 = this.getLicenseInfo(license1);
        const info2 = this.getLicenseInfo(license2);
        
        // AGPL несовместима с большинством лицензий
        if (info1.normalizedName === 'AGPL-3.0' && info2.normalizedName !== 'AGPL-3.0') {
            return { compatible: false, reason: 'AGPL-3.0 несовместима с другими лицензиями' };
        }
        
        // GPL с проприетарными
        if (info1.normalizedName.includes('GPL') && info2.commercial === true && info2.normalizedName !== 'NOASSERTION') {
            if (info2.normalizedName.includes('GPL')) {
                return { compatible: true, reason: 'GPL-совместимые лицензии' };
            }
            return { compatible: false, reason: 'GPL код нельзя смешивать с проприетарным' };
        }
        
        return { compatible: true, reason: 'Совместимы' };
    }
    
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
        
        // Проверка на required attribution
        if (licenseInfo.requiresAttribution) {
            violations.push({
                type: 'ATTRIBUTION_REQUIRED',
                severity: 'INFO',
                message: `Компонент ${component.name} требует указания авторства (${licenseInfo.normalizedName})`,
                recommendation: 'Добавьте уведомление о лицензии в документацию'
            });
        }
        
        // Проверка на disclosure
        if (licenseInfo.requiresSourceDisclosure && projectType === 'commercial') {
            violations.push({
                type: 'SOURCE_DISCLOSURE_REQUIRED',
                severity: 'HIGH',
                message: `Компонент ${component.name} требует открытия исходного кода`,
                recommendation: 'Подготовьтесь к публикации кода под GPL/AGPL'
            });
        }
        
        // Неизвестная лицензия
        if (licenseInfo.normalizedName === 'NOASSERTION') {
            violations.push({
                type: 'UNKNOWN_LICENSE',
                severity: 'MEDIUM',
                message: `У компонента ${component.name} не указана лицензия`,
                recommendation: 'Проверьте лицензию вручную перед использованием'
            });
        }
        
        return violations;
    }
    
    analyzeComponents(components, projectType = 'open_source') {
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
            recommendations: []
        };
        
        for (const component of components) {
            if (!component.name || component.properties?.some(p => p.name === 'src:type' && p.value === 'root')) {
                continue;
            }
            
            results.summary.total++;
            
            const licenseInfo = this.getLicenseInfo(component.license || 'NOASSERTION');
            const violations = this.checkPolicy(component, projectType);
            
            const componentResult = {
                name: component.name,
                version: component.version,
                license: component.license || 'NOASSERTION',
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
                    license: component.license
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
        
        // Генерация рекомендаций
        if (results.summary.critical > 0) {
            results.recommendations.push('🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ: Немедленно замените компоненты с запрещенными лицензиями');
        }
        if (results.summary.high > 0) {
            results.recommendations.push('⚠️ ВЫСОКИЙ РИСК: Проверьте совместимость лицензий с вашим проектом');
        }
        if (results.summary.medium > 0) {
            results.recommendations.push('📋 СРЕДНИЙ РИСК: Уточните условия использования компонентов с неизвестными лицензиями');
        }
        if (results.summary.low > 0 || results.summary.info > 0) {
            results.recommendations.push('ℹ️ ИНФОРМАЦИЯ: Добавьте уведомления об авторских правах в документацию');
        }
        
        if (results.violations.length === 0) {
            results.recommendations.push('✅ Все лицензии чисты. Проект соответствует политикам');
        }
        
        return results;
    }
    
    generateLicenseReport(analysisResults) {
        const report = {
            schema: "https://raw.githubusercontent.com/Hercules-Security/license-report/main/schema.json",
            ...analysisResults
        };
        
        return report;
    }
    
    toCycloneDX(analysisResults, sbom) {
        // Добавляем информацию о лицензиях в существующий SBOM
        const sbomWithLicenses = JSON.parse(JSON.stringify(sbom));
        
        for (const component of sbomWithLicenses.components || []) {
            const licenseInfo = analysisResults.components.find(
                c => c.name === component.name && c.version === component.version
            );
            
            if (licenseInfo) {
                component.license = {
                    name: licenseInfo.license,
                    text: {
                        contentType: "text/plain",
                        encoding: "base64",
                        content: Buffer.from(`License: ${licenseInfo.normalizedLicense}\nRisk: ${licenseInfo.risk}\nCommercial: ${licenseInfo.commercial}`).toString('base64')
                    }
                };
                
                if (!component.properties) component.properties = [];
                component.properties.push(
                    { name: 'license:risk', value: licenseInfo.risk },
                    { name: 'license:commercial', value: String(licenseInfo.commercial) },
                    { name: 'license:requiresAttribution', value: String(licenseInfo.requiresAttribution) },
                    { name: 'license:requiresSourceDisclosure', value: String(licenseInfo.requiresSourceDisclosure) }
                );
            }
        }
        
        // Добавляем сводку по лицензиям в metadata
        if (!sbomWithLicenses.metadata.properties) {
            sbomWithLicenses.metadata.properties = [];
        }
        
        sbomWithLicenses.metadata.properties.push(
            { name: 'license:summary:total', value: String(analysisResults.summary.total) },
            { name: 'license:summary:critical', value: String(analysisResults.summary.critical) },
            { name: 'license:summary:high', value: String(analysisResults.summary.high) },
            { name: 'license:summary:medium', value: String(analysisResults.summary.medium) },
            { name: 'license:summary:low', value: String(analysisResults.summary.low) },
            { name: 'license:summary:recommendations', value: analysisResults.recommendations.join('; ') }
        );
        
        return sbomWithLicenses;
    }
}

export { LicenseAnalyzer };