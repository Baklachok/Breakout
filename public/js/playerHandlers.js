export function addPlayer(scene, playerInfo) {
    console.log("Добавление вашего игрока:", playerInfo);

    // Убедимся, что paddle и ball созданы
    if (!scene.paddle) {
        scene.paddle = scene.physics.add.image(playerInfo.x, playerInfo.y, 'defaultPaddle').setCollideWorldBounds(true);
    }
    if (!scene.ball) {
        scene.ball = scene.physics.add.image(playerInfo.x, playerInfo.y - 50, 'defaultBall').setCollideWorldBounds(true).setBounce(1);
    }

    // Установка текстур
    const paddleTexture = playerInfo.color === 'blue' ? 'paddleBlue' : 'paddleRed';
    scene.paddle.setTexture(paddleTexture);
    scene.paddle.setPosition(playerInfo.x, playerInfo.y);

    const ballTexture = playerInfo.color === 'blue' ? 'ballBlue' : 'ballRed';
    scene.ball.setTexture(ballTexture);
}

export function addOtherPlayer(scene, playerInfo) {
    console.log("Добавление другого игрока:", playerInfo);

    // Убедимся, что группа otherPlayers существует
    if (!scene.otherPlayers) {
        scene.otherPlayers = scene.physics.add.group();
    }

    // Создаём платформу другого игрока
    const paddleTexture = playerInfo.color === 'blue' ? 'paddleBlue' : 'paddleRed';
    const otherPlayer = scene.physics.add.image(playerInfo.x, playerInfo.y, paddleTexture).setImmovable();
    otherPlayer.playerId = playerInfo.playerId;

    scene.otherPlayers.add(otherPlayer);
}

export function addOtherBall(scene, ballData) {
    console.log("Создаем мячик для другого игрока:", ballData);
    const ballTexture = ballData.color === 'blue' ? 'ballBlue' : 'ballRed';
    const otherBall = scene.physics.add.image(ballData.x, ballData.y, ballTexture).setCollideWorldBounds(true).setBounce(1);
    otherBall.setVelocity(ballData.velocityX, ballData.velocityY);
    otherBall.owner = ballData.owner;
    scene.otherBalls.add(otherBall);
}
