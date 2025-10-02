// generate_dashboard.js (Place this file in your repo root)

const fs = require('fs');
const path = require('path');

const HISTORY_FILE = 'report_history.json';
const MAX_HISTORY_DAYS = 15;
const REPORTS_DIR = 'dashboard-output';
const JSON_REPORT_PATH = 'results/report.json'; // Ensure Playwright output matches this path

// --- 1. Load and Update History ---
function updateHistory(newResult) {
    let history = [];
    const historyFilePath = path.join(REPORTS_DIR, HISTORY_FILE);

    console.log(`[HISTORY] Looking for history file at: ${historyFilePath}`);
    
    // Check for history file (this is needed for subsequent runs)
    if (fs.existsSync(historyFilePath)) {
        console.log("[HISTORY] History file FOUND. Attempting to load...");
        try {
            history = JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
            console.log(`[HISTORY] Successfully loaded ${history.length} historical entries.`);
        } catch (e) {
            console.error("Error reading history file, starting fresh:", e.message);
        }
    } else {
        console.log("[HISTORY] History file NOT FOUND. Starting with 0 historical entries.");
    }

    // Safely extract stats, checking if the fields exist in the report.json
    const stats = newResult?.stats;
    if (!stats || stats.total === 0) {
        console.error("Error: New result data is empty or missing 'stats' block. Skipping history update.");
        return history; // Return existing history without adding a bad entry
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
        duration: Math.round(stats.duration / 1000 / 60) // minutes
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
    const passedData = history.map(run => run.passed);
    const failedData = history.map(run => run.failed);
    const currentStats = history[history.length - 1] || { total: 0, passed: 0, failed: 0, skipped: 0 };
    
    // The HTML content (using the template literal is correct)
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

    <script>
        // Data from the script execution
        const labels = ${JSON.stringify(labels)};
        const passedData = ${JSON.stringify(passedData)};
        const failedData = ${JSON.stringify(failedData)};
        const currentPassed = ${currentStats.passed};
        const currentFailed = ${currentStats.failed};
        const currentSkipped = ${currentStats.skipped};

        // Bar Chart (Trend)
        if (labels.length > 0) { // Check data exists before trying to draw
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

// --- 3. Main Execution (THE CRITICAL PATH CHECK) ---
try {
    // 🔑 FATAL FIX: Check for the Playwright output file before proceeding.
    if (!fs.existsSync(JSON_REPORT_PATH)) {
        console.error(`ERROR: Playwright report file not found at ${JSON_REPORT_PATH}. Aborting dashboard generation.`);
        // If the report doesn't exist, we can't get current stats, so we stop.
        process.exit(1); 
    }
    
    const rawData = fs.readFileSync(JSON_REPORT_PATH, 'utf8');
    const newResult = JSON.parse(rawData);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR);
    }

    const updatedHistory = updateHistory(newResult);
    
    // Only try to generate the dashboard if we have any history (at least 1 run)
    if (updatedHistory.length > 0) {
        generateDashboard(updatedHistory);
    } else {
        console.log("No valid test runs found to generate dashboard.");
    }
    
} catch (error) {
    console.error('Failed to generate dashboard due to unexpected error:', error.message);
    process.exit(1);
}