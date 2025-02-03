import { formatPrice } from '../../../shared/services/priceUtils';

export function initializeBookingModal() {
    // Add close button handler for the modal
    const closeModalButton = document.querySelector('[data-element="close-modal"]');
    if (closeModalButton) {
        closeModalButton.addEventListener('click', closeModal);
    }

    // Add click outside modal handler
    const modal = document.querySelector('[data-element="booking-modal"]');
    if (modal) {
        modal.addEventListener('click', function(e) {
            // Close if clicking outside the modal content
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Add ESC key handler
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Close modal if it's open
            const modal = document.querySelector('[data-element="booking-modal"]');
            if (modal && modal.classList.contains('is-visible')) {
                closeModal();
            }
        }
    });
}

export function showBookingDetails(booking) {
    const modal = document.querySelector('[data-element="booking-modal"]');
    if (!modal) return;

    // Populate modal elements
    const modalElements = {
        'guest-name': booking.guests?.name || 'N/A',
        'listing-name': booking.listings?.name || 'N/A',
        'check-in': booking.check_in,
        'check-out': booking.check_out,
        'total-nights': `${booking.total_nights || 0} nights`,
        'total-price': `€${formatPrice(booking.final_total || 0)}`,
        'confirmation-code': booking.id || 'N/A',
        'nightly-rate': `€${formatPrice(booking.nightly_rate || 0)}`,
        'cleaning-fee': `€${formatPrice(booking.cleaning_fee || 0)}`,
        'discount-amount': `€${formatPrice(booking.discount_total || 0)}`,
        'nightstay-tax-amount': `€${formatPrice(booking.nightstay_tax_total || 0)}`,
        'total-guests': booking.number_of_guests || 'N/A',
        'booking-status': booking.status || 'N/A',
        'payment-status': booking.payment_status || 'N/A'
    };

    Object.entries(modalElements).forEach(([element, value]) => {
        const el = document.querySelector(`[data-element="booking-${element}"]`);
        if (el) el.textContent = value;
    });

    // Show the modal
    showModal();
}

function showModal() {
    const modal = document.querySelector('[data-element="booking-modal"]');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('is-visible');
    }
}

function closeModal() {
    const modal = document.querySelector('[data-element="booking-modal"]');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('is-visible');
    }
}
