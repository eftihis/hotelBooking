// Import utility functions
import { formatDate } from '../../shared/services/dateUtils';
import { formatPrice } from '../../shared/services/priceUtils';

// Helper functions
function createDateRanges(selectedDates) {
    if (selectedDates.length === 0) return [];
    
    if (selectedDates.length === 1) {
        const date = new Date(selectedDates[0]);
        date.setHours(12, 0, 0, 0);
        return [{
            start: date,
            end: date
        }];
    }
    
    const sortedDates = [...selectedDates].sort((a, b) => a - b).map(date => {
        const d = new Date(date);
        d.setHours(12, 0, 0, 0);
        return d;
    });
    
    const ranges = [];
    let rangeStart = sortedDates[0];
    
    for (let i = 1; i < sortedDates.length; i++) {
        const currentDate = sortedDates[i];
        const previousDate = sortedDates[i - 1];
        const dayDiff = Math.round((currentDate - previousDate) / (1000 * 60 * 60 * 24));
        
        if (dayDiff > 1) {
            ranges.push({
                start: rangeStart,
                end: previousDate
            });
            rangeStart = currentDate;
        }
    }
    
    ranges.push({
        start: rangeStart,
        end: sortedDates[sortedDates.length - 1]
    });
    
    return ranges;
}

function periodsOverlap(period1Start, period1End, period2Start, period2End) {
    const start1 = new Date(period1Start);
    const end1 = new Date(period1End);
    const start2 = new Date(period2Start);
    const end2 = new Date(period2End);
    
    start1.setHours(12, 0, 0, 0);
    end1.setHours(12, 0, 0, 0);
    start2.setHours(12, 0, 0, 0);
    end2.setHours(12, 0, 0, 0);
    
    return (start1 <= end2 && end1 >= start2) || 
           (Math.abs(end1.getTime() - start2.getTime()) <= 86400000) ||
           (Math.abs(end2.getTime() - start1.getTime()) <= 86400000);
}

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

        // Process bookings to create disabled dates
        const gapDays = settingsResponse.data?.[0]?.gap_days || 0;
        const disabledDateRanges = processBookingsForDisabledDates(bookingsResponse.data, gapDays);

        // Initialize flatpickr
        const adminPicker = initializeFlatpickr({
            listingId,
            baseRate: settingsResponse.data?.[0]?.base_rate,
            openPeriods: openPeriodsResponse.data,
            rates: ratesResponse.data,
            bookings: bookingsResponse.data,
            disabledDateRanges
        });

        // Setup event handlers
        setupEventHandlers(adminPicker, listingId);

        return adminPicker;
    } catch (error) {
        console.error('Error initializing admin calendar:', error);
    }
}

function processBookingsForDisabledDates(bookings, gapDays) {
    const disabledDateRanges = [];
    
    if (bookings) {
        bookings.forEach(booking => {
            const checkIn = new Date(booking.check_in);
            const checkOut = new Date(booking.check_out);
            
            // Calculate gap dates before check-in
            const gapStart = new Date(checkIn);
            gapStart.setDate(gapStart.getDate() - gapDays);
            const gapEndBefore = new Date(checkIn);
            gapEndBefore.setDate(gapEndBefore.getDate() - 1);
            
            // Calculate gap dates after check-out
            const gapStartAfter = new Date(checkOut);
            const gapEnd = new Date(checkOut);
            gapEnd.setDate(gapEnd.getDate() + gapDays - 1);
            
            if (gapDays > 0) {
                disabledDateRanges.push({
                    from: gapStart.toISOString().split('T')[0],
                    to: gapEndBefore.toISOString().split('T')[0]
                });
                
                disabledDateRanges.push({
                    from: checkOut.toISOString().split('T')[0],
                    to: gapEnd.toISOString().split('T')[0]
                });
            }
            
            disabledDateRanges.push({
                from: booking.check_in,
                to: booking.check_out
            });
        });
    }
    return disabledDateRanges;
}

function initializeFlatpickr(config) {
    return flatpickr("[data-element='admin-date-picker']", {
        mode: "multiple",
        inline: true,
        altInput: false,
        altFormat: "F j, Y",
        dateFormat: "Y-m-d",
        minDate: new Date().setFullYear(new Date().getFullYear() - 1),
        maxDate: new Date().setFullYear(new Date().getFullYear() + 1),
        baseRate: config.baseRate || null,
        openPeriods: config.openPeriods || [],
        rates: config.rates || [],
        showMonths: 1,
        bookings: config.bookings || [],
        disable: config.disabledDateRanges,
        
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const currentDate = dayElem.dateObj;
            
            if (currentDate < new Date().setHours(0,0,0,0)) {
                dayElem.classList.add('flatpickr-disabled');
            }
            
            const formattedCurrentDate = formatDate(currentDate);
            
            const dateContent = dayElem.innerHTML;
            dayElem.innerHTML = `<span class="day-number">${dateContent}</span>`;
            
            const openPeriod = fp.config.openPeriods.find(period => 
                formattedCurrentDate >= period.start_date && 
                formattedCurrentDate <= period.end_date
            );
            
            const specificRate = fp.config.rates.find(rate => 
                formattedCurrentDate >= rate.start_date && 
                formattedCurrentDate <= rate.end_date
            );
            
            const rateElement = document.createElement('span');
            rateElement.className = 'day-rate';
            
            if (specificRate) {
                rateElement.textContent = `€ ${specificRate.rate}`;
            } else if (fp.config.baseRate) {
                rateElement.textContent = `€ ${fp.config.baseRate}`;
            } else {
                rateElement.textContent = '-';
            }
            
            dayElem.appendChild(rateElement);
            
            if (!openPeriod) {
                dayElem.classList.add('blocked-date');
            }

            // Add booking indicator if date is booked
            const booking = fp.config.bookings?.find(booking => 
                formattedCurrentDate >= booking.check_in && 
                formattedCurrentDate <= booking.check_out
            );

            if (booking) {
                const bookingStrip = document.createElement('div');
                bookingStrip.className = 'booking-strip';
                
                // Add classes for start and end dates
                if (formattedCurrentDate === booking.check_in) {
                    bookingStrip.classList.add('booking-start');
                    if (booking.guests?.name) {
                        const guestName = document.createElement('span');
                        guestName.className = 'guest-name';
                        guestName.textContent = booking.guests.name;
                        bookingStrip.appendChild(guestName);
                    }
                }
                if (formattedCurrentDate === booking.check_out) {
                    bookingStrip.classList.add('booking-end');
                }

                dayElem.appendChild(bookingStrip);
                dayElem.classList.add('has-booking');
            }
        },

        onReady: function(selectedDates, dateStr, instance) {
            let isSelecting = false;
            let startDate = null;
            let isMouseDown = false;
            let isDragging = false;
            let detectDrag = null;
            
            instance.calendarContainer.addEventListener('mousedown', function(e) {
                const dayElement = e.target.closest('.flatpickr-day');
                if (!dayElement || dayElement.classList.contains('flatpickr-disabled')) return;
                
                isMouseDown = true;
                startDate = new Date(dayElement.dateObj);
                const currentMonth = instance.currentMonth;
                
                const initialX = e.clientX;
                const initialY = e.clientY;
                
                detectDrag = function(moveEvent) {
                    if (!isMouseDown) return;
                    
                    const deltaX = Math.abs(moveEvent.clientX - initialX);
                    const deltaY = Math.abs(moveEvent.clientY - initialY);
                    
                    if (deltaX > 5 || deltaY > 5) {
                        isDragging = true;
                        isSelecting = true;
                        document.removeEventListener('mousemove', detectDrag);
                    }
                };
                
                document.addEventListener('mousemove', detectDrag);
                
                if (!isDragging) {
                    const existingDates = [...instance.selectedDates];
                    const clickedDate = new Date(dayElement.dateObj);
                    
                    const dateExists = existingDates.some(date => 
                        date.toDateString() === clickedDate.toDateString()
                    );
                    
                    if (dateExists) {
                        const newDates = existingDates.filter(date => 
                            date.toDateString() !== clickedDate.toDateString()
                        );
                        instance.setDate(newDates);
                    } else {
                        instance.setDate([...existingDates, clickedDate]);
                    }
                }
                
                instance.changeMonth(currentMonth, false);
            });

            instance.calendarContainer.addEventListener('mousemove', function(e) {
                if (!isMouseDown || !isDragging) return;
                
                const dayElement = e.target.closest('.flatpickr-day');
                if (!dayElement || dayElement.classList.contains('flatpickr-disabled')) return;
                
                const currentDate = new Date(dayElement.dateObj);
                const currentMonth = instance.currentMonth;
                
                if (isDragging) {
                    const existingDates = instance.selectedDates.filter(date => {
                        return date < Math.min(startDate, currentDate) || 
                               date > Math.max(startDate, currentDate);
                    });
                    
                    const dragDates = getDatesInRange(startDate, currentDate);
                    instance.setDate([...existingDates, ...dragDates]);
                    
                    instance.changeMonth(currentMonth, false);
                }
            });

            const handleGlobalMouseUp = function() {
                if (isMouseDown) {
                    isMouseDown = false;
                    isSelecting = false;
                    isDragging = false;
                    startDate = null;
                    if (detectDrag) {
                        document.removeEventListener('mousemove', detectDrag);
                        detectDrag = null;
                    }
                }
            };

            document.addEventListener('mouseup', handleGlobalMouseUp);
            
            instance.calendarContainer.addEventListener('mouseleave', function() {
                if (isMouseDown) {
                    isMouseDown = false;
                    isSelecting = false;
                    isDragging = false;
                    startDate = null;
                }
            });
            
            function getDatesInRange(start, end) {
                const dates = [];
                const startTime = new Date(start);
                const endTime = new Date(end);
                
                const actualStart = startTime < endTime ? startTime : endTime;
                const actualEnd = startTime < endTime ? endTime : startTime;
                
                let currentDate = new Date(actualStart);
                while (currentDate <= actualEnd) {
                    dates.push(new Date(currentDate));
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                
                return dates;
            }
            
            instance._cleanup = function() {
                document.removeEventListener('mouseup', handleGlobalMouseUp);
            };
        }
    });
}

// Event Handlers
function setupEventHandlers(adminPicker, listingId) {
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
                        
                        console.log('Checking period for merge:', {
                            period: {
                                start: period.start_date,
                                end: period.end_date,
                                rate: period.rate
                            },
                            overlaps,
                            isAdjacent,
                            'same rate': period.rate === rate,
                            'should merge': (overlaps || isAdjacent) && period.rate === rate
                        });
                        return (overlaps || isAdjacent) && period.rate === rate;
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

                        // Find all periods that need to be deleted (including different rates in the range)
                        const periodsToDelete = extendedPeriods.filter(p => 
                            periodsOverlap(p.start_date, p.end_date, startDate, endDate) ||
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

    // ESC key handler
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (adminPicker.selectedDates.length > 0) {
                const currentMonth = adminPicker.currentMonth;
                adminPicker.clear();
                adminPicker.redraw();
                adminPicker.changeMonth(currentMonth, false);
                document.querySelector("[data-element='open-dates']").style.display = 'none';
                document.querySelector("[data-element='close-dates']").style.display = 'none';
                document.querySelector('.setrates_wrap').classList.remove('is-open');
            }
        }
    });
}

function setupBookingModal(listingId) {
    // ... exact setupBookingModal code from admin.js ...
}

async function handleBookingClick(dateObj) {
    // ... exact handleBookingClick code from admin.js ...
}