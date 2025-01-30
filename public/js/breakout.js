import { createGameObjects, createBricks } from './gameObjects.js';
import { setupSocketEvents } from './socketEvents.js';
import { addPlayer, addOtherPlayer, addOtherBall } from './playerHandlers.js';
import { resetBall, resetLevel } from './utilities.js';

export default class Breakout extends Phaser.Scene {
    constructor() {
        super({ key: 'breakout' });
        this.bricks = null;
        this.paddle = null;
        this.ball = null;
        this.otherPlayers = null;
        this.otherBalls = null;
        this.isGameStarted = false; // Флаг состояния игры
    }

    preload() {
        console.log("Начата загрузка ресурсов...");

        // Загрузка ресурсов
        this.load.image('ballBlue', 'assets/ballBlue.png');
        this.load.image('ballRed', 'assets/ballRed.png');
        this.load.image('paddleBlue', 'assets/paddleBlue.png');
        this.load.image('paddleRed', 'assets/paddleRed.png');

        for (let i = 0; i <= 5; i++) {
            this.load.image(`brick${i}`, `assets/brick${i}.png`);
        }

        console.log("Ресурсы успешно загружены");
    }

    create() {
        console.log("Создание сцены Breakout");

        // Установка соединения с сервером
        this.socket = io();
        console.log("Установлено соединение с сервером");

        // Создание групп для других игроков и мячей
        this.otherPlayers = this.add.group();
        this.otherBalls = this.add.group();

        // Создание игровых объектов
        createGameObjects(this);
        createBricks(this);

        // Настройка событий
        this.setupInputHandlers();
        setupSocketEvents(this);
    }

    // === Метод для старта игры ===
    startGame() {
        this.isGameStarted = true; // Устанавливаем флаг начала игры
        resetBall(this); // Сбрасываем мяч в начальное положение
    }

    // === Метод для паузы игры ===
    pauseGame() {
        this.isGameStarted = false; // Останавливаем игровую логику
        if (this.ball) {
            this.ball.setVelocity(0, 0); // Останавливаем движение мяча
        }
    }

    // Метод для показа сообщения об ожидании
    showWaitingMessage() {
        const text = this.add.text(400, 300, 'Ожидание второго игрока...', {
            fontSize: '32px',
            color: '#ffffff',
        });
        text.setOrigin(0.5, 0.5);
        this.time.addEvent({
            delay: 3000,
            callback: () => text.destroy(),
        });
    }

    update() {
        // Обновляем движение мяча только если игра началась
        if (this.isGameStarted && this.ball) {
            const ballData = {
                x: this.ball.x,
                y: this.ball.y,
                velocityX: this.ball.body.velocity.x,
                velocityY: this.ball.body.velocity.y,
            };
            this.socket.emit('ballMoved', ballData);
        }
    }

    // Настройка обработчиков ввода
    setupInputHandlers() {
        this.input.on('pointermove', (pointer) => {
            this.paddle.x = Phaser.Math.Clamp(pointer.x, 52, 748);
            this.socket.emit('playerMoved', { x: this.paddle.x, y: this.paddle.y });
        });

        this.physics.world.on('worldbounds', (body) => {
            if (body.gameObject === this.ball) {
                this.emitBallData();
            }
        });
    }

    // Отправка данных мяча на сервер
    emitBallData() {
        const ballData = {
            x: this.ball.x,
            y: this.ball.y,
            velocityX: this.ball.body.velocity.x,
            velocityY: this.ball.body.velocity.y,
        };
        this.socket.emit('ballMoved', ballData);
    }

    // Функции взаимодействия
    addPlayer(playerInfo) {
        addPlayer(this, playerInfo);
    }

    addOtherPlayer(playerInfo) {
        addOtherPlayer(this, playerInfo);
    }

    addOtherBall(ballData) {
        addOtherBall(this, ballData);
    }

    resetGame() {
        this.clearBricks();

        this.socket.once('resetGame', (bricks) => {
            this.restoreBricks(bricks);
        });
    }

    clearBricks() {
        this.bricks.clear(true, true);
    }

    restoreBricks(bricks) {
        bricks.forEach((brick) => {
            if (brick.active) {
                const brickSprite = this.createBrick(brick);
                this.bricks.add(brickSprite);
            }
        });
        console.log("Кирпичи восстановлены из данных сервера");
    }

    createBrick(brickData) {
        const brick = this.physics.add.staticImage(brickData.x, brickData.y, 'brick0');
        brick.id = brickData.id;

        // Добавление коллайдера для взаимодействия мяча и кирпичей
        this.physics.add.collider(this.ball, brick, (ball, brick) => {
            this.hitBrick(ball, brick);
        });

        return brick;
    }

    hitBrick(ball, brick) {
        // Проверяем, началась ли игра
        if (!this.isGameStarted) return;

        console.log("Шарик столкнулся с кирпичом!", brick.id);
        if (brick) {
            brick.destroy();
            this.socket.emit('brickHit', brick.id);
        }
        if (this.bricks.countActive() === 0) {
            resetLevel(this);
        }
    }

    hitPaddle(ball, paddle) {
        // Проверяем, началась ли игра
        if (!this.isGameStarted) return;

        console.log("Шарик столкнулся с платформой!");
        let diff = 0;
        if (ball.x < paddle.x) {
            diff = paddle.x - ball.x;
            ball.setVelocityX(-10 * diff);
        } else if (ball.x > paddle.x) {
            diff = ball.x - paddle.x;
            ball.setVelocityX(10 * diff);
        } else {
            ball.setVelocityX(2 + Math.random() * 8);
        }
    }
}
