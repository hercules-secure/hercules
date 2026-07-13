// ============================================================
// CI-VIZ.JS - ВИЗУАЛИЗАЦИЯ CI/CD ПАЙПЛАЙНОВ ИЗ YAML
// ============================================================

var ciNodeMap = {};
var ciSelectedFile = null;

// ============================================================
// ПАРСЕР YAML
// ============================================================

function parseYamlSimple(yamlText) {
    var result = {};
    var lines = yamlText.split('\n');
    var stack = [{ obj: result, indent: -1 }];
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        var indent = line.length - line.replace(/^[ ]+/, '').length;
        var cleanLine = trimmed.split('#')[0].trim();
        if (!cleanLine) continue;
        
        if (cleanLine.startsWith('- ')) {
            var value = cleanLine.substring(2).trim();
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (value === 'null') value = null;
            else if (!isNaN(value) && value !== '') value = parseFloat(value);
            else if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
            else if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1);
            
            while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
                stack.pop();
            }
            var parent = stack[stack.length - 1].obj;
            var keys = Object.keys(parent);
            if (keys.length > 0) {
                var lastKey = keys[keys.length - 1];
                if (!parent[lastKey]) parent[lastKey] = [];
                if (!Array.isArray(parent[lastKey])) {
                    var old = parent[lastKey];
                    parent[lastKey] = [old];
                }
                parent[lastKey].push(value);
            }
            continue;
        }
        
        var colonIndex = cleanLine.indexOf(':');
        if (colonIndex !== -1) {
            var key = cleanLine.substring(0, colonIndex).trim();
            var value = cleanLine.substring(colonIndex + 1).trim();
            
            while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
                stack.pop();
            }
            var parent = stack[stack.length - 1].obj;
            
            if (value === '' || value === '{}' || value === '[]') {
                parent[key] = {};
                stack.push({ obj: parent[key], indent: indent });
            } else {
                if (value === 'true') value = true;
                else if (value === 'false') value = false;
                else if (value === 'null') value = null;
                else if (!isNaN(value) && value !== '') value = parseFloat(value);
                else if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
                else if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1);
                parent[key] = value;
            }
        }
    }
    return result;
}

// ============================================================
// ОПРЕДЕЛЕНИЕ ТИПА CI
// ============================================================

function detectCIType(data, fileName, rawText) {
    var name = fileName ? fileName.toLowerCase() : '';
    if (name === 'jenkinsfile' || name === 'jenkins' || (rawText && rawText.indexOf('pipeline {') !== -1)) return 'jenkins';
    if (name.includes('.gitlab-ci') || name.includes('gitlab-ci')) return 'gitlab';
    if (name.includes('.github/workflows') || name.includes('workflows')) return 'github';
    if (data.jobs && typeof data.jobs === 'object') {
        var firstJob = Object.values(data.jobs)[0];
        if (firstJob && firstJob['runs-on']) return 'github';
        return 'gitlab';
    }
    if (data.stages || data.include) return 'gitlab';
    return 'unknown';
}

// ============================================================
// ПАРСЕР JENKINSFILE
// ============================================================

function parseJenkinsfile(text) {
    var result = { type: 'jenkins', stages: [], environment: {}, post: {} };
    var lines = text.split('\n');
    var currentStage = null;
    var inParallel = false;
    var parallelStages = [];
    var inEnvironment = false;
    var inPost = false;
    var currentPostType = null;
    var inSteps = false;
    var steps = [];
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var trimmed = line.trim();
        if (!trimmed) continue;
        
        if (trimmed === 'environment {') { inEnvironment = true; continue; }
        if (inEnvironment && trimmed === '}') { inEnvironment = false; continue; }
        if (inEnvironment) {
            var envMatch = trimmed.match(/^([A-Z_]+)\s*=\s*['"](.+)['"]/);
            if (envMatch) result.environment[envMatch[1]] = envMatch[2];
            continue;
        }
        
        if (trimmed === 'post {') { inPost = true; continue; }
        if (inPost && trimmed === '}') { inPost = false; continue; }
        if (inPost) {
            var postMatch = trimmed.match(/^([a-z]+)\s*\{/);
            if (postMatch) { currentPostType = postMatch[1]; result.post[currentPostType] = []; }
            if (currentPostType && trimmed.match(/^\s*echo/)) {
                var echoMatch = trimmed.match(/echo\s+['"](.+)['"]/);
                if (echoMatch && result.post[currentPostType]) result.post[currentPostType].push(echoMatch[1]);
            }
            continue;
        }
        
        var stageMatch = trimmed.match(/stage\s*\(['"](.+)['"]\)\s*\{/);
        if (stageMatch) {
            currentStage = { name: stageMatch[1], steps: [], parallel: [] };
            inParallel = false;
            parallelStages = [];
            steps = [];
            inSteps = false;
            result.stages.push(currentStage);
            continue;
        }
        
        if (trimmed === 'parallel {') { inParallel = true; continue; }
        if (inParallel && trimmed === '}') {
            inParallel = false;
            if (parallelStages.length > 0) currentStage.parallel = parallelStages;
            continue;
        }
        if (inParallel) {
            var parallelMatch = trimmed.match(/^stage\s*\(['"](.+)['"]\)\s*\{/);
            if (parallelMatch) { var ps = { name: parallelMatch[1], steps: [] }; parallelStages.push(ps); continue; }
            if (parallelStages.length > 0) {
                var lastPs = parallelStages[parallelStages.length - 1];
                var stepMatch = trimmed.match(/^\s*(echo|sh)\s+['"](.+)['"]/);
                if (stepMatch) lastPs.steps.push(stepMatch[2]);
            }
            continue;
        }
        
        if (trimmed === 'steps {') { inSteps = true; continue; }
        if (inSteps && trimmed === '}') {
            inSteps = false;
            if (currentStage && steps.length > 0 && currentStage.parallel.length === 0) currentStage.steps = steps;
            steps = [];
            continue;
        }
        if (inSteps) {
            var stepMatch = trimmed.match(/^\s*(echo|sh)\s+['"](.+)['"]/);
            if (stepMatch) steps.push(stepMatch[2]);
            var shMatch = trimmed.match(/^\s*sh\s+(.+)/);
            if (shMatch && !trimmed.match(/['"]/)) steps.push(shMatch[1]);
            if (trimmed.match(/^\s*input/)) steps.push('Manual approval required');
            continue;
        }
    }
    return result;
}

// ============================================================
// ПОСТРОЕНИЕ GITLAB CI ГРАФА
// ============================================================

function buildGitLabGraph(data) {
    var rootId = ++elementIdCounter;
    var rootElement = {
        id: rootId,
        type: 'ci-root',
        name: 'GitLab CI Pipeline',
        x: 250,
        y: 30,
        color: '#FC6D26',
        width: 240,
        height: 44,
        isTool: false,
        isCode: false,
        bgColor: '#FC6D2620',
        borderColor: '#FC6D26',
        textColor: '#FC6D26',
        isRoot: true,
        isVisible: true,
        hidden: false,
        childNodes: []
    };
    elements.push(rootElement);
    ciNodeMap['root'] = rootId;
    
    var stages = [];
    if (data.stages) {
        if (Array.isArray(data.stages)) stages = data.stages.slice();
        else if (typeof data.stages === 'string') stages = [data.stages];
        else if (typeof data.stages === 'object') stages = Object.keys(data.stages);
    }
    
    var jobs = {};
    var variables = data.variables || {};
    var include = data.include || [];
    if (!Array.isArray(include)) include = [include];
    
    var reservedKeys = {
        'stages': true,
        'variables': true,
        'include': true,
        'default': true,
        'workflow': true,
        'cache': true,
        'before_script': true,
        'after_script': true
    };
    
    for (var key in data) {
        if (reservedKeys[key] || key.startsWith('.')) continue;
        var value = data[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (value.script !== undefined || value.stage !== undefined || value.image) {
                jobs[key] = value;
            }
        }
    }
    
    if (Object.keys(jobs).length === 0) {
        for (var key in data) {
            if (reservedKeys[key] || key.startsWith('.')) continue;
            var value = data[key];
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                jobs[key] = value;
            }
        }
    }
    
    if (stages.length === 0) {
        var stageSet = {};
        for (var jobName in jobs) {
            var stage = jobs[jobName].stage || 'test';
            if (typeof stage === 'string') stageSet[stage] = true;
        }
        stages = Object.keys(stageSet);
    }
    if (stages.length === 0) stages = ['build', 'test', 'deploy'];
    
    if (Object.keys(jobs).length === 0) {
        showCustomAlert('Ошибка', 'Не найдены jobs в YAML файле', 'error');
        return;
    }
    
    var jobsByStage = {};
    for (var si = 0; si < stages.length; si++) {
        var stageName = String(stages[si]).trim();
        jobsByStage[stageName] = [];
    }
    
    for (var jobName in jobs) {
        var job = jobs[jobName];
        var stageName = job.stage || 'test';
        if (typeof stageName !== 'string') stageName = 'test';
        if (!jobsByStage[stageName]) jobsByStage[stageName] = [];
        jobsByStage[stageName].push({ name: jobName, data: job });
    }
    
    var stageNodes = {};
    var spacingX = Math.min(260, Math.floor(900 / Math.max(stages.length, 1)));
    var startX = 40;
    var startY = 100;
    var stageHeight = 44;
    
    for (var si = 0; si < stages.length; si++) {
        var stageName = String(stages[si]).trim();
        if (!stageName) continue;
        
        var stageId = ++elementIdCounter;
        var jobList = jobsByStage[stageName] || [];
        var jobCount = jobList.length;
        
        var stageElement = {
            id: stageId,
            type: 'ci-stage',
            name: stageName + ' (' + jobCount + ' jobs)',
            x: startX + si * spacingX,
            y: startY,
            color: '#8B5CF6',
            width: 200,
            height: stageHeight,
            isTool: false,
            isCode: false,
            bgColor: '#8B5CF620',
            borderColor: '#8B5CF6',
            textColor: '#8B5CF6',
            isStage: true,
            stageName: stageName,
            isVisible: true,
            hidden: false,
            childNodes: [],
            hasChildren: jobCount > 0,
            isExpanded: false,
            jobCount: jobCount
        };
        elements.push(stageElement);
        ciNodeMap['stage_' + stageName] = stageId;
        stageNodes[stageName] = stageId;
        
        connections.push({
            id: connections.length + 1,
            from: rootId,
            to: stageId,
            type: 'control',
            label: '▶ ' + stageName,
            color: '#8B5CF6',
            isVisible: true
        });
    }
    
    var jobSpacingY = 60;
    var jobStartY = startY + stageHeight + 10;
    var jobWidth = 180;
    
    for (var si = 0; si < stages.length; si++) {
        var stageName = String(stages[si]).trim();
        if (!stageName) continue;
        
        var stageId = stageNodes[stageName];
        if (!stageId) continue;
        
        var jobList = jobsByStage[stageName] || [];
        var stageX = startX + si * spacingX;
        
        for (var ji = 0; ji < jobList.length; ji++) {
            var jobInfo = jobList[ji];
            var jobName = jobInfo.name;
            var job = jobInfo.data;
            
            var jobId = ++elementIdCounter;
            
            var color = '#10B981';
            if (job.when === 'manual') color = '#EF4444';
            else if (job.allow_failure === true) color = '#F59E0B';
            
            var steps = job.script || [];
            var stepLabels = [];
            if (Array.isArray(steps)) {
                for (var si2 = 0; si2 < Math.min(steps.length, 2); si2++) {
                    var step = steps[si2];
                    if (typeof step === 'string') {
                        stepLabels.push(step.substring(0, 25) + (step.length > 25 ? '...' : ''));
                    }
                }
            }
            
            var jobLabel = jobName;
            if (stepLabels.length > 0) {
                jobLabel = jobName + ' [' + stepLabels.join(' | ') + ']';
            }
            if (jobLabel.length > 45) {
                jobLabel = jobLabel.substring(0, 45) + '...';
            }
            
            var jobElement = {
                id: jobId,
                type: 'ci-job',
                name: jobLabel,
                x: stageX + (200 - jobWidth) / 2,
                y: jobStartY + ji * jobSpacingY,
                color: color,
                width: jobWidth,
                height: 38,
                isTool: false,
                isCode: false,
                bgColor: color + '20',
                borderColor: color,
                textColor: color,
                isJob: true,
                jobName: jobName,
                stageName: stageName,
                isVisible: false,
                hidden: true,
                childNodes: [],
                hasChildren: false,
                isExpanded: false,
                parentId: stageId,
                script: stepLabels,
                needs: job.needs || [],
                dependencies: job.dependencies || [],
                when: job.when || 'on_success',
                allowFailure: job.allow_failure || false,
                isParallel: job.parallel ? true : false
            };
            elements.push(jobElement);
            ciNodeMap['job_' + jobName] = jobId;
            
            connections.push({
                id: connections.length + 1,
                from: stageId,
                to: jobId,
                type: 'control',
                label: 'job',
                color: '#8B5CF6',
                isVisible: false
            });
        }
    }
    
    for (var jobName in jobs) {
        var job = jobs[jobName];
        var jobId = ciNodeMap['job_' + jobName];
        if (!jobId) continue;
        
        var deps = job.dependencies || job.needs || [];
        if (Array.isArray(deps)) {
            for (var di = 0; di < deps.length; di++) {
                var dep = deps[di];
                var depId = ciNodeMap['job_' + dep];
                if (depId) {
                    connections.push({
                        id: connections.length + 1,
                        from: depId,
                        to: jobId,
                        type: 'data-flow',
                        label: 'depends',
                        color: '#F59E0B',
                        isVisible: false
                    });
                }
            }
        }
    }
    
    var varKeys = Object.keys(variables);
    if (varKeys.length > 0) {
        var varId = ++elementIdCounter;
        var varElement = {
            id: varId,
            type: 'ci-stage',
            name: 'Variables (' + varKeys.length + ')',
            x: 20,
            y: startY + 60 + Math.max(1, Object.keys(jobs).length) * jobSpacingY + 40,
            color: '#6B7280',
            width: 200,
            height: 40,
            isTool: false,
            isCode: false,
            bgColor: '#6B728020',
            borderColor: '#6B7280',
            textColor: '#6B7280',
            isStage: true,
            stageName: 'variables',
            isVisible: true,
            hidden: false,
            childNodes: [],
            hasChildren: true,
            isExpanded: false
        };
        elements.push(varElement);
        ciNodeMap['variables'] = varId;
        connections.push({
            id: connections.length + 1,
            from: rootId,
            to: varId,
            type: 'control',
            label: 'variables',
            color: '#6B7280',
            isVisible: true
        });
    }
    
    if (Array.isArray(include) && include.length > 0) {
        var incId = ++elementIdCounter;
        var incElement = {
            id: incId,
            type: 'ci-stage',
            name: 'Include (' + include.length + ')',
            x: 20,
            y: startY + 60 + Math.max(1, Object.keys(jobs).length) * jobSpacingY + 100 + (varKeys.length > 0 ? 80 : 0),
            color: '#A78BFA',
            width: 200,
            height: 40,
            isTool: false,
            isCode: false,
            bgColor: '#A78BFA20',
            borderColor: '#A78BFA',
            textColor: '#A78BFA',
            isStage: true,
            stageName: 'include',
            isVisible: true,
            hidden: false,
            childNodes: [],
            hasChildren: true,
            isExpanded: false
        };
        elements.push(incElement);
        ciNodeMap['include'] = incId;
        connections.push({
            id: connections.length + 1,
            from: rootId,
            to: incId,
            type: 'control',
            label: 'include',
            color: '#A78BFA',
            isVisible: true
        });
    }
}

// ============================================================
// ПОСТРОЕНИЕ GITHUB ACTIONS ГРАФА
// ============================================================

function buildGitHubGraph(data) {
    var rootId = ++elementIdCounter;
    var rootElement = {
        id: rootId,
        type: 'ci-root',
        name: 'GitHub Actions',
        x: 250,
        y: 30,
        color: '#3B82F6',
        width: 240,
        height: 44,
        isTool: false,
        isCode: false,
        bgColor: '#3B82F620',
        borderColor: '#3B82F6',
        textColor: '#3B82F6',
        isRoot: true,
        isVisible: true,
        hidden: false,
        childNodes: []
    };
    elements.push(rootElement);
    ciNodeMap['root'] = rootId;
    
    var jobs = data.jobs || {};
    var jobNames = Object.keys(jobs);
    
    if (jobNames.length === 0) {
        showCustomAlert('Ошибка', 'Не найдены jobs в GitHub Actions', 'error');
        return;
    }
    
    var spacingX = Math.min(240, Math.floor(900 / Math.max(jobNames.length, 1)));
    var startX = 40;
    var startY = 100;
    var jobNodes = {};
    
    for (var ji = 0; ji < jobNames.length; ji++) {
        var jobName = jobNames[ji];
        var job = jobs[jobName];
        var jobId = ++elementIdCounter;
        
        var color = '#10B981';
        if (job['runs-on'] && typeof job['runs-on'] === 'string') {
            if (job['runs-on'].indexOf('windows') !== -1) color = '#3B82F6';
            else if (job['runs-on'].indexOf('macos') !== -1) color = '#6366F1';
        }
        
        var steps = job.steps || [];
        var stepLabels = [];
        for (var si2 = 0; si2 < Math.min(steps.length, 2); si2++) {
            var step = steps[si2];
            var stepName = step.name || step.uses || 'step-' + (si2 + 1);
            if (typeof stepName === 'string') {
                stepLabels.push(stepName.substring(0, 25) + (stepName.length > 25 ? '...' : ''));
            }
        }
        
        var jobLabel = jobName;
        if (stepLabels.length > 0) {
            jobLabel = jobName + ' [' + stepLabels.join(' | ') + ']';
        }
        if (jobLabel.length > 45) {
            jobLabel = jobLabel.substring(0, 45) + '...';
        }
        
        var jobElement = {
            id: jobId,
            type: 'ci-job',
            name: jobLabel,
            x: startX + ji * spacingX,
            y: startY,
            color: color,
            width: 200,
            height: 44,
            isTool: false,
            isCode: false,
            bgColor: color + '20',
            borderColor: color,
            textColor: color,
            isJob: true,
            jobName: jobName,
            isVisible: true,
            hidden: false,
            childNodes: [],
            hasChildren: false,
            isExpanded: false,
            parentId: rootId,
            runsOn: job['runs-on'] || 'ubuntu-latest',
            needs: job.needs || [],
            steps: stepLabels,
            strategy: job.strategy || null
        };
        elements.push(jobElement);
        ciNodeMap['job_' + jobName] = jobId;
        jobNodes[jobName] = jobId;
        
        connections.push({
            id: connections.length + 1,
            from: rootId,
            to: jobId,
            type: 'control',
            label: 'job',
            color: '#3B82F6',
            isVisible: true
        });
    }
    
    for (var jobName in jobs) {
        var job = jobs[jobName];
        var jobId = jobNodes[jobName];
        if (!jobId) continue;
        
        if (job.needs && Array.isArray(job.needs)) {
            for (var ni = 0; ni < job.needs.length; ni++) {
                var need = job.needs[ni];
                var needId = jobNodes[need];
                if (needId) {
                    connections.push({
                        id: connections.length + 1,
                        from: needId,
                        to: jobId,
                        type: 'data-flow',
                        label: 'needs',
                        color: '#F59E0B',
                        isVisible: true
                    });
                }
            }
        }
    }
    
    var env = data.env || {};
    var envKeys = Object.keys(env);
    if (envKeys.length > 0) {
        var envId = ++elementIdCounter;
        var envElement = {
            id: envId,
            type: 'ci-stage',
            name: 'Environment (' + envKeys.length + ')',
            x: 20,
            y: startY + 60 + Math.max(1, jobNames.length) * 70 + 40,
            color: '#6B7280',
            width: 200,
            height: 40,
            isTool: false,
            isCode: false,
            bgColor: '#6B728020',
            borderColor: '#6B7280',
            textColor: '#6B7280',
            isStage: true,
            stageName: 'env',
            isVisible: true,
            hidden: false,
            childNodes: [],
            hasChildren: true,
            isExpanded: false
        };
        elements.push(envElement);
        ciNodeMap['env'] = envId;
        connections.push({
            id: connections.length + 1,
            from: rootId,
            to: envId,
            type: 'control',
            label: 'env',
            color: '#6B7280',
            isVisible: true
        });
    }
}

// ============================================================
// ПОСТРОЕНИЕ JENKINS ГРАФА
// ============================================================

function buildJenkinsGraph(data) {
    var rootId = ++elementIdCounter;
    var rootElement = {
        id: rootId,
        type: 'ci-root',
        name: 'Jenkins Pipeline',
        x: 250,
        y: 30,
        color: '#1E88E5',
        width: 240,
        height: 44,
        isTool: false,
        isCode: false,
        bgColor: '#1E88E520',
        borderColor: '#1E88E5',
        textColor: '#1E88E5',
        isRoot: true,
        isVisible: true,
        hidden: false,
        childNodes: []
    };
    elements.push(rootElement);
    ciNodeMap['root'] = rootId;
    
    var stages = data.stages || [];
    var environment = data.environment || {};
    var post = data.post || {};
    
    if (stages.length === 0) {
        showCustomAlert('Ошибка', 'Не найдены stages в Jenkinsfile', 'error');
        return;
    }
    
    var spacingX = Math.min(240, Math.floor(900 / Math.max(stages.length, 1)));
    var startX = 40;
    var startY = 100;
    var stageNodes = {};
    
    for (var si = 0; si < stages.length; si++) {
        var stage = stages[si];
        var stageName = stage.name || 'stage-' + (si + 1);
        var stageId = ++elementIdCounter;
        var hasParallel = stage.parallel && stage.parallel.length > 0;
        var hasSteps = stage.steps && stage.steps.length > 0;
        
        var stageElement = {
            id: stageId,
            type: 'ci-stage',
            name: stageName + (hasParallel ? ' (parallel)' : ''),
            x: startX + si * spacingX,
            y: startY,
            color: '#8B5CF6',
            width: 200,
            height: 44,
            isTool: false,
            isCode: false,
            bgColor: '#8B5CF620',
            borderColor: '#8B5CF6',
            textColor: '#8B5CF6',
            isStage: true,
            stageName: stageName,
            isVisible: true,
            hidden: false,
            childNodes: [],
            hasChildren: true,
            isExpanded: false,
            hasParallel: hasParallel,
            steps: stage.steps || []
        };
        elements.push(stageElement);
        ciNodeMap['stage_' + stageName] = stageId;
        stageNodes[stageName] = stageId;
        
        connections.push({
            id: connections.length + 1,
            from: rootId,
            to: stageId,
            type: 'control',
            label: stageName,
            color: '#8B5CF6',
            isVisible: true
        });
        
        var stepStartY = startY + 60;
        
        if (hasParallel) {
            var parallelStages = stage.parallel;
            for (var pi = 0; pi < parallelStages.length; pi++) {
                var ps = parallelStages[pi];
                var psId = ++elementIdCounter;
                var psSteps = ps.steps || [];
                var psLabel = ps.name;
                if (psSteps.length > 0) {
                    psLabel = ps.name + ' [' + psSteps.join(' | ') + ']';
                }
                if (psLabel.length > 45) {
                    psLabel = psLabel.substring(0, 45) + '...';
                }
                var psElement = {
                    id: psId,
                    type: 'ci-job',
                    name: psLabel,
                    x: startX + si * spacingX + 20 + pi * 30,
                    y: stepStartY + pi * 35,
                    color: '#F59E0B',
                    width: 160,
                    height: 32,
                    isTool: false,
                    isCode: false,
                    bgColor: '#F59E0B20',
                    borderColor: '#F59E0B',
                    textColor: '#F59E0B',
                    isVisible: false,
                    hidden: true,
                    childNodes: [],
                    hasChildren: false,
                    isExpanded: false,
                    parentId: stageId,
                    isParallel: true,
                    parallelName: ps.name
                };
                elements.push(psElement);
                ciNodeMap['parallel_' + stageName + '_' + pi] = psId;
                connections.push({
                    id: connections.length + 1,
                    from: stageId,
                    to: psId,
                    type: 'control',
                    label: 'parallel',
                    color: '#F59E0B',
                    isVisible: false
                });
            }
        } else if (hasSteps) {
            var steps = stage.steps;
            for (var si2 = 0; si2 < Math.min(steps.length, 5); si2++) {
                var step = steps[si2];
                var stepId = ++elementIdCounter;
                var stepLabel = step;
                if (typeof step === 'string' && step.length > 40) {
                    stepLabel = step.substring(0, 40) + '...';
                }
                var stepElement = {
                    id: stepId,
                    type: 'ci-job',
                    name: stepLabel,
                    x: startX + si * spacingX + 20,
                    y: stepStartY + si2 * 35,
                    color: '#10B981',
                    width: 160,
                    height: 30,
                    isTool: false,
                    isCode: false,
                    bgColor: '#10B98120',
                    borderColor: '#10B981',
                    textColor: '#10B981',
                    isVisible: false,
                    hidden: true,
                    childNodes: [],
                    hasChildren: false,
                    isExpanded: false,
                    parentId: stageId,
                    isStep: true
                };
                elements.push(stepElement);
                ciNodeMap['step_' + stageName + '_' + si2] = stepId;
                connections.push({
                    id: connections.length + 1,
                    from: stageId,
                    to: stepId,
                    type: 'control',
                    label: 'step',
                    color: '#10B981',
                    isVisible: false
                });
            }
        }
    }
    
    var envKeys = Object.keys(environment);
    if (envKeys.length > 0) {
        var envId = ++elementIdCounter;
        var envElement = {
            id: envId,
            type: 'ci-stage',
            name: 'Environment (' + envKeys.length + ')',
            x: 20,
            y: startY + 60 + Math.max(1, stages.length) * 70 + 40,
            color: '#6B7280',
            width: 200,
            height: 40,
            isTool: false,
            isCode: false,
            bgColor: '#6B728020',
            borderColor: '#6B7280',
            textColor: '#6B7280',
            isStage: true,
            stageName: 'env',
            isVisible: true,
            hidden: false,
            childNodes: [],
            hasChildren: true,
            isExpanded: false
        };
        elements.push(envElement);
        ciNodeMap['env'] = envId;
        connections.push({
            id: connections.length + 1,
            from: rootId,
            to: envId,
            type: 'control',
            label: 'env',
            color: '#6B7280',
            isVisible: true
        });
    }
    
    var postKeys = Object.keys(post);
    if (postKeys.length > 0) {
        var postId = ++elementIdCounter;
        var postElement = {
            id: postId,
            type: 'ci-stage',
            name: 'Post Actions (' + postKeys.length + ')',
            x: 20,
            y: startY + 60 + Math.max(1, stages.length) * 70 + 40 + (envKeys.length > 0 ? 80 : 0),
            color: '#6B7280',
            width: 200,
            height: 40,
            isTool: false,
            isCode: false,
            bgColor: '#6B728020',
            borderColor: '#6B7280',
            textColor: '#6B7280',
            isStage: true,
            stageName: 'post',
            isVisible: true,
            hidden: false,
            childNodes: [],
            hasChildren: true,
            isExpanded: false
        };
        elements.push(postElement);
        ciNodeMap['post'] = postId;
        connections.push({
            id: connections.length + 1,
            from: rootId,
            to: postId,
            type: 'control',
            label: 'post',
            color: '#6B7280',
            isVisible: true
        });
    }
}

// ============================================================
// УНИВЕРСАЛЬНЫЙ ГРАФ
// ============================================================

function buildGenericGraph(data) {
    var rootId = ++elementIdCounter;
    var rootElement = {
        id: rootId,
        type: 'ci-root',
        name: 'CI/CD Pipeline',
        x: 250,
        y: 30,
        color: '#3B82F6',
        width: 200,
        height: 40,
        isTool: false,
        isCode: false,
        bgColor: '#3B82F620',
        borderColor: '#3B82F6',
        textColor: '#3B82F6',
        isRoot: true,
        isVisible: true,
        hidden: false,
        childNodes: []
    };
    elements.push(rootElement);
    ciNodeMap['root'] = rootId;
    
    var keys = Object.keys(data);
    var spacingX = 200;
    var startX = 60;
    var startY = 120;
    var idx = 0;
    for (var i = 0; i < keys.length && idx < 20; i++) {
        var key = keys[i];
        var value = data[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            var id = ++elementIdCounter;
            var element = {
                id: id,
                type: 'ci-job',
                name: key,
                x: startX + idx * spacingX,
                y: startY,
                color: '#8B5CF6',
                width: 160,
                height: 36,
                isTool: false,
                isCode: false,
                bgColor: '#8B5CF620',
                borderColor: '#8B5CF6',
                textColor: '#8B5CF6',
                isVisible: true,
                hidden: false,
                childNodes: [],
                hasChildren: false,
                isExpanded: false,
                parentId: rootId
            };
            elements.push(element);
            ciNodeMap[key] = id;
            connections.push({
                id: connections.length + 1,
                from: rootId,
                to: id,
                type: 'control',
                label: 'key',
                color: '#8B5CF6',
                isVisible: true
            });
            idx++;
        }
    }
}

// ============================================================
// ПОСТРОЕНИЕ ГРАФА (ГЛАВНАЯ ФУНКЦИЯ)
// ============================================================

function buildCIGraphFromYAML(yamlText, fileName) {
    var isJenkins = false;
    if (fileName && (fileName.toLowerCase() === 'jenkinsfile' || fileName.toLowerCase() === 'jenkins')) {
        isJenkins = true;
    }
    if (!isJenkins && yamlText.indexOf('pipeline {') !== -1) {
        isJenkins = true;
    }
    
    var data = {};
    var ciType = 'unknown';
    
    if (isJenkins) {
        data = parseJenkinsfile(yamlText);
        ciType = 'jenkins';
    } else {
        try {
            data = parseYamlSimple(yamlText);
        } catch (err) {
            showCustomAlert('Ошибка', 'Не удалось распарсить файл: ' + err.message, 'error');
            return;
        }
        ciType = detectCIType(data, fileName, yamlText);
    }
    
    var hasData = false;
    for (var key in data) {
        if (data[key] !== undefined && data[key] !== null) {
            hasData = true;
            break;
        }
    }
    if (!hasData) {
        showCustomAlert('Ошибка', 'Файл пуст или неверного формата', 'error');
        return;
    }
    
    var existingElements = [];
    for (var i = 0; i < elements.length; i++) {
        if (elements[i].type !== 'ci-stage' && elements[i].type !== 'ci-job' && elements[i].type !== 'ci-root') {
            existingElements.push(elements[i]);
        }
    }
    elements = existingElements;
    connections = [];
    selectedElement = null;
    ciNodeMap = {};
    
    if (ciType === 'gitlab') {
        buildGitLabGraph(data);
    } else if (ciType === 'github') {
        buildGitHubGraph(data);
    } else if (ciType === 'jenkins') {
        buildJenkinsGraph(data);
    } else {
        buildGenericGraph(data);
    }
    
    if (typeof renderElements === 'function') renderElements();
    if (typeof renderConnections === 'function') renderConnections();
    setTimeout(autoFitCanvas, 100);
    setTimeout(addCIControls, 200);
    
    var count = elements.filter(function(e) { 
        return e.type === 'ci-stage' || e.type === 'ci-job' || e.type === 'ci-root'; 
    }).length;
    showCustomAlert('Успешно', 'CI граф построен: ' + count + ' элементов', 'success');
}

// ============================================================
// УПРАВЛЕНИЕ
// ============================================================

function toggleCINode(nodeId) {
    var element = elements.find(function(e) { return e.id === nodeId; });
    if (!element) return;
    if (element.hasChildren) {
        element.isExpanded = !element.isExpanded;
        var children = elements.filter(function(e) { return e.parentId === nodeId; });
        for (var i = 0; i < children.length; i++) {
            children[i].isVisible = element.isExpanded;
            children[i].hidden = !element.isExpanded;
        }
        for (var i = 0; i < connections.length; i++) {
            var conn = connections[i];
            if (conn.from === nodeId || conn.to === nodeId) {
                conn.isVisible = element.isExpanded;
            }
        }
    }
    renderElements();
    renderConnections();
}

function addCIControls() {
    var container = document.getElementById('paletteCanvas') || document.getElementById('canvasContainer');
    if (!container) return;
    var oldControls = container.querySelector('.ci-controls');
    if (oldControls) oldControls.remove();
    var controls = document.createElement('div');
    controls.className = 'ci-controls';
    controls.style.cssText = 'position:absolute;top:10px;right:10px;z-index:1000;display:flex;gap:8px;flex-direction:column;background:rgba(255,255,255,0.95);padding:8px 10px;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,0.15);font-family:Ubuntu,sans-serif;width:auto;flex-shrink:0;';
    controls.innerHTML = `
        <button onclick="expandAllCI()" style="padding:6px 14px;background:#3B82F6;color:white;border:none;border-radius:6px;cursor:pointer;font-family:Ubuntu,sans-serif;font-size:12px;font-weight:500;transition:background .2s;white-space:nowrap;width:100%" onmouseenter="this.style.background='#2563EB'" onmouseleave="this.style.background='#3B82F6'">Развернуть все</button>
        <button onclick="collapseAllCI()" style="padding:6px 14px;background:#6B7280;color:white;border:none;border-radius:6px;cursor:pointer;font-family:Ubuntu,sans-serif;font-size:12px;font-weight:500;transition:background .2s;white-space:nowrap;width:100%" onmouseenter="this.style.background='#4B5563'" onmouseleave="this.style.background='#6B7280'">Свернуть все</button>
    `;
    container.appendChild(controls);
}

function expandAllCI() {
    var ciNodes = elements.filter(function(e) { return e.type === 'ci-stage' || e.type === 'ci-job'; });
    for (var i = 0; i < ciNodes.length; i++) {
        var el = ciNodes[i];
        if (el.hasChildren) {
            el.isExpanded = true;
            var children = elements.filter(function(e) { return e.parentId === el.id; });
            for (var j = 0; j < children.length; j++) {
                children[j].isVisible = true;
                children[j].hidden = false;
            }
        }
    }
    renderElements();
    renderConnections();
}

function collapseAllCI() {
    var ciNodes = elements.filter(function(e) { return e.type === 'ci-stage' || e.type === 'ci-job'; });
    for (var i = 0; i < ciNodes.length; i++) {
        var el = ciNodes[i];
        if (el.hasChildren && !el.isRoot) {
            el.isExpanded = false;
            var children = elements.filter(function(e) { return e.parentId === el.id; });
            for (var j = 0; j < children.length; j++) {
                children[j].isVisible = false;
                children[j].hidden = true;
            }
        }
    }
    renderElements();
    renderConnections();
}

// ============================================================
// МОДАЛКА
// ============================================================

function openYAMLModal() {
    var modal = document.getElementById('yamlModal');
    if (!modal) { createYAMLModal(); modal = document.getElementById('yamlModal'); }
    modal.style.display = 'flex';
    modal.classList.add('active');
    var fileInput = document.getElementById('ciFileInputModal');
    if (fileInput) fileInput.value = '';
    var infoModal = document.getElementById('ciFileInfoModal');
    if (infoModal) infoModal.style.display = 'none';
    var loadBtn = document.getElementById('loadCiFileBtn');
    if (loadBtn) { loadBtn.style.background = '#e5e7eb'; loadBtn.style.color = '#9ca3af'; loadBtn.style.cursor = 'not-allowed'; loadBtn.disabled = true; }
    var statusText = document.getElementById('ciStatusText');
    if (statusText) { statusText.textContent = 'Drop file or click to select'; statusText.style.color = '#374151'; }
    window._ciFile = null;
}

function closeYAMLModal() {
    var modal = document.getElementById('yamlModal');
    if (modal) { modal.style.display = 'none'; modal.classList.remove('active'); }
}

function createYAMLModal() {
    if (document.getElementById('yamlModal')) return;
    var modalHTML = `
        <div id="yamlModal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:100000;align-items:center;justify-content:center">
            <div style="background:white;border-radius:16px;padding:28px 32px;max-width:550px;width:90%;box-shadow:0 25px 50px rgba(0,0,0,0.25);display:flex;flex-direction:column">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-shrink:0">
                    <h3 style="margin:0;font-size:18px;font-weight:600;color:#1a1a2e;font-family:'Ubuntu',sans-serif"><i class="fas fa-code-branch" style="color:#FC6D26;"></i> Load CI/CD</h3>
                    <button onclick="closeYAMLModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#9ca3af;padding:0 8px">&times;</button>
                </div>
                <div style="margin-bottom:20px">
                    <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:8px;font-family:'Ubuntu',sans-serif"><i class="fas fa-file-code" style="color:#FC6D26;margin-right:6px"></i>Select CI/CD file</label>
                    <div id="ciDropZone" style="border:2px dashed #d1d5db;border-radius:12px;padding:30px 20px;text-align:center;cursor:pointer;transition:all .3s ease;background:#fafafa;position:relative">
                        <input type="file" id="ciFileInputModal" accept=".yml,.yaml,.groovy" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer">
                        <div style="width:56px;height:56px;margin:0 auto 10px;background:#f3f4f6;border-radius:50%;display:flex;align-items:center;justify-content:center"><i class="fas fa-code-branch" style="font-size:24px;color:#FC6D26"></i></div>
                        <p style="margin:0;font-size:14px;font-weight:500;color:#374151;font-family:'Ubuntu',sans-serif" id="ciStatusText">Drop file or click to select</p>
                        <p style="margin:6px 0 0 0;font-size:12px;color:#9ca3af;font-family:'Ubuntu',sans-serif">Supported: GitLab CI, GitHub Actions, Jenkinsfile</p>
                        <div id="ciFileInfoModal" style="display:none;margin-top:12px;padding:10px 14px;background:#ecfdf5;border-radius:8px;border:1px solid #10B981">
                            <span id="ciFileNameModal" style="font-size:13px;font-weight:500;color:#065f46;font-family:'Ubuntu',sans-serif"></span>
                            <span style="margin:0 8px;color:#6b7280">|</span>
                            <span id="ciFileSizeModal" style="font-size:12px;color:#6b7280;font-family:'Ubuntu',sans-serif"></span>
                            <span style="margin:0 8px;color:#6b7280">|</span>
                            <span id="ciFileTypeModal" style="font-size:12px;color:#6b7280;font-family:'Ubuntu',sans-serif"></span>
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end;flex-shrink:0">
                    <button onclick="closeYAMLModal()" style="padding:8px 20px;background:#e5e7eb;border:none;border-radius:8px;cursor:pointer;font-family:'Ubuntu',sans-serif;font-size:13px;color:#374151;transition:background .2s" onmouseenter="this.style.background='#d1d5db'" onmouseleave="this.style.background='#e5e7eb'">Cancel</button>
                    <button id="loadCiFileBtn" disabled onclick="loadCIFromModal()" style="padding:8px 24px;background:#e5e7eb;color:#9ca3af;border:none;border-radius:8px;cursor:not-allowed;font-family:'Ubuntu',sans-serif;font-size:13px;font-weight:500;transition:all .2s">Build Graph</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    var fileInput = document.getElementById('ciFileInputModal');
    var dropZone = document.getElementById('ciDropZone');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) { var file = this.files[0]; if (file) handleCIFile(file); });
    }
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) { e.preventDefault(); this.style.borderColor = '#FC6D26'; this.style.background = '#fef3ec'; });
        dropZone.addEventListener('dragleave', function(e) { e.preventDefault(); this.style.borderColor = '#d1d5db'; this.style.background = '#fafafa'; });
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = '#d1d5db';
            this.style.background = '#fafafa';
            var files = e.dataTransfer.files;
            if (files && files.length > 0) {
                handleCIFile(files[0]);
                if (fileInput) {
                    var dt = new DataTransfer();
                    dt.items.add(files[0]);
                    fileInput.files = dt.files;
                }
            }
        });
    }
}

function handleCIFile(file) {
    var size = (file.size / 1024).toFixed(2);
    var fileNameEl = document.getElementById('ciFileNameModal');
    var fileSizeEl = document.getElementById('ciFileSizeModal');
    var fileTypeEl = document.getElementById('ciFileTypeModal');
    var infoModal = document.getElementById('ciFileInfoModal');
    var loadBtn = document.getElementById('loadCiFileBtn');
    var statusText = document.getElementById('ciStatusText');
    if (statusText) { statusText.textContent = file.name; statusText.style.color = '#FC6D26'; }
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = size + ' KB';
    if (fileTypeEl) fileTypeEl.textContent = file.name.includes('Jenkinsfile') ? 'Jenkinsfile' : 'YAML';
    if (infoModal) infoModal.style.display = 'block';
    if (loadBtn) { loadBtn.style.background = '#FC6D26'; loadBtn.style.color = 'white'; loadBtn.style.cursor = 'pointer'; loadBtn.disabled = false; }
    window._ciFile = file;
}

function loadCIFromModal() {
    var file = window._ciFile;
    if (!file) { showCustomAlert('Ошибка', 'Select CI/CD file', 'warning'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var text = e.target.result;
            buildCIGraphFromYAML(text, file.name);
            closeYAMLModal();
        } catch (err) {
            showCustomAlert('Ошибка', 'Failed to process file: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}

function loadYAMLFile() { openYAMLModal(); }

// ============================================================
// ЭКСПОРТЫ
// ============================================================

window.buildCIGraphFromYAML = buildCIGraphFromYAML;
window.openYAMLModal = openYAMLModal;
window.closeYAMLModal = closeYAMLModal;
window.loadCIFromModal = loadCIFromModal;
window.loadYAMLFile = loadYAMLFile;
window.toggleCINode = toggleCINode;
window.expandAllCI = expandAllCI;
window.collapseAllCI = collapseAllCI;
window.handleCIFile = handleCIFile;
window.parseJenkinsfile = parseJenkinsfile;