export function processBookingsForDisabledDates(bookings, gapDays) {
    const disabledDateRanges = [];
    
    if (bookings) {
        bookings.forEach(booking => {
            const checkIn = new Date(booking.check_in);
            const checkOut = new Date(booking.check_out);
            
            // Calculate gap dates before check-in
            const gapStart = new Date(checkIn);
            gapStart.setDate(gapStart.getDate() - gapDays);
            const gapEndBefore = new Date(checkIn);
            gapEndBefore.setDate(gapEndBefore.getDate() - 1);
            
            // Calculate gap dates after check-out
            const gapStartAfter = new Date(checkOut);
            const gapEnd = new Date(checkOut);
            gapEnd.setDate(gapEnd.getDate() + gapDays - 1);
            
            if (gapDays > 0) {
                disabledDateRanges.push({
                    from: gapStart.toISOString().split('T')[0],
                    to: gapEndBefore.toISOString().split('T')[0]
                });
                
                disabledDateRanges.push({
                    from: checkOut.toISOString().split('T')[0],
                    to: gapEnd.toISOString().split('T')[0]
                });
            }
            
            disabledDateRanges.push({
                from: booking.check_in,
                to: booking.check_out
            });
        });
    }
    return disabledDateRanges;
}