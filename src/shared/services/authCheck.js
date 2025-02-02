export async function checkAuth() {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
        window.location.href = '/login';
        return null;
    }
    
    return user;
} 