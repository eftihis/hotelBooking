// Import utility functions
import { formatDate } from '../../shared/utils/dateUtils.js';
import { formatPrice } from '../../shared/utils/priceUtils.js';
import { createDateRanges, periodsOverlap } from './utils/dateUtils.js';
import { initializeBookingModal, showBookingDetails } from './components/bookingModal';
import { createBookingStrip } from './components/bookingStrip';
import { initializeFlatpickr } from './config/flatpickrConfig';
import { processBookingsForDisabledDates } from './utils/bookingUtils.js';
import { handleOpenDates, handleCloseDates } from './handlers/dateHandlers';
import { handleApplyRate, handleResetRates } from './handlers/rateHandlers';
import { fetchListingSettings } from '../settings/listingSettings';

// Main Initialization Function
export async function initializeAdminCalendar(listingId) {
    console.log('Initializing admin calendar for listing:', listingId);
    
    if (!listingId) {
        console.error('No listing ID provided');
        return;
    }

    // Use the global supabase instance
    const supabase = window.supabase;

    try {
        // Use memoized listing settings query
        const [settings, openPeriodsResponse, ratesResponse, bookingsResponse] = await Promise.all([
            fetchListingSettings(listingId),
            supabase
                .from('open_dates')
                .select('*')
                .eq('listing_id', listingId),
            supabase
                .from('rates')
                .select('*')
                .eq('listing_id', listingId),
            supabase
                .from('bookings')
                .select('*,guests(name,email,phone)')
                .eq('listing_id', listingId)
        ]);

        // Initialize flatpickr
        const adminPicker = initializeFlatpickr({
            listingId,
            baseRate: settings?.base_rate,
            openPeriods: openPeriodsResponse.data,
            rates: ratesResponse.data,
            bookings: bookingsResponse.data,
            disabledDateRanges: processBookingsForDisabledDates(bookingsResponse.data, settings?.gap_days)
        });

        // Setup event handlers
        setupEventHandlers(adminPicker, listingId);

        return adminPicker;
    } catch (error) {
        console.error('Error initializing admin calendar:', error);
    }
}

// Event Handlers
function setupEventHandlers(adminPicker, listingId) {
    // Initialize the booking modal
    initializeBookingModal();
    
    // Set rates button handler
    document.querySelector("[data-element='set-rates']").addEventListener('click', () => {
        document.querySelector("[data-element='rate-container']").classList.add('is-open');
        const rateInput = document.querySelector("[data-element='rate-input']");
        if (rateInput) rateInput.focus();
    });

    // Apply rate button handler
    document.querySelector("[data-element='apply-rate']")
        .addEventListener('click', () => handleApplyRate(adminPicker, listingId));

    // Reset rates button handler
    document.querySelector("[data-element='reset-rates']")
        .addEventListener('click', () => handleResetRates(adminPicker, listingId));

    // Open dates button handler
    document.querySelector("[data-element='open-dates']")
        .addEventListener('click', () => handleOpenDates(adminPicker, listingId));

    // Close dates button handler
    document.querySelector("[data-element='close-dates']")
        .addEventListener('click', () => handleCloseDates(adminPicker, listingId));
}