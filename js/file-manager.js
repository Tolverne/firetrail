// File Manager for GitHub repository integration
class FileManager {
    constructor() {
        this.fileTree = [];
        this.currentFile = null;
        this.baseRepoPath = 'latex-files';
        this.apiBase = 'https://api.github.com/repos/tolverne/papertrail2/contents';
    }

    async getFileTreeFromRepo(path = this.baseRepoPath) {
        const apiUrl = `${this.apiBase}/${path}`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                console.error('Failed to fetch files:', response.status);
                return [];
            }
            const items = await response.json();
            
            const processedItems = await Promise.all(
                items.map(async (item) => {
                    const processedItem = {
                        name: item.name,
                        path: item.path,
                        type: item.type,
                        download_url: item.download_url,
                        isExpanded: false
                    };
                    
                    if (item.type === 'dir') {
                        processedItem.children = await this.getFileTreeFromRepo(item.path);
                    }
                    
                    return processedItem;
                })
            );
            
            return processedItems;
        } catch (error) {
            console.error('Error fetching file tree:', error);
            return [];
        }
    }

    async initializeFileTree() {
        try {
            const fileTree = await this.getFileTreeFromRepo();
            this.fileTree = fileTree;
            this.renderFileTree();
            return true;
        } catch (error) {
            console.error('Failed to initialize file tree:', error);
            return false;
        }
    }

    renderFileTree() {
        const treeContainer = document.querySelector('.file-tree-container');
        if (!treeContainer) {
            console.error('File tree container not found');
            return;
        }
        
        treeContainer.innerHTML = this.renderTreeNode(this.fileTree, 0);
        this.attachFileTreeEventListeners();
    }

    renderTreeNode(items, level = 0) {
        if (!items || items.length === 0) return '';
        
        return items.map(item => {
            const indent = level * 20;
            const hasChildren = item.type === 'dir' && item.children && item.children.length > 0;
            const isTexFile = item.name.endsWith('.tex');
            
            let html = `
                <div class="tree-item" data-path="${item.path}" data-type="${item.type}" style="padding-left: ${indent}px;">
                    <div class="tree-item-content">
            `;
            
            if (hasChildren) {
                html += `
                    <span class="tree-toggle ${item.isExpanded ? 'expanded' : 'collapsed'}" data-path="${item.path}">
                        ${item.isExpanded ? '▼' : '▶'}
                    </span>
                `;
            } else {
                html += `<span class="tree-indent"></span>`;
            }
            
            const icon = this.getFileIcon(item);
            const clickable = isTexFile ? 'clickable-file' : '';
            
            html += `
                        <span class="tree-icon">${icon}</span>
                        <span class="tree-label ${clickable}" data-path="${item.path}" data-download-url="${item.download_url || ''}">
                            ${item.name}
                        </span>
                    </div>
                </div>
            `;
            
            if (hasChildren && item.isExpanded) {
                html += `<div class="tree-children">${this.renderTreeNode(item.children, level + 1)}</div>`;
            }
            
            return html;
        }).join('');
    }

    getFileIcon(item) {
        if (item.type === 'dir') {
            return item.isExpanded ? '📂' : '📁';
        } else if (item.name.endsWith('.tex')) {
            return '📄';
        } else {
            return '📋';
        }
    }

    attachFileTreeEventListeners() {
        const treeContainer = document.querySelector('.file-tree-container');
        if (!treeContainer) return;
        
        treeContainer.addEventListener('click', (e) => {
            const toggle = e.target.closest('.tree-toggle');
            if (toggle) {
                const path = toggle.dataset.path;
                this.toggleFolder(path);
                return;
            }
            
            const fileLabel = e.target.closest('.clickable-file');
            if (fileLabel) {
                const path = fileLabel.dataset.path;
                const downloadUrl = fileLabel.dataset.downloadUrl;
                this.loadLatexFile(path, downloadUrl);
                return;
            }
        });
    }

    toggleFolder(path) {
        const item = this.findItemByPath(this.fileTree, path);
        if (item) {
            item.isExpanded = !item.isExpanded;
            this.renderFileTree();
        }
    }

    findItemByPath(items, targetPath) {
        for (const item of items) {
            if (item.path === targetPath) {
                return item;
            }
            if (item.children) {
                const found = this.findItemByPath(item.children, targetPath);
                if (found) return found;
            }
        }
        return null;
    }

    async loadLatexFile(path, downloadUrl) {
        if (!downloadUrl) {
            console.error('No download URL available for file:', path);
            return null;
        }
        
        // Show loading state
        this.showLoading(true);
        
        // Highlight selected file
        this.highlightSelectedFile(path);
        
        try {
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status}`);
            }
            
            const content = await response.text();
            const fileName = path.split('/').pop();
            
            this.currentFile = {
                name: fileName,
                path: path,
                content: content
            };
            
            this.updateFileInfo();
            
            // Dispatch custom event for app to handle
            window.dispatchEvent(new CustomEvent('fileLoaded', {
                detail: {
                    fileName: fileName,
                    content: content,
                    path: path
                }
            }));
            
            return this.currentFile;
            
        } catch (error) {
            console.error('Error loading LaTeX file:', error);
            this.showError('Failed to load the selected file. Please try again.');
            return null;
        } finally {
            this.showLoading(false);
        }
    }

    highlightSelectedFile(path) {
        document.querySelectorAll('.tree-label').forEach(label => {
            label.classList.remove('selected');
        });
        const selectedLabel = document.querySelector(`[data-path="${path}"]`);
        if (selectedLabel) {
            selectedLabel.classList.add('selected');
        }
    }

    updateFileInfo() {
        const fileInfo = document.getElementById('currentFileInfo');
        if (fileInfo && this.currentFile) {
            fileInfo.textContent = `Current file: ${this.currentFile.name}`;
            fileInfo.style.display = 'block';
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'block' : 'none';
        }
    }

    showError(message) {
        // You can implement a more sophisticated error display here
        alert(message);
    }

    getCurrentFile() {
        return this.currentFile;
    }

    getFileTree() {
        return this.fileTree;
    }
}