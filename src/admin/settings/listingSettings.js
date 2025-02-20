import { memoize } from '../../shared/utils/memoUtils';

// Base function that makes the actual API call
async function fetchListingSettingsFromAPI(listingId) {
    const { data, error } = await supabase
        .from('listing_settings')
        .select('*')
        .eq('listing_id', listingId)
        .single();

    if (error) {
        console.error('Error fetching listing settings:', error);
        return null;
    }
    return data;
}

// Memoized version
export const fetchListingSettings = memoize(fetchListingSettingsFromAPI);

export async function saveListingSettings(listingId) {
    const formData = getFormData();
    
    const { error } = await supabase
        .from('listing_settings')
        .update(formData)
        .eq('listing_id', listingId);

    if (error) {
        console.error('Error saving listing settings:', error);
        return false;
    }

    // Clear only this specific listing's cache
    fetchListingSettings.clearCache(listingId);
    return true;
}

export function populateSettingsForm(settings) {
    if (!settings) {
        console.log('No settings provided');
        return;
    }

    console.log('Populating form with settings:', settings);

    // Map database fields to HTML data-element attributes
    const fieldMap = {
        'base_rate': 'base-rate-input',
        'max_guests': 'max-guests-input',
        'extra_guest_fee': 'extra-guest-input',
        'cleaning_fee': 'cleaning-fee-input',
        'minimum_stay': 'min-stay-input',
        'maximum_stay': 'max-stay-input',
        'gap_days': 'booking-gap-input',
        'weekly_discount_percentage': 'weekly-discount-input',
        'monthly_discount_percentage': 'monthly-discount-input'
    };

    Object.entries(fieldMap).forEach(([dbField, elementId]) => {
        const element = document.querySelector(`[data-element="${elementId}"]`);
        let value = settings[dbField];
        
        console.log(`Looking for element with data-element="${elementId}"`, 
                    element ? 'Found' : 'Not found', 
                    'Value:', value);

        if (element && value !== null) {
            // Convert decimal percentages to whole numbers for display
            if (percentageFields.includes(elementId)) {
                value = Math.round(value * 100);
            }
            
            element.value = value;
            console.log(`Updated ${elementId} with value:`, value);
        }
    });
}

// Define field types
const integerFields = [
    'base-rate-input',
    'max-guests-input',
    'extra-guest-input',
    'cleaning-fee-input',
    'min-stay-input',
    'max-stay-input',
    'booking-gap-input'
];

const percentageFields = [
    'weekly-discount-input',
    'monthly-discount-input'
];

export function setupFormValidation() {
    // Integer fields validation
    integerFields.forEach(fieldId => {
        const input = document.querySelector(`[data-element="${fieldId}"]`);
        if (input) {
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
            });

            input.addEventListener('blur', (e) => {
                const value = e.target.value;
                if (value) {
                    e.target.value = Math.floor(parseFloat(value));
                }
            });
        }
    });

    // Percentage fields validation
    percentageFields.forEach(fieldId => {
        const input = document.querySelector(`[data-element="${fieldId}"]`);
        if (input) {
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                if (parseInt(e.target.value) > 100) {
                    e.target.value = '100';
                }
            });
        }
    });
}