export function createGameObjects(scene) {
    console.log("Создаём игровые объекты...");

    const playerBallTexture = 'ballBlue';
    scene.scores = {};

    scene.ball = scene.physics.add.image(400, 300, playerBallTexture)
        .setCollideWorldBounds(true)
        .setBounce(1)
        .setVelocity(150, -150);

    scene.paddle = scene.physics.add.image(400, 550, 'paddleBlue').setImmovable();

    scene.physics.add.collider(scene.ball, scene.paddle, scene.hitPaddle, null, scene);

    // Перемещаем счёт в правый верхний угол
    scene.scoreText = scene.add.text(750, 20, 'Очки: 0', {
        fontSize: '24px',
        fill: '#fff',
        align: 'right'
    }).setOrigin(1, 0); // Устанавливаем якорь в правый верхний угол

    console.log("Игровые объекты созданы.");
}

export function createBricks(scene) {
    console.log("Подготовка группы кирпичей...");
    
    // Создаем пустую группу для кирпичей
    scene.bricks = scene.physics.add.staticGroup();
    scene.isReady = false;
    
    // Ожидание синхронизации кирпичей с сервера
    scene.socket.on('currentBricks', (brickDataArray) => {
        console.log("Получены данные о кирпичах с сервера:", brickDataArray);
    
        // Очистка существующих кирпичей
        scene.bricks.clear(true, true);
    
        // Добавляем новые кирпичи
        brickDataArray.forEach((brickData) => {
            if (brickData.active) {
                const brick = scene.bricks.create(brickData.x, brickData.y, `brick${brickData.type || 0}`);
                brick.id = brickData.id;
                brick.setOrigin(0.5, 0.5);
            }
        });
    
        // Устанавливаем коллайдер после добавления всех кирпичей
        scene.physics.add.collider(scene.ball, scene.bricks, scene.hitBrick, null, scene);
    
        scene.isReady = true;
        console.log("Кирпичи успешно добавлены на сцену.");
    });
    

    console.log("Группа кирпичей подготовлена.");
}

