import { formatDate } from '../../../shared/utils/dateUtils';
import { createDateRanges, periodsOverlap } from '../utils/dateUtils';

export async function handleOpenDates(adminPicker, listingId) {
    console.log('Open dates button clicked');
    const currentMonth = adminPicker.currentMonth;
    const selectedDates = adminPicker.selectedDates;
    console.log('Selected dates:', selectedDates);
    
    if (selectedDates.length === 0) return;

    const dateRanges = createDateRanges(selectedDates);
    console.log('Processing open date ranges:', dateRanges);

    try {
        const supabase = window.supabase;
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
}

export async function handleCloseDates(adminPicker, listingId) {
    const currentMonth = adminPicker.currentMonth;
    const selectedDates = adminPicker.selectedDates;
    if (selectedDates.length === 0) return;

    const dateRanges = createDateRanges(selectedDates);

    try {
        const supabase = window.supabase;
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
} 