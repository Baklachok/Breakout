class Breakout extends Phaser.Scene
{
    constructor ()
    {
        super({ key: 'breakout' });

        this.bricks;
        this.paddle;
        this.ball;
    }

    preload() {
        console.log("Начата загрузка ресурсов...");
        this.load.image('ballBlue', 'assets/ballBlue.png');
        this.load.image('ballRed', 'assets/ballRed.png');
        this.load.image('paddleBlue', 'assets/paddleBlue.png');
        this.load.image('paddleRed', 'assets/paddleRed.png');
        
        // Загрузка кирпичей
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
    
        this.otherPlayers = this.add.group(); // Группа для других игроков
        this.otherBalls = this.add.group();

        // // Ваш шарик
        // this.ball = this.physics.add.image(400, 300, 'ball').setCollideWorldBounds(true).setBounce(1);
        // this.ball.setVelocity(150, -150);

        // Отправить серверу данные о перемещении шарика
        this.physics.world.on('worldstep', () => {
            this.socket.emit('ballMoved', {
                x: this.ball.x,
                y: this.ball.y,
                velocityX: this.ball.body.velocity.x,
                velocityY: this.ball.body.velocity.y
            });
        });

        // Обработчик текущих игроков
        this.socket.on('currentPlayers', (players) => {
            console.log("Получены данные о текущих игроках:", players);
            Object.keys(players).forEach((id) => {
                if (id === this.socket.id) {
                    console.log("Добавлен ваш игрок:", players[id]);
                    this.addPlayer(players[id]); // Ваш игрок
                } else {
                    console.log("Добавлен другой игрок:", players[id]);
                    this.addOtherPlayer(players[id]); // Остальные игроки
                }
            });
        });

        // Получить текущие шарики
        this.socket.on('currentBalls', (balls) => {
            console.log("Текущие шарики от сервера:", balls);
            Object.keys(balls).forEach((id) => {
                if (id !== this.socket.id) {
                    this.addOtherBall(balls[id]);
                }
            });
        });

        this.socket.on('currentBricks', (serverBricks) => {
            console.log("Получены данные о кирпичах:", serverBricks);
            serverBricks.forEach((serverBrick) => {
                const brick = this.bricks.getChildren().find(b => b.id === serverBrick.id);
                if (brick) {
                    if (!serverBrick.active) {
                        brick.disableBody(true, true);
                    }
                } else if (serverBrick.active) {
                    const newBrick = this.bricks.create(serverBrick.x, serverBrick.y, 'brick0');
                    newBrick.id = serverBrick.id;
                }
            });
        });        
    
        // Новый игрок подключился
        this.socket.on('newPlayer', (playerInfo) => {
            console.log("Подключился новый игрок:", playerInfo);
            this.addOtherPlayer(playerInfo);
        });

        // Новый шарик
        this.socket.on('newBall', (ballData) => {
            this.addOtherBall(ballData);
        });

        // Обновление шарика
        this.socket.on('ballMoved', (ballData) => {
            const otherBall = this.otherBalls.getChildren().find((b) => b.owner === ballData.owner);
            if (otherBall) {
                otherBall.setPosition(ballData.x, ballData.y);
                otherBall.setVelocity(ballData.velocityX, ballData.velocityY);
            }
        });
    
        // Движение других игроков
        this.socket.on('playerMoved', (playerInfo) => {
            console.log("Получены данные о движении другого игрока:", playerInfo);
            const otherPlayer = this.otherPlayers.getChildren().find((p) => p.playerId === playerInfo.playerId);
            if (otherPlayer) {
                otherPlayer.setPosition(playerInfo.x, playerInfo.y); // Обновляем положение платформы
            }
        });

        this.socket.on('resetGame', (serverBricks) => {
            console.log("Получено событие resetGame. Синхронизируем кирпичи...");
        
            // Удалить текущие кирпичи
            this.bricks.clear(true, true);
        
            // Пересоздать кирпичи на основе данных сервера
            serverBricks.forEach((serverBrick) => {
                if (serverBrick.active) {
                    const brick = this.bricks.create(serverBrick.x, serverBrick.y, 'brick0');
                    brick.id = serverBrick.id;
                }
            });
        
            // Сбросить шарик и другие параметры
            this.resetBall();
        });
        
        
    
        // Отключение игрока
        this.socket.on('playerDisconnected', (playerId) => {
            console.log("Отключился игрок:", playerId);
            const player = this.otherPlayers.getChildren().find((p) => p.playerId === playerId);
            if (player) {
                player.destroy();
            }
            const otherBall = this.otherBalls.getChildren().find((b) => b.owner === playerId);
            if (otherBall) otherBall.destroy();
        });
    
        // Обработчик мяча
        this.socket.on('ballState', (ballData) => {
            console.log("Получено состояние мяча от сервера:", ballData);
            this.ball.setPosition(ballData.x, ballData.y);
            this.ball.setVelocity(ballData.velocityX, ballData.velocityY);
        });

        this.socket.on('brickHit', (brickId) => {
            console.log(`Событие brickHit получено для кирпича: ${brickId}`);
            const brick = this.bricks.getChildren().find(b => b.id === brickId);
            if (brick && brick.active) {
                brick.disableBody(true, true);
        
                // Сообщить всем остальным игрокам только об этом кирпиче
                this.socket.emit('brickHit', brickId);
        
                // Проверяем, остались ли активные кирпичи
                if (!this.bricks.getChildren().some(b => b.active)) {
                    console.log("Все кирпичи уничтожены! Рестарт игры.");
                    this.resetGame(); // Отправить событие для перезапуска игры
                }
            }
        });
              
        
    
        // Создание физического мира
        this.createGameObjects();

        // Создание кирпичей
        this.createBricks();

        // События сокетов (как раньше)
        this.setupSocketEvents();
    }
    
    
    addPlayer(playerInfo) {
        console.log("Добавление вашего игрока:", playerInfo);
    
        // Убедимся, что paddle и ball созданы
        if (!this.paddle) {
            this.paddle = this.physics.add.image(playerInfo.x, playerInfo.y, 'defaultPaddle').setCollideWorldBounds(true);
        }
        if (!this.ball) {
            this.ball = this.physics.add.image(playerInfo.x, playerInfo.y - 50, 'defaultBall').setCollideWorldBounds(true).setBounce(1);
        }
    
        // Установка текстур
        const paddleTexture = playerInfo.color === 'blue' ? 'paddleBlue' : 'paddleRed';
        this.paddle.setTexture(paddleTexture);
        this.paddle.setPosition(playerInfo.x, playerInfo.y);
    
        const ballTexture = playerInfo.color === 'blue' ? 'ballBlue' : 'ballRed';
        this.ball.setTexture(ballTexture);
    }
    
    addOtherPlayer(playerInfo) {
        console.log("Добавление другого игрока:", playerInfo);
    
        // Убедимся, что группа otherPlayers существует
        if (!this.otherPlayers) {
            this.otherPlayers = this.physics.add.group();
        }
    
        // Создаём платформу другого игрока
        const paddleTexture = playerInfo.color === 'blue' ? 'paddleBlue' : 'paddleRed';
        const otherPlayer = this.physics.add.image(playerInfo.x, playerInfo.y, paddleTexture).setImmovable();
        otherPlayer.playerId = playerInfo.playerId;
    
        this.otherPlayers.add(otherPlayer);
    }
     

    addOtherBall(ballData) {
        const ballTexture = ballData.color === 'blue' ? 'ballBlue' : 'ballRed';
        const otherBall = this.physics.add.image(ballData.x, ballData.y, ballTexture).setCollideWorldBounds(true).setBounce(1);
        otherBall.setVelocity(ballData.velocityX, ballData.velocityY);
        otherBall.owner = ballData.owner;
        this.otherBalls.add(otherBall);
    }

    hitBrick(ball, brick) {
        console.log("Шарик столкнулся с кирпичом!", brick.id);
    
        if (brick) {
            brick.disableBody(true, true);
        
            // Отправить на сервер событие о разрушении кирпича
            this.socket.emit('brickHit', brick.id);
        }
    
        if (this.bricks.countActive() === 0) {
            this.resetLevel();
        }
    }

    resetBall() {
        this.ball.setPosition(400, 300);
        this.ball.setVelocity(150, -150);
        console.log("Мяч сброшен в начальную позицию");
    }

    resetLevel ()
    {
        this.resetBall();
        this.bricks.children.each(brick =>
        {
            brick.enableBody(false, 0, 0, true, true);
        });
        console.log("Кирпичи восстановлены");
    }

    resetGame() {
        console.log("Рестарт игры...");
        this.resetBall();
        this.bricks.children.each(brick => {
            brick.enableBody(false, 0, 0, true, true);
        });
        console.log("Шарик и кирпичи сброшены.");
    }

    hitPaddle(ball, paddle) {
    console.log("Шарик столкнулся с платформой!");
    let diff = 0;

    if (ball.x < paddle.x) {
        // Шарик левее центра платформы
        diff = paddle.x - ball.x;
        ball.setVelocityX(-10 * diff);
    } else if (ball.x > paddle.x) {
        // Шарик правее центра платформы
        diff = ball.x - paddle.x;
        ball.setVelocityX(10 * diff);
    } else {
        // Центр платформы
        ball.setVelocityX(2 + Math.random() * 8);
    }
}

    createGameObjects() {
        console.log("Создаём игровые объекты...");
    
        // Установить текстуру для мяча игрока
        const playerBallTexture = 'ballBlue'; // Предположим, игрок всегда использует синий мяч
        this.ball = this.physics.add.image(400, 300, playerBallTexture)
            .setCollideWorldBounds(true)
            .setBounce(1);

        this.ball.setVelocity(150, -150);
        console.log("Мяч игрока создан с текстурой:", playerBallTexture);

        // Платформа
        this.paddle = this.physics.add.image(400, 550, 'paddleBlue').setImmovable();
        console.log("Создана платформа для игрока");
    
        // Логика столкновения с платформой
        this.physics.add.collider(this.ball, this.paddle, this.hitPaddle, null, this);
    
        // Управление движением платформы
        this.input.on('pointermove', (pointer) => {
            console.log(`Pointer moved to x=${pointer.x}`);
            // Перемещаем платформу
            this.paddle.x = Phaser.Math.Clamp(pointer.x, 52, 748);
    
            // Удалите или закомментируйте отправку данных на сервер
            this.socket.emit('playerMoved', { x: this.paddle.x, y: this.paddle.y });
            console.log(`Платформа перемещена локально: x=${this.paddle.x}`);
        });
    }
    

    createBricks() {
        console.log("Создание кирпичей...");
        this.bricks = this.physics.add.staticGroup();

            const rows = 5; // Количество рядов
            const cols = 10; // Количество колонок
            const brickWidth = 64; // Ширина кирпича
            const brickHeight = 32; // Высота кирпича
            const offsetX = 64; // Отступ слева
            const offsetY = 50; // Отступ сверху

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const brick = this.bricks.create(
                        offsetX + col * brickWidth,
                        offsetY + row * brickHeight,
                        'brick0'
                    );
                    brick.setOrigin(0.5, 0.5);
                    brick.id = `${row}-${col}`; // Уникальный идентификатор
                }
            }

            this.physics.add.collider(this.ball, this.bricks, this.hitBrick, null, this);
        console.log("Кирпичи успешно созданы");
    }

    setupSocketEvents() {
        console.log("Настраиваем события сокетов...");
        
        // Обработчик обновления игрока
        this.socket.on('updatePlayer', (playerInfo) => {
            console.log("Получены обновления игрока:", playerInfo);
        });
    
        // Обработчик событий игры
        this.socket.on('gameUpdate', (gameState) => {
            console.log("Обновление состояния игры:", gameState);
        });
    
        // Вы можете добавить сюда другие события сокетов
        console.log("События сокетов настроены.");
    }
}

const config = {
    type: Phaser.WEBGL,
    width: 800,
    height: 600,
    parent: 'phaser-example',
    scene: [ Breakout ],
    physics: {
        default: 'arcade'
    }
};

const game = new Phaser.Game(config);