/**
 * Вспомогательные функции
 */

export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

export function getShortPath(fullPath) {
    if (!fullPath) return 'unknown';
    
    const normalizedPath = fullPath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    
    if (parts.length <= 3) return parts.join('/');
    
    return '.../' + parts.slice(-3).join('/');
}

export function isValidRepositoryUrl(url) {
    if (!url) return false;
    
    return (
        (url.startsWith('http://') || url.startsWith('https://')) &&
        (url.includes('github.com') || url.includes('gitlab') || url.includes('.git'))
    );
}