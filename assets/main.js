(function () {
  const client = ZAFClient.init();
  client.on('app.registered', initApp);

  function initApp() {
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
    const timeout = 10000;
    const requests = {
      ticket: { url: `/api/v2/tickets/${ticketId}.json`, timeout },
      metrics: { url: `/api/v2/tickets/${ticketId}/metrics.json`, timeout },
      audits: { url: `/api/v2/tickets/${ticketId}/audits.json?include=users`, timeout }
    };

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

  function formatTimeDifference(pastDateString) {
    const createdTime = new Date(pastDateString).getTime();
    const now = Date.now();
    let diff = now - createdTime;

    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const MONTH = 30 * DAY;

    if (diff >= MONTH) {
      const months = Math.floor(diff / MONTH);
      diff -= months * MONTH;
      const days = Math.floor(diff / DAY);
      return `${months}m ${days}d`;
    } else if (diff >= DAY) {
      const days = Math.floor(diff / DAY);
      diff -= days * DAY;
      const hours = Math.floor(diff / HOUR);
      return `${days}d ${hours}h`;
    } else if (diff >= HOUR) {
      const hours = Math.floor(diff / HOUR);
      diff -= hours * HOUR;
      const minutes = Math.floor(diff / MINUTE);
      return `${hours}h ${minutes}m`;
    } else if (diff >= MINUTE) {
      const minutes = Math.floor(diff / MINUTE);
      return `${minutes}m`;
    }
    return 'Just created';
  }

  function resizeApp() {
    const newHeight = document.body.offsetHeight;
    client.invoke('resize', { height: newHeight });
  }

  function displayBasicInfo(ticket) {
    const elapsedTime = formatTimeDifference(ticket.created_at);
    document.getElementById('created-date').textContent = elapsedTime;
  }

  function calculateAndDisplayTimes(ticket, metrics) {
    let assignTime = metrics.initially_assigned_at ? 
        Math.round((new Date(metrics.initially_assigned_at) - new Date(metrics.created_at)) / (1000 * 60)) : 
        'N/A';
    const formattedAssignTime = formatMinutes(assignTime);
    document.getElementById('first-assign-time').textContent = formattedAssignTime !== 'N/A' ? `${formattedAssignTime}` : 'N/A';

    const formattedRequesterUpdate = formatTimeDifference(metrics.requester_updated_at)
    document.getElementById('requester-update').textContent = formattedRequesterUpdate !== 'N/A' ? `${formattedRequesterUpdate}` : 'N/A';

    const firstReplyTime = metrics.reply_time_in_minutes.calendar || 'N/A';
    document.getElementById('first-reply-time').textContent = firstReplyTime !== 'N/A' ? `${firstReplyTime} min` : 'N/A';

    const fullResolutionTime = formatMinutes(metrics.full_resolution_time_in_minutes.calendar) || 'N/A';
    document.getElementById('full-resolution').textContent = fullResolutionTime !== '0m' ? `${fullResolutionTime}` : 'N/A';

    const assigneeStations = metrics.assignee_stations || 'N/A';
    document.getElementById('assignee-stations').textContent = assigneeStations;

    function formatMinutes(totalMinutes) {
      if (totalMinutes === 'N/A' || totalMinutes === 0) return 'N/A';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    }
  }

  function calculateAndDisplayAgentActivity(requesterId, audits, users) {
    let agentRepliesCount = 0;
    let agentInternalRepliesCount = 0;
    let agentIds = new Set();
    let requesterLastUpdateTimestamp = null;
    let agentLastUpdateTimestamp = null;
    let agentLastTouchMap = {};

    const userMap = users.reduce((map, user) => {
        map[user.id] = user;
        return map;
    }, {});

    let requesterLastMs = 0;
    let agentLastMs = 0;

    for (let i = 0; i < audits.length; i++) {
      const audit = audits[i];
      const auditCreatedMs = new Date(audit.created_at).getTime();
      const events = audit.events;

      for (let j = 0; j < events.length; j++) {
        const event = events[j];
        if (event.type === 'Comment') {
          const authorId = audit.author_id;
          const author = userMap[authorId];
          const isAgent = author && (author.role === 'agent' || author.role === 'admin');
          const isRequester = authorId === requesterId;

          if (isAgent) {
            agentIds.add(authorId);

            if (event.public) {
              agentRepliesCount++;
            } else {
              agentInternalRepliesCount++;
            }

            if (auditCreatedMs > agentLastMs) {
              agentLastUpdateTimestamp = audit.created_at;
              agentLastMs = auditCreatedMs;
            }

            if (auditCreatedMs > (new Date(agentLastTouchMap[authorId]).getTime() || 0)) {
              agentLastTouchMap[authorId] = audit.created_at;
            }
          } else if (isRequester) {
            if (auditCreatedMs > requesterLastMs) {
              requesterLastUpdateTimestamp = audit.created_at;
              requesterLastMs = auditCreatedMs;
            }
          }
        }
      }
    }

    const formattedAgentUpdate = agentLastUpdateTimestamp 
      ? formatTimeDifference(agentLastUpdateTimestamp) 
      : 'N/A';

    document.getElementById('public-replies').textContent = agentRepliesCount;
    document.getElementById('internal-replies').textContent = agentInternalRepliesCount;
    document.getElementById('agent-update').textContent = formattedAgentUpdate;

    const agentListContainer = document.getElementById('agent-list-container');
    agentListContainer.innerHTML = '';

    const uniqueAgentIds = Array.from(agentIds);
    const fragment = document.createDocumentFragment();

    if (uniqueAgentIds.length > 0) {
      for (let i = 0; i < uniqueAgentIds.length; i++) {
        const id = uniqueAgentIds[i];
        const name = userMap[id] ? userMap[id].name : `Agent ID: ${id}`;
        const lastTouchRaw = agentLastTouchMap[id];
        const formattedTime = lastTouchRaw ? formatTimeDifference(lastTouchRaw) : 'N/A';

        const agentRow = document.createElement('div');
        agentRow.className = 'agent-row';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'agent-name';
        nameSpan.textContent = name;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'agent-time';
        timeSpan.textContent = formattedTime;

        agentRow.appendChild(nameSpan);
        agentRow.appendChild(timeSpan);
        fragment.appendChild(agentRow);
      }
      agentListContainer.appendChild(fragment);
    } else {
      const noAgentRow = document.createElement('div');
      noAgentRow.className = 'agent-row';
      noAgentRow.innerHTML = '<span class="agent-name">No Agents Involved Yet</span>';
      agentListContainer.appendChild(noAgentRow);
    }
  }

})();