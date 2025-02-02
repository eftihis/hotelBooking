import { displayTaxItem, clearTaxList } from './taxDisplay';
import { setupTaxForm } from './taxForm';

export async function initializeTaxes(listingId) {
    console.log('Initializing taxes...');
    // Fetch predefined taxes for the select dropdown
    const { data: taxes, error } = await supabase
        .from('taxes')
        .select('*');

    if (error) {
        console.error('Error fetching taxes:', error);
        return { taxes: [], appliedTaxes: [] };
    }

    // Setup the add tax form
    setupTaxForm(taxes, listingId);

    // Fetch and display existing applied taxes for this listing
    const { data: appliedTaxes, error: appliedError } = await supabase
        .from('applied_taxes')
        .select(`
            *,
            taxes (
                name,
                calculation_type
            )
        `)
        .eq('listing_id', listingId);

    // Clear existing tax list and display fetched taxes
    clearTaxList();
    if (appliedTaxes) {
        appliedTaxes.forEach(tax => displayTaxItem(tax, listingId));
    }

    return {
        taxes,
        appliedTaxes: appliedError ? [] : appliedTaxes
    };
} 