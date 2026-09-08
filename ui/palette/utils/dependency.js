function loadDependencyFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.mod,.toml,.txt,.xml,.lock,.yml,.yaml';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        var reader = new FileReader();
        reader.onload = function(ev) {
            try {
                var content = ev.target.result;
                var fileName = file.name;
                var ext = fileName.split('.').pop().toLowerCase();
                
                var fileType = detectDependencyFileType(content, fileName);
                var deps = parseDependencies(content, fileType);
                
                if (deps && Object.keys(deps).length > 0) {
                    buildDependencyTree(deps, fileName, fileType);
                    showCustomAlert('Success', 'Dependencies loaded: ' + Object.keys(deps).length + ' packages', 'success');
                } else {
                    showCustomAlert('Error', 'No dependencies found in file', 'warning');
                }
            } catch (err) {
                showCustomAlert('Error', 'Failed to parse file: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function detectDependencyFileType(content, fileName) {
    var ext = fileName.split('.').pop().toLowerCase();
    
    if (ext === 'json') {
        try {
            var data = JSON.parse(content);
            if (data.dependencies || data.devDependencies) return 'npm';
            if (data.require || data['require-dev']) return 'composer';
            if (data.packages) return 'sbom';
        } catch(e) {}
        return 'json';
    }
    
    if (ext === 'mod') return 'gomod';
    if (ext === 'toml') {
        if (content.includes('[package]') && content.includes('[dependencies]')) return 'cargo';
        if (content.includes('[project]') && content.includes('dependencies')) return 'pyproject';
        return 'toml';
    }
    if (ext === 'txt') {
        if (content.includes('==')) return 'requirements';
        return 'txt';
    }
    if (ext === 'xml') {
        if (content.includes('<project') && content.includes('<groupId>')) return 'maven';
        return 'xml';
    }
    if (ext === 'yml' || ext === 'yaml') {
        if (content.includes('dependencies:') || content.includes('packages:')) return 'yaml';
        return 'yaml';
    }
    if (ext === 'lock') {
        if (content.includes('dependencies:')) return 'yarn';
        if (content.includes('packages:')) return 'pnpm';
        return 'lock';
    }
    
    if (content.includes('gem ') && content.includes('source')) return 'gemfile';
    if (content.includes('go ') && content.includes('module ')) return 'gomod';
    if (content.includes('fn ') && content.includes('use ')) return 'cargo';
    if (content.includes('composer.json')) return 'composer';
    
    return 'unknown';
}

function parseDependencies(content, fileType) {
    var deps = {};
    
    switch(fileType) {
        case 'npm':
            try {
                var data = JSON.parse(content);
                deps = data.dependencies || {};
                var devDeps = data.devDependencies || {};
                for (var key in devDeps) {
                    deps[key] = devDeps[key] + ' (dev)';
                }
            } catch(e) {}
            break;
            
        case 'gomod':
            var lines = content.split('\n');
            var inRequire = false;
            lines.forEach(function(line) {
                line = line.trim();
                if (line === 'require (') { inRequire = true; return; }
                if (line === ')') { inRequire = false; return; }
                if (inRequire && line) {
                    var parts = line.split(/\s+/);
                    if (parts.length >= 2) {
                        deps[parts[0]] = parts[1];
                    }
                }
                if (!inRequire && line.startsWith('require ')) {
                    var parts = line.replace('require ', '').split(/\s+/);
                    if (parts.length >= 2) {
                        deps[parts[0]] = parts[1];
                    }
                }
            });
            break;
            
        case 'cargo':
            var lines = content.split('\n');
            var inDeps = false;
            lines.forEach(function(line) {
                line = line.trim();
                if (line === '[dependencies]') { inDeps = true; return; }
                if (line === '[dev-dependencies]') { inDeps = true; return; }
                if (line.startsWith('[')) { inDeps = false; return; }
                if (inDeps && line && !line.startsWith('#')) {
                    var parts = line.split('=');
                    if (parts.length >= 2) {
                        var name = parts[0].trim();
                        var version = parts[1].trim().replace(/["']/g, '');
                        deps[name] = version;
                    }
                }
            });
            break;
            
        case 'requirements':
            var lines = content.split('\n');
            lines.forEach(function(line) {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    var parts = line.split('==');
                    if (parts.length >= 2) {
                        deps[parts[0].trim()] = parts[1].trim();
                    } else {
                        var parts2 = line.split('>=');
                        if (parts2.length >= 2) {
                            deps[parts2[0].trim()] = '>=' + parts2[1].trim();
                        } else {
                            deps[line] = '*';
                        }
                    }
                }
            });
            break;
            
        case 'composer':
            try {
                var data = JSON.parse(content);
                deps = data.require || {};
                var devDeps = data['require-dev'] || {};
                for (var key in devDeps) {
                    deps[key] = devDeps[key] + ' (dev)';
                }
            } catch(e) {}
            break;
            
        case 'maven':
            var depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
            var match;
            while ((match = depRegex.exec(content)) !== null) {
                var depContent = match[1];
                var groupId = extractXmlTag(depContent, 'groupId');
                var artifactId = extractXmlTag(depContent, 'artifactId');
                var version = extractXmlTag(depContent, 'version') || '*';
                if (groupId && artifactId) {
                    deps[groupId + ':' + artifactId] = version;
                }
            }
            break;
            
        case 'gemfile':
            var gemRegex = /gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/g;
            var match;
            while ((match = gemRegex.exec(content)) !== null) {
                var name = match[1];
                var version = match[2] || '*';
                deps[name] = version;
            }
            break;
            
        case 'pyproject':
            var lines = content.split('\n');
            var inDeps = false;
            lines.forEach(function(line) {
                line = line.trim();
                if (line === '[project.dependencies]' || line === '[dependencies]') {
                    inDeps = true;
                    return;
                }
                if (line.startsWith('[')) { inDeps = false; return; }
                if (inDeps && line && !line.startsWith('#')) {
                    var parts = line.split('=');
                    if (parts.length >= 2) {
                        var name = parts[0].trim().replace(/["']/g, '');
                        var version = parts[1].trim().replace(/["']/g, '');
                        deps[name] = version;
                    } else {
                        deps[line] = '*';
                    }
                }
            });
            break;
            
        default:
            var depRegex = /["']([^"']+)["']\s*:\s*["']([^"']+)["']/g;
            var match;
            while ((match = depRegex.exec(content)) !== null) {
                var key = match[1];
                var value = match[2];
                if (!key.startsWith('_') && !key.startsWith('$')) {
                    deps[key] = value;
                }
            }
            break;
    }
    
    return deps;
}

function extractXmlTag(content, tag) {
    var regex = new RegExp('<' + tag + '>([^<]*)</' + tag + '>', 'i');
    var match = regex.exec(content);
    return match ? match[1].trim() : null;
}

function buildDependencyTree(deps, fileName, fileType) {
    elements = [];
    connections = [];
    selectedElement = null;
    
    var depNames = Object.keys(deps);
    var projectName = fileName.replace(/\.[^.]+$/, '');
    
    var projectId = ++elementIdCounter;
    var projectNode = {
        id: projectId,
        type: 'package-project',
        name: '📦 ' + projectName,
        x: 250,
        y: 50,
        color: '#3B82F6',
        width: 200,
        height: 44,
        isTool: false,
        isCode: false,
        bgColor: '#3B82F620',
        borderColor: '#3B82F6',
        textColor: '#3B82F6',
        isExpanded: true,
        children: [],
        isRoot: true
    };
    elements.push(projectNode);
    
    var nodeIds = {};
    var spacingX = 200;
    var startX = 150;
    var startY = 150;
    var cols = 3;
    
    depNames.forEach(function(name, index) {
        var id = ++elementIdCounter;
        nodeIds[name] = id;
        
        var row = Math.floor(index / cols);
        var col = index % cols;
        
        var version = deps[name] || '*';
        var isDev = version.includes('(dev)');
        var color = isDev ? '#F59E0B' : '#10B981';
        
        var displayName = name + (version ? ' (' + version.replace(' (dev)', '') + ')' : '');
        if (isDev) displayName += ' ⚡';
        
        var element = {
            id: id,
            type: 'package-dependency',
            name: displayName,
            x: startX + col * spacingX,
            y: startY + row * 80,
            color: color,
            width: 160,
            height: 36,
            isTool: false,
            isCode: false,
            packageData: {
                name: name,
                version: version,
                isDev: isDev
            },
            bgColor: color + '20',
            borderColor: color,
            textColor: color,
            isExpanded: false,
            children: [],
            parentId: projectId,
            isRoot: false,
            hasChildren: Math.random() > 0.6
        };
        elements.push(element);
        projectNode.children.push(element.id);
    });
    
    depNames.forEach(function(name) {
        var toId = nodeIds[name];
        if (toId) {
            var isDev = deps[name].includes('(dev)');
            connections.push({
                id: connections.length + 1,
                from: projectId,
                to: toId,
                type: 'control',
                label: isDev ? 'dev' : 'prod',
                color: '#8B5CF6'
            });
        }
    });
    
    renderElements();
    renderConnections();
    setTimeout(autoFitCanvas, 100);
    
    showCustomAlert('Success', 'Dependency tree: ' + depNames.length + ' packages. Click ⊕ to expand', 'success');
}

function toggleNodeExpand(elementId) {
    var el = elements.find(function(e) { return e.id === elementId; });
    if (!el) return;
    
    el.isExpanded = !el.isExpanded;
    
    var children = elements.filter(function(e) { 
        return e.parentId === elementId; 
    });
    
    if (el.isExpanded) {
        children.forEach(function(child) {
            child.hidden = false;
        });
        children.forEach(function(child) {
            if (!connections.some(function(c) { return c.from === elementId && c.to === child.id; })) {
                connections.push({
                    id: connections.length + 1,
                    from: elementId,
                    to: child.id,
                    type: 'control',
                    label: 'depends',
                    color: '#8B5CF6'
                });
            }
        });
    } else {
        hideChildrenRecursive(elementId);
        connections = connections.filter(function(c) {
            return !children.some(function(child) { return c.from === elementId && c.to === child.id; });
        });
    }
    
    renderElements();
    renderConnections();
}

function hideChildrenRecursive(parentId) {
    var children = elements.filter(function(e) { 
        return e.parentId === parentId; 
    });
    children.forEach(function(child) {
        child.hidden = true;
        hideChildrenRecursive(child.id);
    });
}

window.loadDependencyFile = loadDependencyFile;
window.detectDependencyFileType = detectDependencyFileType;
window.parseDependencies = parseDependencies;
window.buildDependencyTree = buildDependencyTree;
window.toggleNodeExpand = toggleNodeExpand;