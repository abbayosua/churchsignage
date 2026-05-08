const { createApp, ref, computed, watch, nextTick, onMounted, onUnmounted } = Vue;

let ytApiLoaded = false;
let ytPlayer = null;

function loadYtApi() {
    if (ytApiLoaded) return;
    ytApiLoaded = true;
    window.onYouTubeIframeAPIReady = () => {};
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
}

function destroyYtPlayer() {
    if (ytPlayer) {
        try { ytPlayer.destroy(); } catch (e) {}
        ytPlayer = null;
    }
    const el = document.getElementById('youtube-player');
    if (el) el.innerHTML = '';
}

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
        const isYtPlaying = ref(false);

        const baseUrl = window.location.pathname.replace(/\/[^/]*$/, '');

        const currentItem = computed(() => {
            if (items.value.length === 0) return null;
            return items.value[currentIndex.value];
        });

        function getDeviceCode() {
            const params = new URLSearchParams(window.location.search);
            const urlCode = params.get('device');
            if (urlCode) { localStorage.setItem('device_code', urlCode); return urlCode; }
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
            const item = currentItem.value;
            if (item && item.media_type === 'youtube') return;
            const delay = getDuration(item);
            playbackTimer = setTimeout(() => { nextItem(); }, delay);
        }

        function nextItem() {
            destroyYtPlayer();
            isYtPlaying.value = false;
            if (items.value.length === 0) return;
            currentIndex.value = (currentIndex.value + 1) % items.value.length;
            scheduleNext();
        }

        function handleVideoEnded() { nextItem(); }
        function handleMediaError() { nextItem(); }
        function handleYtEnded() { nextItem(); }

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
                try { await fetch(baseUrl + '/api/player/' + encodeURIComponent(code) + '/heartbeat', { method: 'POST' }); } catch (e) {}
            }, 30000);
        }

        async function requestFullscreen() {
            try { await document.documentElement.requestFullscreen(); } catch (e) {}
        }

        watch(currentIndex, () => {
            const item = currentItem.value;
            if (item && item.media_type === 'youtube') {
                isYtPlaying.value = true;
                nextTick(() => {
                    const videoId = item.filename;
                    const container = document.getElementById('youtube-player');
                    if (!container) return;
                    container.innerHTML = '<div id="yt-embed"></div>';
                    if (window.YT && window.YT.Player) {
                        ytPlayer = new window.YT.Player('yt-embed', {
                            videoId,
                            width: '100%', height: '100%',
                            playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0 },
                            events: { onStateChange: (e) => { if (e.data === window.YT.PlayerState.ENDED) handleYtEnded(); } },
                        });
                    } else {
                        container.innerHTML = '<iframe src="https://www.youtube.com/embed/' + videoId + '?autoplay=1&controls=0&modestbranding=1&rel=0&enablejsapi=1" class="w-100 h-100" allow="autoplay; encrypted-media" allowfullscreen style="border:0"></iframe>';
                        const iframe = container.querySelector('iframe');
                        if (iframe) {
                            iframe.onload = () => {
                                setTimeout(() => { handleYtEnded(); }, getDuration(item));
                            };
                        }
                    }
                });
            } else {
                isYtPlaying.value = false;
            }
        });

        onMounted(() => {
            loadYtApi();
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
            destroyYtPlayer();
            clearInterval(heartbeatTimer);
            clearInterval(refreshTimer);
            clearTimeout(playbackTimer);
        });

        return {
            state, deviceCode, deviceName, registerName, registerError, registering, registerSuccess,
            currentItem, currentIndex, items, playlist, error, deviceInfo, getTransition, isYtPlaying,
            handleVideoEnded, handleMediaError, doRegister,
        };
    },
}).mount('#player-app');
