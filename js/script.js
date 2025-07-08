// Global variables
let currentUser = null;
let recognition = null;
let isListening = false;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let currentStep = 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    initializeVoiceRecognition();
    setupEventListeners();
});

function initializeApp() {
    // Check if user is already logged in
    const userData = localStorage.getItem('voicebot_user');
    if (userData) {
        currentUser = JSON.parse(userData);
        showDashboard();
    } else {
        showLanding(); // Start with landing page
    }
}

function setupEventListeners() {
    // Sign up form
    document.getElementById('signup-form').addEventListener('submit', handleSignUp);
    
    // Sign in form
    document.getElementById('signin-form').addEventListener('submit', handleSignIn);
    
    // Voice recorder
    document.getElementById('voice-recorder').addEventListener('click', toggleVoiceRecording);
    
    // File upload
    document.getElementById('file-upload').addEventListener('click', () => {
        document.getElementById('audio-file').click();
    });
    
    document.getElementById('audio-file').addEventListener('change', handleFileUpload);
}

// Page Navigation
function showLanding() {
    hideAllPages();
    document.getElementById('landing-page').classList.add('active');
}

function showSignIn() {
    hideAllPages();
    document.getElementById('signin-page').classList.add('active');
}

function showSignUp() {
    hideAllPages();
    document.getElementById('signup-page').classList.add('active');
}

function showDashboard() {
    hideAllPages();
    document.getElementById('dashboard-page').classList.add('active');
}

function hideAllPages() {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
}

// Authentication Functions
function handleSignUp(e) {
    e.preventDefault();
    
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters long', 'error');
        return;
    }
    
    // Check if user already exists
    const existingUsers = JSON.parse(localStorage.getItem('voicebot_users') || '[]');
    if (existingUsers.find(user => user.email === email)) {
        showToast('An account with this email already exists', 'error');
        return;
    }
    
    // Create new user
    const newUser = {
        id: Date.now().toString(),
        name: name,
        email: email,
        password: password,
        createdAt: new Date().toISOString()
    };
    
    // Save to localStorage
    existingUsers.push(newUser);
    localStorage.setItem('voicebot_users', JSON.stringify(existingUsers));
    
    // Set current user
    currentUser = newUser;
    localStorage.setItem('voicebot_user', JSON.stringify(currentUser));
    
    showToast('Account created successfully!', 'success');
    
    // Clear form
    document.getElementById('signup-form').reset();
    
    // Navigate to dashboard
    setTimeout(() => {
        showDashboard();
    }, 1000);
}

function handleSignIn(e) {
    e.preventDefault();
    
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    
    if (!email || !password) {
        showToast('Please enter both email and password', 'error');
        return;
    }
    
    // Find user
    const users = JSON.parse(localStorage.getItem('voicebot_users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        showToast('Invalid email or password', 'error');
        return;
    }
    
    // Set current user
    currentUser = user;
    localStorage.setItem('voicebot_user', JSON.stringify(currentUser));
    
    showToast('Welcome back, ' + user.name + '!', 'success');
    
    // Clear form
    document.getElementById('signin-form').reset();
    
    // Navigate to dashboard
    setTimeout(() => {
        showDashboard();
    }, 1000);
}

function logout() {
    currentUser = null;
    localStorage.removeItem('voicebot_user');
    resetProcess();
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        showLanding();
    }, 1000);
}

// Voice Recording Functions
function initializeVoiceRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onstart = function() {
            isListening = true;
            showToast('Listening... Speak now', 'success');
        };
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            processTranscription(transcript);
        };
        
        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            
            let errorMessage;
            if (event.error === 'network') {
                errorMessage = 'Voice recognition failed due to network issues. Please check your internet connection and try again.';
            } else {
                errorMessage = 'Voice recognition error: ' + event.error;
            }
            
            showToast(errorMessage, 'error');
            isListening = false;
            stopRecording();
        };
        
        recognition.onend = function() {
            isListening = false;
            stopRecording();
        };
    } else {
        console.log('Speech recognition not supported');
        showToast('Voice recognition is not supported in this browser', 'warning');
    }
}

async function toggleVoiceRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            processAudioBlob(audioBlob);
        };
        
        mediaRecorder.start();
        isRecording = true;
        
        // Update UI
        const voiceRecorder = document.getElementById('voice-recorder');
        voiceRecorder.classList.add('active');
        voiceRecorder.querySelector('.method-icon').classList.add('recording');
        voiceRecorder.querySelector('p').textContent = 'Recording... Click to stop';
        
        // Start speech recognition
        if (recognition) {
            recognition.start();
        }
        
        showToast('Recording started', 'success');
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        showToast('Error accessing microphone. Please check permissions.', 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    if (recognition && isListening) {
        recognition.stop();
    }
    
    isRecording = false;
    isListening = false;
    
    // Update UI
    const voiceRecorder = document.getElementById('voice-recorder');
    voiceRecorder.classList.remove('active');
    voiceRecorder.querySelector('.method-icon').classList.remove('recording');
    voiceRecorder.querySelector('p').textContent = 'Click to start recording';
    
    showToast('Recording stopped', 'success');
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.type.startsWith('audio/')) {
            processAudioFile(file);
            
            // Update UI
            const fileUpload = document.getElementById('file-upload');
            fileUpload.classList.add('active');
            fileUpload.querySelector('p').textContent = `Selected: ${file.name}`;
            
            showToast('Audio file uploaded successfully', 'success');
        } else {
            showToast('Please select a valid audio file', 'error');
        }
    }
}

// Processing Functions
function processAudioBlob(audioBlob) {
    // Simulate processing the audio blob
    showToast('Processing audio...', 'success');
    
    // Enable generate button
    document.getElementById('generate-btn').disabled = false;
}

function processAudioFile(file) {
    // Simulate processing the audio file
    showToast('Processing audio file...', 'success');
    
    // Enable generate button
    document.getElementById('generate-btn').disabled = false;
}

function processTranscription(transcript) {
    // Update Step 1
    const step1Content = document.getElementById('step-1-content');
    step1Content.innerHTML = `<p>${transcript}</p>`;
    
    currentStep = 1;
    showToast('Speech transcribed successfully', 'success');
}

function generateAnalysis() {
    if (currentStep === 0) {
        showToast('Please record audio or upload a file first', 'warning');
        return;
    }
    
    // Simulate AI analysis
    showToast('Generating AI analysis...', 'success');
    
    setTimeout(() => {
        // Update Step 2
        const step2Content = document.getElementById('step-2-content');
        step2Content.innerHTML = `
            <p>AI Analysis completed successfully. The audio content has been processed and analyzed for key insights, sentiment, and important information.</p>
            <div class="success-message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"/>
                </svg>
                Analysis complete
            </div>
        `;
        
        currentStep = 2;
        
        // Generate text-to-speech
        setTimeout(() => {
            generateTextToSpeech();
        }, 1000);
        
    }, 2000);
}

function generateTextToSpeech() {
    showToast('Generating audio output...', 'success');
    
    setTimeout(() => {
        // Update Step 3
        const step3Content = document.getElementById('step-3-content');
        step3Content.innerHTML = `
            <div class="success-message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"/>
                </svg>
                Audio generated successfully!
            </div>
            <div class="audio-controls">
                <button class="btn btn-primary btn-small" onclick="playAudio()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Play Audio
                </button>
                <button class="btn btn-secondary btn-small" onclick="downloadAudio()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download
                </button>
            </div>
        `;
        
        currentStep = 3;
        showToast('Process completed successfully!', 'success');
        
    }, 1500);
}

function playAudio() {
    showToast('Playing generated audio...', 'success');
    // In a real implementation, this would play the generated audio
}

function downloadAudio() {
    showToast('Downloading audio file...', 'success');
    // In a real implementation, this would download the generated audio file
}

function resetProcess() {
    // Reset all steps
    currentStep = 0;
    
    // Reset UI
    document.getElementById('voice-recorder').classList.remove('active');
    document.getElementById('file-upload').classList.remove('active');
    document.getElementById('generate-btn').disabled = true;
    
    // Reset step contents
    document.getElementById('step-1-content').innerHTML = '<p class="placeholder-text">Audio transcription will appear here...</p>';
    document.getElementById('step-2-content').innerHTML = '<p class="placeholder-text">AI analysis will appear here...</p>';
    document.getElementById('step-3-content').innerHTML = '<p class="placeholder-text">Audio output will be generated here...</p>';
    
    // Reset file input
    document.getElementById('audio-file').value = '';
    
    // Reset recorder text
    document.getElementById('voice-recorder').querySelector('p').textContent = 'Click to start recording';
    document.getElementById('file-upload').querySelector('p').textContent = 'Click to select audio';
    
    showToast('Process reset successfully', 'success');
}

// Utility Functions
function changeApiKey() {
    showToast('API Key change functionality would be implemented here', 'success');
}

function showProfile() {
    if (currentUser) {
        const profileInfo = `
            👤 Name: ${currentUser.name}
            📧 Email: ${currentUser.email}
            📅 Member since: ${new Date(currentUser.createdAt).toLocaleDateString()}
        `;
        showToast(profileInfo, 'success');
    }
}

// Landing page button handlers
function handleGetStarted() {
    showSignIn();
}

function handleCreateAccount() {
    showSignUp();
}

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Service Worker Registration (for PWA support)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
            console.log('ServiceWorker registration successful');
        }, function(err) {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}
