export function resetBall(scene) {
    scene.ball.setPosition(400, 300);
    scene.ball.setVelocity(150, -150);
    console.log("Мяч сброшен в начальную позицию");
}

export function resetLevel(scene) {
    resetBall(scene);
    scene.bricks.children.each((brick) => {
        brick.enableBody(false, 0, 0, true, true);
    });
    console.log("Кирпичи восстановлены");
}
