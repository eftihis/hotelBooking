export function getListingIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('listing_id');
} 