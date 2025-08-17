// Firebase Login page functionality
import auth from './firebase-auth.js';

class LoginManager {
    constructor() {
        this.currentForm = 'login';
        this.init();
    }

    async init() {
        // Wait for auth to initialize
        const user = await auth.waitForAuth();
        if (user) {
            // User is already logged in, redirect to main app
            window.location.href = 'index.html';
            return;
        }

        this.setupEventListeners();
        this.hideFirebaseLoading();
    }

    setupEventListeners() {
        // Form toggle buttons
        document.getElementById('loginToggle').addEventListener('click', () => this.showForm('login'));
        document.getElementById('registerToggle').addEventListener('click', () => this.showForm('register'));
        document.getElementById('forgotPasswordBtn').addEventListener('click', () => this.showForm('reset'));
        document.getElementById('backToLoginBtn').addEventListener('click', () => this.showForm('login'));

        // Form submissions
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('resetForm').addEventListener('submit', (e) => this.handlePasswordReset(e));

        // Real-time form validation
        this.setupFormValidation();

        // Clear errors when user starts typing
        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this.clearMessages());
        });
    }

    setupFormValidation() {
        // Email validation
        const emailInputs = ['loginEmail', 'registerEmail', 'resetEmail'];
        emailInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('blur', () => this.validateEmail(input));
            }
        });

        // Password confirmation validation
        const confirmPassword = document.getElementById('confirmPassword');
        const registerPassword = document.getElementById('registerPassword');
        
        if (confirmPassword && registerPassword) {
            confirmPassword.addEventListener('input', () => {
                this.validatePasswordMatch(registerPassword, confirmPassword);
            });
            registerPassword.addEventListener('input', () => {
                this.validatePasswordMatch(registerPassword, confirmPassword);
            });
        }
    }

    validateEmail(input) {
        if (input.value && !auth.isValidEmail(input.value)) {
            input.style.borderColor = '#e53e3e';
            return false;
        } else {
            input.style.borderColor = '#e2e8f0';
            return true;
        }
    }

    validatePasswordMatch(password, confirmPassword) {
        if (confirmPassword.value && password.value !== confirmPassword.value) {
            confirmPassword.style.borderColor = '#e53e3e';
            return false;
        } else {
            confirmPassword.style.borderColor = '#e2e8f0';
            return true;
        }
    }

    showForm(formType) {
        // Hide all forms
        document.querySelectorAll('.auth-form').forEach(form => {
            form.style.display = 'none';
        });

        // Update toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected form
        this.currentForm = formType;
        
        switch (formType) {
            case 'login':
                document.getElementById('loginForm').style.display = 'block';
                document.getElementById('loginToggle').classList.add('active');
                break;
            case 'register':
                document.getElementById('registerForm').style.display = 'block';
                document.getElementById('registerToggle').classList.add('active');
                break;
            case 'reset':
                document.getElementById('resetForm').style.display = 'block';
                break;
        }

        this.clearMessages();
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const submitBtn = e.target.querySelector('.auth-btn');
        
        if (!this.validateEmail(document.getElementById('loginEmail'))) {
            this.showError('Please enter a valid email address');
            return;
        }

        this.setLoading(submitBtn, true, 'Signing In...');
        this.clearMessages();

        try {
            await auth.login(email, password);
            this.showSuccess('Successfully signed in! Redirecting...');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
            
        } catch (error) {
            this.showError(error.message);
            this.setLoading(submitBtn, false, 'Sign In');
            document.getElementById('loginPassword').value = '';
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const submitBtn = e.target.querySelector('.auth-btn');
        
        // Validation
        if (!this.validateEmail(document.getElementById('registerEmail'))) {
            this.showError('Please enter a valid email address');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters long');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        this.setLoading(submitBtn, true, 'Creating Account...');
        this.clearMessages();

        try {
            await auth.register(email, password, name || null);
            this.showSuccess('Account created successfully! Redirecting...');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
            
        } catch (error) {
            this.showError(error.message);
            this.setLoading(submitBtn, false, 'Create Account');
        }
    }

    async handlePasswordReset(e) {
        e.preventDefault();
        
        const email = document.getElementById('resetEmail').value.trim();
        const submitBtn = e.target.querySelector('.auth-btn');
        
        if (!this.validateEmail(document.getElementById('resetEmail'))) {
            this.showError('Please enter a valid email address');
            return;
        }

        this.setLoading(submitBtn, true, 'Sending...');
        this.clearMessages();

        try {
            await auth.resetPassword(email);
            this.showSuccess('Password reset email sent! Check your inbox.');
            
            setTimeout(() => {
                this.showForm('login');
            }, 3000);
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoading(submitBtn, false, 'Send Reset Email');
        }
    }

    setLoading(button, loading, text) {
        if (loading) {
            button.disabled = true;
            button.textContent = text;
            button.style.opacity = '0.7';
        } else {
            button.disabled = false;
            button.textContent = text;
            button.style.opacity = '1';
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('authError');
        const successDiv = document.getElementById('authSuccess');
        
        successDiv.style.display = 'none';
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    showSuccess(message) {
        const errorDiv = document.getElementById('authError');
        const successDiv = document.getElementById('authSuccess');
        
        errorDiv.style.display = 'none';
        successDiv.textContent = message;
        successDiv.style.display = 'block';
    }

    clearMessages() {
        document.getElementById('authError').style.display = 'none';
        document.getElementById('authSuccess').style.display = 'none';
        
        // Reset input border colors
        document.querySelectorAll('input').forEach(input => {
            input.style.borderColor = '#e2e8f0';
        });
    }

    showFirebaseLoading(text = 'Connecting to Firebase...') {
        const overlay = document.getElementById('firebaseLoading');
        const textElement = document.getElementById('firebaseLoadingText');
        if (overlay && textElement) {
            textElement.textContent = text;
            overlay.style.display = 'flex';
        }
    }

    hideFirebaseLoading() {
        const overlay = document.getElementById('firebaseLoading');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Show loading initially
    const loginManager = new LoginManager();
    
    // Show Firebase loading initially
    const overlay = document.getElementById('firebaseLoading');
    if (overlay) {
        overlay.style.display = 'flex';
    }
});

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Login page error:', e.error);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});