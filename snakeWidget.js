define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/snake'
], function(baja, Widget) {
  'use strict';

  var SnakeUx = function() {
    var that = this;
    Widget.apply(this, arguments);

    // Game state
    this.$snake = [{x: 10, y: 10}];
    this.$direction = {x: 1, y: 0};
    this.$nextDirection = {x: 1, y: 0};
    this.$food = {x: 5, y: 5};
    this.$score = 0;
    this.$highScore = 0;
    this.$gameRunning = false;
    this.$gameReady = false;
    this.$gameLoop = null;
    this.$speed = 150;
    this.$gridSize = 20;

    // Enhanced visual effects
    this.$particles = [];
    this.$trailParticles = [];
    this.$scoreParticles = [];
    this.$animationFrame = 0;
    this.$foodPulse = 0;
    this.$snakeGlow = 0;
    this.$celebrationMode = 0;

    // Game constants
    this.BOARD_WIDTH = 20;
    this.BOARD_HEIGHT = 20;
    this.CELL_SIZE = 20;

    // Load high score from localStorage if available
    try {
      this.$highScore = parseInt(localStorage.getItem('snake-high-score') || '0');
    } catch(e) {
      this.$highScore = 0;
    }
  };

  SnakeUx.prototype = Object.create(Widget.prototype);
  SnakeUx.prototype.constructor = SnakeUx;

  // Helper function to safely find elements
  SnakeUx.prototype.findElement = function(selector) {
    if (this.$container.querySelector) {
      return this.$container.querySelector(selector);
    } else if (this.$container.nodeType) {
      return this.$container.querySelector(selector);
    } else {
      var elem = this.$container.element || this.$container[0] || this.$container;
      return elem.querySelector ? elem.querySelector(selector) : null;
    }
  };

  SnakeUx.prototype.doInitialize = function(element) {
    var that = this;

    // Handle different element wrapper types
    if (element.nodeType) {
      this.$container = element;
    } else if (element.element) {
      this.$container = element.element;
    } else if (element[0] && element[0].nodeType) {
      this.$container = element[0];
    } else {
      this.$container = element;
    }

    // Create enhanced game HTML
    this.$container.innerHTML =
      '<div class="snake-container">' +
        '<div class="snake-header">' +
          '<h2>Snake</h2>' +
          '<div class="score-display">' +
            '<div class="score-item">' +
              '<div class="score-label">Score</div>' +
              '<div class="score-value" id="current-score">0</div>' +
            '</div>' +
            '<div class="score-item">' +
              '<div class="score-label">High Score</div>' +
              '<div class="score-value" id="high-score">' + this.$highScore + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="game-area">' +
          '<canvas id="game-canvas" width="400" height="400"></canvas>' +
        '</div>' +
        '<div class="game-controls">' +
          '<button id="start-btn">Start Game</button>' +
          '<button id="pause-btn">Pause</button>' +
          '<button id="reset-btn">Reset</button>' +
        '</div>' +
        '<div class="game-instructions">' +
          '<p><strong>Instructions:</strong> Use arrow keys to control the snake. Eat the golden food to grow and earn points!</p>' +
          '<p><strong>Controls:</strong> Arrow Keys = Move, Space = Pause</p>' +
        '</div>' +
        '<div class="snake-overlay" id="game-overlay" style="display: none;">' +
          '<div class="overlay-content">' +
            '<div class="overlay-message" id="overlay-message"></div>' +
            '<button id="overlay-restart">Play Again</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Get element references
    this.$canvas = this.findElement('#game-canvas');
    this.$scoreEl = this.findElement('#current-score');
    this.$highScoreEl = this.findElement('#high-score');
    this.$overlayEl = this.findElement('#game-overlay');
    this.$overlayMessageEl = this.findElement('#overlay-message');

    if (!this.$canvas) {
      console.error('Snake: Canvas element not found');
      return;
    }

    this.$ctx = this.$canvas.getContext('2d');
    if (!this.$ctx) {
      console.error('Snake: Cannot get 2D context');
      return;
    }

    // Button event handlers
    var startBtn = this.findElement('#start-btn');
    var pauseBtn = this.findElement('#pause-btn');
    var resetBtn = this.findElement('#reset-btn');
    var overlayRestartBtn = this.findElement('#overlay-restart');

    if (startBtn) {
      startBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        that.startGame();
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        that.pauseGame();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        that.resetGame();
      });
    }

    if (overlayRestartBtn) {
      overlayRestartBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        that.hideOverlay();
        that.resetGame();
      });
    }

    // Enhanced keyboard controls
    this.$keydownHandler = function(e) {
      if ((that.$gameRunning || that.$gameReady) && that.$container &&
          (document.activeElement === that.$canvas || that.$container.contains(document.activeElement))) {
        that.handleKeyPress(e);
      }
    };
    document.addEventListener('keydown', this.$keydownHandler);

    // Make canvas focusable
    this.$canvas.tabIndex = 0;
    this.$canvas.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.$canvas.focus();
    });

    // Initialize game
    this.resetGame();
    this.draw();

    // Start animation loop after canvas context is ready
    this.startAnimationLoop();
  };

  SnakeUx.prototype.startAnimationLoop = function() {
    var that = this;
    function animate() {
      that.$animationFrame++;
      that.$foodPulse = Math.sin(that.$animationFrame * 0.1) * 0.5 + 0.5;
      that.$snakeGlow = Math.sin(that.$animationFrame * 0.05) * 0.3 + 0.7;

      that.updateParticles();

      if (that.$celebrationMode > 0) {
        that.$celebrationMode--;
      }

      that.draw();
      requestAnimationFrame(animate);
    }
    animate();
  };

  SnakeUx.prototype.createFoodParticles = function() {
    // Create spectacular food collection effect
    var centerX = this.$food.x * this.CELL_SIZE + this.CELL_SIZE / 2;
    var centerY = this.$food.y * this.CELL_SIZE + this.CELL_SIZE / 2;

    for (var i = 0; i < 12; i++) {
      var angle = (i / 12) * Math.PI * 2;
      this.$particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color: '#FFD700',
        size: 2 + Math.random() * 2
      });
    }

    // Score burst
    this.$scoreParticles.push({
      x: centerX,
      y: centerY,
      vx: 0,
      vy: -2,
      life: 60,
      maxLife: 60,
      text: '+' + (this.$snake.length * 10),
      color: '#00FF00',
      size: 16
    });
  };

  SnakeUx.prototype.createTrailEffect = function() {
    // Create continuous trail behind snake head
    if (this.$snake.length > 0) {
      var head = this.$snake[0];
      var centerX = head.x * this.CELL_SIZE + this.CELL_SIZE / 2;
      var centerY = head.y * this.CELL_SIZE + this.CELL_SIZE / 2;

      this.$trailParticles.push({
        x: centerX + (Math.random() - 0.5) * this.CELL_SIZE,
        y: centerY + (Math.random() - 0.5) * this.CELL_SIZE,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 20 + Math.random() * 10,
        maxLife: 30,
        color: '#00FF00',
        size: 1 + Math.random()
      });
    }
  };

  SnakeUx.prototype.createDeathEffect = function() {
    // Spectacular death explosion
    if (this.$snake.length > 0) {
      var head = this.$snake[0];
      var centerX = head.x * this.CELL_SIZE + this.CELL_SIZE / 2;
      var centerY = head.y * this.CELL_SIZE + this.CELL_SIZE / 2;

      for (var i = 0; i < 20; i++) {
        var angle = (Math.PI * 2 * i) / 20;
        this.$particles.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * (2 + Math.random() * 3),
          vy: Math.sin(angle) * (2 + Math.random() * 3),
          life: 40 + Math.random() * 20,
          maxLife: 60,
          color: '#FF0000',
          size: 3 + Math.random() * 2
        });
      }
    }
  };

  SnakeUx.prototype.createCelebrationEffect = function() {
    // Milestone celebration
    var centerX = this.BOARD_WIDTH * this.CELL_SIZE / 2;
    var centerY = this.BOARD_HEIGHT * this.CELL_SIZE / 2;

    for (var i = 0; i < 30; i++) {
      var angle = (Math.PI * 2 * i) / 30;
      this.$particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * (1 + Math.random() * 2),
        vy: Math.sin(angle) * (1 + Math.random() * 2),
        life: 40 + Math.random() * 30,
        maxLife: 70,
        color: ['#FFD700', '#FF6600', '#00FF00'][Math.floor(Math.random() * 3)],
        size: 2 + Math.random() * 3
      });
    }
  };

  SnakeUx.prototype.updateParticles = function() {
    // Update main particles
    for (var i = this.$particles.length - 1; i >= 0; i--) {
      var particle = this.$particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.95;
      particle.vy *= 0.95;
      particle.life--;

      if (particle.life <= 0) {
        this.$particles.splice(i, 1);
      }
    }

    // Update trail particles
    for (var i = this.$trailParticles.length - 1; i >= 0; i--) {
      var particle = this.$trailParticles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      particle.life--;

      if (particle.life <= 0) {
        this.$trailParticles.splice(i, 1);
      }
    }

    // Update score particles
    for (var i = this.$scoreParticles.length - 1; i >= 0; i--) {
      var particle = this.$scoreParticles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.1; // gravity
      particle.life--;

      if (particle.life <= 0) {
        this.$scoreParticles.splice(i, 1);
      }
    }

    // Create trail effect when moving
    if (this.$gameRunning && Math.random() < 0.3) {
      this.createTrailEffect();
    }
  };

  SnakeUx.prototype.handleKeyPress = function(e) {
    if (this.$gameReady && !this.$gameRunning && (e.keyCode >= 37 && e.keyCode <= 40)) {
      // Start game from ready state
      e.preventDefault();
      e.stopPropagation();
      this.startGame();
      return;
    }

    if (!this.$gameRunning) return;

    var newDirection = this.$nextDirection;

    switch(e.keyCode) {
      case 37: // Left
        if (this.$direction.x !== 1) {
          newDirection = {x: -1, y: 0};
        }
        break;
      case 38: // Up
        if (this.$direction.y !== 1) {
          newDirection = {x: 0, y: -1};
        }
        break;
      case 39: // Right
        if (this.$direction.x !== -1) {
          newDirection = {x: 1, y: 0};
        }
        break;
      case 40: // Down
        if (this.$direction.y !== -1) {
          newDirection = {x: 0, y: 1};
        }
        break;
      case 32: // Space bar - pause
        this.pauseGame();
        break;
    }

    // Only update direction if it's valid
    if (newDirection !== this.$nextDirection) {
      this.$nextDirection = newDirection;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  SnakeUx.prototype.startGame = function() {
    if (this.$gameReady && !this.$gameRunning) {
      this.startGameLoop();
    }
  };

  SnakeUx.prototype.showReadyMessage = function() {
    // Draw "Ready - Press Arrow Key to Start" message
    this.draw();

    if (!this.$ctx) return;

    this.$ctx.save();
    this.$ctx.fillStyle = '#00ff00';
    this.$ctx.font = 'bold 20px Arial';
    this.$ctx.textAlign = 'center';
    this.$ctx.shadowColor = '#00ff00';
    this.$ctx.shadowBlur = 10;
    this.$ctx.fillText('Ready!', this.BOARD_WIDTH * this.CELL_SIZE / 2, this.BOARD_HEIGHT * this.CELL_SIZE / 2 - 20);

    this.$ctx.font = 'bold 14px Arial';
    this.$ctx.fillText('Press Arrow Key to Start', this.BOARD_WIDTH * this.CELL_SIZE / 2, this.BOARD_HEIGHT * this.CELL_SIZE / 2 + 10);
    this.$ctx.restore();
  };

  SnakeUx.prototype.startGameLoop = function() {
    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
    }

    var that = this;
    this.$gameRunning = true;
    this.$gameReady = false;
    this.$gameLoop = setInterval(function() {
      that.gameStep();
    }, this.$speed);
  };

  SnakeUx.prototype.pauseGame = function() {
    if (this.$gameLoop && this.$gameRunning) {
      clearInterval(this.$gameLoop);
      this.$gameLoop = null;
      this.$gameRunning = false;
      // Show paused message
      this.draw();
      if (this.$ctx) {
        this.$ctx.save();
        this.$ctx.fillStyle = '#ffff00';
        this.$ctx.font = 'bold 24px Arial';
        this.$ctx.textAlign = 'center';
        this.$ctx.shadowColor = '#ffff00';
        this.$ctx.shadowBlur = 10;
        this.$ctx.fillText('PAUSED', this.BOARD_WIDTH * this.CELL_SIZE / 2, this.BOARD_HEIGHT * this.CELL_SIZE / 2);
        this.$ctx.restore();
      }
    } else if (!this.$gameRunning && !this.$gameReady) {
      // Resume from pause
      this.startGameLoop();
    }
  };

  SnakeUx.prototype.resetGame = function() {
    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
      this.$gameLoop = null;
    }

    this.$gameRunning = false;
    this.$gameReady = false;
    this.$snake = [{x: 10, y: 10}];
    this.$direction = {x: 1, y: 0};
    this.$nextDirection = {x: 1, y: 0};
    this.$score = 0;
    this.$speed = 150;
    this.$particles = [];
    this.$trailParticles = [];
    this.$scoreParticles = [];
    this.$celebrationMode = 0;

    this.updateScore();
    this.generateFood();
    this.hideOverlay();

    // Show ready message instead of starting immediately
    this.showReadyMessage();
    this.$gameReady = true;

    // Focus canvas for keyboard input
    if (this.$canvas) {
      this.$canvas.focus();
    }

    // Focus the canvas for keyboard input
    this.$canvas.focus();

    // Add visual indication that game is ready to start
    this.showReadyMessage();

    // Game is ready but not running yet - wait for first key press
    this.$gameRunning = false;
    this.$gameReady = true;
  };

  SnakeUx.prototype.generateFood = function() {
    var emptyCells = [];

    for (var x = 0; x < this.BOARD_WIDTH; x++) {
      for (var y = 0; y < this.BOARD_HEIGHT; y++) {
        var occupied = false;

        // Check if cell is occupied by snake
        for (var i = 0; i < this.$snake.length; i++) {
          if (this.$snake[i].x === x && this.$snake[i].y === y) {
            occupied = true;
            break;
          }
        }

        if (!occupied) {
          emptyCells.push({x: x, y: y});
        }
      }
    }

    if (emptyCells.length > 0) {
      var randomIndex = Math.floor(Math.random() * emptyCells.length);
      this.$food = emptyCells[randomIndex];
    }
  };

  SnakeUx.prototype.gameStep = function() {
    if (!this.$gameRunning) return;

    // Update direction
    this.$direction = this.$nextDirection;

    // Move snake
    var head = {
      x: this.$snake[0].x + this.$direction.x,
      y: this.$snake[0].y + this.$direction.y
    };

    // Check wall collision
    if (head.x < 0 || head.x >= this.BOARD_WIDTH ||
        head.y < 0 || head.y >= this.BOARD_HEIGHT) {
      this.gameOver();
      return;
    }

    // Check self collision
    for (var i = 0; i < this.$snake.length; i++) {
      if (head.x === this.$snake[i].x && head.y === this.$snake[i].y) {
        this.gameOver();
        return;
      }
    }

    // Add new head
    this.$snake.unshift(head);

    // Check food collision
    if (head.x === this.$food.x && head.y === this.$food.y) {
      this.$score += this.$snake.length * 10;
      this.updateScore();
      this.generateFood();
      this.createFoodParticles();

      // Increase speed slightly
      if (this.$speed > 80) {
        this.$speed -= 2;
        clearInterval(this.$gameLoop);
        this.startGameLoop();
      }

      // Special celebration for milestones
      if (this.$snake.length % 5 === 0) {
        this.$celebrationMode = 60;
        this.createCelebrationEffect();
      }
    } else {
      // Remove tail if no food eaten
      this.$snake.pop();
    }
  };

  SnakeUx.prototype.gameOver = function() {
    this.$gameRunning = false;
    this.$gameReady = false;

    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
      this.$gameLoop = null;
    }

    // Update high score
    if (this.$score > this.$highScore) {
      this.$highScore = this.$score;
      this.$highScoreEl.textContent = this.$highScore;

      try {
        localStorage.setItem('snake-high-score', this.$highScore.toString());
      } catch(e) {
        // localStorage not available
      }
    }

    this.createDeathEffect();
    this.showGameOverMessage();
  };

  SnakeUx.prototype.showGameOverMessage = function() {
    this.$overlayMessageEl.textContent = 'Game Over! Score: ' + this.$score;
    this.$overlayEl.style.display = 'flex';
  };

  SnakeUx.prototype.hideOverlay = function() {
    this.$overlayEl.style.display = 'none';
  };

  SnakeUx.prototype.updateScore = function() {
    this.$scoreEl.textContent = this.$score;
    this.$highScoreEl.textContent = this.$highScore;
  };

  SnakeUx.prototype.draw = function() {
    // Safety check for canvas context
    if (!this.$ctx) return;

    // Clear canvas with gradient background
    var gradient = this.$ctx.createLinearGradient(0, 0, 0, this.$canvas.height);
    gradient.addColorStop(0, '#001122');
    gradient.addColorStop(1, '#000508');
    this.$ctx.fillStyle = gradient;
    this.$ctx.fillRect(0, 0, this.$canvas.width, this.$canvas.height);

    // Draw grid
    this.$ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
    this.$ctx.lineWidth = 0.5;
    for (var x = 0; x <= this.BOARD_WIDTH; x++) {
      this.$ctx.beginPath();
      this.$ctx.moveTo(x * this.CELL_SIZE, 0);
      this.$ctx.lineTo(x * this.CELL_SIZE, this.BOARD_HEIGHT * this.CELL_SIZE);
      this.$ctx.stroke();
    }
    for (var y = 0; y <= this.BOARD_HEIGHT; y++) {
      this.$ctx.beginPath();
      this.$ctx.moveTo(0, y * this.CELL_SIZE);
      this.$ctx.lineTo(this.BOARD_WIDTH * this.CELL_SIZE, y * this.CELL_SIZE);
      this.$ctx.stroke();
    }

    // MINIMAL FIX: Always draw snake and food (removed the early return)

    // Draw trail particles
    for (var i = 0; i < this.$trailParticles.length; i++) {
      var particle = this.$trailParticles[i];
      var alpha = particle.life / particle.maxLife;

      this.$ctx.save();
      this.$ctx.globalAlpha = alpha * 0.6;
      this.$ctx.fillStyle = particle.color;
      this.$ctx.shadowColor = particle.color;
      this.$ctx.shadowBlur = 5;
      this.$ctx.fillRect(
        particle.x - particle.size/2,
        particle.y - particle.size/2,
        particle.size,
        particle.size
      );
      this.$ctx.restore();
    }

    // Continue with rest of draw function...

    // Draw enhanced snake with glow
    for (var i = 0; i < this.$snake.length; i++) {
      var segment = this.$snake[i];
      var x = segment.x * this.CELL_SIZE;
      var y = segment.y * this.CELL_SIZE;

      // Create gradient for 3D effect
      var segmentGradient = this.$ctx.createRadialGradient(
        x + this.CELL_SIZE/2, y + this.CELL_SIZE/2, 0,
        x + this.CELL_SIZE/2, y + this.CELL_SIZE/2, this.CELL_SIZE/2
      );

      if (i === 0) { // Head
        segmentGradient.addColorStop(0, '#00FF00');
        segmentGradient.addColorStop(0.7, '#00CC00');
        segmentGradient.addColorStop(1, '#008800');

        this.$ctx.save();
        this.$ctx.shadowColor = '#00FF00';
        this.$ctx.shadowBlur = 15 * this.$snakeGlow;
      } else { // Body
        var intensity = 1 - (i / this.$snake.length) * 0.5;
        segmentGradient.addColorStop(0, 'rgba(0, 255, 0, ' + intensity + ')');
        segmentGradient.addColorStop(0.7, 'rgba(0, 204, 0, ' + intensity + ')');
        segmentGradient.addColorStop(1, 'rgba(0, 136, 0, ' + intensity + ')');

        this.$ctx.save();
        this.$ctx.shadowColor = '#00FF00';
        this.$ctx.shadowBlur = 8 * this.$snakeGlow * intensity;
      }

      this.$ctx.fillStyle = segmentGradient;
      this.$ctx.fillRect(x + 1, y + 1, this.CELL_SIZE - 2, this.CELL_SIZE - 2);

      // Add highlight
      this.$ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.$ctx.fillRect(x + 2, y + 2, this.CELL_SIZE - 8, this.CELL_SIZE - 8);

      this.$ctx.restore();
    }

    // Draw enhanced food with pulse effect
    var foodX = this.$food.x * this.CELL_SIZE;
    var foodY = this.$food.y * this.CELL_SIZE;
    var pulseScale = 1 + this.$foodPulse * 0.2;
    var pulseOffset = (this.CELL_SIZE * (1 - pulseScale)) / 2;

    // Food glow
    this.$ctx.save();
    this.$ctx.shadowColor = '#FFD700';
    this.$ctx.shadowBlur = 20 + this.$foodPulse * 10;

    var foodGradient = this.$ctx.createRadialGradient(
      foodX + this.CELL_SIZE/2, foodY + this.CELL_SIZE/2, 0,
      foodX + this.CELL_SIZE/2, foodY + this.CELL_SIZE/2, this.CELL_SIZE/2 * pulseScale
    );
    foodGradient.addColorStop(0, '#FFD700');
    foodGradient.addColorStop(0.7, '#FFA500');
    foodGradient.addColorStop(1, '#FF6600');

    this.$ctx.fillStyle = foodGradient;
    this.$ctx.fillRect(
      foodX + pulseOffset + 1,
      foodY + pulseOffset + 1,
      (this.CELL_SIZE - 2) * pulseScale,
      (this.CELL_SIZE - 2) * pulseScale
    );
    this.$ctx.restore();

    // Draw main particles
    for (var i = 0; i < this.$particles.length; i++) {
      var particle = this.$particles[i];
      var alpha = particle.life / particle.maxLife;

      this.$ctx.save();
      this.$ctx.globalAlpha = alpha;
      this.$ctx.fillStyle = particle.color;
      this.$ctx.shadowColor = particle.color;
      this.$ctx.shadowBlur = 8;
      this.$ctx.fillRect(
        particle.x - particle.size/2,
        particle.y - particle.size/2,
        particle.size,
        particle.size
      );
      this.$ctx.restore();
    }

    // Draw score particles
    for (var i = 0; i < this.$scoreParticles.length; i++) {
      var particle = this.$scoreParticles[i];
      var alpha = particle.life / particle.maxLife;

      this.$ctx.save();
      this.$ctx.globalAlpha = alpha;
      this.$ctx.fillStyle = particle.color;
      this.$ctx.font = 'bold ' + particle.size + 'px Arial';
      this.$ctx.textAlign = 'center';
      this.$ctx.shadowColor = particle.color;
      this.$ctx.shadowBlur = 5;
      this.$ctx.fillText(particle.text, particle.x, particle.y);
      this.$ctx.restore();
    }

    // Celebration effects
    if (this.$celebrationMode > 0) {
      this.$ctx.save();
      var alpha = this.$celebrationMode / 60;
      this.$ctx.globalAlpha = alpha;
      this.$ctx.fillStyle = '#FFD700';
      this.$ctx.font = 'bold 32px Arial';
      this.$ctx.textAlign = 'center';
      this.$ctx.shadowColor = '#FFD700';
      this.$ctx.shadowBlur = 20;
      this.$ctx.fillText('MILESTONE!', this.BOARD_WIDTH * this.CELL_SIZE / 2, this.BOARD_HEIGHT * this.CELL_SIZE / 4);
      this.$ctx.restore();
    }
  };

  SnakeUx.prototype.doDestroy = function() {
    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
    }
    if (this.$keydownHandler) {
      document.removeEventListener('keydown', this.$keydownHandler);
    }
  };

  return SnakeUx;
});