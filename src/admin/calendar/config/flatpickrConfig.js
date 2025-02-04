import flatpickr from "../flatpickr.js";
import "../styles/flatpickrStyles.css";
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
            let isDown = false;  // renamed from isMouseDown to be device-agnostic
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

            // Helper function to get element from event (works for both touch and mouse)
            function getElementFromEvent(e) {
                const point = e.touches ? e.touches[0] : e;
                return document.elementFromPoint(point.clientX, point.clientY);
            }

            // Helper function to get coordinates from event
            function getCoordinates(e) {
                return {
                    x: e.touches ? e.touches[0].clientX : e.clientX,
                    y: e.touches ? e.touches[0].clientY : e.clientY
                };
            }

            let detectDrag = null;
            
            // Handle start of interaction (touch or mouse)
            function handleStart(e) {
                const dayElement = e.target.closest('.flatpickr-day');
                if (!dayElement || dayElement.classList.contains('flatpickr-disabled')) return;
                
                console.log('Interaction start detected');
                isDown = true;
                isDragging = false;
                startDate = new Date(dayElement.dateObj);
                
                // Store the initial selection when drag starts
                instance._initialSelection = [...instance.selectedDates];
                
                // Store initial event and reset direction
                instance._initialEvent = e;
                instance._dragDirection = null;
                
                const currentMonth = instance.currentMonth;
                
                const initialX = getCoordinates(e).x;
                const initialY = getCoordinates(e).y;
                
                detectDrag = function(moveEvent) {
                    if (!isDown) return;
                    
                    const movePoint = getCoordinates(moveEvent);
                    const deltaX = Math.abs(movePoint.x - initialX);
                    const deltaY = Math.abs(movePoint.y - initialY);
                    
                    if (deltaX > 5 || deltaY > 5) {
                        isDragging = true;
                        isSelecting = true;
                        console.log('Drag detected');
                        document.removeEventListener('mousemove', detectDrag);
                        document.removeEventListener('touchmove', detectDrag);
                    }
                };
                
                document.addEventListener('mousemove', detectDrag);
                document.addEventListener('touchmove', detectDrag, { passive: false });
                
                // Handle click selection logic
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
                
                instance.changeMonth(currentMonth, false);
            }

            // Handle move
            function handleMove(e) {
                if (!isDown || !isDragging) return;
                
                if (e.cancelable) {
                    e.preventDefault();
                }
                
                const element = getElementFromEvent(e);
                const dayElement = element?.closest('.flatpickr-day');
                if (!dayElement || dayElement.classList.contains('flatpickr-disabled')) return;
                
                const currentDate = new Date(dayElement.dateObj);
                const currentMonth = instance.currentMonth;
                
                if (isDragging) {
                    const initialPoint = getCoordinates(instance._initialEvent);
                    const currentPoint = getCoordinates(e);
                    
                    // Calculate deltas from initial point
                    const deltaX = currentPoint.x - initialPoint.x;
                    const deltaY = currentPoint.y - initialPoint.y;
                    
                    // Determine current direction relative to start date
                    const currentDirection = (currentDate > startDate) ? 'forward' : 'backward';
                    
                    // Update drag direction if it changed
                    if (instance._dragDirection !== currentDirection) {
                        console.log('Direction changed to:', currentDirection);
                        instance._dragDirection = currentDirection;
                    }
                    
                    // Get the range of dates based on current direction
                    const dragDates = getDatesInRange(startDate, currentDate);
                    
                    // Keep the initial selection that was present when drag started
                    const initialSelection = instance._initialSelection || [];
                    
                    // Get new dates based on current direction
                    let newRangeDates = [];
                    if (instance._dragDirection === 'forward') {
                        // When going forward, only select dates after start date
                        newRangeDates = dragDates.filter(date => date >= startDate);
                    } else {
                        // When going backward, only select dates before start date
                        newRangeDates = dragDates.filter(date => date <= startDate);
                    }
                    
                    console.log('Direction:', instance._dragDirection, 'Selected dates:', newRangeDates.length);
                    
                    // Combine initial selection with new range
                    const newDates = [...initialSelection, ...newRangeDates];
                    
                    instance.setDate(newDates);
                    instance.changeMonth(currentMonth, false);
                }
            }

            // Handle end of interaction
            function handleEnd(e) {
                if (isDown) {
                    console.log('Selection ended');
                    if (instance.selectedDates.length > 0) {
                        logSelectionChange('Final selection', instance.selectedDates);
                    }
                    isDown = false;
                    isSelecting = false;
                    isDragging = false;
                    startDate = null;
                    instance._dragDirection = null;
                    instance._initialEvent = null;
                    instance._initialSelection = null;  // Clear the initial selection
                    
                    if (detectDrag) {
                        document.removeEventListener('mousemove', detectDrag);
                        document.removeEventListener('touchmove', detectDrag);
                        detectDrag = null;
                    }
                }
            }

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
            
            // Add both mouse and touch event listeners
            instance.calendarContainer.addEventListener('mousedown', handleStart);
            instance.calendarContainer.addEventListener('touchstart', handleStart);
            
            instance.calendarContainer.addEventListener('mousemove', handleMove);
            instance.calendarContainer.addEventListener('touchmove', handleMove, { passive: false });
            
            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchend', handleEnd);
            
            instance.calendarContainer.addEventListener('mouseleave', handleEnd);
            instance.calendarContainer.addEventListener('touchcancel', handleEnd);
            
            // Update cleanup function to remove all event listeners
            instance._cleanup = function() {
                document.removeEventListener('mouseup', handleEnd);
                document.removeEventListener('touchend', handleEnd);
            };
        }
    });

    return adminPicker;
} 