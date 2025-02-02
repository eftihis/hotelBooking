document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page initialized');
    
    // Remove Supabase initialization, use global instance
    const supabase = window.supabase;

    // Password visibility toggle
    const passwordInput = document.querySelector('[data-element="password-input"]');
    const showPasswordIcon = document.querySelector('[data-element="show-password"]');
    const hidePasswordIcon = document.querySelector('[data-element="hide-password"]');

    if (showPasswordIcon && hidePasswordIcon && passwordInput) {
        // Initially hide the "hide password" icon
        hidePasswordIcon.style.display = 'none';
        
        // Toggle function
        const togglePassword = () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                showPasswordIcon.style.display = 'none';
                hidePasswordIcon.style.display = 'flex';
            } else {
                passwordInput.type = 'password';
                showPasswordIcon.style.display = 'block';
                hidePasswordIcon.style.display = 'flex';
            }
        };

        // Add click handlers to both icons
        showPasswordIcon.addEventListener('click', togglePassword);
        hidePasswordIcon.addEventListener('click', togglePassword);
    }

    // Message handling
    const showMessage = (message, isError = false) => {
        const messageDiv = document.querySelector(`[data-element="${isError ? 'error-message' : 'success-message'}"]`);
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.style.display = 'block';
        } else {
            console.log(isError ? 'Error:' : 'Success:', message);
        }
    };

    // Handle login
    const loginButton = document.querySelector('[data-element="login-button"]');
    if (loginButton) {
        loginButton.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Login attempt');

            const email = document.querySelector('[data-element="email-input"]').value;
            const password = document.querySelector('[data-element="password-input"]').value;

            // Clear previous messages
            const messages = document.querySelectorAll('[data-element="error-message"], [data-element="success-message"]');
            messages.forEach(msg => msg.style.display = 'none');

            // Validate inputs
            if (!email || !password) {
                showMessage('Please enter both email and password', true);
                return;
            }

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    if (error.message.includes('Invalid login credentials')) {
                        showMessage('Incorrect email or password. Please try again.', true);
                    } else {
                        showMessage(error.message, true);
                    }
                    return;
                }

                showMessage('Login successful! Redirecting...');
                
                // Store session
                localStorage.setItem('session', JSON.stringify(data.session));

                // Redirect after 1 second
                setTimeout(() => {
                    window.location.href = '/admin-dashboard';
                }, 1000);

            } catch (error) {
                showMessage('An error occurred during login', true);
            }
        });
    }

    // Check if user is already logged in
    const checkSession = async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session) {
            console.log('User already logged in');
            window.location.href = '/admin-dashboard';
        }
    };

    // Check session on page load
    checkSession();
});