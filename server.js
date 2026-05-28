// server.js
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

// Root route correction 
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server Storage Memory
let uids = {}; 
let globalPrediction = { period: "Fetching...", result: "WAITING", color: "Calculating", timestamp: "" };

// Sahi structured parameters API for WinG0 1M
const GAME_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=20&gameId=1";

async function updatePrediction() {
    try {
        const response = await axios.get(GAME_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,hi;q=0.7',
                'Referer': 'https://draw.ar-lottery01.com/',
                'Origin': 'https://draw.ar-lottery01.com'
            },
            timeout: 5000
        });

        if(response.data && response.data.data && response.data.data.list) {
            const list = response.data.data.list;
            if (list.length === 0) return;

            const latestGame = list[0];
            
            // Core Pattern Algorithm loop calculation
            let totalSum = 0;
            let loopLimit = Math.min(list.length, 7); // Using last 7 rounds weight
            for(let i = 0; i < loopLimit; i++) {
                totalSum += parseInt(list[i].number || 0);
            }
            
            // Upcoming Next Period setup calculation
            let nextPeriod = parseInt(latestGame.issueNumber) + 1;
            
            // Smart Prediction Rule Selector 
            let calcFactor = (totalSum + nextPeriod) % 10;
            let predictedResult = (calcFactor >= 5) ? "BIG" : "SMALL";
            let colorSuggestion = (predictedResult === "BIG") ? "🔴 RED [लाल] + 🔮 VIOLET" : "🟢 GREEN [हरा]";

            globalPrediction = {
                period: nextPeriod,
                result: predictedResult,
                color: colorSuggestion,
                timestamp: new Date().toLocaleTimeString()
            };

            // Instantly sync data packets to client displays
            io.emit('predictionUpdate', globalPrediction);
        }
    } catch (error) {
        console.log("Live Sync Status -> Log Trace:", error.message);
    }
}

// Data fetch frequency matching system (Auto check every 4 seconds)
setInterval(updatePrediction, 4000);

// Admin Routing Controls
app.post('/api/admin/uid', (req, res) => {
    const { uid, action, duration } = req.body;
    if (action === 'approve') {
        const expiry = Date.now() + (parseInt(duration) * 60 * 1000);
        uids[uid] = { status: 'approved', expiry: expiry };
    } else if (action === 'reject' || action === 'delete') {
        delete uids[uid];
        io.emit('uidRevoked', { uid });
    }
    res.json({ success: true, uids });
});

app.get('/api/admin/uids', (req, res) => res.json(uids));

// Access authentication verify gateway
app.post('/api/user/verify', (req, res) => {
    const { uid } = req.body;
    if (!uid) return res.json({ status: 'invalid', message: 'UID empty!' });

    const user = uids[uid];
    if (!user) {
        return res.json({ status: 'pending', message: 'UID Status: PENDING! Please contact admin on Telegram to activate.' });
    }
    if (Date.now() > user.expiry) {
        delete uids[uid];
        return res.json({ status: 'expired', message: 'Access Expired! Purchase a new key from admin.' });
    }
    res.json({ status: 'approved' });
});

io.on('connection', (socket) => {
    socket.emit('predictionUpdate', globalPrediction);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server environment operating fine on port ${PORT}`));
