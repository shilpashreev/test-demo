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
function generateDashboard(history) {
    // ... (Your existing HTML generation code) ...
    const labels = history.map(run => run.date);
    const passedData = history.map(run => run.passed);
    const failedData = history.map(run => run.failed);
    const currentStats = history[history.length - 1] || { total: 0, passed: 0, failed: 0, skipped: 0 };
    
    // ... (Your HTML string template) ...
    
    fs.writeFileSync(path.join(REPORTS_DIR, 'index.html'), html);
    console.log('Dashboard HTML generated successfully in ' + REPORTS_DIR);
}

// --- Main Execution ---
try {
    const rawData = fs.readFileSync(JSON_REPORT_PATH, 'utf8');
    const newResult = JSON.parse(rawData);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR);
    }

    const updatedHistory = updateHistory(newResult);
    generateDashboard(updatedHistory);
} catch (error) {
    console.error('Failed to generate dashboard:', error.message);
    process.exit(1);
}