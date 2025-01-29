const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Создание приложения
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Данные игры
const players = {};
const balls = {};
let bricks = [];

// === Функция для инициализации кирпичей ===
function initializeBricks(rows = 5, cols = 10) {
    return Array.from({ length: rows }, (_, row) => {
        return Array.from({ length: cols }, (_, col) => ({
            id: `${row}-${col}`,
            x: 64 + col * 64,
            y: 50 + row * 32,
            active: true,
        }));
    }).flat();
}

// === Функция для сброса игры ===
function resetGame() {
    console.log("Рестарт игры. Восстанавливаем кирпичи.");
    bricks = initializeBricks(); // Инициализируем кирпичи заново
    io.emit('resetGame', bricks); // Уведомляем всех игроков
}

// === Функция для подсчёта игроков определённого цвета ===
function countPlayersByColor(color) {
    return Object.values(players).filter((player) => player.color === color).length;
}

// === Инициализация кирпичей перед запуском сервера ===
bricks = initializeBricks();

// === Настройка маршрутов сервера ===
app.use(express.static(__dirname + '/public')); // Папка для статических файлов

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html'); // Главная страница
});

// === Основная логика работы с сокетами ===
io.on('connection', (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    // Назначение цвета игроку
    const bluePlayers = countPlayersByColor('blue');
    const redPlayers = countPlayersByColor('red');
    const playerColor = bluePlayers <= redPlayers ? 'blue' : 'red';

    // Создание нового игрока
    players[socket.id] = {
        x: 400,
        y: 550,
        playerId: socket.id,
        color: playerColor,
    };

    // Создание мяча игрока
    balls[socket.id] = {
        x: 400,
        y: 300,
        velocityX: 150,
        velocityY: -150,
        owner: socket.id,
        color: playerColor,
    };

    console.log(`Игрок добавлен: ${JSON.stringify(players[socket.id])}`);

    // === Передача текущих данных новому игроку ===
    socket.emit('currentPlayers', players);
    socket.emit('currentBalls', balls);
    socket.emit('currentBricks', bricks);

    // Уведомление остальных игроков о новом подключении
    io.emit('newPlayer', players[socket.id]);
    io.emit('newBall', balls[socket.id]);

    // === Обработка движения игрока ===
    socket.on('playerMoved', (movementData) => {
        const player = players[socket.id];
        if (player) {
            player.x = movementData.x;
            player.y = movementData.y;

            // Уведомить остальных игроков
            socket.broadcast.emit('playerMoved', {
                playerId: socket.id,
                x: movementData.x,
                y: movementData.y,
            });
        }
    });

    // === Обработка движения мяча ===
    socket.on('ballMoved', (ballData) => {
        const ball = balls[socket.id];
        if (ball) {
            Object.assign(ball, ballData); // Обновление состояния мяча
            socket.broadcast.emit('ballMoved', ball); // Уведомление остальных
        }
    });

    // === Обработка удара по кирпичу ===
    socket.on('brickHit', (brickId) => {
        const brick = bricks.find((b) => b.id === brickId);
        if (brick && brick.active) {
            console.log(`Кирпич уничтожен: ${brickId}`);
            brick.active = false; // Деактивируем кирпич
            io.emit('brickHit', brickId); // Уведомляем всех игроков

            // Проверяем, остались ли активные кирпичи
            if (!bricks.some((b) => b.active)) {
                console.log("Все кирпичи уничтожены! Рестарт игры.");
                resetGame(); // Перезапуск игры
            }
        } else {
            console.error(`Ошибка: Кирпич ${brickId} не найден или уже уничтожен.`);
        }
    });

    // === Удаление игрока при отключении ===
    socket.on('disconnect', () => {
        console.log(`Пользователь отключился: ${socket.id}`);

        // Удаляем игрока и его мяч
        if (players[socket.id]) {
            delete players[socket.id];
        }

        if (balls[socket.id]) {
            delete balls[socket.id];
        }

        // Уведомляем остальных игроков
        io.emit('playerDisconnected', socket.id);
    });
});

// === Запуск сервера ===
const PORT = 8081;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
