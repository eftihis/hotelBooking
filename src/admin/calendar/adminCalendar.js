// Import utility functions
import { formatDate } from '../../shared/services/dateUtils';
import { formatPrice } from '../../shared/services/priceUtils';
import { createDateRanges, periodsOverlap } from './utils/dateUtils.js';
import { initializeBookingModal, showBookingDetails } from './components/bookingModal';
import { createBookingStrip } from './components/bookingStrip';
import { initializeFlatpickr } from './config/flatpickrConfig';
import { processBookingsForDisabledDates } from './utils/bookingUtils.js';

// Main Initialization Function
export async function initializeAdminCalendar(listingId) {
    console.log('Initializing admin calendar for listing:', listingId);
    
    if (!listingId) {
        console.error('No listing ID provided');
        return;
    }

    // Use the global supabase instance
    const supabase = window.supabase;

    try {
        // Fetch all necessary data in parallel
        const [settingsResponse, openPeriodsResponse, ratesResponse, bookingsResponse] = await Promise.all([
            supabase
                .from('listing_settings')
                .select('base_rate, gap_days')
                .eq('listing_id', listingId),
            supabase
                .from('open_dates')
                .select('*')
                .eq('listing_id', listingId),
            supabase
                .from('rates')
                .select('*')
                .eq('listing_id', listingId),
            supabase
                .from('bookings')
                .select(`
                    *,
                    guests (
                        name,
                        email,
                        phone
                    )
                `)
                .eq('listing_id', listingId)
        ]);

        // Initialize flatpickr
        const adminPicker = initializeFlatpickr({
            listingId,
            baseRate: settingsResponse.data?.[0]?.base_rate,
            openPeriods: openPeriodsResponse.data,
            rates: ratesResponse.data,
            bookings: bookingsResponse.data,
            disabledDateRanges: processBookingsForDisabledDates(bookingsResponse.data, settingsResponse.data?.[0]?.gap_days)
        });

        // Setup event handlers
        setupEventHandlers(adminPicker, listingId);

        return adminPicker;
    } catch (error) {
        console.error('Error initializing admin calendar:', error);
    }
}

// Event Handlers
function setupEventHandlers(adminPicker, listingId) {
    // Initialize the booking modal
    initializeBookingModal();
    
    // Set rates button handler
    document.querySelector("[data-element='set-rates']").addEventListener('click', () => {
        document.querySelector("[data-element='rate-container']").classList.add('is-open');
        const rateInput = document.querySelector("[data-element='rate-input']");
        if (rateInput) rateInput.focus();
    });

     // Apply rate button handler
     document.querySelector("[data-element='apply-rate']").addEventListener('click', async () => {
        const currentMonth = adminPicker.currentMonth;
        const selectedDates = adminPicker.selectedDates;
        if (selectedDates.length === 0) return;

        // Get and validate the rate
        const rateInput = document.querySelector("[data-element='rate-input']");
        const rate = parseInt(rateInput.value);
        if (isNaN(rate) || rate <= 0 || rate > 32767) {
            alert('Please enter a valid rate between 1 and 32767');
            return;
        }

        // Get our sorted ranges from the selection
        const dateRanges = createDateRanges(selectedDates);
        console.log('Processing rate ranges:', dateRanges);

        try {
            // Process each range independently
            for (const range of dateRanges) {
                const startDate = formatDate(range.start);
                const endDate = formatDate(range.end);
                
                console.log('Processing range:', { startDate, endDate, rate });

                // Find nearby periods
                const { data: nearbyPeriods } = await supabase
                    .from('rates')
                    .select('*')
                    .eq('listing_id', listingId)
                    .or(`end_date.gte.${startDate},start_date.lte.${endDate}`);

                console.log('Found nearby periods:', nearbyPeriods?.map(p => ({
                    start: p.start_date,
                    end: p.end_date,
                    rate: p.rate
                })));

                // First, check if our new period completely encompasses any existing periods
                const isFullOverride = nearbyPeriods.every(period => 
                    new Date(startDate) <= new Date(period.start_date) && 
                    new Date(endDate) >= new Date(period.end_date)
                );

                console.log('Is full override?', isFullOverride);

                if (isFullOverride) {
                    // Delete all existing periods in range
                    for (const period of nearbyPeriods) {
                        console.log('Deleting encompassed period:', period);
                        await supabase.from('rates').delete().eq('id', period.id);
                    }

                    await supabase.from('rates').insert({
                        listing_id: listingId,
                        start_date: startDate,
                        end_date: endDate,
                        rate: rate,
                        created_at: new Date().toISOString()
                    });
                } else {
                    // Expand search to include adjacent periods
                    const { data: extendedPeriods } = await supabase
                        .from('rates')
                        .select('*')
                        .eq('listing_id', listingId)
                        .or(
                            `end_date.gte.${formatDate(new Date(new Date(startDate).getTime() - 86400000))},` +
                            `start_date.lte.${formatDate(new Date(new Date(endDate).getTime() + 86400000))}`
                        );

                    console.log('Extended search periods:', extendedPeriods?.map(p => ({
                        start: p.start_date,
                        end: p.end_date,
                        rate: p.rate
                    })));

                    const shouldMerge = extendedPeriods.some(period => {
                        const overlaps = periodsOverlap(period.start_date, period.end_date, startDate, endDate);
                        const isAdjacent = Math.abs(new Date(period.end_date) - new Date(startDate)) <= 86400000 ||
                                          Math.abs(new Date(period.start_date) - new Date(endDate)) <= 86400000;
                        
                        // Only consider periods for merging if they have the same rate AND either overlap
                        // or are adjacent AND fall within our selected date range
                        return period.rate === rate && (
                            overlaps || 
                            (isAdjacent && (
                                (new Date(period.start_date) >= new Date(startDate) && new Date(period.end_date) <= new Date(endDate)) ||
                                (new Date(period.end_date) >= new Date(startDate) && new Date(period.end_date) <= new Date(endDate)) ||
                                (new Date(period.start_date) >= new Date(startDate) && new Date(period.start_date) <= new Date(endDate))
                            ))
                        );
                    });

                    console.log('Should merge periods?', shouldMerge);

                    if (shouldMerge) {
                        // Merge periods with same rate
                        const periodsToMerge = extendedPeriods.filter(p => {
                            const overlaps = periodsOverlap(p.start_date, p.end_date, startDate, endDate);
                            const isAdjacent = Math.abs(new Date(p.end_date) - new Date(startDate)) <= 86400000 ||
                                              Math.abs(new Date(p.start_date) - new Date(endDate)) <= 86400000;
                            return p.rate === rate && (overlaps || isAdjacent);
                        });

                        console.log('Periods to merge:', periodsToMerge);

                        // When finding periods to delete, we need to be more precise
                        const periodsToDelete = extendedPeriods.filter(p => 
                            (periodsOverlap(p.start_date, p.end_date, startDate, endDate) && new Date(p.end_date) <= new Date(endDate)) ||
                            periodsToMerge.some(mp => mp.id === p.id)
                        );

                        console.log('Periods to delete:', periodsToDelete);

                        // Find the full range to cover
                        const allDates = [...periodsToMerge, { start_date: startDate, end_date: endDate }];
                        const earliestStart = allDates.reduce((earliest, period) => {
                            const periodStart = new Date(period.start_date);
                            return periodStart < earliest ? periodStart : earliest;
                        }, new Date(startDate));

                        const latestEnd = allDates.reduce((latest, period) => {
                            const periodEnd = new Date(period.end_date);
                            return periodEnd > latest ? periodEnd : latest;
                        }, new Date(endDate));

                        // Delete all affected periods
                        for (const period of periodsToDelete) {
                            console.log('Deleting period:', period);
                            await supabase.from('rates').delete().eq('id', period.id);
                        }

                        // Create merged period
                        await supabase.from('rates').insert({
                            listing_id: listingId,
                            start_date: formatDate(earliestStart),
                            end_date: formatDate(latestEnd),
                            rate: rate,
                            created_at: new Date().toISOString()
                        });
                    } else {
                        console.log('Handling non-mergeable periods');
                        // Handle overlapping periods with different rates
                        for (const period of extendedPeriods) {
                            const overlaps = periodsOverlap(period.start_date, period.end_date, startDate, endDate);
                            console.log('Checking period for split:', {
                                period,
                                overlaps,
                                'different rate': period.rate !== rate
                            });

                            if (overlaps) {
                                // Delete original period
                                console.log('Deleting overlapping period:', period);
                                await supabase.from('rates').delete().eq('id', period.id);

                                // Create before period if needed
                                if (new Date(period.start_date) < new Date(startDate)) {
                                    const beforeEnd = new Date(startDate);
                                    beforeEnd.setDate(beforeEnd.getDate() - 1);
                                    
                                    const beforePeriod = {
                                        listing_id: listingId,
                                        start_date: period.start_date,
                                        end_date: formatDate(beforeEnd),
                                        rate: period.rate,
                                        created_at: new Date().toISOString()
                                    };
                                    console.log('Creating before period:', beforePeriod);
                                    await supabase.from('rates').insert(beforePeriod);
                                }

                                // Create after period if needed
                                if (new Date(period.end_date) > new Date(endDate)) {
                                    const afterStart = new Date(endDate);
                                    afterStart.setDate(afterStart.getDate() + 1);
                                    
                                    const afterPeriod = {
                                        listing_id: listingId,
                                        start_date: formatDate(afterStart),
                                        end_date: period.end_date,
                                        rate: period.rate,
                                        created_at: new Date().toISOString()
                                    };
                                    console.log('Creating after period:', afterPeriod);
                                    await supabase.from('rates').insert(afterPeriod);
                                }
                            }
                        }

                        // Create new period
                        const newPeriod = {
                            listing_id: listingId,
                            start_date: startDate,
                            end_date: endDate,
                            rate: rate,
                            created_at: new Date().toISOString()
                        };
                        console.log('Creating new period:', newPeriod);
                        await supabase.from('rates').insert(newPeriod);
                    }
                }
            }

            // Update calendar with all rates
            const { data: updatedRates } = await supabase
                .from('rates')
                .select('*')
                .eq('listing_id', listingId);
                
            adminPicker.config.rates = updatedRates || [];
            
            // Clear and redraw
            adminPicker.clear();
            adminPicker.redraw();
            adminPicker.changeMonth(currentMonth, false);

            // Clear the rate input
            rateInput.value = '';

        } catch (error) {
            console.error('Error in apply rate handler:', error);
        }
    });

    // Reset rates button handler
    document.querySelector("[data-element='reset-rates']").addEventListener('click', async () => {
        const currentMonth = adminPicker.currentMonth;
        const selectedDates = adminPicker.selectedDates;
        if (selectedDates.length === 0) return;

        const dateRanges = createDateRanges(selectedDates);
        console.log('Processing ranges for rate reset:', dateRanges);

        try {
            for (const range of dateRanges) {
                const startDate = formatDate(range.start);
                const endDate = formatDate(range.end);
                
                console.log('Resetting rates from:', startDate, 'to:', endDate);
                
                // Find any rates that overlap with our date range
                const { data: overlappingRates } = await supabase
                    .from('rates')
                    .select('*')
                    .eq('listing_id', listingId)
                    .or(`end_date.gte.${startDate},start_date.lte.${endDate}`);

                console.log('Found overlapping rates:', overlappingRates);

                // Process each overlapping period
                for (const period of overlappingRates || []) {
                    // Skip if the period doesn't actually overlap
                    const periodStart = new Date(period.start_date);
                    const periodEnd = new Date(period.end_date);
                    const rangeStart = new Date(startDate);
                    const rangeEnd = new Date(endDate);

                    if (periodEnd < rangeStart || periodStart > rangeEnd) {
                        console.log('Skipping non-overlapping period:', period);
                        continue;
                    }

                    // Delete the original period
                    await supabase.from('rates').delete().eq('id', period.id);

                    // If the period starts before our range, create a "before" period
                    if (periodStart < rangeStart) {
                        const beforeEndDate = new Date(startDate);
                        beforeEndDate.setDate(beforeEndDate.getDate() - 1);
                        await supabase
                            .from('rates')
                            .insert({
                                listing_id: listingId,
                                start_date: period.start_date,
                                end_date: formatDate(beforeEndDate),
                                rate: period.rate,
                                created_at: new Date().toISOString()
                            });
                    }

                    // If the period ends after our range, create an "after" period
                    if (periodEnd > rangeEnd) {
                        const afterStartDate = new Date(endDate);
                        afterStartDate.setDate(afterStartDate.getDate() + 1);
                        await supabase
                            .from('rates')
                            .insert({
                                listing_id: listingId,
                                start_date: formatDate(afterStartDate),
                                end_date: period.end_date,
                                rate: period.rate,
                                created_at: new Date().toISOString()
                            });
                    }
                }
            }

            // Update calendar
            const { data: updatedRates } = await supabase
                .from('rates')
                .select('*')
                .eq('listing_id', listingId);

            console.log('Final updated rates:', updatedRates);
            adminPicker.config.rates = updatedRates || [];
            
            // Clear and redraw
            adminPicker.clear();
            adminPicker.redraw();
            adminPicker.changeMonth(currentMonth, false);

        } catch (error) {
            console.error('Error in reset rates handler:', error);
        }
    });

    // Open dates button handler
    document.querySelector("[data-element='open-dates']").addEventListener('click', async () => {
        console.log('Open dates button clicked');
        const currentMonth = adminPicker.currentMonth;
        const selectedDates = adminPicker.selectedDates;
        console.log('Selected dates:', selectedDates);
        
        if (selectedDates.length === 0) return;

        const dateRanges = createDateRanges(selectedDates);
        console.log('Processing open date ranges:', dateRanges);

        try {
            for (const range of dateRanges) {
                const startDate = formatDate(range.start);
                const endDate = formatDate(range.end);
                
                console.log('Opening dates from:', startDate, 'to:', endDate);
                
                // Find any open dates that overlap with our range
                const { data: overlappingPeriods } = await supabase
                    .from('open_dates')
                    .select('*')
                    .eq('listing_id', listingId)
                    .or(`end_date.gte.${startDate},start_date.lte.${endDate}`);

                console.log('Found overlapping open periods:', overlappingPeriods);

                // If we have overlapping periods, merge them
                if (overlappingPeriods && overlappingPeriods.length > 0) {
                    // Find the earliest start and latest end dates
                    let earliestStart = new Date(startDate);
                    let latestEnd = new Date(endDate);

                    for (const period of overlappingPeriods) {
                        if (!periodsOverlap(period.start_date, period.end_date, startDate, endDate)) {
                            console.log('Skipping non-overlapping period:', period);
                            continue;
                        }

                        console.log('Processing overlapping period:', period);
                        
                        const periodStart = new Date(period.start_date);
                        const periodEnd = new Date(period.end_date);

                        if (periodStart < earliestStart) earliestStart = periodStart;
                        if (periodEnd > latestEnd) latestEnd = periodEnd;

                        // Delete the overlapping period as we'll create a merged one
                        await supabase.from('open_dates').delete().eq('id', period.id);
                    }

                    // Create the merged period
                    await supabase
                        .from('open_dates')
                        .insert({
                            listing_id: listingId,
                            start_date: formatDate(earliestStart),
                            end_date: formatDate(latestEnd),
                            created_at: new Date().toISOString()
                        });

                } else {
                    // No overlapping periods, just create a new one
                    await supabase
                        .from('open_dates')
                        .insert({
                            listing_id: listingId,
                            start_date: startDate,
                            end_date: endDate,
                            created_at: new Date().toISOString()
                        });
                }
            }

            // Update calendar
            const { data: updatedOpenDates } = await supabase
                .from('open_dates')
                .select('*')
                .eq('listing_id', listingId);
                
            console.log('Updated open dates:', updatedOpenDates);
            adminPicker.config.openPeriods = updatedOpenDates || [];
            
            // Clear and redraw
            adminPicker.clear();
            adminPicker.redraw();
            adminPicker.changeMonth(currentMonth, false);

        } catch (error) {
            console.error('Error in open dates handler:', error);
        }
    });

    // Close dates button handler
    document.querySelector("[data-element='close-dates']").addEventListener('click', async () => {
        const currentMonth = adminPicker.currentMonth;
        const selectedDates = adminPicker.selectedDates;
        if (selectedDates.length === 0) return;

        const dateRanges = createDateRanges(selectedDates);

        try {
            for (const range of dateRanges) {
                const startDate = formatDate(range.start);
                const endDate = formatDate(range.end);
                
                const { data: overlappingPeriods } = await supabase
                    .from('open_dates')
                    .select('*')
                    .eq('listing_id', listingId)
                    .or(`end_date.gte.${startDate},start_date.lte.${endDate}`);

                if (overlappingPeriods) {
                    for (const period of overlappingPeriods) {
                        if (!periodsOverlap(period.start_date, period.end_date, startDate, endDate)) continue;

                        await supabase.from('open_dates').delete().eq('id', period.id);

                        if (new Date(period.start_date) < new Date(startDate)) {
                            const beforeEndDate = new Date(startDate);
                            beforeEndDate.setDate(beforeEndDate.getDate() - 1);
                            
                            await supabase
                                .from('open_dates')
                                .insert({
                                    listing_id: listingId,
                                    start_date: period.start_date,
                                    end_date: formatDate(beforeEndDate),
                                    created_at: new Date().toISOString()
                                });
                        }

                        if (new Date(period.end_date) > new Date(endDate)) {
                            const afterStartDate = new Date(endDate);
                            afterStartDate.setDate(afterStartDate.getDate() + 1);
                            
                            await supabase
                                .from('open_dates')
                                .insert({
                                    listing_id: listingId,
                                    start_date: formatDate(afterStartDate),
                                    end_date: period.end_date,
                                    created_at: new Date().toISOString()
                                });
                        }
                    }
                }
            }

            const { data: updatedOpenDates } = await supabase
                .from('open_dates')
                .select('*')
                .eq('listing_id', listingId);
                
            adminPicker.config.openPeriods = updatedOpenDates || [];
            
            adminPicker.clear();
            adminPicker.redraw();
            adminPicker.changeMonth(currentMonth, false);

        } catch (error) {
            console.error('Error in close dates handler:', error);
        }
    });
}

function setupBookingModal(listingId) {
    // ... exact setupBookingModal code from admin.js ...
}

async function handleBookingClick(dateObj) {
    // ... exact handleBookingClick code from admin.js ...
}