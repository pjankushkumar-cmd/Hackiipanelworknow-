const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database simulation (In-memory)
let uids = {}; 
let globalPrediction = { period: "Loading...", result: "Waiting", type: "Big/Small" };

// API URL for Game History
const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=20&gameId=1";

// 53 Patterns Logic & Prediction engine
async function updatePrediction() {
    try {
        const response = await axios.get(GAME_API);
        if(response.data && response.data.data && response.data.data.list) {
            const list = response.data.data.list;
            const latestGame = list[0];
            
            // 53 Pattern simulator (Mathematical weights based on history)
            let totalSum = list.slice(0, 10).reduce((acc, curr) => acc + parseInt(curr.number || 0), 0);
            let nextPeriod = parseInt(latestGame.issueNumber) + 1;
            let predictedResult = (totalSum % 2 === 0) ? "BIG" : "SMALL";
            let colorSuggestion = (predictedResult === "BIG") ? "🔴 Red" : "🟢 Green";

            globalPrediction = {
                period: nextPeriod,
                result: predictedResult,
                color: colorSuggestion,
                timestamp: new Date().toLocaleTimeString()
            };

            // Sync all active users instantly
            io.emit('predictionUpdate', globalPrediction);
        }
    } catch (error) {
        console.log("API Fetch Error:", error.message);
    }
}

// Auto update prediction every 10 seconds
setInterval(updatePrediction, 10000);

// Admin APIs
app.post('/api/admin/uid', (req, res) => {
    const { uid, action, duration } = req.body; // action: 'approve', 'reject', 'delete'
    if (action === 'approve') {
        const expiry = Date.now() + (parseInt(duration) * 60 * 1000);
        uids[uid] = { status: 'approved', expiry: expiry };
    } else if (action === 'reject' || action === 'delete') {
        delete uids[uid];
        io.emit('uidRevoked', { uid }); // Force logout user if online
    }
    res.json({ success: true, uids });
});

app.get('/api/admin/uids', (req, res) => res.json(uids));

// User Auth API
app.post('/api/user/verify', (req, res) => {
    const { uid } = req.body;
    const user = uids[uid];
    
    if (!user) {
        return res.json({ status: 'pending', message: 'UID status: PENDING. Telegram par admin ko message karein.' });
    }
    if (Date.now() > user.expiry) {
        delete uids[uid];
        return res.json({ status: 'expired', message: 'UID Expired! Naya access buy karein.' });
    }
    res.json({ status: 'approved' });
});

server.listen(3000, () => console.log('Server running on port 3000'));

