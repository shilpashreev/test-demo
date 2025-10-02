// generate_dashboard.js (Place this file in your repo root)

const fs = require('fs');
const path = require('path');

const HISTORY_FILE = 'report_history.json';
const MAX_HISTORY_DAYS = 15;
const REPORTS_DIR = 'dashboard-output';
const JSON_REPORT_PATH = 'results/report.json'; 

// Environment variables passed from GitHub Actions
const { 
    GITHUB_RUN_ID, 
    GITHUB_REPOSITORY, 
    GITHUB_SERVER_URL 
} = process.env;

// --- 1. Load and Update History ---
function updateHistory(newResult) {
    let history = [];
    const historyFilePath = path.join(REPORTS_DIR, HISTORY_FILE);

    console.log(`[HISTORY] Looking for history file at: ${historyFilePath}`);
    
    if (fs.existsSync(historyFilePath)) {
        console.log("[HISTORY] History file FOUND. Attempting to load...");
        try {
            history = JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
            console.log(`[HISTORY] Successfully loaded ${history.length} historical entries.`);
            
            // Clean up old history entries with missing data 
            history = history.map(run => ({
                timestamp: run.timestamp,
                date: run.date,
                total: run.total || 0,
                passed: run.passed || 0,
                failed: run.failed || 0,
                skipped: run.skipped || 0,
                duration: run.duration || 0,
                // Ensure runUrl exists, even if empty for old entries
                runUrl: run.runUrl || '' 
            }));
            
        } catch (e) {
            console.error("Error reading history file, starting fresh:", e.message);
        }
    } else {
        console.log("[HISTORY] History file NOT FOUND. Starting with 0 historical entries.");
    }

    // CRITICAL FIX: Robustly locate stats object
    let stats = newResult?.stats;
    if (!stats || typeof stats.total !== 'number') {
        stats = newResult?.suites?.[0]?.stats;
    }
    
    // Final guarantee: If stats are still invalid, create a zeroed-out fallback
    if (!stats || typeof stats.total !== 'number') {
        stats = { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 };
        console.warn("Could not find valid test statistics in the JSON report. Using zeros for the current run.");
    }

    // 💡 NEW LOGIC: Construct the GitHub Actions Run URL
    let runUrl = '';
    if (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID) {
        runUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
    }
    
    const timestamp = new Date().toISOString();
    const today = timestamp.split('T')[0];
        
    const newRun = {
        timestamp,
        date: today,
        total: stats.total, 
        passed: stats.passed, 
        failed: stats.failed, 
        skipped: stats.skipped, 
        duration: Math.round((stats.duration || 0) / 1000 / 60), // minutes
        runUrl // 💡 Save the run URL
    };

    // Update or add the current run (to only keep one per day)
    const existingIndex = history.findIndex(run => run.date === today);
    if (existingIndex !== -1) {
        history[existingIndex] = newRun;
    } else {
        history.push(newRun);
    }

    // Filter history to last MAX_HISTORY_DAYS
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_HISTORY_DAYS);
    history = history.filter(run => new Date(run.timestamp) >= cutoffDate);
    
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2));
    
    console.log(`[HISTORY] Final history array size after update: ${history.length}`);
    return history;
}

// --- 2. Generate Dashboard HTML ---
function generateDashboard(history) {
    const labels = history.map(run => run.date);
    const passedData = history.map(run => run.passed || 0);
    const failedData = history.map(run => run.failed || 0);

    const lastRun = history[history.length - 1];
    const currentStats = lastRun ? {
        total: lastRun.total || 0,
        passed: lastRun.passed || 0,
        failed: lastRun.failed || 0,
        skipped: lastRun.skipped || 0
    } : { total: 0, passed: 0, failed: 0, skipped: 0 };
    
    // Helper functions
    const formatTime = (isoString) => {
        if (!isoString) return 'N/A';
        try {
            return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        } catch (e) {
            return 'N/A';
        }
    };
    const formatDuration = (minutes) => {
        if (typeof minutes !== 'number') return 'N/A';
        return `${(minutes * 60).toFixed(1)}s`;
    }

    // 💡 NEW LOGIC: Generate the detailed history table HTML with links
    const historyTableRows = history.slice().reverse().map(run => {
        const dateTime = `${run.date} @ ${formatTime(run.timestamp)}`;
        const dateCell = run.runUrl 
            ? `<a href="${run.runUrl}" target="_blank" title="View GitHub Actions Run Log">${dateTime}</a>`
            : dateTime;
        
        return `
            <tr>
                <td>${dateCell}</td>
                <td style="color:#2196F3; font-weight:bold;">${run.total || 0}</td>
                <td style="color:#4CAF50;">${run.passed || 0}</td>
                <td style="color:#F44336;">${run.failed || 0}</td>
                <td style="color:#FFC107;">${run.skipped || 0}</td>
                <td>${formatDuration(run.duration)}</td>
            </tr>
        `;
    }).join('');
    // 💡 END NEW LOGIC
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Playwright Test Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .stats { margin-bottom: 30px; }
        h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .stat-box { 
          padding: 15px; 
          border-radius: 5px; 
          display: inline-block; 
          margin-right: 15px; 
          color: white; 
        }
        .passed { background-color: #4CAF50; }
        .failed { background-color: #F44336; }
        .total { background-color: #2196F3; }
        .history-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 0.9em;
        }
        .history-table th, .history-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        .history-table th {
            background-color: #f2f2f2;
        }
        .history-container {
            margin-top: 40px;
            max-height: 400px; 
            overflow-y: auto; 
        }
        .history-table td a {
            text-decoration: none;
            color: #0366d6; /* GitHub blue link color */
            font-weight: bold;
        }
    </style>
</head>
<body>
    <h1>Playwright Test Dashboard (Last ${MAX_HISTORY_DAYS} Days)</h1>

    <div class="stats">
        <div class="stat-box total">Total Tests: ${currentStats.total}</div>
        <div class="stat-box passed">Passed: ${currentStats.passed}</div>
        <div class="stat-box failed">Failed: ${currentStats.failed}</div>
    </div>

    <div class="grid">
        <div class="chart-container">
            <h2>Pass/Fail Trend (Bar Chart)</h2>
            <canvas id="barChart"></canvas>
        </div>
        <div class="chart-container">
            <h2>Latest Run Status (Pie Chart)</h2>
            <canvas id="pieChart"></canvas>
        </div>
    </div>
    
    <h2>Detailed Run History (Last ${history.length} runs) - Click Date/Time for Run Log</h2>
    <div class="history-container">
        <table class="history-table">
            <thead>
                <tr>
                    <th>Run Date/Time 🔗</th>
                    <th>Total</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Skipped</th>
                    <th>Duration</th>
                </tr>
            </thead>
            <tbody>
                ${historyTableRows}
            </tbody>
        </table>
    </div>

    <script>
        // Data from the script execution
        const labels = ${JSON.stringify(labels)};
        const passedData = ${JSON.stringify(passedData)};
        const failedData = ${JSON.stringify(failedData)};
        const currentPassed = ${currentStats.passed};
        const currentFailed = ${currentStats.failed};
        const currentSkipped = ${currentStats.skipped};

        // Bar Chart (Trend)
        if (labels.length > 0) {
            new Chart(document.getElementById('barChart'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Passed', data: passedData, backgroundColor: '#4CAF50' },
                        { label: 'Failed', data: failedData, backgroundColor: '#F44336' }
                    ]
                },
                options: {
                    responsive: true,
                    scales: { x: { stacked: true }, y: { stacked: true } }
                }
            });

            // Pie Chart (Latest Run Breakdown)
            new Chart(document.getElementById('pieChart'), {
                type: 'pie',
                data: {
                    labels: ['Passed', 'Failed', 'Skipped'],
                    datasets: [{
                        data: [currentPassed, currentFailed, currentSkipped],
                        backgroundColor: ['#4CAF50', '#F44336', '#FFC107']
                    }]
                },
                options: { responsive: true }
            });
        }
    </script>
</body>
</html>
`;
    fs.writeFileSync(path.join(REPORTS_DIR, 'index.html'), html);
    console.log('Dashboard HTML generated successfully in ' + REPORTS_DIR);
}



// --- 3. Main Execution (FINAL CRASH PREVENTION) ---
let newResult = {};
let updatedHistory = [];

try {
    if (fs.existsSync(JSON_REPORT_PATH)) {
        const rawData = fs.readFileSync(JSON_REPORT_PATH, 'utf8');
        newResult = JSON.parse(rawData);
    } else {
        console.warn(`WARNING: Playwright report file not found at ${JSON_REPORT_PATH}. Generating dashboard using ONLY existing history.`);
    }

    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR);
    }
    
    updatedHistory = updateHistory(newResult);
    
    if (updatedHistory.length > 0) {
        generateDashboard(updatedHistory);
    } else {
        console.warn("CRITICAL FALLBACK: History is empty. Creating a dummy index.html to prevent CI crash.");
        generateDashboard([]); 
    }
    
} catch (error) {
    console.error('FATAL CRASH: Failed to generate dashboard due to unexpected error:', error.message);
    try {
        generateDashboard([]);
        console.log("Successfully created blank index.html during crash recovery.");
    } catch(e) {
        console.error("Crash recovery failed:", e.message);
    }
    
    process.exit(1);
}