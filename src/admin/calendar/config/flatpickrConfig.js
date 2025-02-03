import { createBookingStrip } from '../components/bookingStrip';

export function initializeFlatpickr({ listingId, baseRate, openPeriods, rates, bookings, disabledDateRanges }) {
    // Create flatpickr with initial config
    const adminPicker = flatpickr("[data-element='admin-date-picker']", {
        mode: "multiple",
        inline: true,
        altInput: false,
        altFormat: "F j, Y",
        dateFormat: "Y-m-d",
        minDate: new Date().setFullYear(new Date().getFullYear() - 1),
        maxDate: new Date().setFullYear(new Date().getFullYear() + 1),
        baseRate: baseRate || null,
        openPeriods: openPeriods || [],
        rates: rates || [],
        showMonths: 1,
        bookings: bookings || [],
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
                const bookingStrip = createBookingStrip(booking, formattedCurrentDate);
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