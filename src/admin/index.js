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

async function init() {
    // Test auth
    const user = await checkAuth();
    if (!user) return;

    const listingId = getListingIdFromUrl();
    console.log('Listing ID:', listingId);

    if (listingId) {
        // Initialize taxes
        const { taxes, appliedTaxes } = await initializeTaxes(listingId);
        console.log('Available taxes:', taxes);
        console.log('Applied taxes:', appliedTaxes);

        // Fetch and populate settings
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
                    // You might want to add some UI feedback here
                }
            });
        }
    }

    // Test our utility functions
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Formatted date:', formatDate(today));
    console.log('Nights between dates:', calculateNights(today, tomorrow));
    console.log('Formatted price:', formatPrice(99.99));
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Admin page initialized');
    
    const listingId = getListingIdFromUrl();
    console.log('Listing ID:', listingId);

    if (!listingId) {
        console.error('No listing ID found');
        return;
    }

    try {
        // Initialize calendar with new implementation
        const calendar = await initializeAdminCalendar(listingId);
        console.log('Calendar initialized:', !!calendar);

        // Initialize other components
        const { taxes, appliedTaxes } = await initializeTaxes(listingId);
        console.log('Available taxes:', taxes);
        console.log('Applied taxes:', appliedTaxes);

        // Initialize listing settings
        const settings = await fetchListingSettings(listingId);
        console.log('Listing settings:', settings);

    } catch (error) {
        console.error('Error initializing admin page:', error);
    }
});

init();
