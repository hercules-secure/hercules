/**
 * UI Components
 */

import { showToolNotification } from './notifications.js';
import { getShortPath } from './utils.js';

export function showResultsModal(results, onClose) {
    const issues = results.issues || results.results || [];
    const stats = results.statistics || results.summary || {};
    const metadata = results.metadata || {};

    const normalizeSeverity = (sev) => {
        if (!sev) return 'info';
        const lower = sev.toLowerCase();
        if (['critical', 'high', 'medium', 'low', 'info'].includes(lower)) {
            return lower;
        }
        return 'info';
    };

    const criticalHigh = issues.filter(r => {
        const sev = normalizeSeverity(r.severity);
        return sev === 'critical' || sev === 'high';
    });

    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    const severityNames = {
        critical: 'Critical',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        info: 'Info'
    };

    const renderCodeBlock = (item) => {
        if (item.codeBlock && item.codeBlock.lines && item.codeBlock.lines.length > 0) {
            const maxLineNumber = Math.max(...item.codeBlock.lines.map(l => l.number));
            const lineNumberWidth = String(maxLineNumber).length;
            const hasVulnerableLine = item.codeBlock.lines.some(line => line.isVulnerable === true);

            const linesHtml = item.codeBlock.lines.map(line => {
                const num = String(line.number).padStart(lineNumberWidth, ' ');
                const cls = line.isVulnerable ? 'code-line vulnerable-line' : 'code-line';
                const textCls = line.isVulnerable ? 'code-line-text is-vulnerable' : 'code-line-text';
                return `<div class="${cls}">` +
                       `<span class="code-line-number">${num}</span>` +
                       `<span class="${textCls}">${escapeHtml(line.code)}</span>` +
                       `</div>`;
            }).join('');

            return `<div class="code-block">` +
                   `<div class="code-header"><i class="fas fa-code"></i><span>Vulnerable code</span></div>` +
                   `<pre>${linesHtml}</pre>` +
                   `${hasVulnerableLine ? '<div class="code-legend"><span class="legend-dot"></span> Vulnerable line</div>' : ''}` +
                   `</div>`;
        } else if (item.snippet) {
            return `<div class="code-block">` +
                   `<div class="code-header"><i class="fas fa-code"></i><span>Suspicious fragment</span></div>` +
                   `<pre><code class="code-line-text is-vulnerable">${escapeHtml(item.snippet)}</code></pre>` +
                   `</div>`;
        } else if (item.code) {
            return `<div class="code-block">` +
                   `<div class="code-header"><i class="fas fa-code"></i><span>Suspicious code</span></div>` +
                   `<pre><code class="code-line-text">${escapeHtml(item.code)}</code></pre>` +
                   `</div>`;
        }
        return '';
    };

    const totalCount = stats.total || issues.length || 0;
    const criticalCount = stats.critical || 0;
    const highCount = stats.high || 0;
    const mediumCount = stats.medium || 0;
    const lowCount = stats.low || 0;
    const infoCount = stats.info || 0;

    const criticalHighHtml = criticalHigh.length > 0
        ? criticalHigh.map((item) => {
            const shortPath = getShortPath(item.file);
            const severity = normalizeSeverity(item.severity);
            const severityName = severityNames[severity] || severity;

            return `
                <div class="vuln-item" data-severity="${severity}">
                    <div class="vuln-header">
                        <div class="vuln-header-left">
                            <span class="severity-badge badge-${severity}">${severityName}</span>
                            <code class="file-path">${escapeHtml(shortPath)}:${item.line || '?'}</code>
                        </div>
                        <span class="rule-id">${escapeHtml(item.ruleId || 'unknown')}</span>
                    </div>
                    <p class="vuln-message">${escapeHtml(item.message)}</p>
                    ${renderCodeBlock(item)}
                    ${item.recommendation ? `
                        <div class="recommendation">
                            <i class="fas fa-lightbulb"></i>
                            <div>
                                <div class="recommendation-title">Recommendation</div>
                                <div class="recommendation-text">${escapeHtml(item.recommendation)}</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('')
        : `<div class="empty-state">
               <i class="fas fa-check-circle"></i>
               <h3>No critical or high vulnerabilities found</h3>
               <p>Analysis completed successfully.</p>
           </div>`;

    const metadataHtml = metadata.archiveName ? `
        <div class="file-info">
            <span><i class="fas fa-archive"></i> <strong>Archive:</strong> ${escapeHtml(metadata.archiveName)}</span>
            ${metadata.fileCount ? `<span><i class="fas fa-file-code"></i> <strong>Files:</strong> ${metadata.fileCount}</span>` : ''}
            ${metadata.scanTime ? `<span><i class="fas fa-calendar"></i> <strong>Scan:</strong> ${new Date(metadata.scanTime).toLocaleString()}</span>` : ''}
        </div>
    ` : '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
        <style>
            .modal-overlay{
                position:fixed;inset:0;background:rgba(15,23,42,0.65);
                display:flex;justify-content:center;align-items:center;
                z-index:10000;padding:16px;
                font-family:'Fira Sans',sans-serif;
                backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
                animation:modalOverlayFadeIn .2s ease;
            }
            @keyframes modalOverlayFadeIn{from{opacity:0}to{opacity:1}}

            .modal-container{
                background:#fff;border-radius:12px;border:1px solid #e3e8f0;
                width:96vw;max-width:1600px;max-height:92vh;
                display:flex;flex-direction:column;overflow:hidden;
                box-shadow:0 24px 60px rgba(15,23,42,0.35);
                animation:modalFadeIn .25s ease;
            }
            @keyframes modalFadeIn{
                from{opacity:0;transform:scale(.97) translateY(-12px)}
                to{opacity:1;transform:scale(1) translateY(0)}
            }

            .modal-header{
                padding:18px 24px;background:#fff;color:#0f172a;
                display:flex;justify-content:space-between;align-items:center;
                border-bottom:1px solid #e3e8f0;flex-shrink:0;
            }
            .modal-header h3{
                margin:0;font-size:18px;font-weight:700;letter-spacing:-0.01em;
                display:flex;align-items:center;gap:10px;color:#0f172a;
            }
            .modal-header h3 i{color:#0891b2;font-size:18px;}
            .modal-header h3 .sub{color:#64748b;font-weight:400;font-size:13px;margin-left:8px;}
            .modal-close{
                background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;
                width:34px;height:34px;display:flex;align-items:center;justify-content:center;
                border-radius:6px;transition:all .15s;
            }
            .modal-close:hover{background:#f1f5f9;color:#0f172a;}

            .modal-body{
                padding:24px 28px;overflow-y:auto;flex:1;background:#f4f6fb;
            }

            .file-info{
                display:flex;gap:22px;flex-wrap:wrap;font-size:12px;color:#64748b;
                background:#fff;padding:12px 16px;border-radius:10px;
                border:1px solid #e3e8f0;margin-bottom:20px;
            }
            .file-info span{display:flex;align-items:center;gap:6px;}
            .file-info i{color:#0891b2;font-size:12px;}
            .file-info strong{color:#0f172a;font-weight:600;}

            .stats-grid{
                display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:24px;
            }
            .stat-card{
                background:#fff;padding:16px;border-radius:10px;
                border:1px solid #e3e8f0;text-align:center;
                transition:border-color .15s;
            }
            .stat-card:hover{border-color:#0891b2;}
            .stat-number{
                font-size:28px;font-weight:700;font-family:'Fira Code',monospace;
                color:#0f172a;line-height:1;
            }
            .stat-number.c-total{color:#0891b2;}
            .stat-number.c-critical{color:#dc3545;}
            .stat-number.c-high{color:#fd7e14;}
            .stat-number.c-medium{color:#d97706;}
            .stat-number.c-low{color:#16a34a;}
            .stat-number.c-info{color:#64748b;}
            .stat-label{font-size:12px;color:#64748b;margin-top:8px;}

            .section-title{
                margin:8px 0 16px 0;color:#0f172a;font-size:15px;font-weight:700;
                display:flex;align-items:center;gap:10px;
            }
            .section-title .count-pill{
                background:#f1f5f9;color:#64748b;padding:2px 10px;border-radius:4px;
                font-size:12px;font-family:'Fira Code',monospace;font-weight:600;
            }

            .vuln-item{
                background:#fff;padding:18px 20px;margin-bottom:12px;border-radius:10px;
                border:1px solid #e3e8f0;transition:border-color .15s;
            }
            .vuln-item:hover{border-color:#cbd5e1;}

            .vuln-header{
                display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;
                margin-bottom:12px;align-items:center;
            }
            .vuln-header-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}

            .severity-badge{
                display:inline-block;padding:3px 10px;border-radius:4px;
                font-size:10px;font-weight:700;font-family:'Fira Code',monospace;
                text-transform:uppercase;letter-spacing:0.05em;
            }
            .badge-critical{background:#fee2e2;color:#b91c1c;}
            .badge-high{background:#ffedd5;color:#c2410c;}
            .badge-medium{background:#fef3c7;color:#a16207;}
            .badge-low{background:#dcfce7;color:#15803d;}
            .badge-info{background:#e0f2fe;color:#0369a1;}

            .file-path{
                background:#f1f5f9;color:#475569;padding:3px 10px;border-radius:4px;
                font-size:12px;font-family:'Fira Code',monospace;
            }
            .rule-id{
                color:#64748b;font-size:11px;font-family:'Fira Code',monospace;
                padding:3px 10px;background:#f8fafc;border-radius:4px;
                border:1px solid #e3e8f0;
            }
            .vuln-message{
                margin:0 0 14px 0;font-weight:500;color:#0f172a;
                font-size:14px;line-height:1.5;
            }

            /* CODE BLOCK */
            .code-block{
                background:#0f172a;border-radius:8px;margin:14px 0;
                overflow:hidden;border:1px solid #1e293b;
            }
            .code-header{
                background:#1e293b;padding:9px 14px;font-size:11px;font-weight:700;
                color:#94a3b8;border-bottom:1px solid #334155;
                display:flex;align-items:center;gap:8px;
                font-family:'Fira Sans',sans-serif;
                text-transform:uppercase;letter-spacing:0.05em;
            }
            .code-header i{color:#0891b2;}
            .code-block pre{
                margin:0;padding:14px 0;overflow-x:auto;
                font-family:'Fira Code',monospace;font-size:12px;line-height:1.5;
            }
            .code-line{
                display:flex;align-items:flex-start;
                min-height:18px;line-height:18px;white-space:pre;
                font-family:'Fira Code',monospace;
            }
            .code-line-number{
                color:#484f58;width:52px;flex:0 0 52px;text-align:right;
                padding-right:12px;user-select:none;font-size:12px;
            }
            .code-line-text{
                color:#e2e8f0;white-space:pre;padding-right:14px;
            }
            .code-line-text.is-vulnerable{color:#f85149;font-weight:500;}
            .code-line.vulnerable-line{
                background:rgba(239,68,68,0.15);
            }
            .code-legend{
                display:flex;align-items:center;gap:8px;
                padding:8px 14px;font-size:11px;color:#8b949e;
                border-top:1px solid #1e293b;background:#0b1220;
            }
            .legend-dot{
                display:inline-block;width:8px;height:8px;border-radius:50%;
                background:#ef4444;
            }

            .recommendation{
                background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                padding:14px;margin-top:14px;display:flex;gap:12px;
            }
            .recommendation i{font-size:18px;color:#b45309;flex-shrink:0;}
            .recommendation-title{
                font-size:12px;font-weight:700;margin-bottom:4px;color:#0f172a;
                text-transform:uppercase;letter-spacing:0.05em;
            }
            .recommendation-text{
                font-size:12px;color:#475569;line-height:1.5;
            }

            .empty-state{
                text-align:center;padding:60px 20px;background:#fff;
                border-radius:10px;border:1px solid #e3e8f0;
            }
            .empty-state i{font-size:42px;color:#cbd5e1;margin-bottom:14px;display:block;}
            .empty-state h3{font-size:16px;margin-bottom:6px;color:#0f172a;font-weight:700;}
            .empty-state p{font-size:13px;color:#64748b;}

            .modal-footer{
                padding:14px 24px;background:#f8fafc;border-top:1px solid #e3e8f0;
                display:flex;justify-content:flex-end;gap:10px;flex-shrink:0;
            }
            .btn{
                padding:9px 18px;border-radius:6px;font-size:13px;font-weight:600;
                cursor:pointer;border:none;font-family:'Fira Sans',sans-serif;
                transition:all .15s;display:inline-flex;align-items:center;gap:8px;
                color:#fff;
            }
            .btn i{font-size:13px;}
            .btn-html{background:#0891b2;}
            .btn-html:hover{background:#0e7490;}
            .btn-download{background:#10b981;}
            .btn-download:hover{background:#0e9f6e;}

            @media (max-width:1100px){
                .stats-grid{grid-template-columns:repeat(3,1fr);}
            }
            @media (max-width:768px){
                .modal-body{padding:20px;}
                .stats-grid{grid-template-columns:repeat(2,1fr);}
                .vuln-header{flex-direction:column;align-items:flex-start;}
            }
        </style>
        <div class="modal-container">
            <div class="modal-header">
                <h3>
                    <i class="fas fa-shield-halved"></i>
                    SAST Analysis Results
                    <span class="sub">${totalCount} issues · ${criticalHigh.length} critical/high</span>
                </h3>
                <button class="modal-close" aria-label="Close"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                ${metadataHtml}

                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-number c-total">${totalCount}</div><div class="stat-label">Total</div></div>
                    <div class="stat-card"><div class="stat-number c-critical">${criticalCount}</div><div class="stat-label">Critical</div></div>
                    <div class="stat-card"><div class="stat-number c-high">${highCount}</div><div class="stat-label">High</div></div>
                    <div class="stat-card"><div class="stat-number c-medium">${mediumCount}</div><div class="stat-label">Medium</div></div>
                    <div class="stat-card"><div class="stat-number c-low">${lowCount}</div><div class="stat-label">Low</div></div>
                    <div class="stat-card"><div class="stat-number c-info">${infoCount}</div><div class="stat-label">Info</div></div>
                </div>

                <h4 class="section-title">
                    <i class="fas fa-triangle-exclamation" style="color:#dc3545;"></i>
                    Critical &amp; High Vulnerabilities
                    <span class="count-pill">${criticalHigh.length}</span>
                </h4>
                <div id="vulnerabilities-list">${criticalHighHtml}</div>
            </div>
            <div class="modal-footer">
                <button id="downloadHtmlBtn" class="btn btn-html">
                    <i class="fas fa-file-arrow-down"></i> Download HTML
                </button>
                <button id="downloadReportBtn" class="btn btn-download">
                    <i class="fas fa-file-code"></i> Download JSON
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closePopup = () => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s';
        setTimeout(() => {
            overlay.remove();
            if (onClose) onClose();
        }, 200);
    };

    overlay.querySelector('.modal-close').addEventListener('click', closePopup);
    overlay.querySelector('#downloadReportBtn').addEventListener('click', () => downloadJSONReport(results));
    overlay.querySelector('#downloadHtmlBtn').addEventListener('click', () => downloadHTMLReport(results));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePopup();
    });
}

function downloadJSONReport(results) {
    try {
        const reportData = JSON.stringify(results, null, 2);
        const blob = new Blob([reportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sast-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToolNotification('JSON report downloaded successfully', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showToolNotification('Error downloading JSON report', 'error');
    }
}

function downloadHTMLReport(results, sourceName = null) {
    try {
        const defaultName = sourceName 
            ? `sast-report-${sourceName}-${new Date().toISOString().split('T')[0]}`
            : `sast-report-${new Date().toISOString().split('T')[0]}`;
        
        let reportName = prompt('Enter report name:', defaultName);
        
        if (reportName === null) {
            showToolNotification('Download cancelled', 'info');
            return;
        }
        
        if (reportName.trim() === '') {
            reportName = defaultName;
        }
        
        reportName = reportName
            .trim()
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 100);
        
        showToolNotification('Generating HTML report...', 'info');
        
        const htmlContent = generateFullHTMLReport(results);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportName}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToolNotification(`HTML report "${reportName}.html" downloaded successfully`, 'success');
    } catch (error) {
        console.error('HTML download error:', error);
        showToolNotification('Error downloading HTML report', 'error');
    }
}

function generateFullHTMLReport(results) {
    const issues = results.issues || results.results || [];
    const stats = results.statistics || results.summary || {};
    const metadata = results.metadata || {};
    
    const severityNames = {
        critical: 'Critical',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        info: 'Info'
    };
    
    const severityColors = {
        critical: '#dc3545',
        high: '#fd7e14',
        medium: '#ffc107',
        low: '#28a745',
        info: '#6c757d'
    };
    
    const normalizeSeverity = (sev) => {
        if (!sev) return 'info';
        const lower = sev.toLowerCase();
        if (['critical', 'high', 'medium', 'low', 'info'].includes(lower)) {
            return lower;
        }
        return 'info';
    };
    
    const escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    
    const renderCodeBlock = (item) => {
        if (item.codeBlock && item.codeBlock.lines && item.codeBlock.lines.length > 0) {
            const maxLineNumber = Math.max(...item.codeBlock.lines.map(l => l.number));
            const lineNumberWidth = String(maxLineNumber).length;
            
            return `
                <div class="code-block" style="background: #0d1117; color: #e6edf3; padding: 16px; border-radius: 8px; font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 13px; margin-bottom: 14px; overflow-x: auto; border: 1px solid #30363d; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);">
                    ${item.codeBlock.lines.map(line => `
                        <div style="display: flex; align-items: center; min-height: 22px; ${line.isVulnerable ? 'background: rgba(239, 68, 68, 0.15); padding-left: 4px;' : 'padding-left: 7px;'}">
                            <span style="color: #484f58; display: inline-block; width: ${lineNumberWidth * 8 + 8}px; text-align: right; padding-right: 12px; user-select: none; font-size: 12px; flex-shrink: 0;">${String(line.number).padStart(lineNumberWidth, ' ')}</span>
                            <span style="${line.isVulnerable ? 'color: #f85149; font-weight: 500;' : 'color: #e6edf3;'} white-space: pre;">${escapeHtml(line.code)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (item.snippet) {
            return `
                <div class="code-block" style="background: #0d1117; color: #e6edf3; padding: 16px; border-radius: 8px; font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 13px; margin-bottom: 14px; overflow-x: auto; border: 1px solid #30363d; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);">
                    <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; color: #f85149;">${escapeHtml(item.snippet)}</pre>
                </div>
            `;
        } else if (item.code) {
            return `
                <div class="code-block" style="background: #0d1117; color: #e6edf3; padding: 16px; border-radius: 8px; font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 13px; margin-bottom: 14px; overflow-x: auto; border: 1px solid #30363d; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);">
                    <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; color: #e6edf3;">${escapeHtml(item.code)}</pre>
                </div>
            `;
        }
        return '';
    };
    
    const totalCount = stats.total || issues.length || 0;
    const criticalCount = stats.critical || 0;
    const highCount = stats.high || 0;
    const mediumCount = stats.medium || 0;
    const lowCount = stats.low || 0;
    const infoCount = stats.info || 0;
    
    const allVulnerabilitiesHtml = issues.map((item) => {
        const shortPath = getShortPath(item.file);
        const severity = normalizeSeverity(item.severity);
        
        return `
            <div class="vuln-item" data-severity="${severity}" style="background: #f8f9fa; padding: 16px; margin-bottom: 16px; border-radius: 8px; border: 1px solid #e9ecef;">
                <div class="vuln-header" style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                    <div>
                        <span class="severity-badge" style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; color: white; background: ${severityColors[severity] || '#6c757d'};">
                            ${severityNames[severity] || severity}
                        </span>
                        <code class="file-path" style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 10px;">
                            ${shortPath}:${item.line || '?'}
                        </code>
                    </div>
                    <span class="rule-id" style="color: #6c757d; font-size: 12px;">${item.ruleId || 'unknown'}</span>
                </div>
                <p class="vuln-message" style="margin: 0 0 12px 0; font-weight: 500; color: #212529;">${escapeHtml(item.message)}</p>
                ${renderCodeBlock(item)}
                ${item.recommendation ? `
                    <div class="recommendation" style="background: rgba(40, 167, 69, 0.1); padding: 12px; border-radius: 6px; font-size: 13px; color: #28a745;">
                        <strong>Recommendation:</strong> ${escapeHtml(item.recommendation)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    const archiveName = metadata.archiveName || 'Unknown';
    const fileCount = metadata.fileCount || 0;
    const scanTime = metadata.scanTime ? new Date(metadata.scanTime).toLocaleString() : new Date().toLocaleString();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <title>Hercules | SAST - ${new Date().toLocaleDateString()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Fira Sans', sans-serif; background: #f5f5f5; padding: 20px; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }
        .header { background: #0a0a12; color: white; padding: 40px; border-bottom: 2px solid #00ffc8; }
        .header h1 { font-size: 32px; margin-bottom: 10px; }
        .header h1 span { color: #00ffc8; }
        .header .meta { opacity: 0.9; font-size: 14px; color: #8a8aaa; }
        .header .meta strong { color: #e0e0f0; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; padding: 30px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .stat-card .label { font-size: 14px; color: #6c757d; margin-bottom: 10px; }
        .stat-card .value { font-size: 36px; font-weight: bold; font-family: 'Fira Code', monospace; }
        .total-card { background: linear-gradient(135deg, #0a0a12 0%, #1a1a2e 100%); color: white; border: 1px solid #2a2a3e; }
        .total-card .label { color: rgba(255,255,255,0.7); }
        .content { padding: 30px; }
        .filter-bar { margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .filter-btn { padding: 8px 16px; background: #e9ecef; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; font-family: 'Fira Sans', sans-serif; }
        .filter-btn.active { background: #0a0a12; color: white; border: 1px solid #00ffc8; }
        .filter-btn:hover { background: #0a0a12; color: white; }
        .search-box { flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 14px; min-width: 200px; font-family: 'Fira Sans', sans-serif; }
        .search-box:focus { outline: none; border-color: #00ffc8; }
        .vuln-item { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .code-block { background: #1f2937; color: #e5e7eb; padding: 12px; border-radius: 6px; font-family: 'Fira Code', monospace; font-size: 12px; margin-bottom: 12px; overflow-x: auto; }
        .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
        .file-info { background: #e9ecef; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; color: #495057; display: flex; gap: 20px; flex-wrap: wrap; }
        .file-info span { background: white; padding: 4px 12px; border-radius: 4px; }
        @media (max-width: 768px) { .stats { grid-template-columns: repeat(2, 1fr); } .header { padding: 20px; } .content { padding: 20px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Hercules <span>//</span> SAST</h1>
            <div class="meta">
                <div><strong>Archive:</strong> ${escapeHtml(archiveName)}</div>
                <div style="margin-top:4px;"><strong>Files analyzed:</strong> ${fileCount}</div>
                <div style="margin-top:4px;"><strong>Scan date:</strong> ${scanTime}</div>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card total-card">
                <div class="label">Total Vulnerabilities</div>
                <div class="value">${totalCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">Critical</div>
                <div class="value" style="color: #dc3545;">${criticalCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">High</div>
                <div class="value" style="color: #fd7e14;">${highCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">Medium</div>
                <div class="value" style="color: #ffc107;">${mediumCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">Low</div>
                <div class="value" style="color: #28a745;">${lowCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">Info</div>
                <div class="value" style="color: #6c757d;">${infoCount}</div>
            </div>
        </div>
        
        <div class="content">
            <div class="file-info">
                <span><strong>Total files:</strong> ${fileCount}</span>
                <span><strong>Vulnerabilities:</strong> ${totalCount}</span>
            </div>
            
            <div class="filter-bar">
                <input type="text" class="search-box" id="searchInput" placeholder="Search by message, file or rule ID...">
                <button class="filter-btn active" data-filter="all">All (${totalCount})</button>
                <button class="filter-btn" data-filter="critical">Critical (${criticalCount})</button>
                <button class="filter-btn" data-filter="high">High (${highCount})</button>
                <button class="filter-btn" data-filter="medium">Medium (${mediumCount})</button>
                <button class="filter-btn" data-filter="low">Low (${lowCount})</button>
                <button class="filter-btn" data-filter="info">Info (${infoCount})</button>
            </div>
            
            <div id="vulnerabilitiesContainer">
                ${allVulnerabilitiesHtml}
            </div>
            
            ${issues.length === 0 ? `
                <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
                    <h2 style="font-size: 24px; margin-bottom: 12px;">No vulnerabilities found</h2>
                    <p>Analysis completed successfully. Code meets security requirements.</p>
                </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>Generated with <strong>Hercules</strong> | Report contains source code analysis results</p>
            <p style="margin-top:4px; font-size:11px; color: #adb5bd;">SAST v4.5.0 | ${new Date().toISOString()}</p>
        </div>
    </div>
    
    <script>
        const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
        const vulnItems = document.querySelectorAll('.vuln-item');
        const searchInput = document.getElementById('searchInput');
        
        let currentFilter = 'all';
        
        function filterItems() {
            const searchTerm = searchInput.value.toLowerCase();
            
            vulnItems.forEach(item => {
                const severity = item.dataset.severity;
                const text = item.innerText.toLowerCase();
                
                const matchesFilter = currentFilter === 'all' || severity === currentFilter;
                const matchesSearch = searchTerm === '' || text.includes(searchTerm);
                
                item.style.display = (matchesFilter && matchesSearch) ? 'block' : 'none';
            });
        }
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                filterItems();
            });
        });
        
        searchInput.addEventListener('input', filterItems);
    </script>
</body>
</html>`;
}

function generatePDFHTML(results) {
    const issues = results.issues || results.results || [];
    const stats = results.statistics || results.summary || {};
    
    const normalizeSeverity = (sev) => {
        if (!sev) return 'info';
        const lower = sev.toLowerCase();
        if (['critical', 'high', 'medium', 'low', 'info'].includes(lower)) {
            return lower;
        }
        return 'info';
    };
    
    const criticalHigh = issues.filter(r => {
        const sev = normalizeSeverity(r.severity);
        return sev === 'critical' || sev === 'high';
    });
    
    const severityNames = {
        critical: 'Critical',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        info: 'Info'
    };
    
    const severityColors = {
        critical: '#dc3545',
        high: '#fd7e14',
        medium: '#ffc107',
        low: '#28a745',
        info: '#6c757d'
    };
    
    const escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    
    const vulnerabilitiesHtml = criticalHigh.map((item) => {
        const shortPath = getShortPath(item.file);
        const severity = normalizeSeverity(item.severity);
        
        return `
            <div style="background: #f8f9fa; padding: 15px; margin-bottom: 15px; border-radius: 8px; page-break-inside: avoid;">
                <div style="margin-bottom: 10px;">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; color: white; background: ${severityColors[severity] || '#6c757d'};">
                        ${severityNames[severity] || severity}
                    </span>
                    <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-size: 11px; margin-left: 10px;">
                        ${shortPath}:${item.line || '?'}
                    </code>
                    <span style="float: right; color: #6c757d; font-size: 11px;">${item.ruleId || 'unknown'}</span>
                </div>
                <p style="margin: 0 0 12px 0; font-weight: 500; color: #212529; font-size: 13px;">${escapeHtml(item.message)}</p>
                ${item.snippet ? `
                <div style="background: #1f2937; color: #e5e7eb; padding: 10px; border-radius: 6px; font-family: 'Fira Code', monospace; font-size: 10px; margin-bottom: 12px; overflow-x: auto;">
                    <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; color: #f85149;">${escapeHtml(item.snippet)}</pre>
                </div>
                ` : ''}
                ${item.recommendation ? `
                    <div style="background: #e8f5e9; padding: 10px; border-radius: 6px; font-size: 11px; color: #2e7d32;">
                        <strong>Recommendation:</strong> ${escapeHtml(item.recommendation)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    const totalCount = stats.total || issues.length || 0;
    const criticalCount = stats.critical || 0;
    const highCount = stats.high || 0;
    const mediumCount = stats.medium || 0;
    const lowCount = stats.low || 0;
    const infoCount = stats.info || 0;
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>SAST Security Report</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Fira Sans', Arial, sans-serif; padding: 20px; color: #212529; background: white; }
                .header { margin-bottom: 30px; text-align: center; border-bottom: 2px solid #667eea; padding-bottom: 20px; }
                h1 { color: #1f2937; font-size: 24px; margin-bottom: 10px; }
                .date { color: #6c757d; font-size: 12px; }
                .stats-grid { display: flex; justify-content: space-between; gap: 15px; margin: 30px 0; flex-wrap: wrap; }
                .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; flex: 1; min-width: 80px; }
                .stat-number { font-size: 28px; font-weight: bold; font-family: 'Fira Code', monospace; }
                .stat-label { color: #6c757d; font-size: 11px; margin-top: 5px; }
                .section-title { margin: 30px 0 20px 0; color: #1f2937; font-size: 18px; padding-left: 12px; }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6c757d; font-size: 10px; }
                .no-vulns { text-align: center; padding: 40px; color: #28a745; font-size: 16px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>SAST Security Analysis Report</h1>
                <div class="date">Generated: ${new Date().toLocaleString()}</div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number" style="color: #dc3545;">${criticalCount}</div>
                    <div class="stat-label">Critical</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" style="color: #fd7e14;">${highCount}</div>
                    <div class="stat-label">High</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" style="color: #ffc107;">${mediumCount}</div>
                    <div class="stat-label">Medium</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" style="color: #28a745;">${lowCount}</div>
                    <div class="stat-label">Low</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" style="color: #6c757d;">${infoCount}</div>
                    <div class="stat-label">Info</div>
                </div>
            </div>
            
            <div class="section-title">
                Critical & High Vulnerabilities (${criticalHigh.length})
            </div>
            
            ${criticalHigh.length > 0 ? vulnerabilitiesHtml : '<div class="no-vulns">No critical or high vulnerabilities found</div>'}
            
            <div class="footer">
                <p>Generated with Hercules SAST Security Scanner</p>
                <p>Total vulnerabilities found: ${totalCount}</p>
            </div>
        </body>
        </html>
    `;
}

export function showRepositoryUnavailableMessage(url, onClose) {
    const escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        backdrop-filter: blur(5px);
        padding: 16px;
    `;

    overlay.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 40px; max-width: 500px; width: 90%; text-align: center;">
            <div style="width: 80px; height: 80px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 40px; color: #dc2626;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h2 style="margin: 0 0 12px; color: #1f2937;">Repository Unavailable</h2>
            <p style="margin: 0 0 20px; color: #6b7280;">
                Failed to connect to repository<br>
                <strong style="color: #4b5563; word-break: break-all;">${escapeHtml(url)}</strong>
            </p>
            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: left;">
                <p style="margin: 0 0 12px; color: #374151; font-weight: 600;">
                    <i class="fas fa-lightbulb" style="color: #f59e0b; margin-right: 8px;"></i> Recommendations:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                    <li style="margin-bottom: 8px;">Check repository availability</li>
                    <li style="margin-bottom: 8px;">Download archive manually</li>
                    <li style="margin-bottom: 8px;">Upload archive using the form above</li>
                </ul>
            </div>
            <button id="close-unavailable-btn" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-family: 'Fira Sans', sans-serif;">Close</button>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#close-unavailable-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
            if (onClose) onClose();
        });
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
            if (onClose) onClose();
        }
    });
}