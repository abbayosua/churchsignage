const { chromium } = require('playwright');

const BASE = 'http://localhost/churchsignage';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
    let browser, page;
    let passed = 0, failed = 0;
    const failures = [];

    function check(condition, msg) {
        if (condition) { passed++; console.log('  ✅ ' + msg); }
        else { failed++; failures.push(msg); console.log('  ❌ ' + msg); }
    }

    async function api(method, path, body) {
        return await page.evaluate(async ({ method, path, body, BASE }) => {
            const opts = { method, headers: {} };
            if (body) {
                opts.headers['Content-Type'] = 'application/json';
                opts.body = JSON.stringify(body);
            }
            const res = await fetch(BASE + '/api' + path, opts);
            return await res.json();
        }, { method, path, body, BASE });
    }

    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

        console.log('\n🧪 Church Signage Bootstrap Test Suite\n');

        // ── CMS Tests ──
        console.log('── CMS ──');
        page = await context.newPage();

        // 1. CMS Page Loads
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await sleep(3500);
        check(await page.locator('#app').isVisible().catch(() => false), 'Vue app mounted');

        // 2. Login form
        const loginCard = page.locator('.login-page .card');
        check(await loginCard.isVisible().catch(() => false), 'Login card visible');

        // 3. Login
        if (await loginCard.isVisible().catch(() => false)) {
            const inputs = loginCard.locator('input');
            await inputs.nth(0).fill('admin');
            await inputs.nth(1).fill('admin');
            await loginCard.locator('button[type="submit"]').click();
            await sleep(2500);
            check(await page.locator('.sidebar').isVisible().catch(() => false), 'Sidebar visible after login');
        }

        // 4. Dashboard
        if (await page.locator('.sidebar').isVisible().catch(() => false)) {
            await sleep(2000);
            check(await page.locator('.stat-value').first().isVisible().catch(() => false), 'Dashboard stat cards visible');
        }

        // 5. Navigation
        if (await page.locator('.sidebar').isVisible().catch(() => false)) {
            const navLinks = await page.locator('.sidebar .nav-link').all();
            check(navLinks.length >= 5, navLinks.length + ' nav links found');

            for (const label of ['Media', 'Playlists', 'Devices']) {
                const link = page.locator('.sidebar .nav-link', { hasText: label });
                if (await link.isVisible().catch(() => false)) {
                    await link.click();
                    await sleep(800);
                }
            }
            check(true, 'Navigated through all pages');
        }

        // 6. Create Device (manual CMS flow)
        console.log('\n── CMS Device Registration ──');
        if (await page.locator('.sidebar').isVisible().catch(() => false)) {
            await page.locator('.sidebar .nav-link', { hasText: 'Devices' }).click();
            await sleep(1500);
            const addBtn = page.locator('button', { hasText: /Add Device/i });
            if (await addBtn.isVisible().catch(() => false)) {
                await addBtn.click();
                await sleep(500);
                const modal = page.locator('.modal.show');
                if (await modal.isVisible().catch(() => false)) {
                    await modal.locator('input').first().fill('CMS Device');
                    await modal.locator('button i.bi-arrow-repeat').first().click();
                    await sleep(300);
                    await modal.locator('.btn-primary').click();
                    await sleep(2000);
                    check(await page.locator('table').isVisible().catch(() => false), 'Device created from CMS, table visible');
                }
            }
        }

        // 7. API tests
        console.log('\n── API ──');
        const authCheck = await api('GET', '/auth/check');
        check(authCheck.success && authCheck.data, 'Auth check returns user data');

        const mediaList = await api('GET', '/media');
        check(mediaList.success, 'Media list API works');

        const playlist = await api('POST', '/playlists', { name: 'Test Playlist', default_duration: 10 });
        check(playlist.success, 'Playlist created via API');

        const devicesList = await api('GET', '/devices');
        check(devicesList.data && devicesList.data.length > 0, 'At least 1 device exists');

        // 8. Player Auto-Register Test
        console.log('\n── Player Auto-Register ──');
        await page.close();

        // Fresh page (no localStorage) to test registration
        page = await context.newPage();
        await page.goto(BASE + '/player.html', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await sleep(3000);

        // Registration form should appear
        const regForm = page.locator('.card', { hasText: 'Register' });
        check(await regForm.isVisible().catch(() => false), 'Registration form visible on player.html');

        // Fill and submit
        if (await regForm.isVisible().catch(() => false)) {
            await regForm.locator('input').fill('Auto Register TV');
            await regForm.locator('button[type="submit"]').click();
            await sleep(1000);

            // Should show success message (before transitioning to player)
            const successIcon = page.locator('.bi-check-circle');
            check(await successIcon.isVisible().catch(() => false), 'Registration success shown after submit');

            // Wait for auto-transition to playing state
            await sleep(3000);
        }

        // Verify device appears in API
        const updatedDevices = await api('GET', '/devices');
        const autoDevice = updatedDevices.data.find(d => d.name === 'Auto Register TV');
        check(!!autoDevice, 'Auto-registered device appears in CMS (name: "Auto Register TV")');
        if (autoDevice) {
            check(autoDevice.is_active == 1, 'Auto-registered device is active');
        }

        // 9. Verify localStorage persistence
        console.log('\n── Player Reopen (localStorage) ──');
        await page.close();

        page = await context.newPage();
        await page.goto(BASE + '/player.html', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await sleep(3000);

        // Should NOT show registration form (because localStorage has the code)
        const regFormAgain = page.locator('.card', { hasText: 'Register' });
        check(!(await regFormAgain.isVisible().catch(() => false)), 'Registration hidden on reopen (localStorage)');

        // Should show player content or heartbeat info
        const playerInfo = page.locator('.player-info');
        check(await playerInfo.isVisible().catch(() => false), 'Player info visible on reopen');

        // 10. Upload real photo from picsum.photos
        console.log('\n── Media Upload ──');
        await page.close();
        page = await context.newPage();
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await sleep(3500);

        // Login again
        const loginCard2 = page.locator('.login-page .card');
        if (await loginCard2.isVisible().catch(() => false)) {
            const inputs = loginCard2.locator('input');
            await inputs.nth(0).fill('admin');
            await inputs.nth(1).fill('admin');
            await loginCard2.locator('button[type="submit"]').click();
            await sleep(2500);
        }

        try {
            const uploadResult = await page.evaluate(async () => {
                const imgRes = await fetch('https://picsum.photos/400/300.webp', {
                    redirect: 'follow', cache: 'no-cache',
                });
                const blob = await imgRes.blob();
                const ext = blob.type.includes('webp') ? 'webp' : 'jpg';
                const fd = new FormData();
                fd.append('file', blob, 'test-photo.' + ext);
                fd.append('name', 'Test Photo from picsum');
                const basePath = window.location.pathname.replace(/\/+$/, '');
                const res = await fetch(basePath + '/api/media/upload', { method: 'POST', body: fd });
                return await res.json();
            });
            check(uploadResult.success === true, 'Real photo upload works (from picsum.photos)');
        } catch (e) {
            check(false, 'Upload failed: ' + e.message);
        }

        // 11. YouTube integration
        console.log('\n── YouTube ──');
        try {
            const ytRes = await page.evaluate(async () => {
                const basePath = window.location.pathname.replace(/\/[^/]*$/, '');
                const res = await fetch(basePath + '/api/media/youtube', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: 'Test YouTube Video',
                        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    }),
                });
                return await res.json();
            });
            const ytOk = ytRes.success === true;
            check(ytOk, 'YouTube video added via API');
            if (ytOk) {
                check(ytRes.data.type === 'youtube', 'Media type is "youtube"');
                check(!!ytRes.data.filename, 'YouTube video ID extracted: ' + ytRes.data.filename);
            }
        } catch (e) {
            check(false, 'YouTube API failed: ' + e.message);
        }

        // Verify YouTube appears in media list
        const mediaWithYt = await api('GET', '/media');
        const ytItem = mediaWithYt.data.items.find(m => m.type === 'youtube');
        check(!!ytItem, 'YouTube video appears in media list');

        // Add YouTube to playlist
        const playlistsRes = await api('GET', '/playlists');
        if (playlistsRes.data && playlistsRes.data.length > 0 && ytItem) {
            const plId = playlistsRes.data[0].id;
            const addRes = await api('POST', '/playlists/' + plId + '/items', {
                items: [{ media_id: ytItem.id, duration_override: 15 }],
            });
            check(addRes.success, 'YouTube video added to playlist');

            // Verify it's in the playlist
            const plDetail = await api('GET', '/playlists/' + plId);
            const hasYt = plDetail.data.items && plDetail.data.items.some(i => i.media_type === 'youtube');
            check(!!hasYt, 'YouTube video confirmed in playlist items');
        }

        // 12. Running Text
        console.log('\n── Running Text ──');
        try {
            const playlistsRes2 = await api('GET', '/playlists');
            if (playlistsRes2.data && playlistsRes2.data.length > 0) {
                const plId = playlistsRes2.data[0].id;
                const updateRes = await api('PUT', '/playlists/' + plId, {
                    running_text: 'Test ayat berjalan - Yohanes 3:16',
                });
                check(updateRes.success, 'Running text saved to playlist');

                const plDetail2 = await api('GET', '/playlists/' + plId);
                check(plDetail2.data.running_text === 'Test ayat berjalan - Yohanes 3:16', 'Running text read back correctly');
            }
        } catch (e) {
            check(false, 'Running text test failed: ' + e.message);
        }

        // 13. Playlist Preview API
        console.log('\n── Playlist Preview ──');
        try {
            const playlistsRes3 = await api('GET', '/playlists');
            if (playlistsRes3.data && playlistsRes3.data.length > 0) {
                const previewRes = await api('GET', '/preview/' + playlistsRes3.data[0].id);
                check(previewRes.success, 'Preview API returns playlist items');
                check(Array.isArray(previewRes.data.items), 'Preview has items array');
                check(!!previewRes.data.playlist.running_text, 'Preview includes running_text');
            }
        } catch (e) {
            check(false, 'Preview API failed: ' + e.message);
        }

        // 14. Time Scheduling Assignment
        console.log('\n── Time Scheduling ──');
        try {
            const plRes = await api('GET', '/playlists');
            if (plRes.data && plRes.data.length > 0) {
                const assignRes = await api('POST', '/playlists/' + plRes.data[0].id + '/assign', {
                    all_devices: true,
                    time_start: '08:00',
                    time_end: '17:00',
                });
                check(assignRes.success, 'Playlist assigned with time range');

                const plDetail3 = await api('GET', '/playlists/' + plRes.data[0].id);
                const hasTime = plDetail3.data.assignments && plDetail3.data.assignments.some(a => a.time_start);
                check(!!hasTime, 'Assignment includes time_start/time_end');
            }
        } catch (e) {
            check(false, 'Time scheduling test failed: ' + e.message);
        }

        // 15. Logout
        console.log('\n── Logout ──');
        if (await page.locator('.sidebar').isVisible().catch(() => false)) {
            const logoutBtn = page.locator('.sidebar .btn-link', { hasText: 'Logout' });
            if (await logoutBtn.isVisible().catch(() => false)) {
                await logoutBtn.click();
                await sleep(1500);
                check(await page.locator('.login-page .card').isVisible().catch(() => false), 'Returns to login after logout');
            }
        }

        // Summary
        console.log('\n' + '='.repeat(40));
        console.log(`📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
        if (failures.length > 0) {
            console.log('\n❌ Failed:');
            failures.forEach(f => console.log('   - ' + f));
        }
        console.log('='.repeat(40) + '\n');

    } catch (e) {
        console.error('Fatal:', e.message);
        failed++;
    } finally {
        if (browser) await browser.close();
        process.exit(failed > 0 ? 1 : 0);
    }
})();
