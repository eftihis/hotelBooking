import { initializeTaxes } from './appliedTaxes';

export function setupTaxForm(availableTaxes, listingId, appliedTaxes = []) {
    // Get form elements
    const addTaxButtonWrap = document.querySelector('.add_tax_btn_wrap');
    const addTaxForm = document.querySelector('[data-element="add-tax-form"]');
    const taxSelect = document.querySelector('[data-element="tax-select"]');
    const rateInput = document.querySelector('[data-element="tax-rate-input"]');
    let submitBtn = document.querySelector('[data-element="submit-tax"]');
    let addTaxButton = document.querySelector('[data-element="add-tax-button"]');
    
    console.log('Setting up tax form with taxes:', availableTaxes);

    // Remove existing event listeners by cloning and replacing elements
    if (addTaxButton) {
        const newAddTaxButton = addTaxButton.cloneNode(true);
        addTaxButton.parentNode.replaceChild(newAddTaxButton, addTaxButton);
        addTaxButton = newAddTaxButton;
    }

    if (submitBtn) {
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        submitBtn = newSubmitBtn;
    }

    // Get array of already applied tax IDs
    const appliedTaxIds = appliedTaxes.map(tax => tax.tax_id);
    console.log('Already applied tax IDs:', appliedTaxIds);

    // Filter out already applied taxes
    const availableTaxesToAdd = availableTaxes.filter(tax => 
        !appliedTaxIds.includes(tax.id)
    );
    console.log('Available taxes to add:', availableTaxesToAdd);

    // Hide add tax button wrap if no taxes are available to add
    if (addTaxButtonWrap) {
        if (availableTaxesToAdd.length === 0) {
            addTaxButtonWrap.style.display = 'none';
        } else {
            addTaxButtonWrap.style.display = '';
        }
    }

    // Initially hide the form
    if (addTaxForm) {
        addTaxForm.style.display = 'none';
    }

    // Add Tax button click handler
    if (addTaxButton) {
        addTaxButton.addEventListener('click', () => {
            console.log('Add Tax button clicked');
            if (addTaxForm) {
                addTaxForm.style.display = 'flex';
            }
        });
    }

    // Populate tax dropdown with only available taxes
    if (taxSelect && availableTaxesToAdd.length > 0) {
        // Clear existing options (except the first 'Choose tax' option)
        while (taxSelect.options.length > 1) {
            taxSelect.remove(1);
        }

        // Add available tax options
        availableTaxesToAdd.forEach(tax => {
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
                addTaxForm.style.display = 'none';
                
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

// Add this new function to handle select options update
export async function updateTaxSelectOptions(listingId) {
    // Fetch all available taxes
    const { data: allTaxes } = await supabase
        .from('taxes')
        .select('*');

    // Fetch current applied taxes
    const { data: appliedTaxes } = await supabase
        .from('applied_taxes')
        .select('*')
        .eq('listing_id', listingId);

    if (!allTaxes) return;

    // Get array of already applied tax IDs
    const appliedTaxIds = appliedTaxes?.map(tax => tax.tax_id) || [];

    // Filter out already applied taxes
    const availableTaxesToAdd = allTaxes.filter(tax => 
        !appliedTaxIds.includes(tax.id)
    );

    // Update select options
    const taxSelect = document.querySelector('[data-element="tax-select"]');
    if (taxSelect) {
        // Clear existing options (except the first 'Choose tax' option)
        while (taxSelect.options.length > 1) {
            taxSelect.remove(1);
        }

        // Add available tax options
        availableTaxesToAdd.forEach(tax => {
            const option = document.createElement('option');
            option.value = tax.id;
            option.textContent = tax.name;
            taxSelect.appendChild(option);
        });
    }

    return availableTaxesToAdd.length;
} 