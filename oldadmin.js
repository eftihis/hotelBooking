// Utility function to get listing ID from URL
function getListingIdFromUrl() {
    const pathSegments = window.location.pathname.split('/');
    
    // If we're on the admin-dashboard page, get the listing ID from query params
    if (pathSegments.includes('admin-dashboard-copy-2')) {
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

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
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

    // Get listing ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const listingIdFromUrl = urlParams.get('listing_id');
    console.log('Listing ID from URL:', listingIdFromUrl);

    async function initializeAdminCalendar() {
        // Get listing ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('listing_id');
        
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
            mode: "range",
            inline: true,
            altInput: true,
            altFormat: "F j, Y",
            dateFormat: "Y-m-d",
            minDate: new Date().setFullYear(new Date().getFullYear() - 1),
            maxDate: new Date().setFullYear(new Date().getFullYear() + 1),
            baseRate: settingsResponse.data?.[0]?.base_rate || null,
            openPeriods: openPeriodsResponse.data || [],
            rates: ratesResponse.data || [],
            showMonths: 1,
            showOutsideDays: false,
            animate: true,
            position: "center center",
            bookings: bookingsResponse.data || [],
            disable: disabledDateRanges,
            
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) {
                    document.querySelector("[data-element='open-dates']").style.display = 'block';
                    document.querySelector("[data-element='close-dates']").style.display = 'block';
                    document.querySelector('.setrates_wrap').classList.add('is-open');
                }
            },

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
                    console.log('Creating booking strip for date:', formattedCurrentDate);
                    const bookingStrip = document.createElement('div');
                    bookingStrip.className = 'booking-strip';
                    
                    // Add classes for start and end dates
                    if (formattedCurrentDate === booking.check_in) {
                        bookingStrip.classList.add('booking-start');
                        // Only add guest name on the first day of booking
                        if (booking.guests?.name) {
                            console.log('Adding guest name to calendar:', booking.guests.name);
                            const guestName = document.createElement('span');
                            guestName.className = 'guest-name';
                            guestName.textContent = booking.guests.name;
                            bookingStrip.appendChild(guestName);
                        }
                    }
                    if (formattedCurrentDate === booking.check_out) {
                        bookingStrip.classList.add('booking-end');
                    }

                    // Test click handler
                    console.log('Adding click handler to booking strip');
                    bookingStrip.onclick = function(e) {
                        console.log('Booking strip clicked - onclick');
                        e.stopPropagation();
                        e.preventDefault();
                        handleBookingClick(dayElem.dateObj);
                    };

                    // Backup click handler
                    bookingStrip.addEventListener('click', function(e) {
                        console.log('Booking strip clicked - addEventListener');
                        e.stopPropagation();
                        e.preventDefault();
                        handleBookingClick(dayElem.dateObj);
                    }, true);

                    // Test mousedown handler as well
                    bookingStrip.addEventListener('mousedown', function(e) {
                        console.log('Booking strip mousedown');
                        e.stopPropagation();
                        e.preventDefault();
                        handleBookingClick(dayElem.dateObj);
                    }, true);

                    dayElem.appendChild(bookingStrip);
                    dayElem.classList.add('has-booking');

                    // Verify the element is clickable
                    console.log('Booking strip element:', bookingStrip);
                    console.log('Booking strip click handlers:', bookingStrip.onclick);
                }
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
            const [start, end] = adminPicker.selectedDates;
            if (!start || !end) return;

            // Get and validate the rate
            const rateInput = document.querySelector("[data-element='rate-input']");
            const rate = parseInt(rateInput.value);
            if (isNaN(rate) || rate <= 0 || rate > 32767) {
                alert('Please enter a valid rate between 1 and 32767');
                return;
            }

            // Format dates using local timezone
            const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
            const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

            // First, check for any existing periods that overlap with our date range
            const { data: existingRates, error: checkError } = await supabase
                .from('rates')
                .select('*')
                .eq('listing_id', listingId)
                .or(`end_date.gte.${startDate},start_date.lte.${endDate}`);

            if (checkError) {
                console.error('Error checking rates:', checkError);
                return;
            }

            console.log('Existing rates in range:', existingRates);

            // Group periods by rate
            const sameRatePeriods = existingRates?.filter(period => period.rate === rate) || [];
            const differentRatePeriods = existingRates?.filter(period => period.rate !== rate) || [];

            // Handle periods with the same rate first (merge them)
            if (sameRatePeriods.length > 0) {
                const allDates = [...sameRatePeriods, { start_date: startDate, end_date: endDate }];
                const earliestStart = allDates.reduce((earliest, period) => {
                    return new Date(period.start_date) < new Date(earliest) ? period.start_date : earliest;
                }, startDate);

                const latestEnd = allDates.reduce((latest, period) => {
                    return new Date(period.end_date) > new Date(latest) ? period.end_date : latest;
                }, endDate);

                // Delete the existing same-rate periods
                for (const period of sameRatePeriods) {
                    await supabase.from('rates').delete().eq('id', period.id);
                }

                // Create the merged period
                await supabase.from('rates').insert({
                    listing_id: listingId,
                    start_date: earliestStart,
                    end_date: latestEnd,
                    rate: rate,
                    created_at: new Date().toISOString()
                });
            }

            // Handle periods with different rates
            for (const period of differentRatePeriods) {
                // Delete the original period
                await supabase.from('rates').delete().eq('id', period.id);

                // Create before period if needed
                if (new Date(period.start_date) < new Date(startDate)) {
                    const beforeEndDate = new Date(startDate);
                    beforeEndDate.setDate(beforeEndDate.getDate() - 1);
                    const formattedBeforeEnd = beforeEndDate.toISOString().split('T')[0];
                    
                    await supabase.from('rates').insert({
                        listing_id: listingId,
                        start_date: period.start_date,
                        end_date: formattedBeforeEnd,
                        rate: period.rate,
                        created_at: new Date().toISOString()
                    });
                }

                // Create after period if needed
                if (new Date(period.end_date) > new Date(endDate)) {
                    const afterStartDate = new Date(endDate);
                    afterStartDate.setDate(afterStartDate.getDate() + 1);
                    const formattedAfterStart = afterStartDate.toISOString().split('T')[0];
                    
                    await supabase.from('rates').insert({
                        listing_id: listingId,
                        start_date: formattedAfterStart,
                        end_date: period.end_date,
                        rate: period.rate,
                        created_at: new Date().toISOString()
                    });
                }
            }

            // Insert the new rate period if it wasn't merged with existing ones
            if (sameRatePeriods.length === 0) {
                await supabase.from('rates').insert({
                    listing_id: listingId,
                    start_date: startDate,
                    end_date: endDate,
                    rate: rate,
                    created_at: new Date().toISOString()
                });
            }

            // Fetch updated rates
            const { data: updatedRates } = await supabase
                .from('rates')
                .select('*')
                .eq('listing_id', listingId);

            // Update the calendar config
            adminPicker.config.rates = updatedRates || [];
            
            // Clear first, then redraw and change to stored month
            adminPicker.clear();
            adminPicker.redraw();
            adminPicker.changeMonth(currentMonth, false);

            // Clear the rate input and hide the rate settings
            rateInput.value = '';
            document.querySelector('.ratesettings_wrap').classList.remove('is-open');
        });

        // Open dates handler
        document.querySelector("[data-element='open-dates']").addEventListener('click', async () => {
            const currentMonth = adminPicker.currentMonth;
            const [start, end] = adminPicker.selectedDates;
            if (!start || !end) return;

            // Format dates using local timezone
            const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
            const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

            console.log('Opening dates from:', startDate, 'to:', endDate);

            // Check for truly adjacent or overlapping periods
            const { data: nearbyPeriods, error: checkError } = await supabase
                .from('open_dates')
                .select('*')
                .eq('listing_id', listingId)
                .or(`end_date.gte.${startDate},start_date.lte.${endDate}`);

            if (checkError) {
                console.error('Error:', checkError);
                return;
            }

            console.log('Nearby periods:', nearbyPeriods);

            if (nearbyPeriods && nearbyPeriods.length > 0) {
                // Check if periods are truly adjacent (1 day gap or less)
                const shouldMerge = nearbyPeriods.some(period => {
                    const periodStart = new Date(period.start_date);
                    const periodEnd = new Date(period.end_date);
                    const newStart = new Date(startDate);
                    const newEnd = new Date(endDate);

                    // Check if periods are adjacent or overlapping
                    const daysBefore = (newStart - periodEnd) / (1000 * 60 * 60 * 24);
                    const daysAfter = (periodStart - newEnd) / (1000 * 60 * 60 * 24);

                    return daysBefore <= 1 && daysBefore >= -1 || daysAfter <= 1 && daysAfter >= -1;
                });

                if (shouldMerge) {
                    // Find the earliest start date and latest end date among adjacent periods
                    const allDates = [...nearbyPeriods, { start_date: startDate, end_date: endDate }];
                    const earliestStart = allDates.reduce((earliest, period) => {
                        const periodStart = new Date(period.start_date);
                        const currentEarliest = new Date(earliest);
                        return periodStart < currentEarliest ? period.start_date : earliest;
                    }, startDate);

                    const latestEnd = allDates.reduce((latest, period) => {
                        const periodEnd = new Date(period.end_date);
                        const currentLatest = new Date(latest);
                        return periodEnd > currentLatest ? period.end_date : latest;
                    }, endDate);

                    console.log('Merging periods - start:', earliestStart, 'end:', latestEnd);

                    // Delete all existing periods that will be merged
                    for (const period of nearbyPeriods) {
                        const { error: deleteError } = await supabase
                            .from('open_dates')
                            .delete()
                            .eq('id', period.id);

                        if (deleteError) {
                            console.error('Error deleting period:', deleteError);
                            return;
                        }
                    }

                    // Insert the merged period
                    const { error: insertError } = await supabase
                        .from('open_dates')
                        .insert({
                            listing_id: listingId,
                            start_date: earliestStart,
                            end_date: latestEnd
                        });

                    if (insertError) {
                        console.error('Error:', insertError);
                        return;
                    }
                } else {
                    // Create new period if not adjacent
                    console.log('Creating new period:', startDate, 'to', endDate);
                    const { error } = await supabase
                        .from('open_dates')
                        .insert({
                            listing_id: listingId,
                            start_date: startDate,
                            end_date: endDate
                        });

                    if (error) {
                        console.error('Error:', error);
                        return;
                    }
                }
            } else {
                // No nearby periods, create new one
                console.log('Creating new period:', startDate, 'to', endDate);
                const { error } = await supabase
                    .from('open_dates')
                    .insert({
                        listing_id: listingId,
                        start_date: startDate,
                        end_date: endDate
                    });

                if (error) {
                    console.error('Error:', error);
                    return;
                }
            }

            // Update the calendar with filtered data
            const { data: updatedPeriods } = await supabase
                .from('open_dates')
                .select('*')
                .eq('listing_id', listingId);
            
            adminPicker.config.openPeriods = updatedPeriods || [];
            adminPicker.redraw();

            // Clear first, then redraw and change to stored month
            adminPicker.clear();
            adminPicker.redraw();
            adminPicker.changeMonth(currentMonth, false);
        });

        // Close dates handler
        document.querySelector("[data-element='close-dates']").addEventListener('click', async () => {
            const currentMonth = adminPicker.currentMonth;
            const [start, end] = adminPicker.selectedDates;
            if (!start || !end) return;

            // Format dates using local timezone
            const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
            const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

            console.log('Closing dates from:', startDate, 'to:', endDate);

            // First, fetch all potentially affected periods
            const { data: affectedPeriods, error: fetchError } = await supabase
                .from('open_dates')
                .select('*')
                .filter('start_date', 'lte', endDate)
                .filter('end_date', 'gte', startDate);

            if (fetchError) {
                console.error('Error:', fetchError);
                return;
            }

            console.log('Affected periods:', affectedPeriods);

            // For each affected period, delete it and create new non-overlapping periods
            for (const period of affectedPeriods || []) {
                console.log('Processing period:', period);
                
                // Delete the original period
                const { error: deleteError } = await supabase
                    .from('open_dates')
                    .delete()
                    .eq('id', period.id);

                if (deleteError) {
                    console.error('Error deleting period:', deleteError);
                    return;
                }

                // Create before period if exists
                if (new Date(period.start_date) < new Date(startDate)) {
                    const beforeEndDate = new Date(startDate);
                    beforeEndDate.setDate(beforeEndDate.getDate() - 1);
                    const formattedBeforeEnd = `${beforeEndDate.getFullYear()}-${String(beforeEndDate.getMonth() + 1).padStart(2, '0')}-${String(beforeEndDate.getDate()).padStart(2, '0')}`;
                    
                    console.log('Creating before period:', period.start_date, 'to', formattedBeforeEnd);
                    const { error: beforeError } = await supabase
                        .from('open_dates')
                        .insert({
                            listing_id: listingId,
                            start_date: period.start_date,
                            end_date: formattedBeforeEnd
                        });

                    if (beforeError) {
                        console.error('Error creating before period:', beforeError);
                        return;
                    }
                }

                // Create after period if exists
                if (new Date(period.end_date) > new Date(endDate)) {
                    const afterStartDate = new Date(endDate);
                    afterStartDate.setDate(afterStartDate.getDate() + 1);
                    const formattedAfterStart = `${afterStartDate.getFullYear()}-${String(afterStartDate.getMonth() + 1).padStart(2, '0')}-${String(afterStartDate.getDate()).padStart(2, '0')}`;
                    
                    console.log('Creating after period:', formattedAfterStart, 'to', period.end_date);
                    const { error: afterError } = await supabase
                        .from('open_dates')
                        .insert({
                            listing_id: listingId,
                            start_date: formattedAfterStart,
                            end_date: period.end_date
                        });

                    if (afterError) {
                        console.error('Error creating after period:', afterError);
                        return;
                    }
                }
            }

            // Fetch updated open periods
            const { data: updatedPeriods, error: updateError } = await supabase
                .from('open_dates')
                .select('*');

            if (updateError) {
                console.error('Error fetching updated periods:', updateError);
                return;
            }
            
            console.log('Updated periods:', updatedPeriods);
            
            // Update the openPeriods in the calendar config
            adminPicker.config.openPeriods = updatedPeriods || [];
            // Redraw the calendar
            adminPicker.redraw();

            // Clear first, then redraw and change to stored month
            adminPicker.clear();
            adminPicker.redraw();
            adminPicker.changeMonth(currentMonth, false);
        });

        // Reset rates button handler
        document.querySelector("[data-element='reset-rates']").addEventListener('click', async () => {
            const currentMonth = adminPicker.currentMonth; // Store current month before operations
            const [start, end] = adminPicker.selectedDates;
            if (!start || !end) return;

            // Format dates using local timezone
            const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
            const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

            // Find any rates that overlap with our date range
            const { data: existingRates, error: checkError } = await supabase
                .from('rates')
                .select('*')
                .eq('listing_id', listingId)
                .or(`end_date.gte.${startDate},start_date.lte.${endDate}`);

            if (checkError) {
                console.error('Error checking rates:', checkError);
                return;
            }

            console.log('Existing rates to process:', existingRates);

            // Process each overlapping rate period
            for (const period of existingRates || []) {
                // Delete the original period
                await supabase.from('rates').delete().eq('id', period.id);

                // Create before period if needed
                if (new Date(period.start_date) < new Date(startDate)) {
                    const beforeEndDate = new Date(startDate);
                    beforeEndDate.setDate(beforeEndDate.getDate() - 1);
                    const formattedBeforeEnd = beforeEndDate.toISOString().split('T')[0];
                    
                    await supabase.from('rates').insert({
                        listing_id: listingId,
                        start_date: period.start_date,
                        end_date: formattedBeforeEnd,
                        rate: period.rate,
                        created_at: new Date().toISOString()
                    });
                }

                // Create after period if needed
                if (new Date(period.end_date) > new Date(endDate)) {
                    const afterStartDate = new Date(endDate);
                    afterStartDate.setDate(afterStartDate.getDate() + 1);
                    const formattedAfterStart = afterStartDate.toISOString().split('T')[0];
                    
                    await supabase.from('rates').insert({
                        listing_id: listingId,
                        start_date: formattedAfterStart,
                        end_date: period.end_date,
                        rate: period.rate,
                        created_at: new Date().toISOString()
                    });
                }
            }

            // Fetch updated rates
            const { data: updatedRates } = await supabase
                .from('rates')
                .select('*')
                .eq('listing_id', listingId);

            // Update the calendar config
            adminPicker.config.rates = updatedRates || [];
            
            // Clear first, then redraw and change to stored month
            adminPicker.clear();
            adminPicker.redraw();
            adminPicker.changeMonth(currentMonth, false);
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
                    'check-in': formatDate(bookings.check_in),
                    'check-out': formatDate(bookings.check_out),
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
                console.error('Modal element not found! Please check if the HTML contains an element with data-element="booking-modal"');
                return;
            }

            // Populate modal elements
            const modalElements = {
                'guest-name': bookings.guests.name,
                'listing-name': bookings.listings.name,
                'check-in': formatDate(bookings.check_in),
                'check-out': formatDate(bookings.check_out),
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

            // Debug each modal element
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
            modal.style.display = 'block'; // Add explicit display
            modal.classList.add('is-visible');
            console.log('Modal classes after adding is-visible:', modal.classList.toString());
            console.log('Modal display style:', modal.style.display);
            console.log('Modal visibility:', window.getComputedStyle(modal).visibility);
            console.log('Modal opacity:', window.getComputedStyle(modal).opacity);

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