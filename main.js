document.addEventListener('DOMContentLoaded', () => {
    // DOM элементы
    const elements = {
        keyType: document.getElementById('key-type'),
        keyLength: document.getElementById('key-length'),
        minecraftCommand: document.getElementById('minecraft-command'),
        generateBtn: document.getElementById('generate-btn'),
        result: document.getElementById('result'),
        copyBtn: document.getElementById('copy-btn'),
        saveBtn: document.getElementById('save-btn'),
        toast: document.getElementById('toast'),
        tabButtons: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
        saveGithubSettings: document.getElementById('save-github-settings'),
        repoOwner: document.getElementById('repo-owner'),
        repoName: document.getElementById('repo-name'),
        token: document.getElementById('token'),
        filePath: document.getElementById('file-path'),
        branchName: document.getElementById('branch-name'),
        githubLogin: document.getElementById('github-login'),
        githubConnected: document.getElementById('github-connected'),
        connectedRepo: document.getElementById('connected-repo'),
        connectedFile: document.getElementById('connected-file'),
        connectedBranch: document.getElementById('connected-branch'),
        logoutGithub: document.getElementById('logout-github'),
        refreshKeys: document.getElementById('refresh-keys'),
        keysList: document.getElementById('keys-list'),
        noKeysMessage: document.getElementById('no-keys-message'),
        loadingKeys: document.getElementById('loading-keys'),
        commandDisplay: document.getElementById('command-display'),
        commandCode: document.getElementById('command-code')
    };
    
    // Состояние приложения
    const state = {
        currentKey: '',
        currentKeyType: '',
        githubConfig: JSON.parse(localStorage.getItem('githubConfig') || 'null')
    };
    
    // Инициализация
    function init() {
        if (state.githubConfig) {
            elements.repoOwner.value = state.githubConfig.owner;
            elements.repoName.value = state.githubConfig.repo;
            elements.token.value = state.githubConfig.token;
            elements.filePath.value = state.githubConfig.path;
            elements.branchName.value = state.githubConfig.branch || 'main';
            updateGithubStatus(true);
        }
        
        // Регистрация обработчиков событий
        registerEventHandlers();
        
        // Генерируем ключ при загрузке страницы
        generateKey();
    }
    
    // Регистрация всех обработчиков событий
    function registerEventHandlers() {
        // Переключение вкладок
        elements.tabButtons.forEach(button => {
            button.addEventListener('click', handleTabChange);
        });
        
        // GitHub настройки
        elements.saveGithubSettings.addEventListener('click', saveGithubSettings);
        elements.logoutGithub.addEventListener('click', logoutGithub);
        elements.refreshKeys.addEventListener('click', refreshKeys);
        
        // Генератор ключей
        elements.keyType.addEventListener('change', handleKeyTypeChange);
        elements.minecraftCommand.addEventListener('input', updateCommandDisplay);
        elements.generateBtn.addEventListener('click', generateKey);
        elements.copyBtn.addEventListener('click', copyToClipboard);
        elements.saveBtn.addEventListener('click', saveKeyToGithub);
    }
    
    // Обработчики событий
    function handleTabChange() {
        const tabId = this.getAttribute('data-tab');
        
        elements.tabButtons.forEach(btn => btn.classList.remove('active'));
        elements.tabContents.forEach(content => content.classList.remove('active'));
        
        this.classList.add('active');
        document.getElementById(`${tabId}-tab`).classList.add('active');
        
        if (tabId === 'history' && state.githubConfig) {
            loadKeysFromGithub();
        }
    }
    
    function handleKeyTypeChange() {
        const keyType = elements.keyType.value;
        if (keyType === 'uuid') {
            elements.keyLength.value = 36;
            elements.keyLength.disabled = true;
        } else {
            elements.keyLength.disabled = false;
        }
    }
    
    function updateCommandDisplay() {
        const command = elements.minecraftCommand.value.trim();
        
        if (command) {
            elements.commandCode.textContent = command;
            elements.commandDisplay.classList.remove('hidden');
        } else {
            elements.commandDisplay.classList.add('hidden');
        }
    }
    
    // GitHub функции
    function saveGithubSettings() {
        const owner = elements.repoOwner.value.trim();
        const repo = elements.repoName.value.trim();
        const token = elements.token.value.trim();
        const path = elements.filePath.value.trim() || 'keys.yml';
        const branch = elements.branchName.value.trim() || 'main';
        
        if (!owner || !repo || !token) {
            showToast('Пожалуйста, заполните все поля', 'error');
            return;
        }
        
        const config = { owner, repo, token, path, branch };
        localStorage.setItem('githubConfig', JSON.stringify(config));
        state.githubConfig = config;
        
        updateGithubStatus(true);
        showToast('Настройки GitHub сохранены', 'success');
        
        // Проверяем доступность репозитория
        testGithubConnection();
    }
    
    function logoutGithub() {
        localStorage.removeItem('githubConfig');
        state.githubConfig = null;
        updateGithubStatus(false);
        showToast('Отключено от GitHub');
    }
    
    function refreshKeys() {
        if (state.githubConfig) {
            // Проверяем и обновляем raw-файл перед загрузкой
            checkAndUpdateRawFile();
        } else {
            showToast('Сначала настройте подключение к GitHub', 'error');
        }
    }
    
    function updateGithubStatus(isConnected) {
        if (isConnected && state.githubConfig) {
            elements.githubLogin.classList.add('hidden');
            elements.githubConnected.classList.remove('hidden');
            elements.connectedRepo.textContent = `${state.githubConfig.owner}/${state.githubConfig.repo}`;
            elements.connectedFile.textContent = state.githubConfig.path;
            elements.connectedBranch.textContent = state.githubConfig.branch || 'main';
            elements.saveBtn.disabled = false;
        } else {
            elements.githubLogin.classList.remove('hidden');
            elements.githubConnected.classList.add('hidden');
            elements.saveBtn.disabled = true;
        }
    }
    
    function testGithubConnection() {
        if (!state.githubConfig) return;
        
        const { owner, repo, token, path } = state.githubConfig;
        
        // Сначала проверяем существование репозитория
        fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}`)
            .then(handleGithubResponse)
            .then(repoData => {
                // Проверяем, приватный ли репозиторий
                const message = repoData.private
                    ? 'Подключено к приватному репозиторию. Убедитесь, что токен имеет разрешение `repo`.'
                    : 'Подключено к публичному репозиторию.';
                showToast(message, 'success');
                
                // Теперь проверяем существование файла
                return fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${state.githubConfig.branch || 'main'}`);
            })
            .then(response => {
                if (response.status === 404) {
                    // Файл не существует, но репозиторий доступен
                    showToast('Репозиторий доступен, но файл не найден. Он будет создан при сохранении ключа.', 'warning');
                    return;
                }
                
                if (!response.ok) {
                    handleGithubError(response);
                    return;
                }
                
                showToast('Подключение к GitHub успешно! Файл найден.', 'success');
            })
            .catch(error => {
                console.error('Ошибка при проверке подключения к GitHub:', error);
                if (!error.message.includes('Репозиторий не найден') && 
                    !error.message.includes('Неверный токен доступа')) {
                    showToast('Ошибка подключения к GitHub. Проверьте настройки и токен доступа.', 'error');
                }
            });
    }
    
    // Работа с ключами
    function generateKey() {
        const keyType = elements.keyType.value;
        const keyLength = parseInt(elements.keyLength.value);
        
        let key = '';
        
        switch (keyType) {
            case 'random':
                key = generateRandomKey(keyLength);
                break;
            case 'uuid':
                key = generateUUID();
                break;
            case 'alphanumeric':
                key = generateAlphanumericKey(keyLength);
                break;
            case 'hex':
                key = generateHexKey(keyLength);
                break;
        }
        
        elements.result.textContent = key;
        state.currentKey = key;
        state.currentKeyType = keyType;
        
        // Обновляем отображение команды Minecraft
        updateCommandDisplay();
    }
    
    function generateRandomKey(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?';
        return generateKeyFromCharset(chars, length);
    }
    
    function generateAlphanumericKey(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return generateKeyFromCharset(chars, length);
    }
    
    function generateHexKey(length) {
        const chars = '0123456789ABCDEF';
        return generateKeyFromCharset(chars, length);
    }
    
    function generateKeyFromCharset(charset, length) {
        let result = '';
        const charsetLength = charset.length;
        
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charsetLength));
        }
        
        return result;
    }
    
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    function copyToClipboard() {
        const text = elements.result.textContent;
        if (!text) return;
        
        navigator.clipboard.writeText(text)
            .then(() => showToast('Скопировано в буфер обмена!', 'success'))
            .catch(err => console.error('Не удалось скопировать текст: ', err));
    }
    
    function saveKeyToGithub() {
        if (!state.githubConfig) {
            showToast('Сначала настройте подключение к GitHub', 'error');
            return;
        }
        
        if (!state.currentKey) {
            showToast('Сначала сгенерируйте ключ!', 'error');
            return;
        }
        
        const { owner, repo, token, path, branch = 'main' } = state.githubConfig;
        
        // Показываем индикатор загрузки
        showButtonLoading(elements.saveBtn, 'Сохранение...');
        
        // Получаем текущее содержимое файла
        fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`)
            .then(response => {
                if (response.status === 404) {
                    // Файл не существует, создаем новый
                    return { content: null, sha: null };
                }
                
                if (!response.ok) {
                    handleGithubError(response);
                    return Promise.reject(new Error(`HTTP error! status: ${response.status}`));
                }
                
                return response.json();
            })
            .then(data => {
                let keysData = {};
                let sha = null;
                
                if (data.content) {
                    const decodedContent = atob(data.content);
                    try {
                        keysData = jsyaml.load(decodedContent) || {};
                    } catch (e) {
                        console.error('Ошибка при парсинге YAML:', e);
                        keysData = {};
                    }
                    sha = data.sha;
                }
                
                // Генерируем уникальный идентификатор для ключа
                const keyId = `key_${new Date().getTime()}`;
                
                // Создаем новый ключ в формате согласно примеру
                keysData[keyId] = {
                    value: [state.currentKey],
                    minecraft_command: elements.minecraftCommand.value.trim() || null
                };
                
                // Ограничиваем количество ключей до 100
                const keyIds = Object.keys(keysData);
                if (keyIds.length > 100) {
                    // Удаляем старые ключи
                    const idsToRemove = keyIds.slice(0, keyIds.length - 100);
                    idsToRemove.forEach(id => {
                        delete keysData[id];
                    });
                }
                
                // Сериализуем в YAML
                const yamlContent = jsyaml.dump(keysData);
                
                // Обновляем файл на GitHub
                return updateGithubFile(path, yamlContent, sha);
            })
            .then(response => {
                if (response.ok) {
                    showToast('Ключ успешно сохранен в GitHub!', 'success');
                    
                    // Принудительно обновляем raw-файл
                    forceUpdateRawFile();
                } else {
                    handleGithubError(response);
                    return Promise.reject(new Error(`HTTP error! status: ${response.status}`));
                }
            })
            .catch(error => {
                console.error('Ошибка при сохранении ключа:', error);
                showToast(`Ошибка при сохранении ключа: ${error.message}`, 'error');
            })
            .finally(() => {
                // Восстанавливаем кнопку
                resetButton(elements.saveBtn, `<i class="fas fa-save"></i> Сохранить в GitHub`);
            });
    }
    
    // Функция для принудительного обновления raw-файла
    function forceUpdateRawFile() {
        if (!state.githubConfig) return;
        
        const { owner, repo, path, branch = 'main' } = state.githubConfig;
        
        // Даем GitHub время на обработку изменений
        setTimeout(() => {
            // Формируем URL raw-файла с параметром времени для обхода кэширования
            const timestamp = new Date().getTime();
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}?t=${timestamp}`;
            
            // Выполняем запрос к raw-файлу для принудительного обновления
            fetch(rawUrl, { method: 'GET', cache: 'no-store' })
                .then(response => {
                    if (response.ok) {
                        console.log('Raw-файл успешно обновлен');
                    } else {
                        console.warn('Raw-файл не доступен сразу после обновления, это нормально');
                    }
                })
                .catch(error => {
                    console.error('Ошибка при обновлении raw-файла:', error);
                });
        }, 2000); // Задержка в 2 секунды
    }
    
    function updateGithubFile(path, content, sha) {
        const { owner, repo, token, branch = 'main' } = state.githubConfig;
        
        const body = {
            message: 'Добавлен новый ключ',
            content: btoa(content),
            branch: branch
        };
        
        if (sha) {
            body.sha = sha;
        }
        
        return fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });
    }
    
    function loadKeysFromGithub() {
        if (!state.githubConfig) return;
        
        const { owner, repo, path, branch = 'main' } = state.githubConfig;
        
        elements.keysList.innerHTML = '';
        elements.noKeysMessage.style.display = 'none';
        elements.loadingKeys.classList.remove('hidden');
        
        fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`)
            .then(response => {
                if (!response.ok) {
                    handleGithubError(response);
                    return Promise.reject(new Error(`HTTP error! status: ${response.status}`));
                }
                
                return response.json();
            })
            .then(data => {
                const decodedContent = atob(data.content);
                let keysData = {};
                
                try {
                    keysData = jsyaml.load(decodedContent) || {};
                    if (typeof keysData !== 'object' || keysData === null) {
                        throw new Error('Неверный формат данных');
                    }
                } catch (e) {
                    console.error('Ошибка при парсинге YAML:', e);
                    throw new Error('Ошибка при парсинге YAML');
                }
                
                if (Object.keys(keysData).length === 0) {
                    throw new Error('Нет сохраненных ключей');
                }
                
                renderKeysList(keysData);
            })
            .catch(error => {
                console.error('Ошибка при загрузке ключей:', error);
                elements.noKeysMessage.textContent = error.message || 'Ошибка при загрузке ключей';
                elements.noKeysMessage.style.display = 'block';
            })
            .finally(() => {
                elements.loadingKeys.classList.add('hidden');
            });
    }
    
    function renderKeysList(keysData) {
        elements.keysList.innerHTML = '';
        
        Object.entries(keysData).forEach(([keyId, keyData]) => {
            const keyItem = document.createElement('div');
            keyItem.className = 'key-item';
            
            // Формируем содержимое элемента
            let keyValueText = '';
            if (Array.isArray(keyData.value)) {
                keyValueText = keyData.value.join(', ');
            } else {
                keyValueText = String(keyData.value || '');
            }
            
            // Создаем HTML разметку для элемента ключа
            keyItem.innerHTML = `
                <div class="key-header">${keyId}</div>
                <div class="key-value">${keyValueText}</div>
                ${keyData.minecraft_command ? `
                    <div class="key-command">
                        <strong>Команда:</strong> <code>${keyData.minecraft_command}</code>
                    </div>
                    <button class="key-command-copy"><i class="fas fa-copy"></i> Копировать команду</button>
                ` : ''}
            `;
            
            // Добавляем обработчики событий
            keyItem.addEventListener('click', () => {
                navigator.clipboard.writeText(keyValueText)
                    .then(() => showToast('Ключ скопирован в буфер обмена!', 'success'));
            });
            
            // Если есть кнопка копирования команды
            const commandCopyBtn = keyItem.querySelector('.key-command-copy');
            if (commandCopyBtn) {
                commandCopyBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Предотвращаем срабатывание обработчика родительского элемента
                    navigator.clipboard.writeText(keyData.minecraft_command)
                        .then(() => showToast('Команда скопирована в буфер обмена!', 'success'));
                });
            }
            
            elements.keysList.appendChild(keyItem);
        });
    }
    
    // Функция для проверки и обновления raw-файла
    function checkAndUpdateRawFile() {
        if (!state.githubConfig) return;
        
        const { owner, repo, path, branch = 'main' } = state.githubConfig;
        
        // Проверяем файл через API
        fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`)
            .then(response => {
                if (!response.ok) {
                    handleGithubError(response);
                    return Promise.reject(new Error(`HTTP error! status: ${response.status}`));
                }
                
                return response.json();
            })
            .then(data => {
                // Теперь проверяем raw-файл
                const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
                return fetch(rawUrl, { cache: 'no-store' });
            })
            .then(response => {
                if (!response.ok) {
                    // Если raw-файл недоступен, показываем предупреждение
                    showToast('Raw-файл пока не доступен. Это может занять некоторое время.', 'warning');
                }
                // В любом случае пробуем загрузить ключи
                loadKeysFromGithub();
            })
            .catch(error => {
                console.error('Ошибка при проверке файла:', error);
                showToast('Файл не найден. Сначала сохраните ключ.', 'error');
            });
    }
    
    // Вспомогательные функции
    function fetchWithAuth(url) {
        return fetch(url, {
            headers: {
                'Authorization': `token ${state.githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
    }
    
    function handleGithubResponse(response) {
        if (response.status === 404) {
            showToast('Репозиторий не найден. Проверьте имя репозитория или создайте его.', 'warning');
            return Promise.reject(new Error('Репозиторий не найден'));
        }
        
        if (response.status === 401) {
            showToast('Неверный токен доступа. Убедитесь, что у вас есть права на репозиторий.', 'error');
            return Promise.reject(new Error('Неверный токен доступа'));
        }
        
        if (!response.ok) {
            return Promise.reject(new Error(`HTTP error! status: ${response.status}`));
        }
        
        return response.json();
    }
    
    function handleGithubError(response) {
        switch (response.status) {
            case 401:
                showToast('Недостаточно прав для доступа к репозиторию. Проверьте токен.', 'error');
                break;
            case 403:
                showToast('Ограничение GitHub API или недостаточно прав. Проверьте токен.', 'error');
                break;
            case 404:
                showToast('Файл или репозиторий не найден. Проверьте данные.', 'warning');
                break;
            default:
                showToast(`Ошибка GitHub API: ${response.status}`, 'error');
        }
    }
    
    function showButtonLoading(button, loadingText) {
        const originalContent = button.innerHTML;
        button.setAttribute('data-original-content', originalContent);
        button.innerHTML = `<span class="button-spinner"></span> ${loadingText}`;
        button.disabled = true;
    }
    
    function resetButton(button, content) {
        button.innerHTML = content || button.getAttribute('data-original-content') || button.innerHTML;
        button.disabled = false;
    }
    
    function showToast(message, type = 'default') {
        // Определяем иконку на основе типа сообщения
        let icon = '';
        let color = '';
        
        switch (type) {
            case 'success':
                icon = '<i class="fas fa-check-circle"></i>';
                color = 'var(--success)';
                break;
            case 'error':
                icon = '<i class="fas fa-exclamation-circle"></i>';
                color = 'var(--accent)';
                break;
            case 'warning':
                icon = '<i class="fas fa-exclamation-triangle"></i>';
                color = 'var(--warning)';
                break;
            default:
                icon = '<i class="fas fa-info-circle"></i>';
                color = 'var(--bg-mid)';
        }
        
        elements.toast.innerHTML = `${icon} ${message}`;
        elements.toast.style.borderLeftColor = color;
        elements.toast.classList.add('show');
        
        setTimeout(() => {
            elements.toast.classList.remove('show');
        }, 3000);
    }
    
    // Запуск инициализации
    init();
});