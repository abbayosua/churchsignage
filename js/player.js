const { createApp, ref, computed, onMounted, onUnmounted, nextTick } = Vue;

createApp({
    setup() {
        const deviceCode = ref('');
        const playlist = ref(null);
        const items = ref([]);
        const currentIndex = ref(0);
        const loading = ref(true);
        const error = ref('');
        const deviceInfo = ref(null);
        const isPlaying = ref(false);

        function getDeviceCode() {
            const params = new URLSearchParams(window.location.search);
            return params.get('device') || '';
        }

        const currentItem = computed(() => {
            if (items.value.length === 0) return null;
            return items.value[currentIndex.value];
        });

        const baseUrl = (() => {
            const path = window.location.pathname.replace(/\/+$/, '');
            return path;
        })();

        async function fetchPlaylist() {
            const code = getDeviceCode();
            if (!code) {
                error.value = 'No device code specified. Use ?device=CODE';
                loading.value = false;
                return;
            }
            deviceCode.value = code;

            try {
                const res = await fetch(baseUrl + '/api/player/' + encodeURIComponent(code));
                const json = await res.json();

                if (!json.success) {
                    error.value = json.message || 'Failed to load playlist';
                    loading.value = false;
                    return;
                }

                deviceInfo.value = json.data.device;
                playlist.value = json.data.playlist;
                items.value = json.data.items || [];
                loading.value = false;
                startPlayback();
            } catch (e) {
                error.value = 'Connection error: ' + e.message;
                loading.value = false;
            }
        }

        let heartbeatTimer = null;

        function startHeartbeat() {
            const code = getDeviceCode();
            if (!code) return;
            heartbeatTimer = setInterval(async () => {
                try {
                    const res = await fetch(baseUrl + '/api/player/' + encodeURIComponent(code) + '/heartbeat', { method: 'POST' });
                    const json = await res.json();
                    if (json.success && json.data.heartbeat_interval) {
                        clearInterval(heartbeatTimer);
                        startHeartbeatWithInterval(json.data.heartbeat_interval * 1000);
                    }
                } catch (e) {
                    // Silent fail
                }
            }, 30000);
        }

        function startHeartbeatWithInterval(interval) {
            heartbeatTimer = setInterval(async () => {
                try {
                    await fetch(baseUrl + '/api/player/' + encodeURIComponent(getDeviceCode()) + '/heartbeat', { method: 'POST' });
                } catch (e) {}
            }, interval);
        }

        let playbackTimer = null;
        let playlistRefreshTimer = null;

        function scheduleNext() {
            if (playbackTimer) clearTimeout(playbackTimer);
            const delay = getDuration(currentItem.value);
            playbackTimer = setTimeout(() => { nextItem(); }, delay);
        }

        function startPlayback() {
            if (items.value.length === 0) return;
            isPlaying.value = true;
            scheduleNext();

            playlistRefreshTimer = setInterval(() => {
                fetchPlaylist();
            }, 60000);
        }

        function nextItem() {
            if (items.value.length === 0) return;
            currentIndex.value = (currentIndex.value + 1) % items.value.length;
            scheduleNext();
        }

        function handleVideoEnded() {
            nextItem();
        }

        function handleMediaError() {
            nextItem();
        }

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
            return 10000;
        }

        async function requestFullscreen() {
            try {
                await document.documentElement.requestFullscreen();
            } catch (e) {
                // Not allowed without user gesture
            }
        }

        function getTransition() {
            if (playlist.value && playlist.value.transition) {
                return playlist.value.transition;
            }
            return 'fade';
        }

        onMounted(() => {
            fetchPlaylist();
            startHeartbeat();
            document.addEventListener('click', requestFullscreen, { once: true });
            document.addEventListener('touchstart', requestFullscreen, { once: true });
        });

        onUnmounted(() => {
            clearInterval(heartbeatTimer);
            clearInterval(playlistRefreshTimer);
            clearTimeout(playbackTimer);
        });

        return {
            loading, error, currentItem, currentIndex, items, playlist,
            deviceInfo, deviceCode, isPlaying, getTransition,
            nextItem, handleVideoEnded, handleMediaError, getDuration,
            baseUrl, fetchPlaylist,
        };
    },
}).mount('#player-app');
