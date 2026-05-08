const { createApp, ref, computed, onMounted, onUnmounted } = Vue;

createApp({
    setup() {
        const state = ref('loading');
        const deviceCode = ref('');
        const deviceName = ref('');
        const registerName = ref('');
        const registerError = ref('');
        const registering = ref(false);
        const registerSuccess = ref(false);
        const playlist = ref(null);
        const items = ref([]);
        const currentIndex = ref(0);
        const error = ref('');
        const deviceInfo = ref(null);

        const baseUrl = window.location.pathname.replace(/\/[^/]*$/, '');

        const currentItem = computed(() => {
            if (items.value.length === 0) return null;
            return items.value[currentIndex.value];
        });

        function getDeviceCode() {
            const params = new URLSearchParams(window.location.search);
            const urlCode = params.get('device');
            if (urlCode) {
                localStorage.setItem('device_code', urlCode);
                return urlCode;
            }
            return localStorage.getItem('device_code') || '';
        }

        async function doRegister() {
            const name = registerName.value.trim();
            if (!name) { registerError.value = 'Please enter a device name'; return; }
            registerError.value = '';
            registering.value = true;

            try {
                const res = await fetch(baseUrl + '/api/player/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                });
                const json = await res.json();
                if (!json.success) {
                    registerError.value = json.message || 'Registration failed';
                    registering.value = false;
                    return;
                }
                const code = json.data.code;
                localStorage.setItem('device_code', code);
                localStorage.setItem('device_name', name);
                registerSuccess.value = true;
                registerName.value = name;
                setTimeout(() => {
                    deviceCode.value = code;
                    deviceName.value = name;
                    state.value = 'loading';
                    fetchPlaylist(code);
                }, 2000);
            } catch (e) {
                registerError.value = 'Connection error: ' + e.message;
            } finally {
                registering.value = false;
            }
        }

        async function fetchPlaylist(code) {
            state.value = 'loading';
            try {
                const res = await fetch(baseUrl + '/api/player/' + encodeURIComponent(code));
                const json = await res.json();
                if (!json.success) {
                    error.value = json.message || 'Failed to load playlist';
                    state.value = 'error';
                    return;
                }
                deviceInfo.value = json.data.device;
                playlist.value = json.data.playlist;
                items.value = json.data.items || [];
                state.value = 'playing';
                scheduleNext();
            } catch (e) {
                error.value = 'Connection error: ' + e.message;
                state.value = 'error';
            }
        }

        let playbackTimer = null;
        let heartbeatTimer = null;
        let refreshTimer = null;

        function scheduleNext() {
            if (playbackTimer) clearTimeout(playbackTimer);
            if (items.value.length === 0) return;
            const delay = getDuration(currentItem.value);
            playbackTimer = setTimeout(() => { nextItem(); }, delay);
        }

        function nextItem() {
            if (items.value.length === 0) return;
            currentIndex.value = (currentIndex.value + 1) % items.value.length;
            scheduleNext();
        }

        function handleVideoEnded() { nextItem(); }
        function handleMediaError() { nextItem(); }

        function getDuration(item) {
            if (!item) return 10000;
            if (item.duration_override) return item.duration_override * 1000;
            if (playlist.value && playlist.value.default_duration) return playlist.value.default_duration * 1000;
            if (item.media_type === 'video') {
                if (item.media_duration) return item.media_duration * 1000;
                return 30000;
            }
            return 10000;
        }

        function getTransition() {
            return playlist.value && playlist.value.transition ? playlist.value.transition : 'fade';
        }

        function startHeartbeat(code) {
            heartbeatTimer = setInterval(async () => {
                try {
                    await fetch(baseUrl + '/api/player/' + encodeURIComponent(code) + '/heartbeat', { method: 'POST' });
                } catch (e) {}
            }, 30000);
        }

        async function requestFullscreen() {
            try { await document.documentElement.requestFullscreen(); } catch (e) {}
        }

        onMounted(() => {
            const code = getDeviceCode();
            const name = localStorage.getItem('device_name') || '';
            if (code) {
                deviceCode.value = code;
                deviceName.value = name;
                fetchPlaylist(code);
                startHeartbeat(code);
            } else {
                state.value = 'register';
            }
            document.addEventListener('click', requestFullscreen, { once: true });
            document.addEventListener('touchstart', requestFullscreen, { once: true });
        });

        onUnmounted(() => {
            clearInterval(heartbeatTimer);
            clearInterval(refreshTimer);
            clearTimeout(playbackTimer);
        });

        return {
            state, deviceCode, deviceName, registerName, registerError, registering, registerSuccess,
            currentItem, currentIndex, items, playlist, error, deviceInfo, getTransition,
            handleVideoEnded, handleMediaError, doRegister,
        };
    },
}).mount('#player-app');
