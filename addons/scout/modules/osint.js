// addons/scout/modules/osint.js - OSINT модуль для сбора email и телефонов

/**
 * Модуль OSINT для Скаута
 * Собирает email, телефоны, соцсети, ищет персональные данные
 */

// Регулярные выражения для поиска
const PATTERNS = {
    // Email (основные + уточненные)
    email: [
        /[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}/gi,
        /[a-zA-Z0-9._%+-]+@(gmail|mail|yandex|yahoo|outlook|inbox|list|bk|internet|rambler|me|protonmail|tutanota)\.(ru|com|net|org|ua|by|kz|io|me|de|fr|es|it)/gi,
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
        // Корпоративные email
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(ru|com|net|org)/gi
    ],
    
    // Телефоны (международные, российские, украинские, казахстанские)
    phone: [
        // Международный формат +7 999 123-45-67
        /\+\d{1,3}\s?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{1,4}/gi,
        // Российские номера 8-999-123-45-67
        /8[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/gi,
        // 9xx xxx-xx-xx
        /9\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/gi,
        // +7 999 1234567
        /\+\d{1,3}\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2}/gi,
        // Киевстар, Vodafone, Life
        /380\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/gi,
        // Казахстан
        /77\d{1}\s?\d{3}\s?\d{2}\s?\d{2}/gi,
        // Беларусь
        /375\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/gi,
        // Европейские номера
        /\+\d{2}\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/gi
    ],
    
    // Социальные сети (расширенная версия)
    social: {
        // Профессиональные сети
        linkedin: /linkedin\.com\/(?:in|company|school|pub)\/[a-zA-Z0-9\-_%]+/gi,
        indeed: /indeed\.com\/r\/[a-zA-Z0-9\-_]+/gi,
        glassdoor: /glassdoor\.com\/profile\/[a-zA-Z0-9\-_]+/gi,
        headhunter: /hh\.ru\/(?:resume|employer)\/[a-zA-Z0-9\-_]+/gi,
        superjob: /superjob\.ru\/(?:resume|profile)\/[a-zA-Z0-9\-_]+/gi,
        rabota: /rabota\.ru\/profile\/[a-zA-Z0-9\-_]+/gi,
        zarplata: /zarplata\.ru\/profile\/[a-zA-Z0-9\-_]+/gi,
        profi: /profi\.ru\/profile\/[a-zA-Z0-9\-_]+/gi,
        careerist: /careerist\.ru\/profile\/[a-zA-Z0-9\-_]+/gi,
        joblab: /joblab\.com\/profile\/[a-zA-Z0-9\-_]+/gi,
        monster: /monster\.com\/profile\/[a-zA-Z0-9\-_]+/gi,
        
        // Русские социальные сети
        vk: /vk\.com\/(?:id\d+|[a-zA-Z0-9_\.]+)(?:\?[^\/]*)?/gi,
        ok: /ok\.ru\/(?:profile\/\d+|group\/\d+|[a-zA-Z0-9_\.]+)/gi,
        mailru: /my\.mail\.ru\/(?:profile|community)\/[a-zA-Z0-9\-_]+/gi,
        yandex: /yandex\.ru\/profile\/[a-zA-Z0-9\-_]+/gi,
        tenor: /tenor\.com\/user\/[a-zA-Z0-9\-_]+/gi,
        dzen: /dzen\.ru\/(?:id\/\d+|profile\/[a-zA-Z0-9\-_]+)/gi,
        pikabu: /pikabu\.ru\/@[a-zA-Z0-9\-_]+/gi,
        vc: /vc\.ru\/u\/[a-zA-Z0-9\-_]+/gi,
        
        // Зарубежные социальные сети
        facebook: /(?:facebook|fb)\.com\/(?:[a-zA-Z0-9\.]+|profile\.php\?id=\d+)/gi,
        instagram: /instagram\.com\/(?:[a-zA-Z0-9_\.]+|p\/[a-zA-Z0-9\-_]+)/gi,
        twitter: /(?:twitter|x)\.com\/(?:[a-zA-Z0-9_]+|i\/web\/status\/\d+)/gi,
        tiktok: /tiktok\.com\/@[a-zA-Z0-9_\.]+/gi,
        youtube: /youtube\.com\/(?:@[a-zA-Z0-9\-_]+|c\/[a-zA-Z0-9\-_]+|user\/[a-zA-Z0-9\-_]+)/gi,
        twitch: /twitch\.tv\/[a-zA-Z0-9\-_]+/gi,
        discord: /discord\.(?:com\/invite\/[a-zA-Z0-9\-_]+|gg\/[a-zA-Z0-9\-_]+)/gi,
        reddit: /reddit\.com\/(?:user|r)\/[a-zA-Z0-9\-_]+/gi,
        pinterest: /pinterest\.com\/[a-zA-Z0-9\-_]+/gi,
        tumblr: /tumblr\.com\/blog\/[a-zA-Z0-9\-_]+/gi,
        flickr: /flickr\.com\/people\/[a-zA-Z0-9\-_]+/gi,
        snapchat: /snapchat\.com\/add\/[a-zA-Z0-9\-_]+/gi,
        whatsapp: /wa\.me\/\d+/gi,
        viber: /viber\.com\/[a-zA-Z0-9\-_]+/gi,
        
        // Мессенджеры
        telegram: /(?:t\.me|telegram\.me)\/[a-zA-Z0-9_]+/gi,
        signal: /signal\.me\/#\/[a-zA-Z0-9\-_]+/gi,
        wechat: /wechat\.com\/[a-zA-Z0-9\-_]+/gi,
        
        // Блоги и площадки
        habr: /habr\.com\/ru\/users\/[a-zA-Z0-9\-_]+\/posts/gi,
        medium: /medium\.com\/@[a-zA-Z0-9\-_]+/gi,
        blogger: /blogger\.com\/profile\/\d+/gi,
        livejournal: /livejournal\.com\/profile\/[a-zA-Z0-9\-_]+/gi,
        telegraph: /telegra\.ph\/[a-zA-Z0-9\-_]+/gi,
        
        // IT площадки
        github: /github\.com\/[a-zA-Z0-9\-_]+\/[a-zA-Z0-9\-_]+/gi,
        gitlab: /gitlab\.com\/[a-zA-Z0-9\-_]+\/[a-zA-Z0-9\-_]+/gi,
        bitbucket: /bitbucket\.org\/[a-zA-Z0-9\-_]+\/[a-zA-Z0-9\-_]+/gi,
        stackoverflow: /stackoverflow\.com\/users\/\d+\/[a-zA-Z0-9\-_]+/gi,
        leetcode: /leetcode\.com\/[a-zA-Z0-9\-_]+/gi,
        codewars: /codewars\.com\/users\/[a-zA-Z0-9\-_]+/gi,
        hackerrank: /hackerrank\.com\/profile\/[a-zA-Z0-9\-_]+/gi,
        upwork: /upwork\.com\/freelancers\/~[a-zA-Z0-9]+/gi,
        freelancer: /freelancer\.com\/u\/[a-zA-Z0-9\-_]+/gi,
        
        // HR и поиск работы
        linkedin_company: /linkedin\.com\/company\/[a-zA-Z0-9\-_]+/gi,
        hh_company: /hh\.ru\/employer\/\d+/gi,
        indeed_company: /indeed\.com\/cmp\/[a-zA-Z0-9\-_]+/gi,
        
        // Портфолио
        behance: /behance\.net\/[a-zA-Z0-9\-_]+/gi,
        dribbble: /dribbble\.com\/[a-zA-Z0-9\-_]+/gi,
        artstation: /artstation\.com\/[a-zA-Z0-9\-_]+/gi,
        deviantart: /deviantart\.com\/[a-zA-Z0-9\-_]+/gi,
        figma: /figma\.com\/@[a-zA-Z0-9\-_]+/gi,
        
        // Форумные профили
        stackexchange: /stackexchange\.com\/users\/\d+\/[a-zA-Z0-9\-_]+/gi,
        quora: /quora\.com\/profile\/[a-zA-Z0-9\-_]+/gi,
        producthunt: /producthunt\.com\/@[a-zA-Z0-9\-_]+/gi,
        cnet: /cnet\.com\/profiles\/[a-zA-Z0-9\-_]+/gi,
        
        // Крипто и веб3
        etherscan: /etherscan\.io\/address\/0x[a-fA-F0-9]{40}/gi,
        opensea: /opensea\.io\/[a-zA-Z0-9\-_]+/gi,
        github_gist: /gist\.github\.com\/[a-zA-Z0-9\-_]+\/[a-fA-F0-9]+/gi,
        keybase: /keybase\.io\/[a-zA-Z0-9\-_]+/gi,
        
        // API и документация
        readthedocs: /[a-zA-Z0-9\-_]+\.readthedocs\.io/gi,
        gitbook: /[a-zA-Z0-9\-_]+\.gitbook\.io/gi,
        notion: /notion\.so\/[a-zA-Z0-9\-_]+/gi
    },
    
    // Слова-маркеры для поиска HR/персональных страниц (расширенные)
    hrMarkers: [
        'hr', 'hr-менеджер', 'hr manager', 'human resources',
        'рекрутер', 'recruiter', 'кадровый', 'personnel',
        'head of hr', 'директор по персоналу',
        'менеджер по персоналу', 'менеджер по подбору',
        'специалист по подбору', 'talent acquisition',
        'team lead', 'руководитель отдела',
        'директор департамента', 'руководитель направления',
        'chief people officer', 'cpo', 'people partner',
        'hr business partner', 'hrbp', 'hr generalist',
        'hr operations', 'hr admin', 'hr coordinator',
        'people operations', 'talent manager', 'recruitment',
        'staffing', 'employee relations', 'compensation and benefits',
        'learning and development', 'onboarding', 'employer brand',
        'отдел кадров', 'отдел персонала', 'отдел подбора',
        'hr department', 'recruitment department',
        'talent department', 'people department',
        'hr director', 'vp of hr', 'director of talent',
        'recruitment lead', 'sourcer', 'recruitment specialist',
        'hr consultant', 'hr analyst', 'hr manager',
        'вакансия', 'vacancy', 'резюме', 'resume', 'cv',
        'собеседование', 'interview', 'оффер', 'offer',
        'карьера', 'career', 'работа', 'job', 'employment'
    ],
    
    // Типы страниц, где могут быть HR данные (расширенные)
    hrPages: [
        '/career', '/careers', '/job', '/jobs', '/vacancy', '/vacancies',
        '/hr', '/hr-department', '/team', '/about', '/about-us',
        '/staff', '/employees', '/people', '/our-team', '/management',
        '/leadership', '/executive', '/board', '/company', '/company-team',
        '/recruitment', '/hiring', '/join-us', '/work-with-us',
        '/opportunities', '/positions', '/career-opportunities',
        '/talent', '/talent-acquisition', '/people-culture',
        '/life-at-company', '/culture', '/benefits', '/perks',
        '/human-resources', '/hr-team', '/people-team',
        '/recruiters', '/sourcers', '/hr-contacts',
        '/contact-hr', '/hr-email', '/hr-manager',
        '/about/team', '/about/leadership', '/about/management',
        '/company/careers', '/company/jobs', '/company/team',
        '/team/leadership', '/team/management', '/team/hr'
    ],
    
    // Дополнительные паттерны для поиска
    additional: {
        // Skype
        skype: /skype:[a-zA-Z0-9\-_\.]+[?]?/gi,
        // Zoom
        zoom: /zoom\.us\/j\/\d+/gi,
        // Google Meet
        meet: /meet\.google\.com\/[a-z\-]+/gi,
        // Team
        teams: /teams\.microsoft\.com\/l\/meetup-join\/[a-z0-9\-]+/gi,
        // ФИО (русские и английские)
        fullNameRu: /[А-Я][а-я]+(?:\s+[А-Я][а-я]+)+(?:\s+[А-Я][а-я]+)?/g,
        fullNameEn: /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+(?:\s+[A-Z][a-z]+)?/g
    }
};

// Функция для извлечения username из URL соцсети
function extractSocialUsername(url, platform) {
    const patterns = {
        linkedin: /\/(?:in|company|pub)\/([a-zA-Z0-9\-_%]+)/i,
        vk: /vk\.com\/(?:id\d+|([a-zA-Z0-9_\.]+))/i,
        instagram: /instagram\.com\/([a-zA-Z0-9_\.]+)/i,
        twitter: /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i,
        github: /github\.com\/([a-zA-Z0-9\-_]+)\//i,
        telegram: /(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/i,
        facebook: /facebook\.com\/([a-zA-Z0-9\.]+)/i,
        youtube: /youtube\.com\/@([a-zA-Z0-9\-_]+)/i,
        tiktok: /tiktok\.com\/@([a-zA-Z0-9_\.]+)/i,
        habr: /habr\.com\/ru\/users\/([a-zA-Z0-9\-_]+)/i,
        medium: /medium\.com\/@([a-zA-Z0-9\-_]+)/i
    };
    
    const pattern = patterns[platform];
    if (pattern) {
        const match = url.match(pattern);
        return match ? match[1] : null;
    }
    return null;
}

// Функция для поиска email по username и домену
function generatePossibleEmails(username, domain) {
    if (!username || !domain) return [];
    
    const patterns = [
        `${username}@${domain}`,
        `${username}.work@${domain}`,
        `${username}.hr@${domain}`,
        `hr.${username}@${domain}`,
        `${username}.recruit@${domain}`,
        `recruiter.${username}@${domain}`,
        `${username}.career@${domain}`,
        `career.${username}@${domain}`,
        `${username}.jobs@${domain}`,
        `jobs.${username}@${domain}`,
        `${username}.talent@${domain}`,
        `talent.${username}@${domain}`,
        `${username}@hr.${domain}`,
        `${username}@recruit.${domain}`,
        `${username}@careers.${domain}`,
        `${username}@people.${domain}`,
        `${username}@staff.${domain}`,
        `${username}@team.${domain}`,
        `${username}@company.${domain}`,
        `${username[0]}${username.split(' ')[1]}@${domain}`,
        `${username.split(' ')[0]}.${username.split(' ')[1]}@${domain}`,
        `${username.split(' ')[0]}_${username.split(' ')[1]}@${domain}`,
        `${username.split(' ')[0]}${username.split(' ')[1][0]}@${domain}`,
        `${username.split(' ')[0][0]}${username.split(' ')[1]}@${domain}`
    ];
    
    return [...new Set(patterns)];
}

// Функция для очистки и валидации email
function cleanEmail(email) {
    email = email.toLowerCase().trim();
    email = email.replace(/[<>()\[\]{}]/g, '');
    const validEmail = /^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/;
    return validEmail.test(email) ? email : null;
}

// Функция для очистки телефона
function cleanPhone(phone) {
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('8') && cleaned.length === 11) {
        cleaned = '+7' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+') && cleaned.length === 10) {
        cleaned = '+7' + cleaned;
    } else if (cleaned.startsWith('9') && cleaned.length === 10) {
        cleaned = '+7' + cleaned;
    } else if (cleaned.startsWith('380') && cleaned.length === 12) {
        cleaned = '+' + cleaned;
    }
    
    if (cleaned.length < 10) return null;
    return cleaned;
}

// Функция для поиска email в тексте
function findEmails(text, source) {
    const emails = new Map();
    
    for (const pattern of PATTERNS.email) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            const email = cleanEmail(match[0]);
            if (email && !emails.has(email)) {
                emails.set(email, {
                    email: email,
                    source: source,
                    domain: email.split('@')[1],
                    type: 'email'
                });
            }
        }
    }
    
    return Array.from(emails.values());
}

// Функция для поиска телефонов в тексте
function findPhones(text, source) {
    const phones = new Map();
    
    for (const pattern of PATTERNS.phone) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            const phone = cleanPhone(match[0]);
            if (phone && !phones.has(phone)) {
                phones.set(phone, {
                    phone: phone,
                    source: source,
                    type: 'phone',
                    original: match[0]
                });
            }
        }
    }
    
    return Array.from(phones.values());
}

// Функция для поиска соцсетей
function findSocialLinks(text, source) {
    const socials = [];
    
    for (const [platform, pattern] of Object.entries(PATTERNS.social)) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            const username = extractSocialUsername(match[0], platform);
            socials.push({
                platform: platform,
                url: match[0],
                source: source,
                type: 'social',
                username: username
            });
        }
    }
    
    return socials;
}

// Функция для поиска дополнительной информации
function findAdditionalInfo(text, source) {
    const info = [];
    
    // Skype
    const skypeMatches = text.matchAll(PATTERNS.additional.skype);
    for (const match of skypeMatches) {
        info.push({
            type: 'skype',
            value: match[0].replace('skype:', ''),
            source: source
        });
    }
    
    // Zoom
    const zoomMatches = text.matchAll(PATTERNS.additional.zoom);
    for (const match of zoomMatches) {
        info.push({
            type: 'zoom',
            value: match[0],
            source: source
        });
    }
    
    // Имена (русские)
    const namesRu = text.match(PATTERNS.additional.fullNameRu) || [];
    for (const name of namesRu.slice(0, 20)) {
        if (!info.some(i => i.value === name)) {
            info.push({
                type: 'name_ru',
                value: name.trim(),
                source: source
            });
        }
    }
    
    // Имена (английские)
    const namesEn = text.match(PATTERNS.additional.fullNameEn) || [];
    for (const name of namesEn.slice(0, 20)) {
        if (!info.some(i => i.value === name)) {
            info.push({
                type: 'name_en',
                value: name.trim(),
                source: source
            });
        }
    }
    
    return info;
}

// Остальные функции (findInternalLinks, detectHRContext, fetchPage, findContacts) остаются без изменений...
// (они были в предыдущем сообщении)

// Экспорт функций
export { 
    findContacts, 
    findEmails, 
    findPhones, 
    findSocialLinks, 
    findAdditionalInfo,
    detectHRContext, 
    extractSocialUsername, 
    generatePossibleEmails 
};

export default { 
    findContacts, 
    findEmails, 
    findPhones, 
    findSocialLinks, 
    findAdditionalInfo,
    detectHRContext, 
    extractSocialUsername, 
    generatePossibleEmails 
};