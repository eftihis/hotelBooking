document.addEventListener('DOMContentLoaded', function() {
    console.log('Auth check initialized');
    
    // Remove Supabase initialization, use global instance
    const supabase = window.supabase;

    // Get and display user info
    const populateUserInfo = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (!session) {
                console.log('No active session, redirecting to login');
                window.location.href = '/login';
                return;
            }

            const user = session.user;
            console.log('Full user data:', user);

            // Map user data to elements
            const userElements = {
                'user-email': user.email,
                'user-first-name': user.user_metadata?.first_name || '',
                'user-last-name': user.user_metadata?.last_name || '',
                'user-role': user.user_metadata?.role || 'user',
                'user-full-name': `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim(),
                'user-joined-date': new Date(user.created_at).toLocaleDateString()
            };

            // Populate elements with debug logging
            Object.entries(userElements).forEach(([elementId, value]) => {
                const elements = document.querySelectorAll(`[data-element="${elementId}"]`);
                console.log(`Looking for elements with data-element="${elementId}"`, elements.length);
                
                elements.forEach(element => {
                    if (element.tagName === 'INPUT') {
                        element.value = value;
                        console.log(`Set input value for ${elementId}:`, value);
                    } else {
                        element.textContent = value;
                        console.log(`Set text content for ${elementId}:`, value);
                    }
                });
            });

        } catch (error) {
            console.error('Error populating user info:', error);
        }
    };

    // Check auth and populate user info
    const checkAuth = async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!session) {
            console.log('No active session, redirecting to login');
            window.location.href = '/login';
            return;
        }

        console.log('User authenticated:', session.user.email);
        
        // If we're on the admin dashboard, populate user info
        if (window.location.pathname.includes('admin')) {
            await populateUserInfo();
        }
    };

    // Run auth check
    checkAuth();

    // Logout handler
    const logoutButton = document.querySelector('[data-element="logout-button"]');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Error signing out:', error.message);
                return;
            }
            console.log('Logged out successfully');
            window.location.href = '/login';
        });
    }
});