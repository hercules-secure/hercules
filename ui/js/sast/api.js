/**
 * API методы для SAST
 */

/**
 * Загрузка архива по ссылке на репозиторий
 */
export async function fetchArchiveFromUrl(url, branch = null) {
    const payload = { url };
    if (branch) payload.branch = branch;

    const response = await fetch('/api/sast/url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Ошибка загрузки' }));
        throw new Error(error.message || 'Ошибка загрузки архива');
    }

    const data = await response.json();
    return data.archive;
}

/**
 * Загрузка архива файлом
 */
export async function uploadArchive(file) {
    const formData = new FormData();
    formData.append('archive', file);

    const response = await fetch('/api/sast/upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
            error = JSON.parse(errorText);
        } catch {
            error = { message: errorText };
        }
        throw new Error(error.message || 'Ошибка загрузки файла');
    }

    const data = await response.json();
   
    let archiveId = null;
    let archiveData = null;
    
    if (data.archive && data.archive.id) {
        archiveId = data.archive.id;
        archiveData = data.archive;
    } else if (data.id) {
        archiveId = data.id;
        archiveData = data;
    } else if (data.result && data.result.id) {
        archiveId = data.result.id;
        archiveData = data.result;
    } else {
        throw new Error('Сервер вернул некорректные данные');
    }
    
    if (!archiveId) {
        throw new Error('Не удалось получить ID архива из ответа сервера');
    }
    
    return {
        id: archiveId,
        filename: archiveData.filename || file.name,
        size: archiveData.size || file.size
    };
}

/**
 * Запуск SAST анализа
 */
export async function runSASTAnalysis(archiveId) {
    if (!archiveId || archiveId === 'undefined' || archiveId === 'null') {
        throw new Error(`Неверный ID архива: ${archiveId}`);
    }

    const response = await fetch(`/api/sast/analyze/${archiveId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            rulesPath: null
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.results;
}

/**
 * Получение информации об архиве
 */
export async function getArchiveInfo(archiveId) {
    const response = await fetch(`/api/archive/${archiveId}`);
    
    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Ошибка получения информации');
    }

    return await response.json();
}
