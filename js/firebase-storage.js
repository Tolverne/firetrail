// Firebase Canvas Storage Service
import { db } from './firebase-config.js';
import { 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    getDocs, 
    deleteDoc,
    writeBatch,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class FirebaseCanvasStorage {
    constructor(userId) {
        this.userId = userId;
        this.canvasData = {};
        this.isLoading = false;
        this.hasLoadedFromFirebase = false;
    }

    async hashString(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async getFileHash(filePath) {
        // Create a hash of the file path for privacy
        return await this.hashString(filePath || 'default');
    }

    getCanvasKey(questionId, partId, sectionId = null) {
        return sectionId !== null ? 
            `section_${sectionId}_q${questionId}_p${partId}` : 
            `q${questionId}_p${partId}`;
    }

    async saveCanvasAsSVG(canvas, questionId, partId, sectionId = null, filePath = null) {
        if (!this.userId) {
            console.warn('No user ID available for saving canvas');
            return null;
        }

        try {
            const key = this.getCanvasKey(questionId, partId, sectionId);
            const svgData = this.canvasToSVG(canvas);
            const fileHash = await this.getFileHash(filePath);
            
            const canvasDoc = {
                svg: svgData,
                timestamp: serverTimestamp(),
                dimensions: {
                    width: canvas.width,
                    height: canvas.height
                },
                fileId: fileHash,
                questionId: questionId.toString(),
                partId: partId.toString(),
                sectionId: sectionId?.toString() || null
            };

            // Save to Firestore
            const docRef = doc(db, 'users', this.userId, 'canvases', `${fileHash}_${key}`);
            await setDoc(docRef, canvasDoc);
            
            // Update local cache
            this.canvasData[`${fileHash}_${key}`] = {
                ...canvasDoc,
                timestamp: new Date().toISOString() // Use local timestamp for cache
            };
            
            console.log(`Saved canvas ${key} for file ${fileHash} to Firebase`);
            return svgData;
        } catch (error) {
            console.error('Error saving canvas to Firebase:', error);
            return null;
        }
    }

    async loadCanvasFromSVG(canvas, questionId, partId, sectionId = null, filePath = null) {
        if (!this.userId) {
            console.warn('No user ID available for loading canvas');
            return false;
        }

        try {
            const key = this.getCanvasKey(questionId, partId, sectionId);
            const fileHash = await this.getFileHash(filePath);
            const fullKey = `${fileHash}_${key}`;
            
            // Check local cache first
            let canvasDoc = this.canvasData[fullKey];
            
            // If not in cache, try to load from Firebase
            if (!canvasDoc) {
                const docRef = doc(db, 'users', this.userId, 'canvases', fullKey);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    canvasDoc = docSnap.data();
                    // Cache locally
                    this.canvasData[fullKey] = canvasDoc;
                }
            }
            
            if (canvasDoc && canvasDoc.svg) {
                await this.loadSVGToCanvas(canvas, canvasDoc.svg);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error loading canvas from Firebase:', error);
            return false;
        }
    }

    async loadAllCanvasesForFile(filePath) {
        if (!this.userId) {
            console.warn('No user ID available for loading canvases');
            return;
        }

        try {
            this.isLoading = true;
            const fileHash = await this.getFileHash(filePath);
            
            // Load all canvases for this file from Firebase
            const canvasesRef = collection(db, 'users', this.userId, 'canvases');
            const snapshot = await getDocs(canvasesRef);
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.fileId === fileHash) {
                    this.canvasData[doc.id] = data;
                }
            });
            
            this.hasLoadedFromFirebase = true;
            console.log(`Loaded ${snapshot.size} canvases from Firebase for file ${fileHash}`);
        } catch (error) {
            console.error('Error loading canvases from Firebase:', error);
        } finally {
            this.isLoading = false;
        }
    }

    canvasToSVG(canvas) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', canvas.width);
        svg.setAttribute('height', canvas.height);
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        // Convert canvas to data URL and embed as image in SVG
        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        image.setAttribute('width', canvas.width);
        image.setAttribute('height', canvas.height);
        image.setAttribute('href', canvas.toDataURL('image/png'));
        
        svg.appendChild(image);
        return new XMLSerializer().serializeToString(svg);
    }

    loadSVGToCanvas(canvas, svgData) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = reject;
            
            // Extract the image data from SVG
            try {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgData, 'image/svg+xml');
                const imageElement = svgDoc.querySelector('image');
                if (imageElement) {
                    img.src = imageElement.getAttribute('href');
                } else {
                    reject(new Error('No image found in SVG'));
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    async exportAllCanvases() {
        try {
            // Get all canvases from Firebase
            const canvasesRef = collection(db, 'users', this.userId, 'canvases');
            const snapshot = await getDocs(canvasesRef);
            
            const exportData = {
                userId: this.userId,
                timestamp: new Date().toISOString(),
                version: '2.0',
                source: 'firebase',
                canvases: {}
            };
            
            snapshot.forEach((doc) => {
                exportData.canvases[doc.id] = doc.data();
            });
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `canvas-drawings_firebase_${this.userId}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            return snapshot.size;
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }

    async importCanvases(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (!data.canvases) {
                        reject(new Error('Invalid canvas data format'));
                        return;
                    }
                    
                    // Import to Firebase using batch write
                    const batch = writeBatch(db);
                    let count = 0;
                    
                    for (const [key, canvasData] of Object.entries(data.canvases)) {
                        const docRef = doc(db, 'users', this.userId, 'canvases', key);
                        batch.set(docRef, {
                            ...canvasData,
                            timestamp: serverTimestamp(), // Update timestamp
                            importedAt: serverTimestamp()
                        });
                        count++;
                    }
                    
                    await batch.commit();
                    
                    // Update local cache
                    Object.assign(this.canvasData, data.canvases);
                    
                    resolve(count);
                } catch (error) {
                    reject(new Error('Failed to import canvas data: ' + error.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    async clearAllCanvases() {
        try {
            // Delete all canvases from Firebase
            const canvasesRef = collection(db, 'users', this.userId, 'canvases');
            const snapshot = await getDocs(canvasesRef);
            
            const batch = writeBatch(db);
            snapshot.forEach((docSnapshot) => {
                batch.delete(docSnapshot.ref);
            });
            
            await batch.commit();
            
            // Clear local cache
            this.canvasData = {};
            
            console.log('All canvases cleared from Firebase');
        } catch (error) {
            console.error('Error clearing canvases:', error);
            throw error;
        }
    }

    async deleteCanvas(questionId, partId, sectionId = null, filePath = null) {
        try {
            const key = this.getCanvasKey(questionId, partId, sectionId);
            const fileHash = await this.getFileHash(filePath);
            const fullKey = `${fileHash}_${key}`;
            
            // Delete from Firebase
            const docRef = doc(db, 'users', this.userId, 'canvases', fullKey);
            await deleteDoc(docRef);
            
            // Remove from local cache
            delete this.canvasData[fullKey];
            
            console.log(`Deleted canvas ${fullKey} from Firebase`);
        } catch (error) {
            console.error('Error deleting canvas:', error);
            throw error;
        }
    }

    getAllCanvasKeys() {
        return Object.keys(this.canvasData);
    }

    getCanvasCount() {
        return Object.keys(this.canvasData).length;
    }

    isLoadingFromFirebase() {
        return this.isLoading;
    }

    hasLoadedData() {
        return this.hasLoadedFromFirebase;
    }

    // Legacy compatibility methods
    saveToLocalStorage() {
        // No-op - Firebase handles persistence
    }

    loadFromLocalStorage() {
        // No-op - Firebase handles persistence
    }
}

export default FirebaseCanvasStorage;