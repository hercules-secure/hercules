
        const OAUTH_CONFIG = {
            google: {
                clientId: 'YOUR_GOOGLE_CLIENT_ID',
                redirectUri: window.location.origin + '/auth/google/callback',
                authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                scope: 'profile email',
                responseType: 'code'
            },
          yandex: {
                clientId: '3707242322a8410982f9cef1e170ed41',
                redirectUri: window.location.origin,
                authUrl: 'https://oauth.yandex.ru/authorize',
                scope: 'login:email login:info',
                responseType: 'code'
            },
            mailru: {
                clientId: 'YOUR_MAILRU_CLIENT_ID', 
                redirectUri: window.location.origin,
                authUrl: 'https://o2.mail.ru/login',
                scope: 'userinfo',
                responseType: 'code'
            }
        };

        let activeButton = null;

        async function handleProviderLogin(provider) {
            if (activeButton) return;
            
            const config = OAUTH_CONFIG[provider];
            if (!config) {
                showNotification('error', 'Provider not supported');
                return;
            }

            const button = document.getElementById(`${provider}-btn`);
            setButtonLoading(button, true);
            
            try {
                const state = generateRandomState();
                localStorage.setItem('oauth_state', state);
                sessionStorage.setItem('oauth_provider', provider);
                
                const params = new URLSearchParams({
                    client_id: config.clientId,
                    redirect_uri: config.redirectUri,
                    response_type: config.responseType,
                    scope: config.scope,
                    state: state
                });

                const authUrl = `${config.authUrl}?${params.toString()}`;
                
                
                setTimeout(() => {
                    window.location.href = authUrl;
                }, 100);
                
            } catch (error) {
                console.error('OAuth error:', error);
                showNotification('error', `Login failed`);
                setButtonLoading(button, false);
            }
        }

        function setButtonLoading(button, loading) {
            if (!button) return;
            
            if (loading) {
                activeButton = button;
                const originalText = button.querySelector('span').textContent;
                button.dataset.originalText = originalText;
                //button.querySelector('span').innerHTML = '<span class="loading"></span>';
                //button.style.opacity = '0.7';
                button.disabled = true;
            } else {
                activeButton = null;
                button.querySelector('span').innerHTML = button.dataset.originalText;
                button.style.opacity = '1';
                button.disabled = false;
            }
        }

        function generateRandomState() {
            return Math.random().toString(36).substring(2, 15);
        }

        function handleOAuthCallback() {
            const urlParams = new URLSearchParams(window.location.search);
            const error = urlParams.get('error');
            const code = urlParams.get('code');
            const state = urlParams.get('state');
            
            if (error) {
                showNotification('error', 'Authorization failed');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
                return;
            }
            
            if (code) {
                const savedState = localStorage.getItem('oauth_state');
                if (state !== savedState) {
                    showNotification('error', 'Security error');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                    return;
                }
                
                showNotification('success', 'Login successful');
                
                localStorage.removeItem('oauth_state');
                sessionStorage.removeItem('oauth_provider');
                
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            }
        }

        function showNotification(type, message) {
            const notification = document.getElementById('notification');
            const icon = notification.querySelector('.notification-icon');
            const messageEl = notification.querySelector('.notification-message');
            
            notification.className = 'notification ' + type;
            
            const icons = {
                success: '✓',
                error: '✗',
                info: 'i'
            };
            icon.textContent = icons[type] || 'i';
            
            messageEl.textContent = message;
            notification.style.display = 'flex';
            
            clearTimeout(window.notificationTimeout);
            window.notificationTimeout = setTimeout(hideNotification, 3000);
        }

        function hideNotification() {
            const notification = document.getElementById('notification');
            notification.style.display = 'none';
        }

        if (window.location.pathname.includes('/auth/')) {
            handleOAuthCallback();
        }

        window.handleProviderLogin = handleProviderLogin;
        window.showNotification = showNotification;
        window.hideNotification = hideNotification;