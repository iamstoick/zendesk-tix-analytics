(function () {
  // Initialize the Zendesk App Framework client
  const client = ZAFClient.init();
  client.on('app.registered', initApp);

  function initApp() {
    // 1. Get the current ticket ID
    client.get('ticket.id').then(data => {
      const ticketId = data['ticket.id'];
      console.log('Current Ticket ID:', ticketId);
      if (ticketId) {
        fetchTicketData(ticketId);
      } else {
        document.getElementById('created-date').textContent = 'Error: No Ticket ID found.';
      }
    });
  }

  function fetchTicketData(ticketId) {
    const requests = {
      // API call for core ticket details (created_at)
      ticket: `/api/v2/tickets/${ticketId}.json`,
      // API call for ticket metrics (first assignment time, first reply time)
      metrics: `/api/v2/tickets/${ticketId}/metrics.json`,
      // API call for ticket audit log (to find updates, replies, agents involved)
      audits: `/api/v2/tickets/${ticketId}/audits.json?include=users`
    };

    // Use Promises to fetch all necessary data concurrently
    Promise.all([
      client.request(requests.ticket),
      client.request(requests.metrics),
      client.request(requests.audits)
    ])
    .then(results => {
      const ticket = results[0].ticket;
      const metrics = results[1].ticket_metric;
      const audits = results[2].audits;
      const users = results[2].users;

      // 2. Process and display the data
      displayBasicInfo(ticket);
      calculateAndDisplayTimes(ticket, metrics);
      calculateAndDisplayAgentActivity(ticket.requester_id, audits, users);
      resizeApp();
    })
    .catch(error => {
      console.error('Error fetching Zendesk data:', error);
      document.getElementById('created-date').textContent = 'Error loading data.';
      resizeApp();
    });
  }

  // Format date
  /**
   * Calculates the time difference between a past date and now,
   * and formats it into a human-readable string (e.g., "4d 18h").
   * @param {string} pastDateString - The ISO 8601 creation date string.
   * @returns {string} Formatted elapsed time string.
   */
  function formatTimeDifference(pastDateString) {
    const createdTime = new Date(pastDateString).getTime();
    const now = Date.now();
    let diff = now - createdTime; // Difference in milliseconds

    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const MONTH = 30 * DAY; // Approximation for display

    if (diff >= MONTH) {
      const months = Math.floor(diff / MONTH);
      diff -= months * MONTH;
      const days = Math.floor(diff / DAY);
      return `${months}m ${days}d`; // For months: 1m 23d
    } else if (diff >= DAY) {
      const days = Math.floor(diff / DAY);
      diff -= days * DAY;
      const hours = Math.floor(diff / HOUR);
      return `${days}d ${hours}h`; // For days: 4d 18h
    } else if (diff >= HOUR) {
      const hours = Math.floor(diff / HOUR);
      diff -= hours * HOUR;
      const minutes = Math.floor(diff / MINUTE);
      return `${hours}h ${minutes}m`; // For hours: 4h 35m
    } else if (diff >= MINUTE) {
      const minutes = Math.floor(diff / MINUTE);
      return `${minutes}m`;
    }
    return 'Just created';
  }

  // Resize the app height
  function resizeApp() {
      const client = ZAFClient.init(); // Initialize ZAFClient
      
      // Get the height of the currently visible content within the body
      // This value will change depending on which tab is active.
      const newHeight = document.body.offsetHeight;
      
      // Use ZAF Client to tell Zendesk to resize the iframe
      client.invoke('resize', { height: newHeight });
  }

  // --- Display Functions ---
  function displayBasicInfo(ticket) {
    // REQUIREMENT: Convert created date to elapsed time (e.g., 4d 18h)
    const elapsedTime = formatTimeDifference(ticket.created_at);
    document.getElementById('created-date').textContent = elapsedTime;
  }

  function calculateAndDisplayTimes(ticket, metrics) {
    // Requirement: First assignment time
    // First assignment time in minutes (using business hours metric)
    let assignTime = metrics.initially_assigned_at ? 
        Math.round((new Date(metrics.initially_assigned_at) - new Date(metrics.created_at)) / (1000 * 60)) : 
        'N/A';
    const formattedAssignTime = formatMinutes(assignTime);
    document.getElementById('first-assign-time').textContent = formattedAssignTime !== 'N/A' ? `${formattedAssignTime}` : 'N/A';

    // Requirement: Last requester update
    const formattedRequesterUpdate = formatTimeDifference(metrics.requester_updated_at)
    document.getElementById('requester-update').textContent = formattedRequesterUpdate !== 'N/A' ? `${formattedRequesterUpdate}` : 'N/A';

    // Requirement: First reply time
    // First reply time in minutes (using business hours metric)
    const firstReplyTime = metrics.reply_time_in_minutes.calendar || 'N/A';
    document.getElementById('first-reply-time').textContent = firstReplyTime !== 'N/A' ? `${firstReplyTime} min` : 'N/A';

    // Requirement: Full resolution time
    const fullResolutionTime = formatMinutes(metrics.full_resolution_time_in_minutes.calendar) || 'N/A';
    document.getElementById('full-resolution').textContent = fullResolutionTime !== '0m' ? `${fullResolutionTime}` : 'N/A';

    // Requirement: Assignee stations
    const assigneeStations = metrics.assignee_stations || 'N/A';
    document.getElementById('assignee-stations').textContent = assigneeStations;

    // You'll need this simple helper function in your main.js file:
    function formatMinutes(totalMinutes) {
      if (totalMinutes === 'N/A' || totalMinutes === 0) return 'N/A';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    }
  }

  function calculateAndDisplayAgentActivity(requesterId, audits, users) {
    let agentRepliesCount = 0;      // Tracks Public Comments (current requirement)
    let agentInternalRepliesCount = 0; // NEW: Tracks Internal Comments
    let agentIds = new Set();
    
    // Store raw ISO strings for reliable time calculations
    let requesterLastUpdateTimestamp = null; 
    let agentLastUpdateTimestamp = null; 
    let agentLastTouchMap = {};  // NEW: Map to store the LATEST raw ISO timestamp for each individual agent

    // Helper to map user IDs to roles (for fast lookup)
    const userMap = users.reduce((map, user) => {
        map[user.id] = user;
        return map;
    }, {});
    
    // Iterate through audits (events) to find updates and replies
    // Iterate through audits (events) to find updates and replies
    audits.forEach(audit => {
      audit.events.forEach(event => {
        if (event.type === 'Comment') {
          const authorId = audit.author_id;
          const author = userMap[authorId];
          const isAgent = author && (author.role === 'agent' || author.role === 'admin');
          const isRequester = authorId === requesterId;
          
          const currentTimestamp = audit.created_at; 
          const currentTimestampMs = new Date(currentTimestamp).getTime();

          if (isAgent) {
            agentIds.add(authorId);
            
            // --- CRITICAL FILTERING LOGIC ---
            if (event.public) {
              // 1. PUBLIC Reply Count
              agentRepliesCount++;
            } else {
              // 2. INTERNAL Reply Count (event.public is false)
              agentInternalRepliesCount++;
            }
            // ---------------------------------
            
            // Track LATEST overall agent update (remaining logic)
            const overallRecordedMs = agentLastUpdateTimestamp 
              ? new Date(agentLastUpdateTimestamp).getTime() 
              : 0;

            if (currentTimestampMs > overallRecordedMs) {
              agentLastUpdateTimestamp = currentTimestamp;
            }
            
            // Track LATEST update for THIS SPECIFIC agent (for the list)
            const agentRecordedMs = agentLastTouchMap[authorId] 
                ? new Date(agentLastTouchMap[authorId]).getTime() 
                : 0;

            if (currentTimestampMs > agentRecordedMs) {
                agentLastTouchMap[authorId] = currentTimestamp;
            }
          } else if (isRequester) {
            // Track LATEST requester update (remaining logic)
            const recordedTimestampMs = requesterLastUpdateTimestamp 
              ? new Date(requesterLastUpdateTimestamp).getTime() 
              : 0;

            if (currentTimestampMs > recordedTimestampMs) {
              requesterLastUpdateTimestamp = currentTimestamp;
            }
          }
        }
      });
    });

    // ... (Displaying overall metrics remains the same) ...
    const formattedAgentUpdate = agentLastUpdateTimestamp 
      ? formatTimeDifference(agentLastUpdateTimestamp) 
      : 'N/A';

    document.getElementById('public-replies').textContent = agentRepliesCount;
    document.getElementById('internal-replies').textContent = agentInternalRepliesCount;
    document.getElementById('agent-update').textContent = formattedAgentUpdate;


    // --- NEW LIST DISPLAY LOGIC ---
    const agentListContainer = document.getElementById('agent-list-container');
    agentListContainer.innerHTML = ''; // Clear 'Loading...'
    
    const uniqueAgentIds = Array.from(agentIds);
    
    if (uniqueAgentIds.length > 0) {
      uniqueAgentIds.forEach(id => {
          const name = userMap[id] ? userMap[id].name : `Agent ID: ${id}`;
          const lastTouchRaw = agentLastTouchMap[id];
          
          // Format the time difference using the reusable utility function
          const formattedTime = lastTouchRaw 
              ? formatTimeDifference(lastTouchRaw) 
              : 'N/A';
          
          // Create the agent row container
          const agentRow = document.createElement('div');
          agentRow.className = 'agent-row';

          // 1. Agent Name Column
          const nameSpan = document.createElement('span');
          nameSpan.className = 'agent-name';
          nameSpan.textContent = name;
          
          // 2. Last Update Time Column
          const timeSpan = document.createElement('span');
          timeSpan.className = 'agent-time';
          timeSpan.textContent = formattedTime;

          agentRow.appendChild(nameSpan);
          agentRow.appendChild(timeSpan);
          agentListContainer.appendChild(agentRow);
      });
    } else {
        const noAgentRow = document.createElement('div');
        noAgentRow.className = 'agent-row';
        noAgentRow.innerHTML = '<span class="agent-name">No Agents Involved Yet</span>';
        agentListContainer.appendChild(noAgentRow);
    }
  }

})();