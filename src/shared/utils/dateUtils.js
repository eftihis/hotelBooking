// Simple utility functions that don't depend on other code
export function formatDate(date) {
    console.log('formatDate received:', date, typeof date);
    
    try {
        // Handle different input types
        let d;
        if (date instanceof Date) {
            d = date;
        } else if (typeof date === 'number') {
            d = new Date(date);
        } else if (typeof date === 'string') {
            d = new Date(date);
        } else {
            console.error('Invalid date input:', date);
            return null;
        }

        // Validate the date is valid
        if (isNaN(d.getTime())) {
            console.error('Invalid date:', date);
            return null;
        }

        // Return in YYYY-MM-DD format
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch (error) {
        console.error('Error formatting date:', error, 'Input was:', date);
        return null;
    }
}

export function calculateNights(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
} 