// Initialize Supabase first
window.supabase = window.supabase.createClient(
    'https://uzjmmrthjfmaizbeihkq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6am1tcnRoamZtYWl6YmVpaGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxMTMzMjMsImV4cCI6MjA1MjY4OTMyM30.a39DgG8nvpXDjV4ALWcyCxvCISkgVUUwmwuDDpnKtAM'
);

import { formatDate, calculateNights } from '../shared/utils/dateUtils';
import { formatPrice } from '../shared/utils/priceUtils';
import { getListingIdFromUrl } from '../shared/utils/urlUtils';
import { checkAuth } from '../shared/services/authCheck';
import { initializeTaxes } from './taxes/appliedTaxes';
import { 
    fetchListingSettings, 
    populateSettingsForm, 
    setupFormValidation,
    saveListingSettings 
} from './settings/listingSettings';
import { initializeAdminCalendar } from './calendar/adminCalendar';

async function initializeAdmin(listingId) {
    try {
        // Initialize calendar
        const calendar = await initializeAdminCalendar(listingId);
        console.log('Calendar initialized:', !!calendar);

        // Initialize taxes
        const { taxes, appliedTaxes } = await initializeTaxes(listingId);
        console.log('Available taxes:', taxes);
        console.log('Applied taxes:', appliedTaxes);

        // Fetch and populate settings (only one call)
        const settings = await fetchListingSettings(listingId);
        console.log('Listing settings:', settings);
        populateSettingsForm(settings);
        setupFormValidation();

        // Setup save button handler
        const saveButton = document.querySelector('[data-element="save-listing-settings"]');
        if (saveButton) {
            saveButton.addEventListener('click', async () => {
                const success = await saveListingSettings(listingId);
                if (success) {
                    console.log('Settings saved successfully');
                }
            });
        }

    } catch (error) {
        console.error('Error initializing admin page:', error);
    }
}

// Single initialization point
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Admin page initialized');
    
    // Check auth first
    const user = await checkAuth();
    if (!user) return;

    const listingId = getListingIdFromUrl();
    console.log('Listing ID:', listingId);

    if (!listingId) {
        console.error('No listing ID found');
        return;
    }

    await initializeAdmin(listingId);
});
