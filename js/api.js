const BASE_URL = (() => {
    const path = window.location.pathname.replace(/\/+$/, '');
    return path + '/api';
})();

const api = {
    async request(method, endpoint, data = null, isUpload = false) {
        const url = BASE_URL + endpoint;
        const options = {
            method,
            headers: {},
        };

        if (isUpload) {
            options.body = data;
        } else if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }

        try {
            const res = await fetch(url, options);
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.message || 'Request failed');
            }

            return json;
        } catch (err) {
            if (err.message === 'Failed to fetch') {
                throw new Error('Network error - is the server running?');
            }
            throw err;
        }
    },

    get(endpoint) { return this.request('GET', endpoint); },
    post(endpoint, data) { return this.request('POST', endpoint, data); },
    put(endpoint, data) { return this.request('PUT', endpoint, data); },
    delete(endpoint) { return this.request('DELETE', endpoint); },
    upload(endpoint, formData) { return this.request('POST', endpoint, formData, true); },
};

window.api = api;
