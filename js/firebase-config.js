const firebaseConfig = {
    apiKey: "AIzaSyDBLPsZTcMywuJOSUde079v96w0DtQB7EI",
    authDomain: "latex-quiz-platform.firebaseapp.com",
    projectId: "latex-quiz-platform",
    storageBucket: "latex-quiz-platform.firebasestorage.app",
    messagingSenderId: "643215939837",
    appId: "1:643215939837:web:9d5bec4d89093fd9ddc694",
    measurementId: "G-4YXW4HKQS4"
  };


// Import the functions you need from the SDKs you need
// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service  
export const db = getFirestore(app);

// Export the app for other uses
export default app;
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

