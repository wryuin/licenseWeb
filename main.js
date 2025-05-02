document.addEventListener('DOMContentLoaded', () => {
    const keyTypeSelect = document.getElementById('key-type');
    const keyLengthInput = document.getElementById('key-length');
    const minecraftCommandInput = document.getElementById('minecraft-command');
    const generateBtn = document.getElementById('generate-btn');
    const resultDiv = document.getElementById('result');
    const copyBtn = document.getElementById('copy-btn');
    const saveBtn = document.getElementById('save-btn');
    const toast = document.getElementById('toast');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const saveGithubSettingsBtn = document.getElementById('save-github-settings');
    const repoOwnerInput = document.getElementById('repo-owner');
    const repoNameInput = document.getElementById('repo-name');
    const tokenInput = document.getElementById('token');
    const filePathInput = document.getElementById('file-path');
    const branchNameInput = document.getElementById('branch-name');
    const githubLoginDiv = document.getElementById('github-login');
    const githubConnectedDiv = document.getElementById('github-connected');
    const connectedRepoSpan = document.getElementById('connected-repo');
    const connectedFileSpan = document.getElementById('connected-file');
    const connectedBranchSpan = document.getElementById('connected-branch');
    const logoutGithubBtn = document.getElementById('logout-github');
    const refreshKeysBtn = document.getElementById('refresh-keys');
    const keysListDiv = document.getElementById('keys-list');
    const noKeysMessage = document.getElementById('no-keys-message');
    const loadingKeysDiv = document.getElementById('loading-keys');
    
    let currentKey = '';
    let currentKeyType = '';
    let githubConfig = JSON.parse(localStorage.getItem('githubConfig') || 'null');
    
    if (githubConfig) {
        repoOwnerInput.value = githubConfig.owner;
        repoNameInput.value = githubConfig.repo;
        tokenInput.value = githubConfig.token;
        filePathInput.value = githubConfig.path;
        branchNameInput.value = githubConfig.branch || 'main';
        updateGithubStatus(true);
    }
    
    // Переключение вкладок
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            if (tabId === 'history' && githubConfig) {
                loadKeysFromGithub();
            }
        });
    });
    
    saveGithubSettingsBtn.addEventListener('click', () => {
        const owner = repoOwnerInput.value.trim();
        const repo = repoNameInput.value.trim();
        const token = tokenInput.value.trim();
        const path = filePathInput.value.trim() || 'keys.yml';
        const branch = branchNameInput.value.trim() || 'main';
        
        if (!owner || !repo || !token) {
            showToast('Пожалуйста, заполните все поля', '#f44336');
            return;
        }
        
        const config = { owner, repo, token, path, branch };
        localStorage.setItem('githubConfig', JSON.stringify(config));
        githubConfig = config;
        
        updateGithubStatus(true);
        showToast('Настройки GitHub сохранены', '#4CAF50');
        
        // Проверяем доступность репозитория
        testGithubConnection();
    });
    
    logoutGithubBtn.addEventListener('click', () => {
        localStorage.removeItem('githubConfig');
        githubConfig = null;
        updateGithubStatus(false);
        showToast('Отключено от GitHub', '#333');
    });
    
    refreshKeysBtn.addEventListener('click', () => {
        if (githubConfig) {
            // Проверяем и обновляем raw-файл перед загрузкой
            checkAndUpdateRawFile();
        } else {
            showToast('Сначала настройте подключение к GitHub', '#f44336');
        }
    });
    
    keyTypeSelect.addEventListener('change', () => {
        const keyType = keyTypeSelect.value;
        if (keyType === 'uuid') {
            keyLengthInput.value = 36;
            keyLengthInput.disabled = true;
        } else {
            keyLengthInput.disabled = false;
        }
    });
    
    minecraftCommandInput.addEventListener('input', () => {
        const commandDisplay = document.getElementById('command-display');
        const commandCode = document.getElementById('command-code');
        const command = minecraftCommandInput.value.trim();
        
        if (command) {
            commandCode.textContent = command;
            commandDisplay.classList.remove('hidden');
        } else {
            commandDisplay.classList.add('hidden');
        }
    });
    
    generateBtn.addEventListener('click', generateKey);
    copyBtn.addEventListener('click', copyToClipboard);
    saveBtn.addEventListener('click', saveKeyToGithub);
    
    function updateGithubStatus(isConnected) {
        if (isConnected && githubConfig) {
            githubLoginDiv.classList.add('hidden');
            githubConnectedDiv.classList.remove('hidden');
            connectedRepoSpan.textContent = `${githubConfig.owner}/${githubConfig.repo}`;
            connectedFileSpan.textContent = githubConfig.path;
            connectedBranchSpan.textContent = githubConfig.branch || 'main';
            saveBtn.disabled = false;
        } else {
            githubLoginDiv.classList.remove('hidden');
            githubConnectedDiv.classList.add('hidden');
            saveBtn.disabled = true;
        }
    }
    
    function testGithubConnection() {
        if (!githubConfig) return;
        
        const { owner, repo, token, path } = githubConfig;
        
        // Сначала проверяем существование репозитория
        fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        })
        .then(response => {
            if (response.status === 404) {
                // Репозиторий не существует
                showToast('Репозиторий не найден. Проверьте имя репозитория или создайте его.', '#ff9800');
                return Promise.reject(new Error('Репозиторий не найден'));
            }
            
            if (response.status === 401) {
                // Неверный токен
                showToast('Неверный токен доступа. Убедитесь, что у вас есть права на репозиторий.', '#f44336');
                return Promise.reject(new Error('Неверный токен доступа'));
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response.json();
        })
        .then(repoData => {
            // Проверяем, приватный ли репозиторий
            if (repoData.private) {
                showToast('Подключено к приватному репозиторию. Убедитесь, что токен имеет разрешение `repo`.', '#4CAF50');
            } else {
                showToast('Подключено к публичному репозиторию.', '#4CAF50');
            }
            
            // Теперь проверяем существование файла
            return fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
        })
        .then(response => {
            if (response.status === 404) {
                // Файл не существует, но репозиторий доступен
                showToast('Репозиторий доступен, но файл не найден. Он будет создан при сохранении ключа.', '#ff9800');
                return;
            }
            
            if (response.status === 401) {
                throw new Error('Недостаточно прав для доступа к файлу. Проверьте токен и настройки репозитория.');
            }
            
            if (response.status === 403) {
                throw new Error('Ограничение GitHub API или недостаточно прав. Проверьте токен и настройки репозитория.');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            showToast('Подключение к GitHub успешно! Файл найден.', '#4CAF50');
        })
        .catch(error => {
            console.error('Ошибка при проверке подключения к GitHub:', error);
            if (!error.message.includes('Репозиторий не найден') && 
                !error.message.includes('Неверный токен доступа')) {
                showToast('Ошибка подключения к GitHub. Проверьте настройки и токен доступа.', '#f44336');
            }
        });
    }
    
    function generateKey() {
        const keyType = keyTypeSelect.value;
        const keyLength = parseInt(keyLengthInput.value);
        
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
        
        resultDiv.textContent = key;
        currentKey = key;
        currentKeyType = keyType;
        
        // Обновляем отображение команды Minecraft
        const commandDisplay = document.getElementById('command-display');
        const commandCode = document.getElementById('command-code');
        const command = minecraftCommandInput.value.trim();
        
        if (command) {
            commandCode.textContent = command;
            commandDisplay.classList.remove('hidden');
        } else {
            commandDisplay.classList.add('hidden');
        }
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
        const text = resultDiv.textContent;
        if (!text) return;
        
        navigator.clipboard.writeText(text).then(() => {
            showToast('Скопировано в буфер обмена!');
        }).catch(err => {
            console.error('Не удалось скопировать текст: ', err);
        });
    }
    
    function saveKeyToGithub() {
        if (!githubConfig) {
            showToast('Сначала настройте подключение к GitHub', '#f44336');
            return;
        }
        
        if (!currentKey) {
            showToast('Сначала сгенерируйте ключ!', '#f44336');
            return;
        }
        
        const { owner, repo, token, path, branch = 'main' } = githubConfig;
        
        // Показываем индикатор загрузки
        const saveIcon = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid white; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></span> Сохранение...';
        saveBtn.disabled = true;
        
        // Добавляем стиль анимации, если его еще нет
        if (!document.querySelector('style#spin-animation')) {
            const style = document.createElement('style');
            style.id = 'spin-animation';
            style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
        
        // Получаем текущее содержимое файла
        fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        })
        .then(response => {
            if (response.status === 404) {
                // Файл не существует, создаем новый
                return { content: null, sha: null };
            }
            
            if (response.status === 401) {
                throw new Error('Недостаточно прав для доступа к репозиторию. Убедитесь, что токен имеет разрешение `repo`.');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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
                value: [currentKey],
                minecraft_command: minecraftCommandInput.value.trim() || null
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
                showToast('Ключ успешно сохранен в GitHub!', '#4CAF50');
                
                // Принудительно обновляем raw-файл
                forceUpdateRawFile();
            } else if (response.status === 401) {
                throw new Error('Недостаточно прав для сохранения файла. Убедитесь, что токен имеет разрешение `repo`.');
            } else if (response.status === 404) {
                throw new Error('Репозиторий или путь к файлу не найден.');
            } else if (response.status === 403) {
                throw new Error('Ограничение GitHub API или недостаточно прав. Проверьте токен и настройки репозитория.');
            } else {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
        })
        .catch(error => {
            console.error('Ошибка при сохранении ключа:', error);
            showToast(`Ошибка при сохранении ключа: ${error.message}`, '#f44336');
        })
        .finally(() => {
            // Восстанавливаем кнопку
            saveBtn.innerHTML = saveIcon || 'Сохранить в GitHub';
            saveBtn.disabled = false;
        });
    }
    
    // Функция для принудительного обновления raw-файла
    function forceUpdateRawFile() {
        if (!githubConfig) return;
        
        const { owner, repo, path, branch = 'main' } = githubConfig;
        
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
        const { owner, repo, token, branch = 'main' } = githubConfig;
        
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
        if (!githubConfig) return;
        
        const { owner, repo, token, path, branch = 'main' } = githubConfig;
        
        keysListDiv.innerHTML = '';
        noKeysMessage.style.display = 'none';
        loadingKeysDiv.classList.remove('hidden');
        
        // URL с указанием ветки
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
        
        fetch(apiUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        })
        .then(response => {
            if (response.status === 404) {
                throw new Error('Файл не найден');
            }
            
            if (response.status === 401) {
                throw new Error('Недостаточно прав для доступа к файлу. Проверьте токен доступа.');
            }
            
            if (response.status === 403) {
                throw new Error('Ограничение GitHub API или недостаточно прав. Проверьте токен и настройки репозитория.');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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
            noKeysMessage.textContent = error.message || 'Ошибка при загрузке ключей';
            noKeysMessage.style.display = 'block';
        })
        .finally(() => {
            loadingKeysDiv.classList.add('hidden');
        });
    }
    
    function renderKeysList(keysData) {
        keysListDiv.innerHTML = '';
        
        Object.entries(keysData).forEach(([keyId, keyData]) => {
            const keyItem = document.createElement('div');
            keyItem.className = 'key-item';
            
            // Заголовок с ID ключа
            const keyHeader = document.createElement('div');
            keyHeader.className = 'key-header';
            keyHeader.textContent = keyId;
            keyHeader.style.fontWeight = 'bold';
            keyHeader.style.marginBottom = '0.5rem';
            keyHeader.style.color = '#333';
            keyItem.appendChild(keyHeader);
            
            // Значение ключа
            const keyValue = document.createElement('div');
            keyValue.className = 'key-value';
            
            // Обрабатываем разные форматы ключей
            let keyValueText = '';
            if (Array.isArray(keyData.value)) {
                keyValueText = keyData.value.join(', ');
            } else {
                keyValueText = String(keyData.value || '');
            }
            
            keyValue.textContent = keyValueText;
            keyItem.appendChild(keyValue);
            
            // Добавляем команду Minecraft, если она есть
            if (keyData.minecraft_command) {
                const commandDiv = document.createElement('div');
                commandDiv.className = 'key-command';
                commandDiv.innerHTML = `<strong>Команда:</strong> <code>${keyData.minecraft_command}</code>`;
                commandDiv.style.marginTop = '0.5rem';
                commandDiv.style.fontSize = '0.9rem';
                commandDiv.style.color = '#555';
                keyItem.appendChild(commandDiv);
                
                // Кнопка для копирования команды
                const copyCommandBtn = document.createElement('button');
                copyCommandBtn.textContent = 'Копировать команду';
                copyCommandBtn.style.marginTop = '0.5rem';
                copyCommandBtn.style.backgroundColor = '#ff9800';
                copyCommandBtn.style.fontSize = '0.8rem';
                copyCommandBtn.style.padding = '5px 10px';
                
                copyCommandBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Предотвращаем срабатывание обработчика родительского элемента
                    navigator.clipboard.writeText(keyData.minecraft_command).then(() => {
                        showToast('Команда скопирована в буфер обмена!');
                    });
                });
                
                keyItem.appendChild(copyCommandBtn);
            }
            
            // Обработчик клика для копирования ключа
            keyItem.addEventListener('click', () => {
                navigator.clipboard.writeText(keyValueText).then(() => {
                    showToast('Ключ скопирован в буфер обмена!');
                });
            });
            
            keysListDiv.appendChild(keyItem);
        });
    }
    
    function formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }
    
    function showToast(message, color = '#333') {
        toast.textContent = message;
        toast.style.backgroundColor = color;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    // Функция для проверки и обновления raw-файла
    function checkAndUpdateRawFile() {
        if (!githubConfig) return;
        
        const { owner, repo, path, branch = 'main' } = githubConfig;
        
        // Проверяем raw-файл
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
        
        // Сначала проверяем файл через API
        fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else if (response.status === 404) {
                throw new Error(`Файл не найден через API GitHub`);
            } else if (response.status === 401) {
                throw new Error('Недостаточно прав для доступа к файлу. Проверьте токен доступа.');
            } else if (response.status === 403) {
                throw new Error('Ограничение GitHub API или недостаточно прав. Проверьте токен и настройки репозитория.');
            } else {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
        })
        .then(data => {
            // Теперь проверяем raw-файл
            return fetch(rawUrl, { cache: 'no-store' });
        })
        .then(response => {
            if (!response.ok) {
                // Если raw-файл недоступен, показываем предупреждение
                showToast('Raw-файл пока не доступен. Это может занять некоторое время.', '#ff9800');
            }
            // В любом случае пробуем загрузить ключи
            loadKeysFromGithub();
        })
        .catch(error => {
            console.error('Ошибка при проверке файла:', error);
            showToast('Файл не найден. Сначала сохраните ключ.', '#f44336');
        });
    }
    
    // Генерируем ключ при загрузке страницы
    generateKey();
});