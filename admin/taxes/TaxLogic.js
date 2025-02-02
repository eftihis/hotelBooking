document.addEventListener('DOMContentLoaded', async function() {
    console.log('TaxLogic.js loaded');
    const supabase = window.supabase;
    const listingId = getListingIdFromUrl();
    console.log('Listing ID:', listingId);

    // Add Tax button click handler
    const addTaxButton = document.querySelector('[data-element="add-tax-button"]');
    const addTaxForm = document.querySelector('[data-element="add-tax-form"]');
    
    console.log('Add Tax Button:', addTaxButton);
    console.log('Add Tax Form:', addTaxForm);

    addTaxButton.addEventListener('click', () => {
        console.log('Add Tax button clicked');
        addTaxForm.style.display = 'flex'; // or whatever display value matches your design
    });

    // Submit tax handler
    const submitTaxButton = document.querySelector('[data-element="submit-tax"]');
    submitTaxButton.addEventListener('click', async () => {
        console.log('Submit tax clicked');
        
        // Get form values with updated selector
        const taxSelect = document.querySelector('[data-element="tax-select"]');
        const taxRateInput = document.querySelector('[data-element="tax-rate-input"]');
        
        console.log('Tax rate input element:', taxRateInput);
        console.log('Tax rate input value:', taxRateInput?.value);
        console.log('Selected tax:', taxSelect.value);

        // Validate inputs
        if (!taxSelect.value) {
            console.error('Please select a tax');
            return;
        }

        if (!taxRateInput || !taxRateInput.value) {
            console.error('Please enter a tax rate');
            return;
        }

        const rate = parseFloat(taxRateInput.value);
        if (isNaN(rate)) {
            console.error('Please enter a valid number for tax rate');
            return;
        }

        try {
            // Insert new applied tax
            const { data, error } = await supabase
                .from('applied_taxes')
                .insert({
                    listing_id: listingId,
                    tax_id: taxSelect.value,
                    rate: rate,
                    is_active: true
                })
                .select(`
                    *,
                    taxes (
                        name,
                        calculation_type
                    )
                `)
                .single();

            if (error) throw error;

            console.log('Tax applied successfully:', data);

            // Display the new tax
            displayAppliedTax(data);

            // Clear and hide form
            taxSelect.value = '';
            taxRateInput.value = '';
            addTaxForm.style.display = 'none';

        } catch (error) {
            console.error('Error applying tax:', error);
        }
    });

    // Initialize tax functionality
    async function initializeTaxes() {
        console.log('Initializing taxes...');
        // Fetch predefined taxes for the select dropdown
        const { data: taxes, error } = await supabase
            .from('taxes')
            .select('*');

        if (error) {
            console.error('Error fetching taxes:', error);
            return;
        }
        console.log('Fetched predefined taxes:', taxes);

        // Populate tax select dropdown
        const taxSelect = document.querySelector('[data-element="tax-select"]');
        console.log('Tax select element:', taxSelect);
        
        taxes.forEach(tax => {
            const option = document.createElement('option');
            option.value = tax.id;
            option.textContent = tax.name;
            taxSelect.appendChild(option);
        });

        // Fetch and display existing applied taxes for this listing
        await loadAppliedTaxes();
    }

    // Load existing applied taxes
    async function loadAppliedTaxes() {
        console.log('Loading applied taxes...');
        const { data: appliedTaxes, error } = await supabase
            .from('applied_taxes')
            .select(`
                *,
                taxes (
                    name,
                    calculation_type
                )
            `)
            .eq('listing_id', listingId);

        if (error) {
            console.error('Error fetching applied taxes:', error);
            return;
        }
        console.log('Fetched applied taxes:', appliedTaxes);

        // Display each applied tax
        appliedTaxes.forEach(displayAppliedTax);
    }

    // Function to display an applied tax in the list
    function displayAppliedTax(appliedTax) {
        console.log('Displaying tax:', appliedTax);
        const taxList = document.querySelector('[data-element="applied-taxes-list"]');
        const template = document.querySelector('[data-element="tax-item"]');
        
        // First time setup - hide template
        if (template.style.display !== 'none') {
            template.style.display = 'none';
        }
        
        // Clone the template
        const taxItem = template.cloneNode(true);
        console.log('Cloned tax item before style:', taxItem.style.display);
        
        // Explicitly set display to flex (or whatever display type you need)
        taxItem.style.display = 'block';
        console.log('Cloned tax item after style:', taxItem.style.display);
        
        // Set tax data attributes
        taxItem.dataset.taxId = appliedTax.tax_id;
        taxItem.dataset.appliedTaxId = appliedTax.id;
        
        // Set tax name and rate
        const nameElement = taxItem.querySelector('[data-element="tax-name"]');
        const rateElement = taxItem.querySelector('[data-element="tax-rate"]');
        
        if (nameElement) nameElement.textContent = appliedTax.taxes.name;
        if (rateElement) rateElement.textContent = formatTaxRate(appliedTax.rate, appliedTax.taxes.calculation_type);
        
        // Set toggle state
        const toggle = taxItem.querySelector('[data-element="tax-toggle"]');
        if (toggle) {
            toggle.checked = appliedTax.is_active;
            toggle.addEventListener('change', async (e) => {
                console.log('Toggle changed:', e.target.checked);
                try {
                    const { error } = await supabase
                        .from('applied_taxes')
                        .update({ is_active: e.target.checked })
                        .eq('id', appliedTax.id);

                    if (error) throw error;
                    console.log('Tax status updated successfully');
                } catch (error) {
                    console.error('Error updating tax status:', error);
                    // Revert toggle if update failed
                    e.target.checked = !e.target.checked;
                }
            });
        }

        // Add delete handler
        const deleteButton = taxItem.querySelector('[data-element="remove-tax"]');
        if (deleteButton) {
            deleteButton.addEventListener('click', async () => {
                console.log('Delete clicked for tax:', appliedTax.id);
                try {
                    const { error } = await supabase
                        .from('applied_taxes')
                        .delete()
                        .eq('id', appliedTax.id);

                    if (error) throw error;
                    console.log('Tax deleted successfully');
                    
                    // Remove the item from UI
                    taxItem.remove();
                } catch (error) {
                    console.error('Error deleting tax:', error);
                }
            });
        }

        // Add to list
        taxList.appendChild(taxItem);
        console.log('Added tax item to list with display:', taxItem.style.display);
    }

    // Helper function to format tax rate based on type
    function formatTaxRate(rate, type) {
        console.log('Formatting rate:', rate, 'type:', type);
        switch (type) {
            case 'percentage':
                return `${rate}%`;
            case 'per_night':
                return `€${rate} per night`;
            case 'flat':
                return `€${rate}`;
            default:
                return `€${rate}`;
        }
    }

    // Initialize on load
    console.log('Starting initialization...');
    initializeTaxes();
});