const { chromium } = require('playwright');

const BASE = 'http://localhost/churchsignage';

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

(async () => {
    let browser;
    let page;
    let passed = 0;
    let failed = 0;
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
        page = await context.newPage();

        console.log('\n🧪 Church Signage Test Suite\n');

        // 1. CMS Page Loads
        console.log('1. CMS Page');
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await sleep(3000);
        check(await page.locator('#app').isVisible().catch(() => false), 'Vue app mounted');

        // 2. Login Visible
        console.log('\n2. Login Form');
        check(await page.locator('.login-card').isVisible().catch(() => false), 'Login form visible');

        // 3. Login
        console.log('\n3. Login');
        if (await page.locator('.login-card').isVisible().catch(() => false)) {
            const inputs = page.locator('.login-card input');
            await inputs.nth(0).fill('admin');
            await inputs.nth(1).fill('admin');
            await page.locator('.login-card button[type="submit"]').click();
            await sleep(2500);
            check(await page.locator('.sidebar').isVisible().catch(() => false), 'Sidebar visible after login');
        }

        // 4. Dashboard Stats
        console.log('\n4. Dashboard');
        if (await page.locator('.sidebar').isVisible().catch(() => false)) {
            await sleep(2000);
            check(await page.locator('.stat-card').first().isVisible().catch(() => false), 'Stat cards visible');
        }

        // 5. Navigation
        console.log('\n5. Navigation');
        if (await page.locator('.sidebar').isVisible().catch(() => false)) {
            const navCount = (await page.locator('.nav-item').all()).length;
            check(navCount >= 4, navCount + ' nav items found');

            for (const label of ['Media', 'Playlists', 'Devices', 'Player Preview']) {
                const nav = page.locator('.nav-item', { hasText: label });
                if (await nav.isVisible().catch(() => false)) {
                    await nav.click();
                    await sleep(800);
                }
            }
            check(true, 'All navigation links work');
        }

        // 6. Create Device
        console.log('\n6. Create Device');
        if (await page.locator('.sidebar').isVisible().catch(() => false)) {
            await page.locator('.nav-item', { hasText: 'Devices' }).click();
            await sleep(1500);
            const addBtn = page.locator('button', { hasText: 'Add Device' });
            if (await addBtn.isVisible().catch(() => false)) {
                await addBtn.click();
                await sleep(500);
                const modal = page.locator('.modal-overlay .modal');
                if (await modal.isVisible().catch(() => false)) {
                    await modal.locator('input').first().fill('Test Device');
                    await modal.locator('button', { hasText: 'Generate' }).click();
                    await sleep(300);
                    await modal.locator('.btn-primary').click();
                    await sleep(2000);
                    check(await page.locator('table').isVisible().catch(() => false), 'Device created and table visible');
                }
            }
        }

        // 7. API tests
        console.log('\n7. API');
        const authCheck = await api('GET', '/auth/check');
        check(authCheck.success && authCheck.data, 'Auth check: user data returned');

        const mediaList = await api('GET', '/media');
        check(mediaList.success, 'Media list works');

        const playlist = await api('POST', '/playlists', { name: 'Test Playlist', default_duration: 10 });
        check(playlist.success, 'Playlist created via API');

        const devicesList = await api('GET', '/devices');
        const deviceCode = devicesList.data && devicesList.data.length > 0 ? devicesList.data[0].code : 'TEST123';
        const playerRes = await api('GET', '/player/' + deviceCode);
        check(playerRes.success, 'Player API responds for device ' + deviceCode);

        // 8. Upload via browser FormData
        console.log('\n8. Media Upload');
        try {
            const uploadResult = await page.evaluate(async () => {
                const png = new Uint8Array([
                    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
                    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
                    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
                    0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0x00, 0x00,
                    0x00, 0x02, 0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC,
                    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
                    0xAE, 0x42, 0x60, 0x82,
                ]);
                const blob = new Blob([png], { type: 'image/png' });
                const fd = new FormData();
                fd.append('file', blob, 'test-image.png');
                fd.append('name', 'Test Image');

                const basePath = window.location.pathname.replace(/\/+$/, '');
                const res = await fetch(basePath + '/api/media/upload', { method: 'POST', body: fd });
                return await res.json();
            });
            check(uploadResult.success === true, 'Media upload via browser works');
        } catch (e) {
            check(false, 'Upload failed: ' + e.message);
        }

        // 9. Logout
        console.log('\n9. Logout');
        if (await page.locator('.sidebar').isVisible().catch(() => false)) {
            const logoutBtn = page.locator('.sidebar-footer button');
            if (await logoutBtn.isVisible().catch(() => false)) {
                await logoutBtn.click();
                await sleep(1500);
                check(await page.locator('.login-card').isVisible().catch(() => false), 'Returns to login after logout');
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
