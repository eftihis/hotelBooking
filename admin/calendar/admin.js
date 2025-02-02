// Utility function to get listing ID from URL
function getListingIdFromUrl() {
    const pathSegments = window.location.pathname.split('/');
    
    // If we're on the admin page, get the listing ID from query params
    if (pathSegments.includes('admin')) {
        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('listing_id');
        console.log('Listing ID from query params:', listingId);
        return listingId;
    }
    
    // Otherwise get it from the path
    const listingId = pathSegments[pathSegments.length - 1];
    console.log('Listing ID from URL:', listingId);
    return listingId;
}

// Add helper functions at the top of the file
function calculateNights(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatPrice(price) {
    return price?.toFixed(2) || '0.00';
}

// Keep this more robust version of formatDate and remove the other one
function formatDate(date) {
    console.log('formatDate received:', date, typeof date);
    
    try {
        // Handle different input types
        let d;
        if (date instanceof Date) {
            d = date;
        } else if (typeof date === 'number') {
            d = new Date(date);
        } else if (typeof date === 'string') {
            d = new Date(date);
        } else {
            console.error('Invalid date input:', date);
            return null;
        }

        // Validate the date is valid
        if (isNaN(d.getTime())) {
            console.error('Invalid date:', date);
            return null;
        }

        // Return in YYYY-MM-DD format
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch (error) {
        console.error('Error formatting date:', error, 'Input was:', date);
        return null;
    }
}

// Helper functions
function createDateRanges(selectedDates) {
    if (selectedDates.length === 0) return [];
    
    // If only one date is selected, treat it as a single-day range
    if (selectedDates.length === 1) {
        const date = new Date(selectedDates[0]);
        // Ensure we're working with local dates at noon to avoid timezone issues
        date.setHours(12, 0, 0, 0);
        return [{
            start: date,
            end: date
        }];
    }
    
    // Sort dates chronologically
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
        
        // Check if dates are consecutive
        const dayDiff = Math.round((currentDate - previousDate) / (1000 * 60 * 60 * 24));
        
        if (dayDiff > 1) {
            // End of a range
            ranges.push({
                start: rangeStart,
                end: previousDate
            });
            // Start new range
            rangeStart = currentDate;
        }
    }
    
    // Add the last range
    ranges.push({
        start: rangeStart,
        end: sortedDates[sortedDates.length - 1]
    });
    
    return ranges;
}

// Helper function to check if two periods overlap or are adjacent
function periodsOverlap(period1Start, period1End, period2Start, period2End) {
    const start1 = new Date(period1Start);
    const end1 = new Date(period1End);
    const start2 = new Date(period2Start);
    const end2 = new Date(period2End);
    
    start1.setHours(12, 0, 0, 0);
    end1.setHours(12, 0, 0, 0);
    start2.setHours(12, 0, 0, 0);
    end2.setHours(12, 0, 0, 0);
    
    // Check if periods overlap or are adjacent (within 1 day)
    return (start1 <= end2 && end1 >= start2) || 
           (Math.abs(end1.getTime() - start2.getTime()) <= 86400000) ||
           (Math.abs(end2.getTime() - start1.getTime()) <= 86400000);
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Admin logic initialized');
    
    // Get the listing ID
    const listingId = getListingIdFromUrl();
    console.log('Using listing ID:', listingId);

    // Only proceed if we have a valid listing ID
    if (!listingId) {
        console.error('No listing ID found');
        return;
    }

    // Remove Supabase initialization, use global instance
    const supabase = window.supabase;

    async function initializeAdminCalendar() {
        // Fetch settings, open dates, rates and bookings in parallel
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

        // Process bookings to create disabled dates based on gap days
        const gapDays = settingsResponse.data?.[0]?.gap_days || 0;
        const disabledDateRanges = [];
        
        if (bookingsResponse.data) {
            bookingsResponse.data.forEach(booking => {
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
                gapEnd.setDate(gapEnd.getDate() + gapDays - 1); // Adjust end date to include gap days after checkout
                
                // Add ranges to disabled dates
                if (gapDays > 0) {
                    // Add pre-booking gap
                    disabledDateRanges.push({
                        from: gapStart.toISOString().split('T')[0],
                        to: gapEndBefore.toISOString().split('T')[0]
                    });
                    
                    // Add post-booking gap
                    disabledDateRanges.push({
                        from: checkOut.toISOString().split('T')[0],  // Start from checkout date
                        to: gapEnd.toISOString().split('T')[0]
                    });
                }
                
                // Add the actual booking dates
                disabledDateRanges.push({
                    from: booking.check_in,
                    to: booking.check_out
                });
            });
        }

        // Create flatpickr with initial config
        const adminPicker = flatpickr("[data-element='admin-date-picker']", {
            mode: "multiple",
            inline: true,
            altInput: false,
            altFormat: "F j, Y",
            dateFormat: "Y-m-d",
            minDate: new Date().setFullYear(new Date().getFullYear() - 1),
            maxDate: new Date().setFullYear(new Date().getFullYear() + 1),
            baseRate: settingsResponse.data?.[0]?.base_rate || null,
            openPeriods: openPeriodsResponse.data || [],
            rates: ratesResponse.data || [],
            showMonths: 1,
            bookings: bookingsResponse.data || [],
            disable: disabledDateRanges,
            

            onDayCreate: function(dObj, dStr, fp, dayElem) {
                const currentDate = dayElem.dateObj;
                
                // Add past-date class for dates before today
                if (currentDate < new Date().setHours(0,0,0,0)) {
                    dayElem.classList.add('flatpickr-disabled');
                }
                
                // Format current date for comparison
                const formattedCurrentDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                
                // Wrap the date number in a span
                const dateContent = dayElem.innerHTML;
                dayElem.innerHTML = `<span class="day-number">${dateContent}</span>`;
                
                const openPeriod = fp.config.openPeriods.find(period => 
                    formattedCurrentDate >= period.start_date && 
                    formattedCurrentDate <= period.end_date
                );
                
                // Check for specific rate
                const specificRate = fp.config.rates.find(rate => 
                    formattedCurrentDate >= rate.start_date && 
                    formattedCurrentDate <= rate.end_date
                );
                
                // Create rate element
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

                    bookingStrip.onclick = function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        handleBookingClick(dayElem.dateObj);
                    };

                    bookingStrip.addEventListener('click', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        handleBookingClick(dayElem.dateObj);
                    }, true);

                    bookingStrip.addEventListener('mousedown', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        handleBookingClick(dayElem.dateObj);
                    }, true);

                    dayElem.appendChild(bookingStrip);
                    dayElem.classList.add('has-booking');
                }
            },

            onReady: function(selectedDates, dateStr, instance) {
                let isSelecting = false;
                let startDate = null;
                let isMouseDown = false;
                let isDragging = false;
                
                // Helper function to format dates for logging
                function formatDatesForLog(dates) {
                    return dates.map(date => date.toLocaleDateString()).join(', ');
                }
                
                // Helper function to log selection changes
                function logSelectionChange(action, dates) {
                    console.log(`%c${action}: ${dates.length} dates selected`, 'color: #4CAF50; font-weight: bold');
                    console.log('Selected dates:', formatDatesForLog(dates));
                }

                // Move detectDrag to outer scope
                let detectDrag = null;
                
                // Add mousedown event to calendar container
                instance.calendarContainer.addEventListener('mousedown', function(e) {
                    const dayElement = e.target.closest('.flatpickr-day');
                    if (!dayElement || dayElement.classList.contains('flatpickr-disabled')) return;
                    
                    console.log('Mouse down detected');
                    isMouseDown = true;
                    startDate = new Date(dayElement.dateObj);
                    const currentMonth = instance.currentMonth;
                    
                    // Store initial click position to detect drag
                    const initialX = e.clientX;
                    const initialY = e.clientY;
                    
                    // Define detectDrag function and store reference
                    detectDrag = function(moveEvent) {
                        if (!isMouseDown) return;
                        
                        const deltaX = Math.abs(moveEvent.clientX - initialX);
                        const deltaY = Math.abs(moveEvent.clientY - initialY);
                        
                        if (deltaX > 5 || deltaY > 5) {
                            isDragging = true;
                            isSelecting = true;
                            console.log('Drag detected');
                            document.removeEventListener('mousemove', detectDrag);
                        }
                    };
                    
                    document.addEventListener('mousemove', detectDrag);
                    
                    // If not dragging yet, handle as a click
                    if (!isDragging) {
                        const existingDates = [...instance.selectedDates];
                        const clickedDate = new Date(dayElement.dateObj);
                        
                        // Check if the clicked date is already selected
                        const dateExists = existingDates.some(date => 
                            date.toDateString() === clickedDate.toDateString()
                        );
                        
                        if (dateExists) {
                            // If date exists, remove it
                            const newDates = existingDates.filter(date => 
                                date.toDateString() !== clickedDate.toDateString()
                            );
                            instance.setDate(newDates);
                        } else {
                            // If date doesn't exist, add it to existing selection
                            instance.setDate([...existingDates, clickedDate]);
                        }
                    }
                    
                    // Restore the month view
                    instance.changeMonth(currentMonth, false);
                });
                
                // Add mousemove event to calendar container
                instance.calendarContainer.addEventListener('mousemove', function(e) {
                    if (!isMouseDown || !isDragging) return;
                    
                    const dayElement = e.target.closest('.flatpickr-day');
                    if (!dayElement || dayElement.classList.contains('flatpickr-disabled')) return;
                    
                    const currentDate = new Date(dayElement.dateObj);
                    const currentMonth = instance.currentMonth;
                    
                    if (isDragging) {
                        // During drag, merge with existing selection
                        const existingDates = instance.selectedDates.filter(date => {
                            // Keep dates that aren't in the current drag range
                            return date < Math.min(startDate, currentDate) || 
                                   date > Math.max(startDate, currentDate);
                        });
                        
                        const dragDates = getDatesInRange(startDate, currentDate);
                        instance.setDate([...existingDates, ...dragDates]);
                        
                        // Restore the month view
                        instance.changeMonth(currentMonth, false);
                    }
                });
                
                const handleGlobalMouseUp = function(e) {
                    if (isMouseDown) {
                        console.log('Selection ended');
                        if (instance.selectedDates.length > 0) {
                            logSelectionChange('Final selection', instance.selectedDates);
                        }
                        isMouseDown = false;
                        isSelecting = false;
                        isDragging = false;
                        startDate = null;
                        // Now detectDrag will be defined when we try to remove it
                        if (detectDrag) {
                            document.removeEventListener('mousemove', detectDrag);
                            detectDrag = null;
                        }
                    }
                };

                // Add mouseup handler to document
                document.addEventListener('mouseup', handleGlobalMouseUp);
                
                // Add mouseleave handler to calendar container
                instance.calendarContainer.addEventListener('mouseleave', function() {
                    console.log('Mouse left calendar area');
                    if (isMouseDown) {
                        console.log('Resetting selection state on mouseleave');
                        isMouseDown = false;
                        isSelecting = false;
                        isDragging = false;
                        startDate = null;
                    }
                });
                
                // Helper function to get all dates between two dates
                function getDatesInRange(start, end) {
                    const dates = [];
                    const startTime = new Date(start);
                    const endTime = new Date(end);
                    
                    // Ensure start is before end
                    const actualStart = startTime < endTime ? startTime : endTime;
                    const actualEnd = startTime < endTime ? endTime : startTime;
                    
                    // Create date range
                    let currentDate = new Date(actualStart);
                    while (currentDate <= actualEnd) {
                        dates.push(new Date(currentDate));
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                    
                    return dates;
                }
                
                // Clean up function
                instance._cleanup = function() {
                    document.removeEventListener('mouseup', handleGlobalMouseUp);
                };
            }
        });

        return adminPicker;
    }

    // Fetch both listing details and settings in parallel
    async function initializeListingPage() {
        console.log('Initializing listing page...');
        
        try {
            const [listingResponse, settingsResponse] = await Promise.all([
                supabase
                    .from('listings')
                    .select('name')
                    .eq('id', listingId)
                    .single(),
                supabase
                    .from('listing_settings')
                    .select('*')
                    .eq('listing_id', listingId)
            ]);

            console.log('Listing Response:', listingResponse);
            console.log('Settings Response:', settingsResponse);

            // Update listing name
            const listingNameElement = document.querySelector('[data-element="listing-name"]');
            if (listingResponse.data) {
                console.log('Setting listing name:', listingResponse.data.name);
                listingNameElement.textContent = listingResponse.data.name;
            } else {
                console.warn('No listing data found');
            }

            // Handle settings
            if (settingsResponse.data && settingsResponse.data.length > 0) {
                console.log('Found existing settings:', settingsResponse.data[0]);
                // Populate form with existing settings
                populateSettingsForm(settingsResponse.data[0]);
            } else {
                console.log('No settings found for this listing - using empty form');
                // Form will remain empty, ready for new settings
            }

        } catch (error) {
            console.error('Error initializing page:', error);
        }
    }

    function populateSettingsForm(settings) {
        const fieldMappings = {
            'base-rate-input': settings.base_rate,
            'max-guests-input': settings.max_guests,
            'extra-guest-input': settings.extra_guest_fee,
            'cleaning-fee-input': settings.cleaning_fee,
            'min-stay-input': settings.minimum_stay,
            'max-stay-input': settings.maximum_stay,
            'booking-gap-input': settings.gap_days,
            'weekly-discount-input': settings.weekly_discount_percentage * 100,
            'monthly-discount-input': settings.monthly_discount_percentage * 100
        };

        Object.entries(fieldMappings).forEach(([elementId, value]) => {
            const input = document.querySelector(`[data-element="${elementId}"]`);
            if (input && value !== null) {
                console.log(`Setting ${elementId} to ${value}`);
                input.value = value;
            }
        });
    }

    // Call the function
    initializeListingPage().catch(error => {
        console.error('Failed to initialize listing page:', error);
    });

    // Rest of your code remains the same...
    initializeAdminCalendar().then(adminPicker => {
        // Set rates button handler
        document.querySelector("[data-element='set-rates']").addEventListener('click', () => {
            document.querySelector('.ratesettings_wrap').classList.add('is-open');
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

        // Add this near your other event listeners
        document.querySelector("[data-element='save-listing-settings']").addEventListener('click', async () => {
            console.log('Save settings clicked');
            
            // Get all form values with proper parsing
            const settings = {
                listing_id: listingId,
                base_rate: Math.floor(parseFloat(document.querySelector('[data-element="base-rate-input"]').value)),
                max_guests: Math.floor(parseFloat(document.querySelector('[data-element="max-guests-input"]').value)),
                extra_guest_fee: Math.floor(parseFloat(document.querySelector('[data-element="extra-guest-input"]').value)),
                cleaning_fee: Math.floor(parseFloat(document.querySelector('[data-element="cleaning-fee-input"]').value)),
                minimum_stay: Math.floor(parseFloat(document.querySelector('[data-element="min-stay-input"]').value)),
                maximum_stay: Math.floor(parseFloat(document.querySelector('[data-element="max-stay-input"]').value)),
                gap_days: Math.floor(parseFloat(document.querySelector('[data-element="booking-gap-input"]').value)),
                weekly_discount_percentage: parseFloat(document.querySelector('[data-element="weekly-discount-input"]').value) / 100,
                monthly_discount_percentage: parseFloat(document.querySelector('[data-element="monthly-discount-input"]').value) / 100,
                updated_at: new Date().toISOString()
            };

            console.log('Settings to save:', settings);

            try {
                // First check if settings exist for this listing
                const { data: existingSettings } = await supabase
                    .from('listing_settings')
                    .select('*')
                    .eq('listing_id', listingId);

                let response;
                if (existingSettings && existingSettings.length > 0) {
                    // Update existing settings
                    response = await supabase
                        .from('listing_settings')
                        .update(settings)
                        .eq('listing_id', listingId);
                } else {
                    // Insert new settings
                    response = await supabase
                        .from('listing_settings')
                        .insert([{
                            ...settings,
                            created_at: new Date().toISOString()
                        }]);
                }

                if (response.error) {
                    console.error('Error saving settings:', response.error);
                    alert('Failed to save settings. Please try again.');
                } else {
                    console.log('Settings saved successfully:', response);
                    alert('Settings saved successfully!');
                }

            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred while saving settings.');
            }
        });

        // Add ESC key handler for calendar
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                // Clear calendar selection if dates are selected
                if (adminPicker.selectedDates.length > 0) {
                    console.log('Clearing calendar selection on ESC');
                    const currentMonth = adminPicker.currentMonth; // Store current month before operations
                    adminPicker.clear();
                    adminPicker.redraw();
                    adminPicker.changeMonth(currentMonth, false); // Restore the month view
                    // Hide any open UI elements
                    document.querySelector("[data-element='open-dates']").style.display = 'none';
                    document.querySelector("[data-element='close-dates']").style.display = 'none';
                    document.querySelector('.setrates_wrap').classList.remove('is-open');
                }
                // Keep existing modal close behavior
                const modal = document.querySelector('[data-element="booking-modal"]');
                if (modal?.classList.contains('is-visible')) {
                    console.log('Closing modal on escape key');
                    modal.style.display = 'none';
                    modal.classList.remove('is-visible');
                }
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

        document.querySelector("[data-element='close-dates']").addEventListener('click', async () => {
            console.log('Close dates button clicked');
            const currentMonth = adminPicker.currentMonth;
            const selectedDates = adminPicker.selectedDates;
            console.log('Selected dates:', selectedDates);
            
            if (selectedDates.length === 0) return;

            const dateRanges = createDateRanges(selectedDates);
            console.log('Processing close date ranges:', dateRanges);

            try {
                for (const range of dateRanges) {
                    const startDate = formatDate(range.start);
                    const endDate = formatDate(range.end);
                    
                    console.log('Closing dates from:', startDate, 'to:', endDate);
                    
                    // Find any open dates that overlap with our range
                    const { data: overlappingPeriods } = await supabase
                        .from('open_dates')
                        .select('*')
                        .eq('listing_id', listingId)
                        .or(`end_date.gte.${startDate},start_date.lte.${endDate}`);

                    console.log('Found overlapping open periods:', overlappingPeriods);

                    if (overlappingPeriods) {
                        for (const period of overlappingPeriods) {
                            if (!periodsOverlap(period.start_date, period.end_date, startDate, endDate)) {
                                console.log('Skipping non-overlapping period:', period);
                                continue;
                            }

                            console.log('Processing overlapping period:', period);

                            // Delete the original period
                            await supabase.from('open_dates').delete().eq('id', period.id);

                            // If period starts before our range
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

                            // If period ends after our range
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
                console.error('Error in close dates handler:', error);
            }
        });
    });

    // Add this after your DOM content loaded event
    function setupIntegerInputs() {
        // Fields that should only accept integers
        const integerFields = [
            'base-rate-input',
            'max-guests-input',
            'extra-guest-input',
            'cleaning-fee-input',
            'min-stay-input',
            'max-stay-input',
            'booking-gap-input'
        ];

           // Fields that can have decimals (percentage and tax)
           const decimalFields = [
            'nightstay-tax-input',
            'weekly-discount-input',
            'monthly-discount-input'
        ];

        integerFields.forEach(fieldId => {
            const input = document.querySelector(`[data-element="${fieldId}"]`);
            if (input) {
                // Prevent decimal input
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                });

                // Ensure integer on blur
                input.addEventListener('blur', (e) => {
                    const value = e.target.value;
                    if (value) {
                        e.target.value = Math.floor(parseFloat(value));
                    }
                });
            }
        });

     

        decimalFields.forEach(fieldId => {
            const input = document.querySelector(`[data-element="${fieldId}"]`);
            if (input) {
                // Allow decimals but clean input
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^0-9.]/g, '');
                    // Ensure only one decimal point
                    const parts = e.target.value.split('.');
                    if (parts.length > 2) {
                        e.target.value = parts[0] + '.' + parts.slice(1).join('');
                    }
                });
            }
        });

        // Special handling for percentage fields
        const percentageFields = [
            'weekly-discount-input',
            'monthly-discount-input'
        ];

        percentageFields.forEach(fieldId => {
            const input = document.querySelector(`[data-element="${fieldId}"]`);
            if (input) {
                // Convert decimal to percentage when displaying
                if (input.value) {
                    input.value = (parseFloat(input.value) * 100).toString();
                }

                // Allow only whole numbers for percentages
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                    // Ensure value doesn't exceed 100
                    if (parseInt(e.target.value) > 100) {
                        e.target.value = '100';
                    }
                });
            }
        });
    }

    // Call this function after DOM loads
    setupIntegerInputs();

    function setupBookingModal() {
        // Handle booking strip clicks
        document.addEventListener('click', async (e) => {
            if (e.target.closest('.booking-strip')) {
                const dayElem = e.target.closest('.flatpickr-day');
                const date = dayElem.dateObj;
                const formattedDate = date.toISOString().split('T')[0];

                // Find the booking that contains this date
                const { data: bookings, error } = await supabase
                    .from('bookings')
                    .select(`
                        *,
                        guests (*),
                        listings (name)
                    `)
                    .eq('listing_id', listingId)
                    .lte('check_in', formattedDate)
                    .gte('check_out', formattedDate)
                    .single();

                if (error) {
                    console.error('Error fetching booking:', error);
                    return;
                }

                if (!bookings) {
                    console.error('No booking found for this date');
                    return;
                }

                // Use stored booking values from the database
                const nights = bookings.total_nights || 0;
                const nightlyTotal = bookings.subtotal_nights || 0;
                const discountAmount = bookings.discount_total || 0;
                const cleaningFee = bookings.cleaning_fee || 0;
                const nightstayTaxAmount = bookings.nightstay_tax_total || 0;
                const totalPrice = bookings.final_total || 0;

                // Populate modal elements
                const modalElements = {
                    'guest-name': bookings.guests.name,
                    'listing-name': bookings.listings.name,
                    'check-in': bookings.check_in, // No need to format, already in YYYY-MM-DD
                    'check-out': bookings.check_out, // No need to format, already in YYYY-MM-DD
                    'total-nights': `${nights} nights`,
                    'total-price': `€${formatPrice(totalPrice)}`,
                    'confirmation-code': bookings.id || 'N/A',
                    'nightly-rate': `€${formatPrice(bookings.nightly_rate)}`,
                    'cleaning-fee': `€${formatPrice(cleaningFee)}`,
                    'discount-amount': `€${formatPrice(discountAmount)}`,
                    'nightstay-tax-amount': `€${formatPrice(nightstayTaxAmount)}`,
                    'total-guests': bookings.number_of_guests || 'N/A',
                    'booking-status': bookings.status || 'N/A',
                    'payment-status': bookings.payment_status || 'N/A'
                };

                // Update all elements in the modal
                Object.entries(modalElements).forEach(([element, value]) => {
                    const el = document.querySelector(`[data-element="booking-${element}"]`);
                    if (el) el.textContent = value;
                });

                // Show the modal
                document.querySelector('[data-element="booking-modal"]').classList.add('is-visible');
            }
        });

        // Handle modal closing
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-element="close-modal"]') || 
                e.target.matches('[data-element="modal-background"]')) {
                document.querySelector('[data-element="booking-modal"]').classList.remove('is-visible');
            }
        });
    }

    // Initialize the booking modal functionality
    setupBookingModal();

    // Modify handleBookingClick to ensure it's being called
    async function handleBookingClick(dateObj) {
        console.log('handleBookingClick called with date:', dateObj);
        
        // Ensure we're using the correct date by setting time to noon to avoid timezone issues
        const adjustedDate = new Date(dateObj);
        adjustedDate.setHours(12, 0, 0, 0);
        
        // Format date for query
        const formattedDate = adjustedDate.toISOString().split('T')[0];
        
        console.log('Using adjusted date for query:', formattedDate);
        
        // Find the booking that contains this date
        console.log('Fetching booking for listing:', listingId, 'and date:', formattedDate);
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select(`
                *,
                guests (*),
                listings (name)
            `)
            .eq('listing_id', listingId)
            .lte('check_in', formattedDate)
            .gte('check_out', formattedDate)
            .single();

        if (error) {
            console.error('Error fetching booking:', error);
            return;
        }

        if (!bookings) {
            console.error('No booking found for this date');
            return;
        }

        console.log('Found booking:', bookings);

        try {
            // Use stored booking values from the database
            const nights = bookings.total_nights || 0;
            const nightlyTotal = bookings.subtotal_nights || 0;
            const discountAmount = bookings.discount_total || 0;
            const cleaningFee = bookings.cleaning_fee || 0;
            const nightstayTaxAmount = bookings.nightstay_tax_total || 0;
            const totalPrice = bookings.final_total || 0;

            // Debug modal element
            const modal = document.querySelector('[data-element="booking-modal"]');
            console.log('Modal element:', modal);
            
            if (!modal) {
                console.error('Modal element not found!');
                return;
            }

            // Populate modal elements
            const modalElements = {
                'guest-name': bookings.guests.name,
                'listing-name': bookings.listings.name,
                'check-in': bookings.check_in, // No need to format, already in YYYY-MM-DD
                'check-out': bookings.check_out, // No need to format, already in YYYY-MM-DD
                'total-nights': `${nights} nights`,
                'total-price': `€${formatPrice(totalPrice)}`,
                'confirmation-code': bookings.id || 'N/A',
                'nightly-rate': `€${formatPrice(bookings.nightly_rate)}`,
                'cleaning-fee': `€${formatPrice(cleaningFee)}`,
                'discount-amount': `€${formatPrice(discountAmount)}`,
                'nightstay-tax-amount': `€${formatPrice(nightstayTaxAmount)}`,
                'total-guests': bookings.number_of_guests || 'N/A',
                'booking-status': bookings.status || 'N/A',
                'payment-status': bookings.payment_status || 'N/A'
            };

            // Update each modal element
            Object.entries(modalElements).forEach(([element, value]) => {
                const el = document.querySelector(`[data-element="booking-${element}"]`);
                if (el) {
                    console.log(`Found element booking-${element}, setting value:`, value);
                    el.textContent = value;
                } else {
                    console.error(`Element booking-${element} not found in DOM`);
                }
            });

            // Show the modal
            console.log('Attempting to show modal...');
            modal.style.display = 'block';
            modal.classList.add('is-visible');

        } catch (err) {
            console.error('Error processing booking:', err);
        }
    }

    // Add modal close handlers
    const modal = document.querySelector('[data-element="booking-modal"]');
    const closeButton = document.querySelector('[data-element="close-modal"]');
    
    if (modal) {
        // Close on background click
        modal.addEventListener('click', function(e) {
            console.log('Modal clicked:', e.target);
            console.log('Modal element:', modal);
            console.log('Is click target modal?', e.target === modal);
            console.log('Target classes:', e.target.classList);
            
            // Check if the click was on the modal background
            // We'll check both the modal itself and any element with modal_background class
            if (e.target === modal || e.target.classList.contains('modal_background')) {
                console.log('Closing modal on background click');
                modal.style.display = 'none';
                modal.classList.remove('is-visible');
            }
        });
    }

    if (closeButton) {
        // Close on close button click
        closeButton.addEventListener('click', function(e) {
            console.log('Closing modal on button click');
            e.preventDefault();
            modal.style.display = 'none';
            modal.classList.remove('is-visible');
        });
    }

    // Add escape key handler
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('is-visible')) {
            console.log('Closing modal on escape key');
            modal.style.display = 'none';
            modal.classList.remove('is-visible');
        }
    });
});