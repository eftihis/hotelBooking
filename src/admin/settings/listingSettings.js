export async function fetchListingSettings(listingId) {
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

export async function saveListingSettings(listingId) {
    // Map form fields to database fields
    const fieldMap = {
        'base-rate-input': 'base_rate',
        'max-guests-input': 'max_guests',
        'extra-guest-input': 'extra_guest_fee',
        'cleaning-fee-input': 'cleaning_fee',
        'min-stay-input': 'minimum_stay',
        'max-stay-input': 'maximum_stay',
        'booking-gap-input': 'gap_days',
        'weekly-discount-input': 'weekly_discount_percentage',
        'monthly-discount-input': 'monthly_discount_percentage'
    };

    // Collect form values
    const settings = {};
    Object.entries(fieldMap).forEach(([elementId, dbField]) => {
        const element = document.querySelector(`[data-element="${elementId}"]`);
        if (element) {
            let value = element.value;
            
            // Convert percentage fields from whole numbers to decimals
            if (percentageFields.includes(elementId)) {
                value = (parseInt(value) || 0) / 100;
            } else {
                value = parseInt(value) || null;
            }
            
            settings[dbField] = value;
        }
    });

    console.log('Saving settings:', settings);

    const { data, error } = await supabase
        .from('listing_settings')
        .update(settings)
        .eq('listing_id', listingId);

    if (error) {
        console.error('Error saving settings:', error);
        return false;
    }

    return true;
} 