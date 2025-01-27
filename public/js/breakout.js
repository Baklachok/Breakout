import { createGameObjects, createBricks } from './gameObjects.js';
import { setupSocketEvents } from './socketEvents.js';
import { addPlayer, addOtherPlayer, addOtherBall } from './playerHandlers.js';

export default class Breakout extends Phaser.Scene {
    constructor() {
        super({ key: 'breakout' });
        this.bricks = null;
        this.paddle = null;
        this.ball = null;

        this.otherPlayers = null;
        this.otherBalls = null;
    }

    preload() {
        console.log("Начата загрузка ресурсов...");
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

        // Установите соединение с сервером
        this.socket = io();
        console.log("Установлено соединение с сервером");

        this.otherPlayers = this.add.group();
        this.otherBalls = this.add.group();

        // Создание игровых объектов
        createGameObjects(this);
        createBricks(this);

        // Настройка событий сокетов
        setupSocketEvents(this);

        // Обработчики движения платформы
        this.input.on('pointermove', (pointer) => {
            this.paddle.x = Phaser.Math.Clamp(pointer.x, 52, 748);
            this.socket.emit('playerMoved', { x: this.paddle.x, y: this.paddle.y });
        });

        this.physics.world.on('worldbounds', (body) => {
            if (body.gameObject === this.ball) {
                // Отправка новых координат и скорости мяча на сервер
                const ballData = {
                    x: this.ball.x,
                    y: this.ball.y,
                    velocityX: this.ball.body.velocity.x,
                    velocityY: this.ball.body.velocity.y,
                };
                this.socket.emit('ballMoved', ballData);
            }
        });        
        
    }

    update() {
        if (this.ball) {
            const ballData = {
                x: this.ball.x,
                y: this.ball.y,
                velocityX: this.ball.body.velocity.x,
                velocityY: this.ball.body.velocity.y,
            };
            this.socket.emit('ballMoved', ballData);
        }
    }    

    // Функции для взаимодействия
    addPlayer(playerInfo) {
        addPlayer(this, playerInfo);
    }

    addOtherPlayer(playerInfo) {
        addOtherPlayer(this, playerInfo);
    }

    addOtherBall(ballData) {
        addOtherBall(this, ballData);
    }

    resetBall() {
        this.ball.setPosition(400, 300);
        this.ball.setVelocity(150, -150);
        console.log("Мяч сброшен в начальную позицию");
    }

    resetGame() {
        this.bricks.clear(true, true); // Удаляем все кирпичи из сцены
    
        // Восстанавливаем кирпичи на основе данных от сервера
        this.socket.on('resetGame', (bricks) => {
            bricks.forEach((brick) => {
                if (brick.active) {
                    const brickSprite = this.physics.add.image(brick.x, brick.y, 'brick0');
                    brickSprite.id = brick.id;
                    this.bricks.add(brickSprite);
                }
            });
        });
    }
    

    resetLevel() {
        this.resetBall();
        this.bricks.children.each(brick => {
            brick.enableBody(false, 0, 0, true, true);
        });
        console.log("Кирпичи восстановлены");
    }

    hitBrick(ball, brick) {
        console.log("Шарик столкнулся с кирпичом!", brick.id);
        if (brick) {
            brick.destroy();
            this.socket.emit('brickHit', brick.id);
        }
        if (this.bricks.countActive() === 0) {
            this.resetLevel();
        }
    }

    hitPaddle(ball, paddle) {
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
