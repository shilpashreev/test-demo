// generate_dashboard.js (Place this file in your repo root)

const fs = require('fs');
const path = require('path');

const HISTORY_FILE = 'report_history.json';
const MAX_HISTORY_DAYS = 15;
const REPORTS_DIR = 'dashboard-output';
// Playwright config confirms this path:
const JSON_REPORT_PATH = 'results/report.json'; 

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
            
            // 🌟🌟🌟 FIX: Clean up old history entries with missing data 🌟🌟🌟
            history = history.map(run => ({
                timestamp: run.timestamp,
                date: run.date,
                // Ensure all core metrics default to 0 if missing from old file
                total: run.total || 0,
                passed: run.passed || 0,
                failed: run.failed || 0,
                skipped: run.skipped || 0,
                duration: run.duration || 0
            }));
            // 🌟🌟🌟 End FIX 🌟🌟🌟
            
        } catch (e) {
            console.error("Error reading history file, starting fresh:", e.message);
        }
    } else {
        console.log("[HISTORY] History file NOT FOUND. Starting with 0 historical entries.");
    }

    // Use optional chaining for safety, but we rely on the report having stats.
    const stats = newResult?.stats;
    
    // Check if new data is valid (only update history if stats exist)
    if (!stats || typeof stats.total !== 'number') {
        console.warn("WARNING: New Playwright report 'stats' block is invalid or missing total count. Skipping update of history with new run.");
        return history; // Return existing history without adding a bad entry
    }

    const timestamp = new Date().toISOString();
    const today = timestamp.split('T')[0];
    
    // Use || 0 to ensure all metrics are numbers, even if Playwright missed one
    const newRun = {
        timestamp,
        date: today,
        total: stats.total || 0,
        passed: stats.passed || 0,
        failed: stats.failed || 0,
        skipped: stats.skipped || 0,
        duration: Math.round((stats.duration || 0) / 1000 / 60) // minutes
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
    // FIX 1: Use || 0 to replace any null/undefined in the trend data arrays
    const passedData = history.map(run => run.passed || 0);
    const failedData = history.map(run => run.failed || 0);

    // FIX 2: Ensure currentStats always has numbers, using the last entry or default 0
    const lastRun = history[history.length - 1];
    const currentStats = lastRun ? {
        total: lastRun.total || 0,
        passed: lastRun.passed || 0,
        failed: lastRun.failed || 0,
        skipped: lastRun.skipped || 0
    } : { total: 0, passed: 0, failed: 0, skipped: 0 };
    
    // The HTML content (omitted for brevity, assume correct)
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

// --- 3. Main Execution (THE CRASH PREVENTION FIX) ---
try {
    let newResult = {}; // Initialize to empty object for safety
    
    // 🔑 FIX: Check for the Playwright output file without immediately crashing.
    if (fs.existsSync(JSON_REPORT_PATH)) {
        const rawData = fs.readFileSync(JSON_REPORT_PATH, 'utf8');
        newResult = JSON.parse(rawData);
    } else {
        // Log a warning, but don't crash the job. This ensures index.html is written.
        console.warn(`WARNING: Playwright report file not found at ${JSON_REPORT_PATH}. Generating dashboard using ONLY existing history.`);
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR);
    }

    // Pass newResult (which may be {} if report was missing) to updateHistory
    const updatedHistory = updateHistory(newResult);
    
    // Only try to generate the dashboard if we have any valid history
    if (updatedHistory.length > 0) {
        generateDashboard(updatedHistory);
    } else {
        // If it's truly the first run and report is missing, dashboard cannot be generated.
        console.log("No valid test runs found to generate dashboard.");
    }
    
} catch (error) {
    console.error('Failed to generate dashboard due to unexpected error:', error.message);
    // CRITICAL: We still exit with 1 on UNEXPECTED errors (like file system failure), 
    // but not on missing Playwright report (which is handled above).
    process.exit(1);
}