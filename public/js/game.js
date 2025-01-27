import Breakout from './breakout.js';

const config = {
    type: Phaser.WEBGL,
    width: 800,
    height: 600,
    parent: 'phaser-example',
    scene: [Breakout],
    physics: {
        default: 'arcade'
    }
};

const game = new Phaser.Game(config);
