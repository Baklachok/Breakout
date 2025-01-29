export function setupSocketEvents(scene) {
    console.log("Настраиваем события сокетов...");

    scene.socket.on('currentPlayers', (players) => {
        console.log("Получены данные о текущих игроках:", players);
        Object.keys(players).forEach((id) => {
            if (id === scene.socket.id) {
                scene.addPlayer(players[id]);
            } else {
                scene.addOtherPlayer(players[id]);
            }
        });
    });

    scene.socket.on('currentBalls', (balls) => {
        console.log("Текущие шарики от сервера:", balls);
        Object.keys(balls).forEach((id) => {
            if (id !== scene.socket.id) {
                console.log("Добавление другого мячика:", balls[id]);
                scene.addOtherBall(balls[id]);
            }
        });
    });

    scene.socket.on('currentBricks', (bricks) => {
        console.log("Получены актуальные кирпичи от сервера:", bricks);

        scene.bricks.clear(true, true); // Удаляем старые кирпичи
        bricks.forEach((brick) => {
            if (brick.active) {
                const brickSprite = scene.bricks.create(brick.x, brick.y, 'brick0');
                brickSprite.id = brick.id;
            }
        });
    });
  
    
    scene.socket.on('brickHit', (brickId) => {
        console.log("Кирпич ударен:", brickId);
    
        const brick = scene.bricks.getChildren().find((b) => b.id === brickId);
        if (brick) {
            brick.destroy(); // Удаляем кирпич
        }
    });  

    scene.socket.on('playerMoved', (playerInfo) => {
        const otherPlayer = scene.otherPlayers.getChildren().find((p) => p.playerId === playerInfo.playerId);
        if (otherPlayer) {
            otherPlayer.setPosition(playerInfo.x, playerInfo.y);
        }
    });

    scene.socket.on('playerDisconnected', (playerId) => {
        const player = scene.otherPlayers.getChildren().find((p) => p.playerId === playerId);
        if (player) player.destroy();

        const otherBall = scene.otherBalls.getChildren().find((b) => b.owner === playerId);
        if (otherBall) otherBall.destroy();
    });

    scene.socket.on('newPlayer', (playerInfo) => {
        if (playerInfo.playerId !== scene.socket.id) {
            console.log("Новый игрок присоединился:", playerInfo);
            scene.addOtherPlayer(playerInfo);
        }
    });
    
    scene.socket.on('newBall', (ballData) => {
        if (ballData.owner !== scene.socket.id) {
            console.log("Новый шарик добавлен:", ballData);
            scene.addOtherBall(ballData);
        }
    });
     
    scene.socket.on('ballMoved', (ballData) => {
        // Найти мячик по идентификатору владельца
        const ball = scene.otherBalls.getChildren().find((b) => b.owner === ballData.owner);
        if (ball) {
            // Обновить позицию и скорость мячика
            ball.setPosition(ballData.x, ballData.y);
            ball.setVelocity(ballData.velocityX, ballData.velocityY);
        } else {
            console.log("Мячик не найден для обновления:", ballData);
        }
    });  
    
    scene.socket.on('resetGame', (bricks) => {
        console.log("Сброс игры. Восстановление кирпичей.");
        scene.bricks.clear(true, true); // Удаляем старые кирпичи
        
        bricks.forEach((brick) => {
            if (brick.active) {
                const brickSprite = scene.physics.add.staticImage(brick.x, brick.y, 'brick0'); // Создаем статичный кирпич
                brickSprite.id = brick.id;
    
                // Добавляем кирпич в группу
                scene.bricks.add(brickSprite);
    
                // Включаем столкновения между мячом и кирпичами
                scene.physics.add.collider(scene.ball, brickSprite, (ball, brick) => {
                    scene.hitBrick(ball, brick);
                });
            }
        });
    });       

    console.log("События сокетов настроены.");
}
