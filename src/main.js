// Entry point: wires canvas, input, audio, UI and the game together.
import { Game } from './game.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI, initGoldIcon } from './ui/ui.js';
import { buildSprites } from './render/sprites.js';

function start() {
  buildSprites();
  const canvas = document.getElementById('game');
  const ui = new UI(document.getElementById('ui'));
  const input = new Input(canvas);
  const audio = new Audio();
  const game = new Game(canvas, ui, input, audio);
  ui.game = game;
  initGoldIcon();
  // browsers only allow audio after a user gesture
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  game.boot();
  window.__game = game; // handy for debugging in the console
}

window.addEventListener('error', (e) => {
  const box = document.getElementById('fatal');
  if (box) { box.style.display = 'block'; box.textContent = 'Something went wrong: ' + e.message; }
});

if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('16px "Pixelify Sans"'), document.fonts.load('16px "VT323"')]).finally(start);
else start();
