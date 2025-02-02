import { updateTaxSelectOptions } from './taxForm';

function formatTaxRate(rate, calculationType) {
    switch (calculationType) {
        case 'percentage':
            return `${rate}%`;
        case 'flat':
            return `€${rate}`;
        case 'per_night':
            return `€${rate}/night`;
        default:
            return rate;
    }
}

export function displayTaxItem(tax, listingId) {
    console.log('Attempting to display tax:', tax);

    // Get the container where tax items should be displayed
    const taxList = document.querySelector('[data-element="applied-taxes-list"]');
    console.log('Tax list container:', taxList);

    // Get the template
    const template = document.querySelector('[data-element="tax-item"]');
    console.log('Template element:', template);

    if (!taxList || !template) {
        console.error('Required elements not found:', {
            taxList: !!taxList,
            template: !!template
        });
        return;
    }

    // Clone the template
    const taxItem = template.cloneNode(true);
    
    // Make sure the cloned item is visible
    taxItem.style.display = 'block';
    
    // Set unique identifiers
    taxItem.setAttribute('data-applied-tax-id', tax.id);
    taxItem.setAttribute('data-tax-id', tax.tax_id);

    // Update tax details
    const nameElement = taxItem.querySelector('[data-element="tax-name"]');
    const rateElement = taxItem.querySelector('[data-element="tax-rate"]');
    
    console.log('Found elements:', {
        nameElement: !!nameElement,
        rateElement: !!rateElement,
        taxName: tax.taxes?.name,
        taxRate: tax.rate,
        calculationType: tax.taxes?.calculation_type
    });

    if (nameElement) nameElement.textContent = tax.taxes.name;
    if (rateElement) {
        rateElement.textContent = formatTaxRate(tax.rate, tax.taxes.calculation_type);
    }

    // Setup toggle switch
    const toggle = taxItem.querySelector('[data-element="tax-toggle"]');
    if (toggle) {
        toggle.checked = tax.is_active;
        toggle.addEventListener('change', async (e) => {
            const success = await toggleTax(tax.id, e.target.checked);
            if (!success) {
                e.target.checked = !e.target.checked;
            }
        });
    }

    // Setup remove button
    const removeBtn = taxItem.querySelector('[data-element="remove-tax"]');
    if (removeBtn) {
        removeBtn.addEventListener('click', async () => {
            const success = await removeTax(tax.id, listingId);
            if (success) {
                taxItem.remove();
            }
        });
    }

    // Add the new tax item to the list
    taxList.appendChild(taxItem);
    console.log('Tax item added to list:', {
        display: taxItem.style.display,
        visible: taxItem.offsetHeight > 0
    });
}

export async function toggleTax(appliedTaxId, isActive) {
    console.log('Toggling tax:', { appliedTaxId, isActive });
    
    const { error } = await supabase
        .from('applied_taxes')
        .update({ is_active: isActive })
        .eq('id', appliedTaxId);

    if (error) {
        console.error('Error toggling tax:', error);
        return false;
    }

    return true;
}

export async function removeTax(appliedTaxId, listingId) {
    const { error } = await supabase
        .from('applied_taxes')
        .delete()
        .eq('id', appliedTaxId);

    if (error) {
        console.error('Error removing tax:', error);
        return false;
    }

    // Update select options and get count of available taxes
    const availableTaxCount = await updateTaxSelectOptions(listingId);

    // Show add tax button if there are taxes available to add
    const addTaxButtonWrap = document.querySelector('.add_tax_btn_wrap');
    if (addTaxButtonWrap && availableTaxCount > 0) {
        addTaxButtonWrap.style.display = '';
    }

    return true;
}

export function clearTaxList() {
    console.log('Clearing tax list');
    const taxList = document.querySelector('[data-element="applied-taxes-list"]');
    if (taxList) {
        // Keep the template
        const template = taxList.querySelector('[data-element="tax-item"]');
        taxList.innerHTML = '';
        if (template) {
            template.style.display = 'none';
            taxList.appendChild(template);
        }
    }
} 