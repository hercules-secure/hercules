// Анти-дебаггинг
if (typeof window !== 'undefined') {
    setInterval(() => {
        const start = performance.now();
        debugger;
        if (performance.now() - start > 100) {
            document.body.innerHTML = '<h1>Access Denied</h1>';
            throw new Error('Debugger detected');
        }
    }, 1000);
}

// Проверка окружения
if (process.env.NODE_ENV !== 'production') {
    console.log('Development mode');
}
