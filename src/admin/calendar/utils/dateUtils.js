// Helper function to create date ranges from selected dates
export function createDateRanges(selectedDates) {
    if (selectedDates.length === 0) return [];
    
    // If only one date is selected, treat it as a single-day range
    if (selectedDates.length === 1) {
        const date = new Date(selectedDates[0]);
        // Ensure we're working with local dates at noon to avoid timezone issues
        date.setHours(12, 0, 0, 0);
        return [{
            start: date,
            end: date
        }];
    }
    
    // Sort dates chronologically
    const sortedDates = [...selectedDates].sort((a, b) => a - b).map(date => {
        const d = new Date(date);
        d.setHours(12, 0, 0, 0);
        return d;
    });
    
    const ranges = [];
    let rangeStart = sortedDates[0];
    
    for (let i = 1; i < sortedDates.length; i++) {
        const currentDate = sortedDates[i];
        const previousDate = sortedDates[i - 1];
        
        // Check if dates are consecutive
        const dayDiff = Math.round((currentDate - previousDate) / (1000 * 60 * 60 * 24));
        
        if (dayDiff > 1) {
            // End of a range
            ranges.push({
                start: rangeStart,
                end: previousDate
            });
            // Start new range
            rangeStart = currentDate;
        }
    }
    
    // Add the last range
    ranges.push({
        start: rangeStart,
        end: sortedDates[sortedDates.length - 1]
    });
    
    return ranges;
}

// Helper function to check if two periods overlap or are adjacent
export function periodsOverlap(period1Start, period1End, period2Start, period2End) {
    const start1 = new Date(period1Start);
    const end1 = new Date(period1End);
    const start2 = new Date(period2Start);
    const end2 = new Date(period2End);
    
    start1.setHours(12, 0, 0, 0);
    end1.setHours(12, 0, 0, 0);
    start2.setHours(12, 0, 0, 0);
    end2.setHours(12, 0, 0, 0);
    
    // Check if periods overlap or are adjacent (within 1 day)
    return (start1 <= end2 && end1 >= start2) || 
           (Math.abs(end1.getTime() - start2.getTime()) <= 86400000) ||
           (Math.abs(end2.getTime() - start1.getTime()) <= 86400000);
}