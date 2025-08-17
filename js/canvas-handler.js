// Canvas Handler for drawing functionality with Firebase integration
class CanvasHandler {
    constructor(storage) {
        this.storage = storage;
        this.canvases = [];
        this.currentColor = '#000000';
        this.isErasing = false;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.autoSaveTimeout = null;
    }

    initializeSidebarTools() {
        this.currentColor = '#000000';
        this.isErasing = false;
        
        // Color picker event listeners
        document.querySelectorAll('.sidebar-tools .color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.sidebar-tools .color-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                this.currentColor = e.target.dataset.color;
                this.isErasing = false;
                
                const eraserBtn = document.querySelector('.sidebar-tools .eraser-btn');
                if (eraserBtn) {
                    eraserBtn.classList.remove('active');
                }
                
                this.updateToolStatus();
                this.updateCanvasCursors();
            });
        });
        
        // Eraser event listener
        const eraserBtn = document.querySelector('.sidebar-tools .eraser-btn');
        if (eraserBtn) {
            eraserBtn.addEventListener('click', (e) => {
                this.isErasing = !this.isErasing;
                e.target.classList.toggle('active');
                
                if (this.isErasing) {
                    document.querySelectorAll('.sidebar-tools .color-btn').forEach(b => b.classList.remove('active'));
                } else {
                    const blackBtn = document.querySelector('.sidebar-tools .color-btn[data-color="#000000"]');
                    if (blackBtn) {
                        blackBtn.classList.add('active');
                    }
                }
                
                this.updateToolStatus();
                this.updateCanvasCursors();
            });
        }
        
        this.updateToolStatus();
    }

    updateToolStatus() {
        const toolInfo = document.querySelector('.tool-info small');
        if (!toolInfo) return;
        
        if (this.isErasing) {
            toolInfo.textContent = 'Eraser mode active - Click canvas to erase';
            toolInfo.style.color = '#ee5a24';
        } else {
            toolInfo.textContent = 'Drawing mode active - Click canvas to draw';
            toolInfo.style.color = this.currentColor || '#000000';
        }
    }

    updateCanvasCursors() {
        const canvases = document.querySelectorAll('.drawing-canvas');
        canvases.forEach(canvas => {
            if (this.isErasing) {
                canvas.classList.add('eraser-mode');
            } else {
                canvas.classList.remove('eraser-mode');
            }
        });
    }

    initializeCanvases() {
        const canvases = document.querySelectorAll('.drawing-canvas');
        
        canvases.forEach((canvas) => {
            if (canvas.dataset.initialized) return;
            
            this.setupCanvas(canvas);
            canvas.dataset.initialized = 'true';
            
            // Load existing canvas data if available
            this.loadCanvasData(canvas);
        });
    }

    initializeCanvasesForSection(sectionIndex) {
        const sectionCanvases = document.querySelectorAll(`[data-section="${sectionIndex}"] .drawing-canvas`);
        
        sectionCanvases.forEach((canvas) => {
            if (canvas.dataset.initialized) return;
            
            this.setupCanvas(canvas);
            canvas.dataset.initialized = 'true';
            
            // Load existing canvas data if available
            this.loadCanvasData(canvas);
        });
    }

    setupCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2;
        
        this.canvases.push({ canvas, ctx });
        
        // Visual feedback when canvas is active
        canvas.addEventListener('mouseenter', () => {
            canvas.parentElement.classList.add('active');
        });
        
        canvas.addEventListener('mouseleave', () => {
            if (!this.isDrawing) {
                canvas.parentElement.classList.remove('active');
            }
        });
        
        // Drawing event listeners
        canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        canvas.addEventListener('mousemove', this.draw.bind(this));
        canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        canvas.addEventListener('mouseout', this.stopDrawing.bind(this));
        
        // Touch events for stylus/finger
        canvas.addEventListener('touchstart', this.handleTouch.bind(this));
        canvas.addEventListener('touchmove', this.handleTouch.bind(this));
        canvas.addEventListener('touchend', this.stopDrawing.bind(this));
        
        // Resize handle
        const resizeHandle = canvas.parentElement.querySelector('.resize-handle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => this.startResize(e, canvas));
        }
    }

    async loadCanvasData(canvas) {
        const questionId = canvas.dataset.question;
        const partId = canvas.dataset.part;
        const sectionId = canvas.dataset.section;
        const filePath = canvas.dataset.filePath || window.quizApp?.getCurrentFilePath();
        
        if (this.storage && questionId && partId) {
            try {
                await this.storage.loadCanvasFromSVG(canvas, questionId, partId, sectionId, filePath);
            } catch (error) {
                console.warn('Failed to load canvas data:', error);
            }
        }
    }

    startDrawing(e) {
        this.isDrawing = true;
        const rect = e.target.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const canvas = e.target;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(this.lastX, this.lastY);
        ctx.lineTo(currentX, currentY);
        
        if (this.isErasing) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 20;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = this.currentColor;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
        
        ctx.stroke();
        
        this.lastX = currentX;
        this.lastY = currentY;
        
        // Auto-save with debouncing
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.autoSaveCanvas(canvas);
        }, 1000);
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            document.querySelectorAll('.canvas-container').forEach(container => {
                container.classList.remove('active');
            });
        }
    }

    handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                         e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        e.target.dispatchEvent(mouseEvent);
    }

    startResize(e, canvas) {
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = canvas.width;
        const startHeight = canvas.height;
        
        // Save current canvas content
        const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        
        const doDrag = (e) => {
            const newWidth = Math.min(800, Math.max(200, startWidth + (e.clientX - startX)));
            const newHeight = Math.min(800, Math.max(150, startHeight + (e.clientY - startY)));
            
            canvas.width = newWidth;
            canvas.height = newHeight;
            canvas.getContext('2d').putImageData(imageData, 0, 0);
        };
        
        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
            // Save after resize
            this.autoSaveCanvas(canvas);
        };
        
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    }

    async autoSaveCanvas(canvas) {
        const questionId = canvas.dataset.question;
        const partId = canvas.dataset.part;
        const sectionId = canvas.dataset.section;
        const filePath = canvas.dataset.filePath || window.quizApp?.getCurrentFilePath();
        
        if (this.storage && questionId && partId) {
            try {
                await this.storage.saveCanvasAsSVG(canvas, questionId, partId, sectionId, filePath);
                
                // Update Firebase status to show successful save
                if (window.quizApp) {
                    window.quizApp.updateFirebaseStatus('online', 'Saved');
                    setTimeout(() => {
                        window.quizApp.updateFirebaseStatus('online', 'Connected');
                    }, 1000);
                }
            } catch (error) {
                console.warn('Failed to save canvas:', error);
                if (window.quizApp) {
                    window.quizApp.updateFirebaseStatus('error', 'Save failed');
                }
            }
        }
    }

    async reloadAllCanvases() {
        const canvases = document.querySelectorAll('.drawing-canvas');
        for (const canvas of canvases) {
            await this.loadCanvasData(canvas);
        }
    }

    clearCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.autoSaveCanvas(canvas);
    }

    clearAllCanvases() {
        const canvases = document.querySelectorAll('.drawing-canvas');
        canvases.forEach(canvas => {
            this.clearCanvas(canvas);
        });
    }

    setupStorageControls() {
        // Export all canvases
        const saveBtn = document.getElementById('saveCanvases');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                if (this.storage) {
                    try {
                        saveBtn.disabled = true;
                        saveBtn.textContent = '⏳ Exporting...';
                        
                        const count = await this.storage.exportAllCanvases();
                        this.showMessage(`Exported ${count} canvas drawings!`);
                    } catch (error) {
                        this.showMessage('Failed to export canvases: ' + error.message, 'error');
                    } finally {
                        saveBtn.disabled = false;
                        saveBtn.textContent = '💾 Export All Canvases';
                    }
                }
            });
        }

        // Import canvases
        const loadBtn = document.getElementById('loadCanvases');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                document.getElementById('canvasFileInput').click();
            });
        }

        // Handle file input
        const fileInput = document.getElementById('canvasFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file && this.storage) {
                    try {
                        loadBtn.disabled = true;
                        loadBtn.textContent = '⏳ Importing...';
                        
                        const count = await this.storage.importCanvases(file);
                        this.showMessage(`Successfully imported ${count} canvas drawings!`);
                        await this.reloadAllCanvases();
                    } catch (error) {
                        this.showMessage('Failed to import canvases: ' + error.message, 'error');
                    } finally {
                        loadBtn.disabled = false;
                        loadBtn.textContent = '📁 Import Canvases';
                    }
                }
                // Clear the input
                e.target.value = '';
            });
        }
    }

    showMessage(message, type = 'success') {
        // Enhanced message display with Firebase status integration
        if (window.quizApp) {
            if (type === 'error') {
                window.quizApp.updateFirebaseStatus('error', 'Error occurred');
                window.quizApp.showError(message);
            } else {
                window.quizApp.updateFirebaseStatus('online', 'Operation complete');
                window.quizApp.showSuccess(message);
                setTimeout(() => {
                    window.quizApp.updateFirebaseStatus('online', 'Connected');
                }, 2000);
            }
        } else {
            // Fallback for direct usage
            const alertType = type === 'error' ? 'alert' : 'confirm';
            if (alertType === 'alert') {
                alert(message);
            } else {
                console.log(message);
                alert(message);
            }
        }
    }

    getCanvasCount() {
        return this.canvases.length;
    }

    getStorageStatus() {
        if (!this.storage) return 'No storage available';
        
        const canvasCount = this.storage.getCanvasCount();
        const loadingStatus = this.storage.isLoadingFromFirebase() ? ' (Loading...)' : '';
        
        return `${canvasCount} canvases stored${loadingStatus}`;
    }

    destroy() {
        // Clean up event listeners and references
        this.canvases = [];
        clearTimeout(this.autoSaveTimeout);
    }
}