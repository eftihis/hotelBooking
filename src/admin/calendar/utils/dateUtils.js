export function createDateRanges(dates) {
    const sortedDates = [...dates].sort((a, b) => a - b);
    const ranges = [];
    let rangeStart = sortedDates[0];
    
    for (let i = 1; i < sortedDates.length; i++) {
        const currentDate = sortedDates[i];
        const previousDate = sortedDates[i - 1];
        const dayDiff = Math.round((currentDate - previousDate) / (1000 * 60 * 60 * 24));
        
        if (dayDiff > 1) {
            ranges.push({
                start: rangeStart,
                end: previousDate
            });
            rangeStart = currentDate;
        }
    }
    
    ranges.push({
        start: rangeStart,
        end: sortedDates[sortedDates.length - 1]
    });
    
    return ranges;
}

export function periodsOverlap(period1Start, period1End, period2Start, period2End) {
    const start1 = new Date(period1Start);
    const end1 = new Date(period1End);
    const start2 = new Date(period2Start);
    const end2 = new Date(period2End);
    
    start1.setHours(12, 0, 0, 0);
    end1.setHours(12, 0, 0, 0);
    start2.setHours(12, 0, 0, 0);
    end2.setHours(12, 0, 0, 0);
    
    return (start1 <= end2 && end1 >= start2) || 
           (Math.abs(end1.getTime() - start2.getTime()) <= 86400000) ||
           (Math.abs(end2.getTime() - start1.getTime()) <= 86400000);
} 