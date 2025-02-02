import { initializeTaxes } from './appliedTaxes';

export function setupTaxForm(availableTaxes, listingId) {
    // Get form elements
    const addTaxButton = document.querySelector('[data-element="add-tax-button"]');
    const addTaxForm = document.querySelector('[data-element="add-tax-form"]');
    const taxSelect = document.querySelector('[data-element="tax-select"]');
    const rateInput = document.querySelector('[data-element="tax-rate-input"]');
    const submitBtn = document.querySelector('[data-element="submit-tax"]');
    
    console.log('Setting up tax form with taxes:', availableTaxes);

    // Initially hide the form
    if (addTaxForm) {
        addTaxForm.style.display = 'none';
    }

    // Add Tax button click handler
    if (addTaxButton) {
        addTaxButton.addEventListener('click', () => {
            console.log('Add Tax button clicked');
            if (addTaxForm) {
                addTaxForm.style.display = 'flex'; // Show the form when button is clicked
            }
        });
    }

    // Populate tax dropdown
    if (taxSelect && availableTaxes) {
        // Clear existing options (except the first 'Choose tax' option)
        while (taxSelect.options.length > 1) {
            taxSelect.remove(1);
        }

        // Add tax options
        availableTaxes.forEach(tax => {
            const option = document.createElement('option');
            option.value = tax.id;
            option.textContent = tax.name;
            taxSelect.appendChild(option);
        });
    }

    // Handle form submission
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const selectedTaxId = taxSelect.value;
            const rate = parseFloat(rateInput.value);

            if (!selectedTaxId || !rate) {
                console.error('Please select a tax and enter a rate');
                return;
            }

            const success = await addTax(listingId, selectedTaxId, rate);
            if (success) {
                // Clear form
                taxSelect.value = '';
                rateInput.value = '';
                addTaxForm.style.display = 'none'; // Hide form after successful submission
                
                // Refresh tax list
                const { appliedTaxes } = await initializeTaxes(listingId);
                console.log('Taxes refreshed after adding new tax');
            }
        });
    }
}

async function addTax(listingId, taxId, rate) {
    console.log('Adding tax:', { listingId, taxId, rate });

    const { data, error } = await supabase
        .from('applied_taxes')
        .insert([
            {
                listing_id: listingId,
                tax_id: taxId,
                rate: rate,
                is_active: true
            }
        ]);

    if (error) {
        console.error('Error adding tax:', error);
        return false;
    }

    return true;
} 