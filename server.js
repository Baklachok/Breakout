const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const players = {};
const balls = {};
let bricks = [];
const scores = {};

const MAX_PLAYERS = 2;
const BALL_VELOCITY = { x: 150, y: -150 };
const BRICK_SETTINGS = { rows: 5, cols: 10, brickWidth: 64, brickHeight: 32 };

function initializeBricks(rows = BRICK_SETTINGS.rows, cols = BRICK_SETTINGS.cols) {
    return Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => ({
            id: `${row}-${col}`,
            x: BRICK_SETTINGS.brickWidth / 2 + col * BRICK_SETTINGS.brickWidth,
            y: BRICK_SETTINGS.brickHeight / 2 + row * BRICK_SETTINGS.brickHeight,
            active: true,
        }))
    ).flat();
}

function resetGame() {
    console.log("Рестарт игры: восстанавливаем кирпичи и сбрасываем очки...");

    bricks = initializeBricks();

    console.log("Очки перед сбросом:", JSON.stringify(scores));

    for (const playerId in scores) {
        scores[playerId] = 0;
    }

    console.log("Очки после сброса:", JSON.stringify(scores));

    io.emit('resetGame', { bricks, scores });
}

function countPlayersByColor(color) {
    return Object.values(players).filter((player) => player.color === color).length;
}

function addPlayer(socket) {
    const bluePlayers = countPlayersByColor('blue');
    const redPlayers = countPlayersByColor('red');
    const playerColor = bluePlayers <= redPlayers ? 'blue' : 'red';

    players[socket.id] = {
        x: 400,
        y: 550,
        playerId: socket.id,
        color: playerColor,
    };

    balls[socket.id] = {
        x: 400,
        y: 300,
        velocityX: BALL_VELOCITY.x,
        velocityY: BALL_VELOCITY.y,
        owner: socket.id,
        color: playerColor,
    };

    if (!scores[socket.id]) {
        scores[socket.id] = 0;
    }

    console.log(`Игрок добавлен: ${JSON.stringify(players[socket.id])}`);
}

function removePlayer(socketId) {
    if (players[socketId]) delete players[socketId];
    if (balls[socketId]) delete balls[socketId];
    console.log(`Игрок ${socketId} удалён.`);
}

function checkStartGame() {
    const playerCount = Object.keys(players).length;
    if (playerCount === MAX_PLAYERS) {
        console.log("Два игрока подключились, игра начинается!");
        io.emit('startGame');
    } else {
        console.log("Ожидаем второго игрока...");
        io.emit('waitingForPlayers');
    }
}

function checkGameOver() {
    if (!bricks.some((brick) => brick.active)) {
        console.log("Все кирпичи уничтожены! Рестарт игры.");
        resetGame();
    }
}

function incrementScore(playerId, points = 10) {
    if (!scores[playerId]) scores[playerId] = 0;
    scores[playerId] += points;
    console.log(`Игрок ${playerId} получил ${points} очков. Всего: ${scores[playerId]}`);
}

bricks = initializeBricks();

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log(`Игрок подключился: ${socket.id}`);

    if (Object.keys(players).length >= MAX_PLAYERS) {
        console.log(`Игрок ${socket.id} отклонён: максимум ${MAX_PLAYERS} игроков.`);
        socket.emit('roomFull');
        socket.disconnect();
        return;
    }

    addPlayer(socket);

    socket.emit('currentPlayers', players);
    socket.emit('currentBalls', balls);
    socket.emit('currentBricks', bricks);
    socket.emit('currentScores', scores);

    io.emit('newPlayer', players[socket.id]);
    io.emit('newBall', balls[socket.id]);

    checkStartGame();

    socket.on('playerMoved', (movementData) => {
        if (players[socket.id]) {
            Object.assign(players[socket.id], movementData);
            socket.broadcast.emit('playerMoved', {
                playerId: socket.id,
                ...movementData,
            });
        }
    });

    socket.on('ballMoved', (ballData) => {
        if (balls[socket.id]) {
            Object.assign(balls[socket.id], ballData);
            socket.broadcast.emit('ballMoved', balls[socket.id]);
        }
    });

    socket.on('brickHit', (brickId) => {
        const brick = bricks.find((b) => b.id === brickId);
        if (brick && brick.active) {
            console.log(`Кирпич уничтожен: ${brickId}`);
            brick.active = false;

            incrementScore(socket.id, 10);

            io.emit('brickHit', { brickId, scores });
            checkGameOver();
        }
    });

    socket.on('disconnect', () => {
        console.log(`Игрок отключился: ${socket.id}`);
        removePlayer(socket.id);

        io.emit('playerDisconnected', socket.id);

        if (Object.keys(players).length < MAX_PLAYERS) {
            console.log("Недостаточно игроков для продолжения игры.");
            io.emit('pauseGame');
        }
    });
});

const PORT = 8081;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
