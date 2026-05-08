const MediaManager = {
    name: 'MediaManager',
    template: `
        <div>
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="fw-bold mb-0">Media Library</h4>
                <div class="d-flex gap-2 align-items-center">
                    <select class="form-select form-select-sm" v-model="filterType" @change="loadMedia" style="width:auto">
                        <option value="">All Types</option>
                        <option value="image">Images</option>
                        <option value="video">Videos</option>
                        <option value="gif">GIFs</option>
                        <option value="youtube">YouTube</option>
                    </select>
                    <input class="form-control form-control-sm" v-model="searchQuery" @input="debounceSearch" placeholder="Search..." style="width:180px">
                    <button class="btn btn-outline-danger btn-sm" @click="showYoutube = true"><i class="bi bi-youtube me-1"></i>YouTube</button>
                    <button class="btn btn-primary btn-sm" @click="showUpload = true"><i class="bi bi-upload me-1"></i>Upload</button>
                </div>
            </div>

            <div v-if="loading" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
            </div>
            <div v-else-if="media.length === 0" class="text-center py-5 text-muted">
                <i class="bi bi-images display-1 d-block mb-3" style="opacity:0.3"></i>
                <p>No media files yet</p>
                <button class="btn btn-primary" @click="showUpload = true">Upload your first file</button>
            </div>
            <div v-else class="row g-3">
                <div v-for="m in media" :key="m.id" class="col-6 col-md-4 col-lg-3 col-xl-2">
                    <div class="card border-0 shadow-sm media-item" @click="preview(m)">
                        <div class="position-relative">
                            <img class="media-thumb rounded-top" :src="m.thumbnail_url || m.url" :alt="m.name" @error="handleImgErr">
                            <span class="position-absolute top-0 start-0 badge bg-dark bg-opacity-75 m-1 text-uppercase" style="font-size:10px">{{ m.type }}</span>
                            <div class="position-absolute top-0 end-0 m-1 d-flex gap-1" style="display:none">
                                <button class="btn btn-sm btn-dark p-1 lh-1" @click.stop="preview(m)" title="Preview"><i class="bi bi-eye"></i></button>
                                <button class="btn btn-sm btn-danger p-1 lh-1" @click.stop="deleteMedia(m)" title="Delete"><i class="bi bi-trash"></i></button>
                            </div>
                        </div>
                        <div class="p-2">
                            <small class="d-block text-truncate fw-semibold">{{ m.name }}</small>
                            <small class="text-muted">{{ (m.size / 1024).toFixed(0) }} KB &middot; {{ m.width }}x{{ m.height }}</small>
                        </div>
                    </div>
                </div>
            </div>

            <nav v-if="totalPages > 1" class="mt-4 d-flex justify-content-center">
                <ul class="pagination pagination-sm">
                    <li class="page-item" :class="{ disabled: page <= 1 }">
                        <button class="page-link" @click="goPage(page - 1)">Previous</button>
                    </li>
                    <li class="page-item disabled"><span class="page-link">Page {{ page }} of {{ totalPages }}</span></li>
                    <li class="page-item" :class="{ disabled: page >= totalPages }">
                        <button class="page-link" @click="goPage(page + 1)">Next</button>
                    </li>
                </ul>
            </nav>

            <div v-if="showUpload" class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5)">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-upload me-1"></i>Upload Media</h5>
                            <button class="btn-close" @click="closeUpload"></button>
                        </div>
                        <div class="modal-body">
                            <div class="upload-zone" @click="$refs.fileInput.click()"
                                 @dragover.prevent="$event.target.classList.add('border-primary')"
                                 @dragleave.prevent="$event.target.classList.remove('border-primary')"
                                 @drop.prevent="handleDrop">
                                <i class="bi bi-cloud-arrow-up display-5 d-block mb-2" style="opacity:0.4"></i>
                                <p class="mb-0" v-if="!uploadFile">Click or drag & drop files here</p>
                                <p class="mb-0 fw-semibold" v-else>{{ uploadFile.name }} <small class="text-muted">({{ (uploadFile.size / 1024).toFixed(0) }} KB)</small></p>
                                <input type="file" ref="fileInput" @change="handleFile" accept="image/*,video/*" class="d-none">
                            </div>
                            <div class="mt-3">
                                <label class="form-label small fw-semibold text-muted">Name (optional)</label>
                                <input class="form-control" v-model="uploadName" placeholder="Auto from filename">
                            </div>
                            <div class="mt-2">
                                <label class="form-label small fw-semibold text-muted">Category</label>
                                <select class="form-select" v-model="uploadCategory">
                                    <option value="">None</option>
                                    <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                                </select>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline-secondary" @click="closeUpload">Cancel</button>
                            <button class="btn btn-primary" @click="doUpload" :disabled="!uploadFile || uploading">
                                <span v-if="uploading" class="spinner-border spinner-border-sm me-1"></span>
                                {{ uploading ? 'Uploading...' : 'Upload' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="showYoutube" class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5)">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-youtube text-danger me-1"></i>Add YouTube Video</h5>
                            <button class="btn-close" @click="closeYoutube"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-muted">Name</label>
                                <input class="form-control" v-model="ytName" placeholder="Video title">
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-muted">YouTube URL</label>
                                <input class="form-control" v-model="ytUrl" placeholder="https://youtube.com/watch?v=...">
                            </div>
                            <div v-if="ytThumb" class="text-center">
                                <img :src="ytThumb" class="img-fluid rounded" style="max-height:200px">
                            </div>
                            <div v-if="ytError" class="alert alert-danger py-2 small mt-2">{{ ytError }}</div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline-secondary" @click="closeYoutube">Cancel</button>
                            <button class="btn btn-danger" @click="addYoutube" :disabled="ytAdding || !ytName.trim() || !ytUrl.trim()">
                                <span v-if="ytAdding" class="spinner-border spinner-border-sm me-1"></span>
                                {{ ytAdding ? 'Adding...' : 'Add Video' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="previewItem" class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5)">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">{{ previewItem.name }}</h5>
                            <button class="btn-close" @click="closePreview"></button>
                        </div>
                        <div class="modal-body p-0">
                            <div class="preview-box rounded-0" style="aspect-ratio:16/9">
                                <img v-if="previewItem.type === 'image' || previewItem.type === 'gif'" :src="previewItem.url" class="mw-100 mh-100">
                                <video v-else-if="previewItem.type === 'video'" :src="previewItem.url" controls class="mw-100 mh-100"></video>
                                <iframe v-else-if="previewItem.type === 'youtube'" :src="previewItem.url" class="w-100 h-100" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                            </div>
                        </div>
                        <div class="modal-footer small text-muted d-block">
                            <template v-if="previewItem.type === 'youtube'">
                                YouTube Video &middot; ID: {{ previewItem.filename }}
                            </template>
                            <template v-else>
                                {{ previewItem.width }}x{{ previewItem.height }} &middot;
                                {{ (previewItem.size / 1024 / 1024).toFixed(2) }} MB &middot;
                                {{ previewItem.mime }}
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            media: [], categories: [], loading: true,
            page: 1, totalPages: 1,
            filterType: '', searchQuery: '',
            showUpload: false, uploadFile: null, uploadName: '', uploadCategory: '',
            uploading: false, previewItem: null, searchTimer: null,
            showYoutube: false, ytName: '', ytUrl: '', ytError: '', ytAdding: false, ytThumb: '',
        };
    },
    async created() {
        await Promise.all([this.loadMedia(), this.loadCategories()]);
    },
    methods: {
        handleImgErr(e) {
            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect fill="%23eee" width="200" height="150"/></svg>';
        },
        async loadMedia() {
            this.loading = true;
            try {
                let endpoint = '/media?page=' + this.page + '&per_page=20';
                if (this.filterType) endpoint += '&type=' + this.filterType;
                if (this.searchQuery) endpoint += '&search=' + encodeURIComponent(this.searchQuery);
                const res = await api.get(endpoint);
                this.media = res.data.items;
                this.totalPages = res.data.total_pages;
            } catch (e) {
                alert('Error: ' + e.message);
            } finally {
                this.loading = false;
            }
        },
        async loadCategories() {
            try { const res = await api.get('/media-categories'); this.categories = res.data; } catch (e) {}
        },
        debounceSearch() {
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(() => { this.page = 1; this.loadMedia(); }, 300);
        },
        goPage(p) { this.page = p; this.loadMedia(); },
        handleFile(e) {
            const file = e.target.files[0];
            if (file) { this.uploadFile = file; if (!this.uploadName) this.uploadName = file.name.replace(/\.[^.]+$/, ''); }
        },
        handleDrop(e) {
            e.target.classList.remove('border-primary');
            const file = e.dataTransfer.files[0];
            if (file) { this.uploadFile = file; if (!this.uploadName) this.uploadName = file.name.replace(/\.[^.]+$/, ''); }
        },
        closeUpload() {
            this.showUpload = false; this.uploadFile = null; this.uploadName = ''; this.uploadCategory = '';
        },
        async doUpload() {
            if (!this.uploadFile) return;
            this.uploading = true;
            try {
                const fd = new FormData();
                fd.append('file', this.uploadFile);
                fd.append('name', this.uploadName || '');
                if (this.uploadCategory) fd.append('category_id', this.uploadCategory);
                await api.upload('/media/upload', fd);
                this.closeUpload();
                this.page = 1;
                await this.loadMedia();
            } catch (e) {
                alert('Upload failed: ' + e.message);
            } finally {
                this.uploading = false;
            }
        },
        closeYoutube() {
            this.showYoutube = false; this.ytName = ''; this.ytUrl = ''; this.ytError = ''; this.ytThumb = '';
        },
        async addYoutube() {
            this.ytError = '';
            this.ytAdding = true;
            try {
                const res = await api.post('/media/youtube', { name: this.ytName.trim(), url: this.ytUrl.trim() });
                if (res.success) {
                    this.ytThumb = res.data.thumbnail_url || '';
                    this.closeYoutube();
                    this.page = 1;
                    await this.loadMedia();
                }
            } catch (e) {
                this.ytError = e.message;
            } finally {
                this.ytAdding = false;
            }
        },
        preview(m) { this.previewItem = m; },
        closePreview() { this.previewItem = null; },
        async deleteMedia(m) {
            if (!confirm('Delete "' + m.name + '"?')) return;
            try { await api.delete('/media/' + m.id); await this.loadMedia(); }
            catch (e) { alert('Error: ' + e.message); }
        }
    }
};
