function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function loadJSZip() {
    return new Promise((resolve, reject) => {
        if (window.JSZip) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load JSZip'));
        document.head.appendChild(script);
    });
}

async function createZipArchive(files, folderName) {
    try {
        if (!window.JSZip) {
            await loadJSZip();
        }

        const zip = new window.JSZip();

        for (const file of files) {
            let relativePath = file.webkitRelativePath || file.name;

            if (folderName && relativePath.startsWith(folderName)) {
                relativePath = relativePath.substring(folderName.length + 1);
            }

            if (!relativePath) continue;

            const arrayBuffer = await file.arrayBuffer();
            zip.file(relativePath, arrayBuffer);
        }

        return await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
    } catch (error) {
        throw error;
    }
}

function getMethodColor(method) {
    switch (method?.toUpperCase()) {
        case 'GET': return '#10b981';
        case 'POST': return '#3b82f6';
        case 'PUT': return '#f59e0b';
        case 'DELETE': return '#ef4444';
        case 'PATCH': return '#8b5cf6';
        default: return '#64748b';
    }
}

export function generateDependenciesHTML(report) {
    let dependencies = [];
    let vulnerabilityStats = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
    };

    if (report.dependencies && Array.isArray(report.dependencies) && report.dependencies.length > 0) {
        dependencies = report.dependencies;

        for (const dep of dependencies) {
            const cveCount = typeof dep.cveCount === 'number' ? dep.cveCount : 0;
            vulnerabilityStats.total += cveCount;

            const cveSummary = dep.cveSummary || {};
            vulnerabilityStats.critical += typeof cveSummary.critical === 'number' ? cveSummary.critical : 0;
            vulnerabilityStats.high += typeof cveSummary.high === 'number' ? cveSummary.high : 0;
            vulnerabilityStats.medium += typeof cveSummary.medium === 'number' ? cveSummary.medium : 0;
            vulnerabilityStats.low += typeof cveSummary.low === 'number' ? cveSummary.low : 0;
        }
    } else if (report.sca?.dependencies && report.sca.dependencies.length > 0) {
        dependencies = report.sca.dependencies;

        for (const dep of dependencies) {
            if (dep.cveCount) vulnerabilityStats.total += dep.cveCount;
            if (dep.cveSummary) {
                vulnerabilityStats.critical += dep.cveSummary.critical || 0;
                vulnerabilityStats.high += dep.cveSummary.high || 0;
                vulnerabilityStats.medium += dep.cveSummary.medium || 0;
                vulnerabilityStats.low += dep.cveSummary.low || 0;
            }
        }
    }

    if (!dependencies?.length) {
        return '<div class="info-box">No dependencies found</div>';
    }

    let allVulnerabilities = [];
    for (const dep of dependencies) {
        if (dep.vulnerabilities && dep.vulnerabilities.vulnerabilities) {
            for (const vuln of dep.vulnerabilities.vulnerabilities) {
                allVulnerabilities.push({
                    ...vuln,
                    package: dep.name,
                    version: dep.version,
                    reachable: dep.isReachable,
                    usageFiles: dep.usageFiles || []
                });
            }
        }
    }

    const grouped = dependencies.reduce((acc, dep) => {
        const manager = dep.manager || 'unknown';
        if (!acc[manager]) acc[manager] = [];
        acc[manager].push(dep);
        return acc;
    }, {});

    let html = `
        <div class="vuln-stats" style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
            <div class="summary-card critical" style="flex: 1; background: var(--bg-input); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid var(--border);">
                <div class="card-value" style="font-size: 28px; font-weight: 700; color: #dc2626;">${vulnerabilityStats.critical}</div>
                <div class="card-label" style="font-size: 12px; color: var(--text-dim);">Critical</div>
            </div>
            <div class="summary-card high" style="flex: 1; background: var(--bg-input); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid var(--border);">
                <div class="card-value" style="font-size: 28px; font-weight: 700; color: #f97316;">${vulnerabilityStats.high}</div>
                <div class="card-label" style="font-size: 12px; color: var(--text-dim);">High</div>
            </div>
            <div class="summary-card medium" style="flex: 1; background: var(--bg-input); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid var(--border);">
                <div class="card-value" style="font-size: 28px; font-weight: 700; color: #eab308;">${vulnerabilityStats.medium}</div>
                <div class="card-label" style="font-size: 12px; color: var(--text-dim);">Medium</div>
            </div>
            <div class="summary-card low" style="flex: 1; background: var(--bg-input); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid var(--border);">
                <div class="card-value" style="font-size: 28px; font-weight: 700; color: #22c55e;">${vulnerabilityStats.low}</div>
                <div class="card-label" style="font-size: 12px; color: var(--text-dim);">Low</div>
            </div>
        </div>

        <div class="filter-bar" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; align-items: center;">
            <input type="text" id="vulnSearch" placeholder="Search by component or CVE..." class="search-box" style="flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid var(--border); background: var(--bg-input); color: var(--text); border-radius: 5px; outline: none;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="filter-btn active" data-filter="all">All (${allVulnerabilities.length})</button>
                <button class="filter-btn" data-filter="critical">Critical (${allVulnerabilities.filter(v => v.severity === 'critical').length})</button>
                <button class="filter-btn" data-filter="high">High (${allVulnerabilities.filter(v => v.severity === 'high').length})</button>
                <button class="filter-btn" data-filter="medium">Medium (${allVulnerabilities.filter(v => v.severity === 'medium').length})</button>
                <button class="filter-btn" data-filter="low">Low (${allVulnerabilities.filter(v => v.severity === 'low').length})</button>
                <button class="filter-btn" data-filter="reachable">Reachable (${allVulnerabilities.filter(v => v.reachable === true).length})</button>
            </div>
        </div>
    `;

    html += `<h4 style="margin-bottom: 16px; color: var(--text);">Dependencies found: ${dependencies.length}</h4>`;

    for (const [manager, items] of Object.entries(grouped)) {
        html += `
            <div class="dep-group" style="margin-bottom: 24px;">
                <h5 style="margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid var(--accent); display: inline-flex; align-items: center; gap: 8px; color: var(--text);">
                    <i class="fas fa-box" style="color: var(--accent);"></i>
                    ${escapeHtml(manager).toUpperCase()}
                    <span style="font-size: 12px; font-weight: normal; color: var(--text-dim);">(${items.length})</span>
                </h5>
                <div style="overflow-x: auto;">
                    <table class="dep-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: var(--bg-input);">
                                <th style="width: 30px; padding: 10px;"></th>
                                <th style="padding: 10px; text-align: left;">Package</th>
                                <th style="padding: 10px; text-align: left;">Version</th>
                                <th style="padding: 10px; text-align: left;">Source</th>
                                <th style="padding: 10px; text-align: center;">Vulnerabilities</th>
                                <th style="padding: 10px; text-align: left;">License</th>
                                <th style="padding: 10px; text-align: center;">Reachable</th>
                            </tr>
                        </thead>
                        <tbody id="vulnTableBody">
                            ${items.map((dep, idx) => {
                                const reachableText = dep.isReachable === true ? 'Yes' : (dep.isReachable === false ? 'No' : 'Unknown');
                                const reachableClass = dep.isReachable === true ? 'reachable-yes' : (dep.isReachable === false ? 'reachable-no' : 'reachable-unknown');

                                return `
                                <tr class="dep-row" data-idx="${idx}" data-manager="${manager}" data-severity="${dep.cveSummary?.critical > 0 ? 'critical' : (dep.cveSummary?.high > 0 ? 'high' : '')}" data-reachable="${dep.isReachable}" data-component="${dep.name}" style="border-bottom: 1px solid var(--border); cursor: pointer;">
                                    <td style="padding: 10px; text-align: center;">
                                        <span class="expand-icon" style="transition: transform 0.2s; display: inline-block;">▶</span>
                                    </td>
                                    <td style="padding: 10px;"><strong>${escapeHtml(dep.name)}</strong>${dep.type === 'development' ? '<span style="font-size: 10px; background: var(--bg-input); padding: 2px 6px; border-radius: 10px; margin-left: 8px;">dev</span>' : ''}</td>
                                    <td style="padding: 10px; font-family: monospace;">${escapeHtml(dep.version || 'unknown')}</td>
                                    <td style="padding: 10px; font-size: 11px; color: var(--text-dim);">${escapeHtml(dep.file || '-')}</td>
                                    <td style="padding: 10px; text-align: center;">
                                        ${dep.cveCount > 0 ? `
                                            <span class="vuln-count" style="background: #f9731620; color: #f97316; padding: 2px 8px; border-radius: 16px; font-weight: 600; font-size: 12px;">
                                                ${dep.cveCount}
                                            </span>
                                        ` : `<span style="color: #10b981;">None</span>`}
                                    </td>
                                    <td style="padding: 10px;">
                                        <span style="background: #94a3b820; color: #94a3b8; padding: 4px 8px; border-radius: 12px; font-size: 11px;">
                                            ${escapeHtml(dep.license || 'UNKNOWN')}
                                        </span>
                                    </td>
                                    <td style="padding: 10px; text-align: center;">
                                        <span class="${reachableClass}" style="padding: 4px 8px; border-radius: 12px; font-size: 11px;">${reachableText}</span>
                                    </td>
                                </tr>
                                <tr class="dep-details-row" data-details-idx="${idx}" data-details-manager="${manager}" style="display: none; background: var(--bg-input);">
                                    <td colspan="7" style="padding: 15px 20px;">
                                        <div style="background: var(--bg-card); border-radius: 8px; padding: 16px; border: 1px solid var(--border); color: var(--text);">
                                            <div><strong>Dependency Details</strong></div>
                                            <div style="margin-top: 12px;">
                                                <strong>License:</strong> ${escapeHtml(dep.license || 'UNKNOWN')}
                                                ${dep.licenseInfo ? `<span style="margin-left: 12px; padding: 2px 8px; border-radius: 12px; font-size: 11px; background: ${dep.licenseInfo.risk === 'high' ? '#fee2e2' : '#dcfce7'}; color: ${dep.licenseInfo.risk === 'high' ? '#dc2626' : '#16a34a'};">${dep.licenseInfo.type || 'unknown'}</span>` : ''}
                                            </div>
                                            ${dep.licenseInfo?.recommendation ? `<div style="margin-top: 8px;"><strong>Recommendation:</strong> ${escapeHtml(dep.licenseInfo.recommendation)}</div>` : ''}
                                            ${dep.usageFiles && dep.usageFiles.length > 0 ? `
                                                <div style="margin-top: 12px;">
                                                    <strong>Usage files (${dep.usageFiles.length}):</strong>
                                                    <ul style="margin-top: 8px; margin-left: 8px; list-style: none; padding-left: 0; max-height: 200px; overflow-y: auto;">
                                                        ${dep.usageFiles.map(f => `<li style="font-family: monospace; font-size: 12px; padding: 4px 0;">${escapeHtml(f)}</li>`).join('')}
                                                    </ul>
                                                </div>
                                                ` : dep.isReachable === true ? `
                                                <div style="margin-top: 12px; padding: 8px; background: #fee2e2; border-radius: 6px; color: #dc2626;">
                                                    <i class="fas fa-exclamation-triangle"></i> Vulnerability is reachable, but no specific usage files found
                                                </div>
                                                ` : dep.isReachable === false ? `
                                                <div style="margin-top: 12px; padding: 8px; background: #dcfce7; border-radius: 6px; color: #16a34a;">
                                                    <i class="fas fa-check-circle"></i> Vulnerability is not reachable - component is not used in the code
                                                </div>
                                                ` : ''}
                                                ${dep.vulnerabilities && dep.vulnerabilities.vulnerabilities ? `
                                                <div style="margin-top: 12px;">
                                                    <strong>Found CVE (${dep.vulnerabilities.vulnerabilities.length}):</strong>
                                                    <div style="max-height: 300px; overflow-y: auto; margin-top: 8px;">
                                                        ${dep.vulnerabilities.vulnerabilities.map(v => `
                                                            <div style="padding: 6px 0; border-bottom: 1px solid var(--border);">
                                                                <a href="https://osv.dev/vulnerability/${v.id}" target="_blank" style="color: var(--accent);">${escapeHtml(v.id)}</a>
                                                                <span style="margin-left: 8px; padding: 2px 6px; border-radius: 10px; font-size: 10px; background: ${v.severity === 'critical' ? '#fee2e2' : '#ffedd5'}; color: ${v.severity === 'critical' ? '#dc2626' : '#f97316'};">${v.severity || 'unknown'}</span>
                                                                <span style="margin-left: 8px; font-size: 11px; color: var(--text-dim);">${escapeHtml((v.summary || '').substring(0, 80))}${(v.summary || '').length > 80 ? '...' : ''}</span>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                </div>
                                                ` : ''}
                                        </div>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    setTimeout(() => {
        const rows = document.querySelectorAll('.dep-row');
        rows.forEach(row => {
            row.onclick = (e) => {
                if (e.target.tagName === 'A') return;
                const idx = row.dataset.idx;
                const manager = row.dataset.manager;
                const detailsRow = document.querySelector(`.dep-details-row[data-details-idx="${idx}"][data-details-manager="${manager}"]`);
                const expandIcon = row.querySelector('.expand-icon');
                if (detailsRow) {
                    detailsRow.classList.toggle('show');
                    if (expandIcon) {
                        expandIcon.style.transform = detailsRow.classList.contains('show') ? 'rotate(90deg)' : 'rotate(0deg)';
                    }
                }
            };
        });

        let activeFilter = 'all';
        const searchInput = document.getElementById('vulnSearch');
        const filterBtns = document.querySelectorAll('.filter-btn');
        const allRows = document.querySelectorAll('.dep-row');

        function filterRows() {
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

            allRows.forEach(row => {
                const severity = row.dataset.severity;
                const reachable = row.dataset.reachable === 'true';
                const component = (row.dataset.component || '').toLowerCase();

                let matchesFilter = true;
                if (activeFilter === 'critical') matchesFilter = severity === 'critical';
                else if (activeFilter === 'high') matchesFilter = severity === 'high';
                else if (activeFilter === 'medium') matchesFilter = severity === 'medium';
                else if (activeFilter === 'low') matchesFilter = severity === 'low';
                else if (activeFilter === 'reachable') matchesFilter = reachable === true;

                let matchesSearch = true;
                if (searchTerm) {
                    matchesSearch = component.includes(searchTerm);
                }

                row.style.display = matchesFilter && matchesSearch ? '' : 'none';

                const idx = row.dataset.idx;
                const manager = row.dataset.manager;
                const detailsRow = document.querySelector(`.dep-details-row[data-details-idx="${idx}"][data-details-manager="${manager}"]`);
                if (detailsRow && row.style.display === 'none') {
                    detailsRow.classList.remove('show');
                    const expandIcon = row.querySelector('.expand-icon');
                    if (expandIcon) expandIcon.style.transform = 'rotate(0deg)';
                }
            });
        }

        filterBtns.forEach(btn => {
            btn.onclick = () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.filter;
                filterRows();
            };
        });

        if (searchInput) {
            searchInput.oninput = filterRows;
        }
    }, 100);

    return html;
}

function generateCodeHTML(report) {
    const issues = report.sast?.issues || report.codeAnalysis?.issues || [];

    if (!issues.length) {
        return `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>No issues found</h3>
                <p>SAST analysis did not find any vulnerabilities in the code</p>
            </div>
        `;
    }

    function getSeverityColorStatic(severity) {
        switch(severity) {
            case 'CRITICAL': return '#dc2626';
            case 'HIGH': return '#f97316';
            case 'MEDIUM': return '#eab308';
            case 'LOW': return '#22c55e';
            default: return '#3b82f6';
        }
    }

    function escapeHtmlStatic(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function shortenPath(filePath) {
        if (!filePath) return 'unknown';
        let path = filePath;
        path = path.replace(/^loan-master[\\/]/, '');
        path = path.replace(/^src[\\/]/, '');
        if (path.startsWith('config/') || path.startsWith('docs/')) {
            return path;
        }
        if (path.length > 50) {
            const parts = path.split(/[\\/]/);
            if (parts.length > 2) {
                return parts.slice(-2).join('/');
            }
        }
        return path;
    }

    function getUniqueRules(issuesList) {
        const rules = new Set();
        issuesList.forEach(issue => {
            const rule = issue.ruleId || issue.rule;
            if (rule) rules.add(rule);
        });
        return Array.from(rules).sort();
    }

    function isTestMockFile(filePath) {
        if (!filePath) return false;
        const lowerPath = filePath.toLowerCase();
        const patterns = ['test', 'mock', 'spec', 'fixture', '__tests__', '__mocks__', '.test.', '.spec.', '/tests/', '/test/'];
        return patterns.some(p => lowerPath.includes(p));
    }

    const normalizedIssues = issues.map((issue, index) => {
        const fullPath = issue.file || 'unknown';
        return {
            ...issue,
            id: index,
            fullPath: fullPath,
            file: shortenPath(fullPath),
            severity: (issue.severity || 'INFO').toUpperCase()
        };
    });

    const statistics = {
        critical: normalizedIssues.filter(i => i.severity === 'CRITICAL').length,
        high: normalizedIssues.filter(i => i.severity === 'HIGH').length,
        medium: normalizedIssues.filter(i => i.severity === 'MEDIUM').length,
        low: normalizedIssues.filter(i => i.severity === 'LOW').length,
        info: normalizedIssues.filter(i => i.severity === 'INFO').length,
        total: normalizedIssues.length
    };

    const uniqueId = 'sast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    function renderSastTableRowsInline(issuesList, uid) {
        if (!issuesList.length) return '';

        let html = '';
        for (let i = 0; i < issuesList.length; i++) {
            const issue = issuesList[i];
            const severityColor = getSeverityColorStatic(issue.severity);
            const ruleName = issue.ruleId || issue.rule || 'unknown';
            const message = (issue.message || 'No description').substring(0, 80);
            const file = issue.file;
            const fullPath = issue.fullPath;
            const line = issue.line || '?';
            const codeBlock = issue.codeBlock;
            const rowId = 'sast-row-' + uid + '-' + i;
            const detailsId = 'sast-details-' + uid + '-' + i;

            html += `
                <tr id="${rowId}" class="sast-row" data-idx="${i}" data-severity="${issue.severity}" data-rule="${escapeHtmlStatic(ruleName)}" data-fullpath="${escapeHtmlStatic(fullPath)}" data-message="${escapeHtmlStatic(message)}">
                    <td style="padding: 10px; text-align: center;">
                        <span class="sast-expand-icon" data-idx="${i}" data-details-id="${detailsId}" style="transition: transform 0.2s; display: inline-block; cursor: pointer;">▶</span>
                    </td>
                    <td style="padding: 10px;">
                        <span style="color: ${severityColor}; font-weight: 600; padding: 4px 8px; border-radius: 12px; font-size: 11px; background: ${severityColor}20;">
                            ${issue.severity}
                        </span>
                    </td>
                    <td style="padding: 10px;">
                        <code class="sast-rule-name">${escapeHtmlStatic(ruleName)}</code>
                    </td>
                    <td style="padding: 10px; max-width: 300px;">
                        <div class="sast-message">${escapeHtmlStatic(message)}${issue.message && issue.message.length > 80 ? '...' : ''}</div>
                    </td>
                    <td style="padding: 10px;">
                        <span class="sast-filepath" title="${escapeHtmlStatic(fullPath)}">${escapeHtmlStatic(file)}</span>
                    </td>
                    <td style="padding: 10px; text-align: center;">
                        <span style="background: var(--bg-input); padding: 2px 6px; border-radius: 4px; font-family: monospace;">${line}</span>
                    </td>
                </tr>
                <tr id="${detailsId}" class="sast-details-row" data-details-idx="${i}" style="display: none; background: var(--bg-input);">
                    <td colspan="6" style="padding: 15px 20px;">
                        <div style="background: var(--bg-card); border-radius: 8px; padding: 16px; border: 1px solid var(--border); color: var(--text);">
                            <div style="margin-bottom: 12px;">
                                <strong style="font-size: 14px;">${escapeHtmlStatic(ruleName)}</strong>
                                <span style="color: ${severityColor}; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 10px; background: ${severityColor}20;">
                                    ${issue.severity}
                                </span>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <strong>Description:</strong>
                                <p style="margin-top: 4px; color: var(--text-dim);">${escapeHtmlStatic(issue.message || 'No description')}</p>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <strong>Location:</strong>
                                <div style="margin-top: 4px; font-family: monospace; font-size: 12px; background: var(--bg-input); padding: 6px 10px; border-radius: 4px;">
                                    ${escapeHtmlStatic(fullPath)}:${line}
                                </div>
                            </div>
                            ${codeBlock && codeBlock.lines ? `
                                <div style="margin-bottom: 12px;">
                                    <strong>Code block:</strong>
                                    <pre style="margin-top: 8px; background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px;">${codeBlock.lines.map(function(l) {
                                        const prefix = l.isVulnerable ? '→' : ' ';
                                        const lineNum = String(l.number).padStart(4, ' ');
                                        const lineCode = escapeHtmlStatic(l.code || '');
                                        return prefix + ' ' + lineNum + ' | ' + lineCode;
                                    }).join('\n')}</pre>
                                </div>
                            ` : issue.snippet ? `
                                <div style="margin-bottom: 12px;">
                                    <strong>Code snippet:</strong>
                                    <pre style="margin-top: 8px; background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px;">${escapeHtmlStatic(issue.snippet)}</pre>
                                </div>
                            ` : ''}
                            ${issue.recommendation ? `
                                <div style="margin-top: 12px; padding: 12px; background: rgba(59,130,246,0.08); border-left: 3px solid var(--accent); border-radius: 4px;">
                                    <strong style="color: var(--accent);"><i class="fas fa-lightbulb"></i> Recommendation:</strong>
                                    <p style="margin-top: 4px; color: var(--text);">${escapeHtmlStatic(issue.recommendation)}</p>
                                </div>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }
        return html;
    }

    const filterModalHtml = `
    <div id="sast-filter-modal-${uniqueId}" class="sast-modal-overlay">
        <div class="sast-modal">
            <div class="sast-modal-header">
                <h3><i class="fas fa-sliders-h"></i>Advanced Filters</h3>
                <button class="sast-modal-close">&times;</button>
            </div>
            <div class="sast-modal-body">
                <div class="sast-filter-group">
                    <label class="sast-checkbox-label">
                        <input type="checkbox" id="sast-exclude-test-mock-${uniqueId}">
                        <span>Exclude test/mock files</span>
                    </label>
                    <div class="sast-filter-hint">
                        excludes files containing: test, mock, spec, fixture, __tests__, etc.
                    </div>
                </div>
                <div class="sast-filter-group">
                    <label>Filter by rule:</label>
                    <select id="sast-rule-filter-${uniqueId}" class="sast-select">
                        <option value="all">All rules</option>
                        ${getUniqueRules(normalizedIssues).map(rule => `<option value="${escapeHtmlStatic(rule)}">${escapeHtmlStatic(rule)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="sast-modal-footer">
                <button class="sast-btn sast-btn-secondary sast-filter-reset">Reset</button>
                <button class="sast-btn sast-btn-primary sast-filter-apply">Apply</button>
            </div>
        </div>
    </div>
    `;

    const filterBarHtml = `
<button id="sast-filter-btn-${uniqueId}" class="sast-filter-btn-ext">
    <i class="fas fa-sliders-h"></i> Advanced Filters
</button>
`;

    let html = `
        <div id="${uniqueId}" class="sast-container">
            <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
                <div style="flex: 1; background: var(--bg-input); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid var(--border);">
                    <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${statistics.critical}</div>
                    <div style="font-size: 12px; color: var(--text-dim);">Critical</div>
                </div>
                <div style="flex: 1; background: var(--bg-input); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid var(--border);">
                    <div style="font-size: 28px; font-weight: 700; color: #f97316;">${statistics.high}</div>
                    <div style="font-size: 12px; color: var(--text-dim);">High</div>
                </div>
                <div style="flex: 1; background: var(--bg-input); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid var(--border);">
                    <div style="font-size: 28px; font-weight: 700; color: #eab308;">${statistics.medium}</div>
                    <div style="font-size: 12px; color: var(--text-dim);">Medium</div>
                </div>
                <div style="flex: 1; background: var(--bg-input); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid var(--border);">
                    <div style="font-size: 28px; font-weight: 700; color: #22c55e;">${statistics.low}</div>
                    <div style="font-size: 12px; color: var(--text-dim);">Low</div>
                </div>
                <div style="flex: 1; background: var(--bg-input); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid var(--border);">
                    <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">${statistics.info}</div>
                    <div style="font-size: 12px; color: var(--text-dim);">Info</div>
                </div>
            </div>

            <div class="sast-filter-bar" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; align-items: center;">
                <input type="text" id="sast-search-${uniqueId}" placeholder="Search by file, rule or description..." class="sast-search-box" style="flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid var(--border); background: var(--bg-input); color: var(--text); border-radius: 5px; outline: none;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="sast-filter-btn active" data-filter="all">All (${statistics.total})</button>
                    <button class="sast-filter-btn" data-filter="critical">Critical (${statistics.critical})</button>
                    <button class="sast-filter-btn" data-filter="high">High (${statistics.high})</button>
                    <button class="sast-filter-btn" data-filter="medium">Medium (${statistics.medium})</button>
                    <button class="sast-filter-btn" data-filter="low">Low (${statistics.low})</button>
                    <button class="sast-filter-btn" data-filter="info">Info (${statistics.info})</button>
                </div>
                ${filterBarHtml}
            </div>

            ${filterModalHtml}

            <div style="overflow-x: auto;">
                <table class="sast-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: var(--bg-input);">
                            <th style="width: 30px; padding: 10px;"></th>
                            <th style="padding: 10px; text-align: left;">Severity</th>
                            <th style="padding: 10px; text-align: left;">Rule</th>
                            <th style="padding: 10px; text-align: left;">Description</th>
                            <th style="padding: 10px; text-align: left;">File</th>
                            <th style="padding: 10px; text-align: center;">Line</th>
                        </tr>
                    </thead>
                    <tbody id="sast-table-body-${uniqueId}">
                        ${renderSastTableRowsInline(normalizedIssues, uniqueId)}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    setTimeout(() => {
        const container = document.getElementById(uniqueId);
        if (!container) return;

        const rows = container.querySelectorAll('.sast-row');
        rows.forEach(row => {
            const expandIcon = row.querySelector('.sast-expand-icon');
            if (!expandIcon) return;
            const detailsId = expandIcon.getAttribute('data-details-id');
            const detailsRow = document.getElementById(detailsId);
            if (!detailsRow) return;

            row.onclick = (e) => {
                if (e.target.classList && e.target.classList.contains('sast-expand-icon')) return;
                if (detailsRow.style.display === 'none' || !detailsRow.style.display) {
                    detailsRow.style.display = 'table-row';
                    expandIcon.style.transform = 'rotate(90deg)';
                } else {
                    detailsRow.style.display = 'none';
                    expandIcon.style.transform = 'rotate(0deg)';
                }
            };

            expandIcon.onclick = (e) => {
                e.stopPropagation();
                if (detailsRow.style.display === 'none' || !detailsRow.style.display) {
                    detailsRow.style.display = 'table-row';
                    expandIcon.style.transform = 'rotate(90deg)';
                } else {
                    detailsRow.style.display = 'none';
                    expandIcon.style.transform = 'rotate(0deg)';
                }
            };
        });

        const searchInputElem = container.querySelector('.sast-search-box');
        const filterBtnsElem = container.querySelectorAll('.sast-filter-btn');
        let activeFilter = 'all';

        function filterRows() {
            const searchTerm = searchInputElem ? searchInputElem.value.toLowerCase() : '';
            const allRows = container.querySelectorAll('.sast-row');

            allRows.forEach(row => {
                const severity = row.getAttribute('data-severity') || '';
                const filePath = row.querySelector('.sast-filepath')?.getAttribute('title') || '';
                const message = row.querySelector('.sast-message')?.innerText || '';

                let matchesFilter = true;
                if (activeFilter !== 'all') {
                    matchesFilter = severity.toLowerCase() === activeFilter;
                }

                let matchesSearch = true;
                if (searchTerm) {
                    matchesSearch = filePath.toLowerCase().includes(searchTerm) ||
                                   message.toLowerCase().includes(searchTerm);
                }

                row.style.display = matchesFilter && matchesSearch ? '' : 'none';

                if (row.style.display === 'none') {
                    const icon = row.querySelector('.sast-expand-icon');
                    if (icon) {
                        const detailsRow = document.getElementById(icon.getAttribute('data-details-id'));
                        if (detailsRow) detailsRow.style.display = 'none';
                    }
                }
            });
        }

        filterBtnsElem.forEach(btn => {
            if (btn.classList.contains('sast-filter-btn')) {
                btn.onclick = () => {
                    filterBtnsElem.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeFilter = btn.getAttribute('data-filter');
                    filterRows();
                };
            }
        });

        if (searchInputElem) {
            searchInputElem.oninput = filterRows;
        }

        const filterBtn = document.getElementById(`sast-filter-btn-${uniqueId}`);
        const modal = document.getElementById(`sast-filter-modal-${uniqueId}`);
        const applyBtn = modal?.querySelector('.sast-filter-apply');
        const resetBtn = modal?.querySelector('.sast-filter-reset');
        const excludeTestMockCheckbox = document.getElementById(`sast-exclude-test-mock-${uniqueId}`);
        const ruleFilterSelect = document.getElementById(`sast-rule-filter-${uniqueId}`);

        let excludeTestMock = false;
        let selectedRule = 'all';

        if (filterBtn && modal) {
            filterBtn.onclick = () => {
                modal.style.display = 'flex';
            };
        }

        if (modal) {
            const closeBtn = modal.querySelector('.sast-modal-close');
            if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };

            modal.onclick = (e) => {
                if (e.target === modal) modal.style.display = 'none';
            };
        }

        if (applyBtn) {
            applyBtn.onclick = () => {
                excludeTestMock = excludeTestMockCheckbox ? excludeTestMockCheckbox.checked : false;
                selectedRule = ruleFilterSelect ? ruleFilterSelect.value : 'all';

                const rowsList = document.querySelectorAll(`#${uniqueId} .sast-row`);
                rowsList.forEach(row => {
                    const filePath = row.querySelector('.sast-filepath')?.getAttribute('title') || '';
                    const ruleName = row.querySelector('.sast-rule-name')?.innerText || '';

                    let excludeByTestMock = true;
                    if (excludeTestMock) {
                        excludeByTestMock = !isTestMockFile(filePath);
                    }

                    let matchRule = true;
                    if (selectedRule !== 'all') {
                        matchRule = ruleName === selectedRule;
                    }

                    row.style.display = (excludeByTestMock && matchRule) ? '' : 'none';

                    if (row.style.display === 'none') {
                        const icon = row.querySelector('.sast-expand-icon');
                        if (icon) {
                            const detailsRow = document.getElementById(icon.getAttribute('data-details-id'));
                            if (detailsRow) detailsRow.style.display = 'none';
                        }
                    }
                });

                modal.style.display = 'none';
            };
        }

        if (resetBtn) {
            resetBtn.onclick = () => {
                if (excludeTestMockCheckbox) excludeTestMockCheckbox.checked = false;
                if (ruleFilterSelect) ruleFilterSelect.value = 'all';
                excludeTestMock = false;
                selectedRule = 'all';

                const rowsList = document.querySelectorAll(`#${uniqueId} .sast-row`);
                rowsList.forEach(row => {
                    row.style.display = '';
                });

                modal.style.display = 'none';
            };
        }
    }, 100);

    return html;
}

function generateSummaryHTML(report) {
    const scaStats = report.sca?.statistics || {};
    const scaVulnerabilities = report.sca?.vulnerabilities || [];

    const scaCritical = scaVulnerabilities.filter(v => v.severity === 'critical').length;
    const scaHigh = scaVulnerabilities.filter(v => v.severity === 'high').length;
    const scaMedium = scaVulnerabilities.filter(v => v.severity === 'medium').length;
    const scaLow = scaVulnerabilities.filter(v => v.severity === 'low').length;

    const sastIssues = report.sast?.issues || [];

    const sastCritical = sastIssues.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL' || i.severity === 'critical').length;
    const sastHigh = sastIssues.filter(i => (i.severity || '').toUpperCase() === 'HIGH' || i.severity === 'high').length;
    const sastMedium = sastIssues.filter(i => (i.severity || '').toUpperCase() === 'MEDIUM' || i.severity === 'medium').length;
    const sastLow = sastIssues.filter(i => (i.severity || '').toUpperCase() === 'LOW' || i.severity === 'low').length;

    const totalCritical = scaCritical + sastCritical;
    const totalHigh = scaHigh + sastHigh;

    return `
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div class="stat-card" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center;">
                <div class="stat-number" style="font-size: 32px; font-weight: bold; color: var(--accent);">${scaStats.totalDependencies || 0}</div>
                <div class="stat-label" style="font-size: 12px; color: var(--text-dim);">Dependencies</div>
            </div>
            <div class="stat-card" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center;">
                <div class="stat-number" style="font-size: 32px; font-weight: bold; color: var(--accent);">${sastIssues.length}</div>
                <div class="stat-label" style="font-size: 12px; color: var(--text-dim);">SAST issues</div>
            </div>
        </div>

        <div style="background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <div style="color: var(--accent-ink); text-align: center;">
                <div style="font-size: 14px; opacity: 0.9;">Overall risk</div>
                <div style="font-size: 36px; font-weight: 700;">${totalCritical + totalHigh}</div>
                <div style="font-size: 12px; opacity: 0.8;">critical and high vulnerabilities</div>
            </div>
        </div>

        <div style="margin-bottom: 24px;">
            <h3 style="margin-bottom: 16px; font-size: 18px; color: var(--text);">Critical and High Vulnerabilities</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); overflow: hidden;">
                    <div style="padding: 12px 16px; background: var(--bg-input); border-bottom: 1px solid var(--border); color: var(--text); font-weight: 600;">
                        Composition Analysis
                    </div>
                    <div style="padding: 16px;">
                        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${scaCritical}</div>
                                <div style="font-size: 12px; color: var(--text-dim);">Critical</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #f97316;">${scaHigh}</div>
                                <div style="font-size: 12px; color: var(--text-dim);">High</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #eab308;">${scaMedium}</div>
                                <div style="font-size: 12px; color: var(--text-dim);">Medium</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #22c55e;">${scaLow}</div>
                                <div style="font-size: 12px; color: var(--text-dim);">Low</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); overflow: hidden;">
                    <div style="padding: 12px 16px; background: var(--bg-input); border-bottom: 1px solid var(--border); color: var(--text); font-weight: 600;">
                        Source Code Analysis
                    </div>
                    <div style="padding: 16px;">
                        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${sastCritical}</div>
                                <div style="font-size: 12px; color: var(--text-dim);">Critical</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #f97316;">${sastHigh}</div>
                                <div style="font-size: 12px; color: var(--text-dim);">High</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #eab308;">${sastMedium}</div>
                                <div style="font-size: 12px; color: var(--text-dim);">Medium</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #22c55e;">${sastLow}</div>
                                <div style="font-size: 12px; color: var(--text-dim);">Low</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateHTMLReport(report) {
    if (!report) {
        return '<html><body><h1>No data</h1></body></html>';
    }

    const summaryHtml = generateSummaryHTML(report);
    const scaHtml = generateDependenciesHTML(report);
    const sastHtml = generateCodeHTML(report);

    const scaCount = (report.sca && report.sca.vulnerabilities && report.sca.vulnerabilities.length) || 0;
    const sastCount = (report.sast && report.sast.issues && report.sast.issues.length) || 0;
    const generated = new Date().toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hercules | Blender - Security Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}

        /* ============ REPORT (auto-adapts to parent theme via CSS vars) ============ */
        .report-container,
        .report-container *{
            font-family:'Fira Sans',sans-serif;
            color:inherit;
        }
        .report-container{
            background:transparent;
            color:var(--text);
            width:100%;
        }

        /* HEADER */
        .report-header{padding:0 0 20px 0;border-bottom:1px solid var(--border);}
        .report-header h1{
            font-size:22px;display:flex;align-items:center;gap:12px;
            font-weight:700;letter-spacing:-0.01em;color:var(--text);
        }
        .report-header h1 i{color:var(--accent);font-size:22px;}
        .report-header p{color:var(--text-dim);font-size:13px;margin-top:8px;}
        .report-meta{display:flex;gap:22px;font-size:12px;color:var(--text-dim);flex-wrap:wrap;margin-top:10px;}
        .report-meta span{display:flex;align-items:center;gap:6px;}
        .report-meta i{color:var(--accent);font-size:12px;}

        /* TABS */
        .report-tabs{
            display:flex;gap:0;margin-top:20px;
            border-bottom:1px solid var(--border);
        }
        .report-tab{
            padding:14px 18px;background:transparent;border:none;
            border-bottom:2px solid transparent;font-size:13px;font-weight:600;
            color:var(--text-dim);cursor:pointer;transition:color .15s,border-color .15s;
            font-family:'Fira Sans',sans-serif;letter-spacing:-0.01em;margin-bottom:-1px;
            display:inline-flex;align-items:center;gap:8px;
        }
        .report-tab:hover{color:var(--text);}
        .report-tab.active{color:var(--accent);border-bottom-color:var(--accent);}
        .report-tab .tab-badge{
            background:var(--bg-input);color:var(--text-dim);padding:1px 7px;border-radius:4px;
            font-size:11px;font-family:'Fira Code',monospace;font-weight:600;
        }
        .report-tab.active .tab-badge{background:var(--logo-bg);color:var(--accent);}

        /* CONTENT */
        .report-content{padding:24px 0;min-height:200px;}
        .tab-pane{display:none;}
        .tab-pane.active{display:block;animation:fadeIn .25s ease;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}

        /* FOOTER */
        .report-footer{
            padding:18px 0 0 0;text-align:center;
            font-size:11px;color:var(--text-faint);border-top:1px solid var(--border);line-height:1.7;
        }
        .report-footer strong{color:var(--text-dim);}

        /* STATS GRID */
        .stats-grid{
            display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
            gap:14px;margin-bottom:24px;
        }
        .stat-card{
            background:var(--bg-input);border-radius:10px;padding:20px;text-align:center;
            border:1px solid var(--border);transition:border-color .15s;
        }
        .stat-card:hover{border-color:var(--accent);}
        .stat-number{font-size:32px;font-weight:700;color:var(--text);font-family:'Fira Code',monospace;line-height:1;}
        .stat-label{font-size:12px;color:var(--text-dim);margin-top:8px;}

        /* VULN STATS */
        .vuln-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:24px;}
        .summary-card{
            background:var(--bg-input);border:1px solid var(--border);border-radius:10px;
            padding:18px;text-align:center;transition:border-color .15s;
        }
        .summary-card:hover{border-color:var(--accent);}
        .summary-card .card-value{font-size:28px;font-weight:700;font-family:'Fira Code',monospace;line-height:1;}
        .summary-card .card-label{font-size:12px;color:var(--text-dim);margin-top:8px;}
        .summary-card.critical .card-value{color:#dc2626;}
        .summary-card.high .card-value{color:#f97316;}
        .summary-card.medium .card-value{color:#eab308;}
        .summary-card.low .card-value{color:#22c55e;}

        /* FILTER BAR */
        .filter-bar,.sast-filter-bar{
            display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;
            background:var(--bg-input);padding:12px;border:1px solid var(--border);border-radius:10px;
        }
        .search-box,.sast-search-box{
            flex:1;min-width:220px;padding:9px 14px;background:var(--bg-card);
            border:1px solid var(--border);border-radius:6px;font-size:13px;color:var(--text);
            font-family:'Fira Sans',sans-serif;transition:border-color .15s;
        }
        .search-box:focus,.sast-search-box:focus{outline:none;border-color:var(--accent);}
        .search-box::placeholder,.sast-search-box::placeholder{color:var(--text-faint);}

        .filter-btn,.sast-filter-btn{
            padding:6px 12px;background:var(--bg-card);border:1px solid var(--border);
            border-radius:6px;cursor:pointer;font-size:12px;color:var(--text-dim);
            transition:all .15s;font-family:'Fira Sans',sans-serif;font-weight:600;
        }
        .filter-btn:hover,.sast-filter-btn:hover{border-color:var(--accent);color:var(--accent);}
        .filter-btn.active,.sast-filter-btn.active{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);}

        .sast-filter-btn-ext{
            padding:6px 12px;background:var(--bg-card);border:1px solid var(--border);
            border-radius:6px;cursor:pointer;font-size:12px;color:var(--text-dim);
            transition:all .15s;font-family:'Fira Sans',sans-serif;font-weight:600;
            display:inline-flex;align-items:center;gap:6px;
        }
        .sast-filter-btn-ext:hover{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);}

        /* TABLES */
        .dep-table,.sast-table{
            width:100%;border-collapse:collapse;font-size:13px;background:var(--bg-card);
            border-radius:8px;overflow:hidden;border:1px solid var(--border);
        }
        .dep-table th,.sast-table th{
            background:var(--bg-input);padding:12px;text-align:left;font-weight:700;
            font-size:11px;color:var(--text-dim);border-bottom:1px solid var(--border);
            text-transform:uppercase;letter-spacing:0.05em;font-family:'Fira Sans',sans-serif;
        }
        .dep-table td,.sast-table td{
            padding:11px 12px;border-bottom:1px solid var(--border);
            font-family:'Fira Sans',sans-serif;vertical-align:top;color:var(--text);
        }
        .dep-table tr:last-child td,.sast-table tr:last-child td{border-bottom:none;}

        .dep-row,.sast-row{cursor:pointer;transition:background .1s;}
        .dep-row:hover,.sast-row:hover{background:var(--bg-input);}

        .expand-icon,.sast-expand-icon{
            transition:transform .2s;display:inline-block;font-size:10px;
            color:var(--text-faint);cursor:pointer;width:20px;text-align:center;
        }
        .dep-row:hover .expand-icon,.sast-row:hover .sast-expand-icon{color:var(--accent);}

        .dep-details-row,.sast-details-row{display:none;background:var(--bg-input);}
        .dep-details-row.show,.sast-details-row.show{display:table-row;}

        /* BADGES */
        .badge{
            display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;
            font-weight:700;font-family:'Fira Code',monospace;text-transform:uppercase;
            letter-spacing:0.05em;
        }
        .badge-critical{background:#fee2e2;color:#b91c1c;}
        .badge-high{background:#ffedd5;color:#c2410c;}
        .badge-medium{background:#fef3c7;color:#a16207;}
        .badge-low{background:#dcfce7;color:#15803d;}
        .badge-info{background:#e0f2fe;color:#0369a1;}

        /* REACHABILITY */
        .reachable-yes{background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;font-family:'Fira Code',monospace;text-transform:uppercase;letter-spacing:0.05em;}
        .reachable-no{background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;font-family:'Fira Code',monospace;text-transform:uppercase;letter-spacing:0.05em;}
        .reachable-unknown{background:var(--bg-input);color:var(--text-dim);padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;font-family:'Fira Code',monospace;text-transform:uppercase;letter-spacing:0.05em;}

        /* MISC */
        .vuln-count{
            background:#ffedd5;color:#c2410c;padding:2px 8px;border-radius:4px;
            font-weight:700;font-size:11px;font-family:'Fira Code',monospace;
        }
        .sast-rule-name,.sast-filepath{font-family:'Fira Code',monospace;font-size:12px;color:var(--text);}
        .sast-filepath{color:var(--text-dim);}

        .empty-state{
            text-align:center;padding:60px 20px;background:var(--bg-input);
            border-radius:10px;border:1px solid var(--border);
        }
        .empty-state i{font-size:42px;color:var(--text-faint);margin-bottom:14px;display:block;}
        .empty-state h3{font-size:16px;margin-bottom:6px;color:var(--text);font-weight:700;}
        .empty-state p{font-size:13px;color:var(--text-dim);}

        /* SAST MODAL (вложенная модалка фильтров) */
        .sast-modal-overlay{
            position:fixed;inset:0;background:rgba(0,0,0,0.6);
            backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
            z-index:21000;display:none;
            justify-content:center;align-items:center;padding:20px;
        }
        .sast-modal-overlay.active,.sast-modal-overlay.show{display:flex;}
        .sast-modal{
            background:var(--bg-card);border-radius:12px;border:1px solid var(--border);
            width:520px;max-width:96%;max-height:calc(100vh - 40px);
            display:flex;flex-direction:column;overflow:hidden;
            box-shadow:0 24px 60px rgba(0,0,0,0.5);
            animation:sastModalFadeIn .2s ease;
            color:var(--text);
        }
        @keyframes sastModalFadeIn{
            from{opacity:0;transform:scale(.96) translateY(-10px)}
            to{opacity:1;transform:scale(1) translateY(0)}
        }
        .sast-modal-header{
            display:flex;justify-content:space-between;align-items:center;
            padding:18px 22px;border-bottom:1px solid var(--border);flex-shrink:0;
        }
        .sast-modal-header h3{
            margin:0;font-size:16px;font-weight:700;color:var(--text);
            display:flex;align-items:center;gap:8px;font-family:'Fira Sans',sans-serif;
        }
        .sast-modal-header h3 i{color:var(--accent);font-size:16px;}
        .sast-modal-close{
            background:none;border:none;font-size:16px;cursor:pointer;color:var(--text-dim);
            width:32px;height:32px;display:flex;align-items:center;justify-content:center;
            border-radius:6px;transition:all .15s;line-height:1;
        }
        .sast-modal-close:hover{background:var(--bg-input);color:var(--text);}
        .sast-modal-body{padding:20px 22px;overflow-y:auto;flex:1;}
        .sast-filter-group{margin-bottom:20px;}
        .sast-filter-group:last-child{margin-bottom:0;}
        .sast-filter-group label{
            display:block;margin-bottom:8px;font-weight:600;font-size:13px;
            color:var(--text);font-family:'Fira Sans',sans-serif;
        }
        .sast-checkbox-label{
            display:flex;align-items:center;gap:10px;cursor:pointer;
            font-size:14px;color:var(--text);font-family:'Fira Sans',sans-serif;
        }
        .sast-checkbox-label input{
            width:16px;height:16px;cursor:pointer;accent-color:var(--accent);margin:0;
        }
        .sast-checkbox-label span{font-weight:400;}
        .sast-filter-hint{
            font-size:11px;color:var(--text-dim);margin-top:6px;margin-left:26px;
            line-height:1.5;font-family:'Fira Sans',sans-serif;
        }
        .sast-select{
            width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;
            font-size:13px;font-family:'Fira Sans',sans-serif;background:var(--bg-input);
            color:var(--text);cursor:pointer;transition:border-color .15s;
        }
        .sast-select:hover{border-color:var(--accent);}
        .sast-select:focus{
            outline:none;border-color:var(--accent);
            box-shadow:0 0 0 3px var(--logo-glow);
        }
        .sast-modal-footer{
            display:flex;justify-content:flex-end;gap:10px;padding:14px 22px;
            border-top:1px solid var(--border);background:var(--bg-input);
            border-radius:0 0 12px 12px;flex-shrink:0;
        }
        .sast-btn{
            padding:8px 18px;border-radius:6px;font-size:13px;font-weight:600;
            cursor:pointer;border:none;font-family:'Fira Sans',sans-serif;
            transition:all .15s;line-height:1.2;
        }
        .sast-btn-secondary{background:var(--bg-card);color:var(--text-dim);border:1px solid var(--border);}
        .sast-btn-secondary:hover{background:var(--bg-input);color:var(--text);}
        .sast-btn-primary{background:var(--accent);color:var(--accent-ink);}
        .sast-btn-primary:hover{background:var(--accent-2);}

        /* BLOCK HEADER (SCA groups) */
        .dep-group h5{
            display:inline-flex;align-items:center;gap:8px;
            border-bottom:2px solid var(--accent);padding-bottom:6px;
            color:var(--text);font-size:13px;font-weight:700;letter-spacing:0.05em;
            text-transform:uppercase;margin-bottom:12px;
        }
        .dep-group h5 i{color:var(--accent);}
        .dep-group h5 span{color:var(--text-dim);font-weight:500;text-transform:none;letter-spacing:0;}

        /* RESPONSIVE */
        @media (max-width:1100px){
            .report-content{padding:20px 0;}
        }
        @media (max-width:768px){
            .stats-grid{grid-template-columns:repeat(2,1fr);}
            .dep-table,.sast-table{font-size:11px;}
            .dep-table th,.dep-table td,.sast-table th,.sast-table td{padding:8px;}
            .filter-bar,.sast-filter-bar{flex-direction:column;align-items:stretch;}
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1><i class="fas fa-shield-halved"></i> Hercules | Blender</h1>
            <p>Comprehensive security analysis — SCA &amp; SAST</p>
            <div class="report-meta">
                <span><i class="fas fa-calendar"></i> Generated: ${generated}</span>
                <span><i class="fas fa-cubes"></i> SCA: ${scaCount}</span>
                <span><i class="fas fa-code"></i> SAST: ${sastCount}</span>
            </div>
        </div>

        <div class="report-tabs">
            <button class="report-tab active" data-tab="summary"><i class="fas fa-chart-pie"></i> Summary</button>
            <button class="report-tab" data-tab="sca"><i class="fas fa-cubes"></i> SCA <span class="tab-badge">${scaCount}</span></button>
            <button class="report-tab" data-tab="sast"><i class="fas fa-code"></i> SAST <span class="tab-badge">${sastCount}</span></button>
        </div>

        <div class="report-content">
            <div class="tab-pane active" id="tab-summary">
                ${summaryHtml}
            </div>
            <div class="tab-pane" id="tab-sca">
                ${scaHtml}
            </div>
            <div class="tab-pane" id="tab-sast">
                ${sastHtml}
            </div>
        </div>

        <div class="report-footer">
            <p>Generated with <strong>Hercules | Blender</strong> · Comprehensive security analysis</p>
            <p>SCA based on public CVE databases · SAST based on static code analysis rules</p>
        </div>
    </div>

    <script>
    // Tabs
    document.querySelectorAll('.report-tab').forEach(function(tab){
        tab.addEventListener('click', function(){
            var target = tab.getAttribute('data-tab');
            document.querySelectorAll('.report-tab').forEach(function(t){t.classList.remove('active');});
            document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');});
            tab.classList.add('active');
            var pane = document.getElementById('tab-' + target);
            if (pane) pane.classList.add('active');
        });
    });

    // Expandable rows (SCA)
    document.querySelectorAll('.dep-row').forEach(function(row){
        var icon = row.querySelector('.expand-icon');
        var details = row.nextElementSibling;
        if (!icon || !details) return;

        function toggle(){
            if (details.style.display === 'none' || !details.style.display){
                details.style.display = 'table-row';
                details.classList.add('show');
                icon.style.transform = 'rotate(90deg)';
            } else {
                details.style.display = 'none';
                details.classList.remove('show');
                icon.style.transform = 'rotate(0deg)';
            }
        }
        icon.onclick = function(e){e.stopPropagation(); toggle();};
        row.onclick = toggle;
    });

    // Expandable rows (SAST)
    document.querySelectorAll('.sast-row').forEach(function(row){
        var icon = row.querySelector('.sast-expand-icon');
        var details = row.nextElementSibling;
        if (!icon || !details) return;

        function toggle(){
            if (details.style.display === 'none' || !details.style.display){
                details.style.display = 'table-row';
                details.classList.add('show');
                icon.style.transform = 'rotate(90deg)';
            } else {
                details.style.display = 'none';
                details.classList.remove('show');
                icon.style.transform = 'rotate(0deg)';
            }
        }
        icon.onclick = function(e){e.stopPropagation(); toggle();};
        row.onclick = toggle;
    });

    // SCA filter
    var scaSearch = document.getElementById('vulnSearch');
    var scaBtns = document.querySelectorAll('#tab-sca .filter-btn');
    var currentScaFilter = 'all';
    var currentScaReachable = false;

    function filterSca(){
        var searchText = scaSearch ? scaSearch.value.toLowerCase() : '';
        var rows = document.querySelectorAll('#tab-sca .dep-row');
        rows.forEach(function(row){
            var severity = row.getAttribute('data-severity') || '';
            var reachable = row.getAttribute('data-reachable') === 'true';
            var component = (row.getAttribute('data-component') || '').toLowerCase();

            var show = true;
            if (currentScaFilter === 'critical') show = show && severity === 'critical';
            else if (currentScaFilter === 'high') show = show && severity === 'high';
            else if (currentScaFilter === 'medium') show = show && severity === 'medium';
            else if (currentScaFilter === 'low') show = show && severity === 'low';
            if (currentScaReachable) show = show && reachable;
            if (searchText) show = show && component.indexOf(searchText) !== -1;

            row.style.display = show ? '' : 'none';
            if (!show){
                var details = row.nextElementSibling;
                if (details && details.classList.contains('dep-details-row')){
                    details.style.display = 'none';
                    details.classList.remove('show');
                    var icon = row.querySelector('.expand-icon');
                    if (icon) icon.style.transform = 'rotate(0deg)';
                }
            }
        });
    }

    scaBtns.forEach(function(btn){
        btn.onclick = function(){
            var fv = btn.getAttribute('data-filter');
            if (fv === 'reachable'){
                currentScaReachable = !currentScaReachable;
                btn.classList.toggle('active');
            } else {
                scaBtns.forEach(function(b){
                    if (b.getAttribute('data-filter') !== 'reachable') b.classList.remove('active');
                });
                btn.classList.add('active');
                currentScaFilter = fv;
            }
            filterSca();
        };
    });
    if (scaSearch) scaSearch.oninput = filterSca;

    // SAST filter
    var sastSearch = document.querySelector('#tab-sast .sast-search-box');
    var sastBtns = document.querySelectorAll('#tab-sast .sast-filter-btn');
    var currentSastFilter = 'all';

    function filterSast(){
        var searchText = sastSearch ? sastSearch.value.toLowerCase() : '';
        var rows = document.querySelectorAll('#tab-sast .sast-row');
        rows.forEach(function(row){
            var severity = (row.getAttribute('data-severity') || '').toLowerCase();
            var file = row.getAttribute('data-fullpath') || '';
            var rule = row.getAttribute('data-rule') || '';

            var show = true;
            if (currentSastFilter !== 'all') show = show && severity === currentSastFilter;
            if (searchText) show = show && (file.toLowerCase().indexOf(searchText) !== -1 || rule.toLowerCase().indexOf(searchText) !== -1);

            row.style.display = show ? '' : 'none';
            if (!show){
                var details = row.nextElementSibling;
                if (details && details.classList.contains('sast-details-row')){
                    details.style.display = 'none';
                    details.classList.remove('show');
                    var icon = row.querySelector('.sast-expand-icon');
                    if (icon) icon.style.transform = 'rotate(0deg)';
                }
            }
        });
    }

    sastBtns.forEach(function(btn){
        btn.onclick = function(){
            sastBtns.forEach(function(b){b.classList.remove('active');});
            btn.classList.add('active');
            currentSastFilter = btn.getAttribute('data-filter');
            filterSast();
        };
    });
    if (sastSearch) sastSearch.oninput = filterSast;

    // Advanced SAST filters modal
    var filterBtn = document.querySelector('#tab-sast .sast-filter-btn-ext');
    var modal = document.querySelector('#tab-sast .sast-modal-overlay');
    var excludeCheckbox = document.querySelector('#tab-sast .sast-checkbox-label input');
    var ruleSelect = document.querySelector('#tab-sast .sast-select');

    function isTestMockFile(path){
        if (!path) return false;
        var p = path.toLowerCase();
        return p.indexOf('test') !== -1 || p.indexOf('mock') !== -1 || p.indexOf('spec') !== -1
            || p.indexOf('fixture') !== -1 || p.indexOf('__tests__') !== -1;
    }

    function applyExtendedFilters(){
        var exclude = excludeCheckbox ? excludeCheckbox.checked : false;
        var rule = ruleSelect ? ruleSelect.value : 'all';
        document.querySelectorAll('#tab-sast .sast-row').forEach(function(row){
            var filePath = row.getAttribute('data-fullpath') || '';
            var ruleName = row.getAttribute('data-rule') || '';
            var show = true;
            if (exclude) show = show && !isTestMockFile(filePath);
            if (rule !== 'all') show = show && ruleName === rule;
            row.style.display = show ? '' : 'none';
            if (!show){
                var details = row.nextElementSibling;
                if (details) details.style.display = 'none';
                var icon = row.querySelector('.sast-expand-icon');
                if (icon) icon.style.transform = 'rotate(0deg)';
            }
        });
    }

    if (filterBtn && modal){
        filterBtn.onclick = function(){ modal.style.display = 'flex'; };
        var closeBtn = modal.querySelector('.sast-modal-close');
        if (closeBtn) closeBtn.onclick = function(){ modal.style.display = 'none'; };
        var applyBtn = modal.querySelector('.sast-filter-apply');
        if (applyBtn) applyBtn.onclick = function(){ applyExtendedFilters(); modal.style.display = 'none'; };
        var resetBtn = modal.querySelector('.sast-filter-reset');
        if (resetBtn) resetBtn.onclick = function(){
            if (excludeCheckbox) excludeCheckbox.checked = false;
            if (ruleSelect) ruleSelect.value = 'all';
            document.querySelectorAll('#tab-sast .sast-row').forEach(function(r){r.style.display = '';});
            modal.style.display = 'none';
        };
        modal.onclick = function(e){ if (e.target === modal) modal.style.display = 'none'; };
    }

    setTimeout(function(){ filterSca(); filterSast(); }, 150);
    </script>
</body>
</html>`;
}

function updateOverallProgress(percent) {
    const overallProgress = document.getElementById('overallProgress');
    const overallPercent = document.getElementById('overallPercent');
    if (overallProgress) {
        overallProgress.style.width = `${percent}%`;
    }
    if (overallPercent) {
        overallPercent.textContent = `${percent}%`;
    }
}

function updateThermometerFill(percent) {
    const fill = document.getElementById('thermometerFill');
    if (fill) {
        fill.style.width = `${percent}%`;
    }
}

function updateStepStatus(step, status) {
    const dot = document.getElementById(`markDot${step}`);
    const label = document.getElementById(`markLabel${step}`);

    if (dot) {
        dot.classList.remove('completed', 'active');
        if (status === 'completed') {
            dot.classList.add('completed');
        } else if (status === 'active') {
            dot.classList.add('active');
        }
    }

    if (label) {
        label.classList.remove('completed', 'active');
        if (status === 'completed') {
            label.classList.add('completed');
        } else if (status === 'active') {
            label.classList.add('active');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const activateBtn = document.getElementById('activateLicenseBtn');
    if (activateBtn) {
        activateBtn.onclick = activateLicense;
    }
});

export {
    formatBytes,
    delay,
    escapeHtml,
    loadJSZip,
    createZipArchive,
    generateCodeHTML,
    generateSummaryHTML,
    generateHTMLReport,
    updateOverallProgress,
    updateThermometerFill,
    updateStepStatus
};