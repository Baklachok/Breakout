const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const players = {};
const balls = {};
let bricks = [];

// Инициализация кирпичей
function initializeBricks(rows = 5, cols = 10) {
    const newBricks = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            newBricks.push({
                id: `${row}-${col}`, // Уникальный идентификатор кирпича
                x: 64 + col * 64,    // Позиция кирпича по X
                y: 50 + row * 32,    // Позиция кирпича по Y
                active: true         // Кирпич активен
            });
        }
    }
    return newBricks;
}

// Инициализация кирпичей перед запуском сервера
bricks = initializeBricks();

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    // Добавление нового игрока
    players[socket.id] = {
        x: 400, // начальная позиция платформы
        y: 550,
        playerId: socket.id,
    };

    balls[socket.id] = {
        x: 400,
        y: 300,
        velocityX: 150,
        velocityY: -150,
        owner: socket.id,
    };

    console.log(`Игрок добавлен: ${JSON.stringify(players[socket.id])}`);

    // Отправить текущие данные новому игроку
    socket.emit('currentPlayers', players);
    socket.emit('currentBalls', balls);
    socket.emit('currentBricks', bricks);

    // Сообщить другим игрокам о новом игроке
    socket.broadcast.emit('newPlayer', players[socket.id]);
    socket.broadcast.emit('newBall', balls[socket.id]);

    // Обработка движения игрока
    socket.on('playerMoved', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;

            // Уведомить остальных игроков
            socket.broadcast.emit('playerMoved', {
                playerId: socket.id,
                x: movementData.x,
                y: movementData.y,
            });
        }
    });

    // Обновление состояния шарика
    socket.on('ballMoved', (ballData) => {
        if (balls[socket.id]) {
            Object.assign(balls[socket.id], ballData);
            socket.broadcast.emit('ballMoved', balls[socket.id]);
        }
    });

    // Обработка удара по кирпичу
    socket.on('brickHit', (brickId) => {
        const brick = bricks.find((b) => b.id === brickId);
        if (brick && brick.active) {
            brick.active = false;
            io.emit('brickHit', brickId);

            // Проверить, остались ли активные кирпичи
            if (!bricks.some((b) => b.active)) {
                console.log("Все кирпичи уничтожены! Рестарт игры.");
                resetGame();
            }
        }
    });

    // Удаление игрока при отключении
    socket.on('disconnect', () => {
        console.log(`Пользователь отключился: ${socket.id}`);
        delete players[socket.id];
        delete balls[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Перезапуск игры
function resetGame() {
    console.log("Рестарт игры. Восстанавливаем кирпичи.");
    bricks = initializeBricks();
    io.emit('resetGame', bricks);
}

// Запуск сервера
server.listen(8081, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${server.address().port}`);
});
