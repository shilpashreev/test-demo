// generate_dashboard.js (Place this file in your repo root)

const fs = require('fs');
const path = require('path');

const HISTORY_FILE = 'report_history.json';
const MAX_HISTORY_DAYS = 15;
const REPORTS_DIR = 'dashboard-output';
const JSON_REPORT_PATH = 'results/report.json';

// --- 1. Load and Update History ---
function updateHistory(newResult) {
    let history = [];
    const historyFilePath = path.join(REPORTS_DIR, HISTORY_FILE);

    console.log(`[DEBUG] Looking for history file at: ${historyFilePath}`); // 🔑 NEW DEBUG LINE 1

    if (fs.existsSync(historyFilePath)) {
        console.log("[DEBUG] History file FOUND. Attempting to load..."); // 🔑 NEW DEBUG LINE 2
        try {
            history = JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
            console.log(`[DEBUG] Successfully loaded ${history.length} historical entries.`); // 🔑 NEW DEBUG LINE 3
        } catch (e) {
            console.error("Error reading history file, starting fresh:", e.message);
        }
    } else {
        console.log("[DEBUG] History file NOT FOUND. Starting with 0 historical entries."); // 🔑 NEW DEBUG LINE 4
    }

    // ... (rest of the history update logic is correct)
    const timestamp = new Date().toISOString();
    const today = timestamp.split('T')[0];
    const totalTests = newResult.stats.total;
    const passed = newResult.stats.passed;
    const failed = newResult.stats.failed;
    const skipped = newResult.stats.skipped;
    const duration = newResult.stats.duration;

    const newRun = {
        timestamp,
        date: today,
        total: totalTests,
        passed,
        failed,
        skipped,
        duration: Math.round(duration / 1000 / 60) // minutes
    };

    // Only keep one entry per day for a cleaner chart (optional)
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
    
    console.log(`[DEBUG] Final history array size after update: ${history.length}`); // 🔑 NEW DEBUG LINE 5
    return history;
}

// --- 2. Generate Dashboard HTML (No changes needed here) ---
// --- 2. Generate Dashboard HTML (CORRECTED) ---
function generateDashboard(history) {
  const labels = history.map(run => run.date);
  const passedData = history.map(run => run.passed);
  const failedData = history.map(run => run.failed);
  const currentStats = history[history.length - 1] || { total: 0, passed: 0, failed: 0, skipped: 0 };
  
  // 🔑 FATAL FIX: The 'html' variable MUST be defined here
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
  </script>
</body>
</html>
`;
  fs.writeFileSync(path.join(REPORTS_DIR, 'index.html'), html);
  console.log('Dashboard HTML generated successfully in ' + REPORTS_DIR);
}