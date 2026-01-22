
# Ticket Analytics Zendesk App

Ticket Analytics is a private Zendesk Support application designed to provide agents with real-time, high-density metrics regarding ticket lifecycles and agent collaboration directly within the ticket sidebar.

## 📋 Features

### 📊 Comprehensive Metrics

The app organizes data into four specialized tabs to help agents understand the ticket context at a glance:

* **Ticket Overview**: Tracks the total time since the ticket was created and provides a breakdown of public vs. internal agent comments.

* **Service Milestones**: Displays critical performance data, including first assignment time, agent first reply time, and total resolution time.

* **Update History**: monitors the last interaction from both the requester and the agent, alongside the total number of "Assignee Stations" (how many agents the ticket has been assigned to).

* **Agent Activity**: Lists every agent who has interacted with the ticket and the time of their "Last Touch".

### ⚡ Technical Highlights

* **Human-Readable Timestamps**: Automatically converts raw date strings into intuitive formats like 4d 18h, 4h 35m, or 1m 23d.

* **Dynamic UI**: Built with a tabbed interface and responsive data grids that automatically resize to fit the sidebar content without scrollbars.

* **Real-time Data**: Fetches data concurrently from the Ticket, Ticket Metrics, and Ticket Audit APIs to ensure the most up-to-date information.

## 🛠 Installation & Development

**Project Structure**

```
zendesk-tix-analytics/
├── assets/
│   ├── iframe.html    # App UI and tab logic
│   ├── main.js        # Data processing and ZAF Client logic
│   ├── style.css      # Custom grid and tab styling
│   └── logo.png       # App icons
├── manifest.json      # App configuration and permissions
└── translations/
    └── en.json        # Default English localized strings
```

**Local Development**

To run the app locally using the Zendesk Apps Tools (ZAT):

1. Navigate to the project root directory.

2. Start the local server: `zat server`
   
3. Append `?zat=true` to your Zendesk ticket URL to load the local version of the app.

### ⚙️ Configuration

The app is configured as a private app and runs in the ticket_sidebar location of Zendesk Support. It utilizes Framework Version 2.0.

## 👤 Author

* Name: Gerald Villorente
* Email: gerald@pantheon.io
* URL: https://pantheon.io

## 📖 Agent User Guide: Ticket Analytics

The Ticket Analytics app provides a deep dive into the lifecycle of a ticket. Use the four tabs at the top of the app to switch between different data views.

1. Ticket Overview Tab
* **Since Created**: Shows the total "age" of the ticket in a human-readable format (e.g., 2d 4h).

* **Public Comments**: Displays the total count of all public replies made by agents to the customer.

* **Internal Comments**: Displays the total count of private internal notes left by agents on the ticket.

2. Service Milestones Tab
* **First Assignment**: The elapsed time between when the ticket was created and when it was first assigned to an agent.

* **Agent First Reply**: The total calendar time it took for an agent to send the very first public response.

* **Full Resolution**: The total time taken from ticket creation until the ticket was moved to a "Solved" state.

3. Update History Tab
* **Requester Last Update**: Displays how long ago the customer last sent a message or updated the ticket.

* **Agent Last Update**: Displays how long ago an agent last made a change or comment.

* **Assignee Stations**: Shows the number of unique times the "Assignee" field was changed (helps identify if a ticket is being "bounced" between agents).

4. Agent Activity Tab
* **Agents Involved**: A dedicated list showing every agent who has participated in the ticket.

* **Last Touch**: Shows exactly how long ago each specific agent last interacted with this ticket, allowing you to identify who was most recently active.

### 💡 Pro-Tips for Agents
* **Auto-Resize**: The app automatically adjusts its height based on the tab you are viewing, so you never have to deal with internal scrollbars.

* **Real-Time Data**: Data is refreshed every time you open a ticket or switch between tabs, ensuring you are looking at the latest metrics.
