import { showBookingDetails } from './bookingModal';

export function createBookingStrip(booking, formattedCurrentDate) {
    const bookingStrip = document.createElement('div');
    bookingStrip.className = 'booking-strip';
    
    // Add classes for start and end dates
    if (formattedCurrentDate === booking.check_in) {
        bookingStrip.classList.add('booking-start');
        if (booking.guests?.name) {
            const guestName = document.createElement('span');
            guestName.className = 'guest-name';
            guestName.textContent = booking.guests.name;
            bookingStrip.appendChild(guestName);
        }
    }
    if (formattedCurrentDate === booking.check_out) {
        bookingStrip.classList.add('booking-end');
    }

    // Add click handler to show booking details
    bookingStrip.addEventListener('click', async function(e) {
        e.stopPropagation();
        e.preventDefault();
        showBookingDetails(booking);
    }, true);

    return bookingStrip;
} 