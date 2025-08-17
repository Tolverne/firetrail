// Firebase Authentication Service
import { auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

class FirebaseAuth {
    constructor() {
        this.currentUser = null;
        this.authStateListeners = [];
        this.initializeAuthListener();
    }

    initializeAuthListener() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = {
                    id: this.hashEmail(user.email),
                    uid: user.uid,
                    displayName: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    emailVerified: user.emailVerified,
                    loginTime: new Date().toISOString()
                };
            } else {
                this.currentUser = null;
            }
            
            // Notify listeners
            this.authStateListeners.forEach(listener => listener(this.currentUser));
        });
    }

    async hashEmail(email) {
        if (!email) return null;
        const encoder = new TextEncoder();
        const data = encoder.encode(email.toLowerCase().trim());
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async login(email, password) {
        try {
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            if (!this.isValidEmail(email)) {
                throw new Error('Invalid email format');
            }

            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
            
            // User info will be set by the auth state listener
            return this.currentUser;
        } catch (error) {
            console.error('Login error:', error);
            
            // Provide user-friendly error messages
            switch (error.code) {
                case 'auth/user-not-found':
                    throw new Error('No account found with this email address');
                case 'auth/wrong-password':
                    throw new Error('Incorrect password');
                case 'auth/too-many-requests':
                    throw new Error('Too many failed attempts. Please try again later');
                case 'auth/user-disabled':
                    throw new Error('This account has been disabled');
                case 'auth/invalid-email':
                    throw new Error('Invalid email address');
                default:
                    throw new Error(error.message || 'Login failed. Please try again.');
            }
        }
    }

    async register(email, password, displayName = null) {
        try {
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            if (!this.isValidEmail(email)) {
                throw new Error('Invalid email format');
            }

            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            
            // Update display name if provided
            if (displayName) {
                await updateProfile(userCredential.user, {
                    displayName: displayName
                });
            }
            
            return this.currentUser;
        } catch (error) {
            console.error('Registration error:', error);
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    throw new Error('An account with this email already exists');
                case 'auth/invalid-email':
                    throw new Error('Invalid email address');
                case 'auth/weak-password':
                    throw new Error('Password is too weak. Please choose a stronger password');
                default:
                    throw new Error(error.message || 'Registration failed. Please try again.');
            }
        }
    }

    async logout() {
        try {
            await signOut(auth);
            this.currentUser = null;
        } catch (error) {
            console.error('Logout error:', error);
            throw new Error('Failed to sign out. Please try again.');
        }
    }

    async resetPassword(email) {
        try {
            if (!email || !this.isValidEmail(email)) {
                throw new Error('Please enter a valid email address');
            }

            await sendPasswordResetEmail(auth, email.trim());
            return true;
        } catch (error) {
            console.error('Password reset error:', error);
            
            switch (error.code) {
                case 'auth/user-not-found':
                    throw new Error('No account found with this email address');
                case 'auth/invalid-email':
                    throw new Error('Invalid email address');
                default:
                    throw new Error('Failed to send password reset email. Please try again.');
            }
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isLoggedIn() {
        return this.currentUser !== null && auth.currentUser !== null;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    onAuthStateChange(callback) {
        this.authStateListeners.push(callback);
        
        // Return unsubscribe function
        return () => {
            const index = this.authStateListeners.indexOf(callback);
            if (index > -1) {
                this.authStateListeners.splice(index, 1);
            }
        };
    }

    async waitForAuth() {
        return new Promise((resolve) => {
            if (this.currentUser !== null) {
                resolve(this.currentUser);
                return;
            }
            
            const unsubscribe = this.onAuthStateChange((user) => {
                unsubscribe();
                resolve(user);
            });
        });
    }

    // Legacy compatibility methods
    loadSession() {
        return this.currentUser;
    }

    saveSession() {
        // No-op for Firebase (handles sessions automatically)
    }

    clearSession() {
        // No-op for Firebase (handles sessions automatically)  
    }
}

// Create global auth instance
window.auth = new FirebaseAuth();

export default window.auth;