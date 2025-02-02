document.addEventListener('DOMContentLoaded', function() {
    console.log('Signup page initialized');
    const supabase = window.supabase;

    // Password visibility toggle - Debug logs
    const passwordInput = document.querySelector('[data-element="password-input"]');
    const confirmPasswordInput = document.querySelector('[data-element="confirm-password-input"]');
    const showPasswordIcon = document.querySelector('[data-element="show-password"]');
    const hidePasswordIcon = document.querySelector('[data-element="hide-password"]');

    console.log('Password elements found:', {
        passwordInput: !!passwordInput,
        confirmPasswordInput: !!confirmPasswordInput,
        showPasswordIcon: !!showPasswordIcon,
        hidePasswordIcon: !!hidePasswordIcon
    });

    if (showPasswordIcon && hidePasswordIcon && passwordInput) {
     
        
        // Toggle function for both password fields
        const togglePassword = () => {
            console.log('Toggle password clicked');
            const isPasswordVisible = passwordInput.type === 'password';
            
            // Toggle main password
            passwordInput.type = isPasswordVisible ? 'text' : 'password';
            
            // Toggle confirm password if it exists
            if (confirmPasswordInput) {
                confirmPasswordInput.type = isPasswordVisible ? 'text' : 'password';
            }
            
            // Toggle icons
            showPasswordIcon.style.display = isPasswordVisible ? 'none' : 'flex';
            hidePasswordIcon.style.display = isPasswordVisible ? 'flex' : 'none';
            
            console.log('Password visibility:', {
                isVisible: isPasswordVisible,
                mainType: passwordInput.type,
                confirmType: confirmPasswordInput?.type
            });
        };

        // Add click handlers to both icons
        showPasswordIcon.addEventListener('click', () => {
            console.log('Show password clicked');
            togglePassword();
        });
        
        hidePasswordIcon.addEventListener('click', () => {
            console.log('Hide password clicked');
            togglePassword();
        });
    }

    const signupButton = document.querySelector('[data-element="signup-button"]');
    
    // Add message handling
    const showMessage = (message, isError = false) => {
        const messageDiv = document.querySelector(`[data-element="${isError ? 'error-message' : 'success-message'}"]`);
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.style.display = 'block';
        } else {
            console.log(isError ? 'Error:' : 'Success:', message);
        }
    };

    if (signupButton) {
        signupButton.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Get form values
            const email = document.querySelector('[data-element="email-input"]').value;
            const password = document.querySelector('[data-element="password-input"]').value;
            const confirmPassword = document.querySelector('[data-element="confirm-password-input"]').value;
            const firstName = document.querySelector('[data-element="firstname-input"]').value;
            const lastName = document.querySelector('[data-element="lastname-input"]').value;
            const termsCheckbox = document.querySelector('[data-element="terms-checkbox"]');
            
            // Clear previous messages
            const messages = document.querySelectorAll('[data-element="error-message"], [data-element="success-message"]');
            messages.forEach(msg => msg.style.display = 'none');

            // Validate inputs
            if (!email || !password || !confirmPassword || !firstName || !lastName) {
                showMessage('Please fill in all fields', true);
                return;
            }

            // Validate password match
            if (password !== confirmPassword) {
                showMessage('Passwords do not match', true);
                return;
            }

            // Validate password strength (optional)
            if (password.length < 6) {
                showMessage('Password must be at least 6 characters long', true);
                return;
            }

            // Validate terms acceptance
            if (!termsCheckbox || !termsCheckbox.checked) {
                showMessage('Please accept the terms and conditions', true);
                return;
            }
            
            try {
                // Sign up the user
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            first_name: firstName,
                            last_name: lastName,
                            terms_accepted: true,
                            terms_accepted_date: new Date().toISOString(),
                            role: 'user' // Default role
                        }
                    }
                });

                if (error) {
                    showMessage(error.message, true);
                    return;
                }

                showMessage('Sign up successful! Please check your email to confirm your account. Redirecting to login...');
                
                // Redirect after 3 seconds
                setTimeout(() => {
                    window.location.href = '/login';
                }, 3000);

            } catch (error) {
                showMessage('An error occurred during signup', true);
            }
        });
    }
}); 