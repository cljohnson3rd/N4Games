define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/spaceinvaders'
], function(baja, Widget) {
  'use strict';

  var SpaceInvadersUx = function() {
    var that = this;
    Widget.apply(this, arguments);

    // Game state
    this.$score = 0;
    this.$lives = 3;
    this.$level = 1;
    this.$gameRunning = false;
    this.$gameOver = false;
    this.$gameLoop = null;

    // Player
    this.$player = {
      x: 0,
      y: 0,
      width: 40,
      height: 30,
      speed: 5,
      color: '#00ff00',
      thrustFrame: 0
    };

    // Game objects
    this.$bullets = [];
    this.$invaders = [];
    this.$enemyBullets = [];
    this.$explosions = [];
    this.$stars = [];

    // Animation state
    this.$animationFrame = 0;
    this.$invaderAnimFrame = 0;
    this.$screenShake = 0;

    // Game constants
    this.CANVAS_WIDTH = 800;
    this.CANVAS_HEIGHT = 600;
    this.BULLET_SPEED = 7;
    this.ENEMY_BULLET_SPEED = 3;
    this.SHOT_COOLDOWN = 200; // ms
    this.$lastShot = 0;
    this.$invaderSpeed = 1;
    this.$invaderDropSpeed = 20;
    this.$invaderDirection = 1; // 1 = right, -1 = left

    // Input handling
    this.$keys = {};

    // Initialize animated stars
    this.initStars();
  };

  SpaceInvadersUx.prototype = Object.create(Widget.prototype);
  SpaceInvadersUx.prototype.constructor = SpaceInvadersUx;

  SpaceInvadersUx.prototype.initStars = function() {
    this.$stars = [];
    for (var i = 0; i < 100; i++) {
      this.$stars.push({
        x: Math.random() * this.CANVAS_WIDTH,
        y: Math.random() * this.CANVAS_HEIGHT,
        speed: Math.random() * 2 + 0.5,
        brightness: Math.random(),
        twinkle: Math.random() * 60
      });
    }
  };

  // Helper function to safely find elements
  SpaceInvadersUx.prototype.findElement = function(selector) {
    if (this.$container.querySelector) {
      return this.$container.querySelector(selector);
    } else if (this.$container.nodeType) {
      return this.$container.querySelector(selector);
    } else {
      var elem = this.$container.element || this.$container[0] || this.$container;
      return elem.querySelector ? elem.querySelector(selector) : null;
    }
  };

  SpaceInvadersUx.prototype.doInitialize = function(element) {
    var that = this;

    // Ensure we have a proper DOM element - handle Niagara element wrappers
    if (element.nodeType) {
      this.$container = element;
    } else if (element.element) {
      this.$container = element.element;
    } else if (element[0] && element[0].nodeType) {
      this.$container = element[0];
    } else {
      this.$container = element;
    }

    // Create game HTML
    this.$container.innerHTML =
      '<div class="spaceinvaders-container">' +
        '<div class="spaceinvaders-game">' +
          '<canvas id="spaceinvaders-board" width="800" height="600"></canvas>' +
        '</div>' +
        '<div class="spaceinvaders-sidebar">' +
          '<div class="spaceinvaders-info">' +
            '<div>Score: <span id="si-score">0</span></div>' +
            '<div>Lives: <span id="si-lives">3</span></div>' +
            '<div>Level: <span id="si-level">1</span></div>' +
          '</div>' +
          '<div class="spaceinvaders-controls">' +
            '<button id="si-start-btn">Start Game</button>' +
            '<button id="si-pause-btn">Pause</button>' +
            '<button id="si-reset-btn">Reset</button>' +
          '</div>' +
          '<div class="spaceinvaders-instructions">' +
            '<div><strong>Controls:</strong></div>' +
            '<div>← → Move</div>' +
            '<div>Space: Shoot</div>' +
            '<div>Defend Earth from aliens!</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Get canvas elements
    this.$canvas = this.findElement('#spaceinvaders-board');
    this.$ctx = this.$canvas.getContext('2d');

    // Get UI elements
    this.$scoreEl = this.findElement('#si-score');
    this.$livesEl = this.findElement('#si-lives');
    this.$levelEl = this.findElement('#si-level');

    // Initialize game
    this.initGame();

    // Event listeners
    this.findElement('#si-start-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.startGame();
    });

    this.findElement('#si-pause-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.pauseGame();
    });

    this.findElement('#si-reset-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.resetGame();
    });

    // Keyboard controls - store handler for cleanup
    this.$keydownHandler = function(e) {
      if (that.$gameRunning && that.$container &&
          (document.activeElement === that.$canvas || that.$container.contains(document.activeElement))) {

        // Handle arrow keys and space
        if ((e.keyCode >= 37 && e.keyCode <= 40) || e.keyCode === 32) {
          e.preventDefault();
          e.stopPropagation();
          that.handleKeyPress(e, true);
        }
      }
    };

    this.$keyupHandler = function(e) {
      if (that.$gameRunning && that.$container &&
          (document.activeElement === that.$canvas || that.$container.contains(document.activeElement))) {

        if ((e.keyCode >= 37 && e.keyCode <= 40) || e.keyCode === 32) {
          e.preventDefault();
          e.stopPropagation();
          that.handleKeyPress(e, false);
        }
      }
    };

    document.addEventListener('keydown', this.$keydownHandler);
    document.addEventListener('keyup', this.$keyupHandler);

    // Make canvas focusable and add click handler for manual focus
    this.$canvas.tabIndex = 0;
    this.$canvas.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.$canvas.focus();
    });

    this.draw();
  };

  SpaceInvadersUx.prototype.initGame = function() {
    // Set player starting position
    this.$player.x = this.CANVAS_WIDTH / 2 - this.$player.width / 2;
    this.$player.y = this.CANVAS_HEIGHT - this.$player.height - 10;

    // Clear arrays
    this.$bullets = [];
    this.$enemyBullets = [];
    this.$explosions = [];

    // Reset animation state
    this.$animationFrame = 0;
    this.$invaderAnimFrame = 0;
    this.$screenShake = 0;

    this.createInvaders();
  };

  SpaceInvadersUx.prototype.createInvaders = function() {
    this.$invaders = [];
    var rows = 5;
    var cols = 10;
    var invaderWidth = 40;
    var invaderHeight = 30;
    var spacing = 50;
    var startX = 100;
    var startY = 50;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        this.$invaders.push({
          x: startX + col * spacing,
          y: startY + row * spacing,
          width: invaderWidth,
          height: invaderHeight,
          alive: true,
          type: row < 2 ? 3 : row < 4 ? 2 : 1, // Different point values
          lastShot: 0,
          animFrame: 0
        });
      }
    }
  };

  SpaceInvadersUx.prototype.createExplosion = function(x, y, type) {
    type = type || 'normal';
    var particleCount = type === 'big' ? 15 : 8;
    var speed = type === 'big' ? 4 : 2;

    for (var i = 0; i < particleCount; i++) {
      this.$explosions.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: (Math.random() - 0.5) * speed * 2,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color: type === 'big' ? '#ff0000' : ['#ff0000', '#ff6600', '#ffff00'][Math.floor(Math.random() * 3)],
        size: type === 'big' ? 3 : 2
      });
    }

    // Screen shake for big explosions
    if (type === 'big') {
      this.$screenShake = 10;
    }
  };

  SpaceInvadersUx.prototype.handleKeyPress = function(e, isDown) {
    if (!this.$gameRunning) return;

    switch(e.keyCode) {
      case 37: // Left
        this.$keys.left = isDown;
        break;
      case 39: // Right
        this.$keys.right = isDown;
        break;
      case 32: // Space
        if (isDown) {
          this.shoot();
        }
        break;
    }
  };

  SpaceInvadersUx.prototype.shoot = function() {
    var now = Date.now();
    if (now - this.$lastShot > this.SHOT_COOLDOWN) {
      this.$bullets.push({
        x: this.$player.x + this.$player.width / 2 - 2,
        y: this.$player.y,
        width: 4,
        height: 10,
        trail: []
      });
      this.$lastShot = now;
    }
  };

  SpaceInvadersUx.prototype.startGame = function() {
    var that = this;
    this.$gameRunning = true;
    this.$gameOver = false;
    this.$score = 0;
    this.$lives = 3;
    this.$level = 1;
    this.$invaderSpeed = 1;
    this.initGame();
    this.updateUI();

    this.$gameLoop = setInterval(function() {
      that.gameStep();
    }, 16); // ~60 FPS
  };

  SpaceInvadersUx.prototype.pauseGame = function() {
    this.$gameRunning = !this.$gameRunning;
  };

  SpaceInvadersUx.prototype.resetGame = function() {
    this.$gameRunning = false;
    this.$gameOver = false;
    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
      this.$gameLoop = null;
    }
    this.$score = 0;
    this.$lives = 3;
    this.$level = 1;
    this.$invaderSpeed = 1;
    this.initGame();
    this.updateUI();
    this.draw();
  };

  SpaceInvadersUx.prototype.gameStep = function() {
    if (!this.$gameRunning) return;

    // Update animation frame
    this.$animationFrame++;
    if (this.$animationFrame % 30 === 0) {
      this.$invaderAnimFrame = 1 - this.$invaderAnimFrame; // Toggle between 0 and 1
    }

    // Update screen shake
    if (this.$screenShake > 0) {
      this.$screenShake--;
    }

    // Move player
    if (this.$keys.left && this.$player.x > 0) {
      this.$player.x -= this.$player.speed;
      this.$player.thrustFrame = Math.min(this.$player.thrustFrame + 1, 5);
    } else if (this.$keys.right && this.$player.x < this.CANVAS_WIDTH - this.$player.width) {
      this.$player.x += this.$player.speed;
      this.$player.thrustFrame = Math.min(this.$player.thrustFrame + 1, 5);
    } else {
      this.$player.thrustFrame = Math.max(this.$player.thrustFrame - 1, 0);
    }

    // Update bullets
    this.updateBullets();

    // Update invaders
    this.updateInvaders();

    // Update explosions
    this.updateExplosions();

    // Update stars
    this.updateStars();

    // Enemy shooting
    this.enemyShoot();

    // Check collisions
    this.checkCollisions();

    // Check game state
    this.checkGameState();

    this.draw();
  };

  SpaceInvadersUx.prototype.updateBullets = function() {
    // Update player bullets
    for (var i = this.$bullets.length - 1; i >= 0; i--) {
      var bullet = this.$bullets[i];

      // Add to trail
      bullet.trail.push({x: bullet.x, y: bullet.y});
      if (bullet.trail.length > 5) {
        bullet.trail.shift();
      }

      bullet.y -= this.BULLET_SPEED;
      if (bullet.y < 0) {
        this.$bullets.splice(i, 1);
      }
    }

    // Update enemy bullets
    for (var i = this.$enemyBullets.length - 1; i >= 0; i--) {
      this.$enemyBullets[i].y += this.ENEMY_BULLET_SPEED;
      if (this.$enemyBullets[i].y > this.CANVAS_HEIGHT) {
        this.$enemyBullets.splice(i, 1);
      }
    }
  };

  SpaceInvadersUx.prototype.updateExplosions = function() {
    for (var i = this.$explosions.length - 1; i >= 0; i--) {
      var explosion = this.$explosions[i];
      explosion.x += explosion.vx;
      explosion.y += explosion.vy;
      explosion.vx *= 0.98;
      explosion.vy *= 0.98;
      explosion.life--;

      if (explosion.life <= 0) {
        this.$explosions.splice(i, 1);
      }
    }
  };

  SpaceInvadersUx.prototype.updateStars = function() {
    for (var i = 0; i < this.$stars.length; i++) {
      var star = this.$stars[i];
      star.y += star.speed;
      star.twinkle += 0.1;

      if (star.y > this.CANVAS_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * this.CANVAS_WIDTH;
      }
    }
  };

  SpaceInvadersUx.prototype.updateInvaders = function() {
    var shouldDrop = false;

    // Check if any invader hit the edge
    for (var i = 0; i < this.$invaders.length; i++) {
      var invader = this.$invaders[i];
      if (!invader.alive) continue;

      if ((invader.x <= 0 && this.$invaderDirection === -1) ||
          (invader.x + invader.width >= this.CANVAS_WIDTH && this.$invaderDirection === 1)) {
        shouldDrop = true;
        break;
      }
    }

    // Move invaders
    for (var i = 0; i < this.$invaders.length; i++) {
      var invader = this.$invaders[i];
      if (!invader.alive) continue;

      if (shouldDrop) {
        invader.y += this.$invaderDropSpeed;
      } else {
        invader.x += this.$invaderSpeed * this.$invaderDirection;
      }
    }

    if (shouldDrop) {
      this.$invaderDirection *= -1;
      this.$invaderSpeed += 0.2;
      this.$screenShake = 5; // Screen shake when they drop
    }
  };

  SpaceInvadersUx.prototype.enemyShoot = function() {
    var now = Date.now();
    var shootChance = 0.001;

    for (var i = 0; i < this.$invaders.length; i++) {
      var invader = this.$invaders[i];
      if (!invader.alive) continue;

      if (Math.random() < shootChance && now - invader.lastShot > 2000) {
        this.$enemyBullets.push({
          x: invader.x + invader.width / 2 - 2,
          y: invader.y + invader.height,
          width: 4,
          height: 10
        });
        invader.lastShot = now;
        break;
      }
    }
  };

  SpaceInvadersUx.prototype.checkCollisions = function() {
    // Player bullets vs invaders
    for (var i = this.$bullets.length - 1; i >= 0; i--) {
      for (var j = this.$invaders.length - 1; j >= 0; j--) {
        if (!this.$invaders[j].alive) continue;

        if (this.isColliding(this.$bullets[i], this.$invaders[j])) {
          this.$score += this.$invaders[j].type * 10;
          this.$invaders[j].alive = false;

          // Create explosion
          this.createExplosion(
            this.$invaders[j].x + this.$invaders[j].width / 2,
            this.$invaders[j].y + this.$invaders[j].height / 2,
            'normal'
          );

          this.$bullets.splice(i, 1);
          break;
        }
      }
    }

    // Enemy bullets vs player
    for (var i = this.$enemyBullets.length - 1; i >= 0; i--) {
      if (this.isColliding(this.$enemyBullets[i], this.$player)) {
        this.$lives--;
        this.$enemyBullets.splice(i, 1);

        // Create big explosion
        this.createExplosion(
          this.$player.x + this.$player.width / 2,
          this.$player.y + this.$player.height / 2,
          'big'
        );

        if (this.$lives <= 0) {
          this.gameOver();
          return;
        }
        break;
      }
    }

    // Invaders vs player (collision or reached bottom)
    for (var i = 0; i < this.$invaders.length; i++) {
      var invader = this.$invaders[i];
      if (!invader.alive) continue;

      if (invader.y + invader.height >= this.$player.y ||
          this.isColliding(invader, this.$player)) {
        this.gameOver();
        return;
      }
    }
  };

  SpaceInvadersUx.prototype.isColliding = function(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  };

  SpaceInvadersUx.prototype.checkGameState = function() {
    // Check if all invaders are dead
    var aliveInvaders = 0;
    for (var i = 0; i < this.$invaders.length; i++) {
      if (this.$invaders[i].alive) {
        aliveInvaders++;
      }
    }

    if (aliveInvaders === 0) {
      this.nextLevel();
    }

    this.updateUI();
  };

  SpaceInvadersUx.prototype.nextLevel = function() {
    this.$level++;
    this.$invaderSpeed = 1 + this.$level * 0.5;
    this.createInvaders();
    this.$bullets = [];
    this.$enemyBullets = [];
    this.$explosions = [];
    this.$score += 100; // Level bonus

    // Create celebration effect
    for (var i = 0; i < 20; i++) {
      this.createExplosion(
        Math.random() * this.CANVAS_WIDTH,
        Math.random() * this.CANVAS_HEIGHT / 2,
        'normal'
      );
    }
  };

  SpaceInvadersUx.prototype.gameOver = function() {
    this.$gameRunning = false;
    this.$gameOver = true;
    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
      this.$gameLoop = null;
    }

    // Final explosion
    this.createExplosion(
      this.$player.x + this.$player.width / 2,
      this.$player.y + this.$player.height / 2,
      'big'
    );

    this.draw();
  };

  SpaceInvadersUx.prototype.updateUI = function() {
    this.$scoreEl.textContent = this.$score;
    this.$livesEl.textContent = this.$lives;
    this.$levelEl.textContent = this.$level;
  };

  SpaceInvadersUx.prototype.draw = function() {
    // Apply screen shake
    var shakeX = this.$screenShake > 0 ? (Math.random() - 0.5) * this.$screenShake : 0;
    var shakeY = this.$screenShake > 0 ? (Math.random() - 0.5) * this.$screenShake : 0;

    this.$ctx.save();
    this.$ctx.translate(shakeX, shakeY);

    // Clear canvas
    this.$ctx.fillStyle = '#000000';
    this.$ctx.fillRect(-shakeX, -shakeY, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    // Draw animated stars
    this.drawAnimatedStars();

    // Draw player with better graphics
    this.drawPlayer();

    // Draw bullets with trails
    this.drawBulletsWithTrails();

    // Draw enemy bullets
    this.drawEnemyBullets();

    // Draw invaders with animation
    this.drawAnimatedInvaders();

    // Draw explosions
    this.drawExplosions();

    this.$ctx.restore();

    // Draw game over screen if game is over (no shake)
    if (this.$gameOver) {
      this.$ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      this.$ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

      // Animated game over text
      var pulse = Math.sin(this.$animationFrame * 0.1) * 0.5 + 0.5;
      this.$ctx.fillStyle = 'rgb(' + Math.floor(255 * pulse) + ', 0, 0)';
      this.$ctx.font = '48px Arial';
      this.$ctx.textAlign = 'center';
      this.$ctx.fillText('GAME OVER', this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2);

      this.$ctx.fillStyle = '#ffffff';
      this.$ctx.font = '24px Arial';
      this.$ctx.fillText('Final Score: ' + this.$score, this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2 + 60);
      this.$ctx.fillText('Click Reset to play again', this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2 + 100);
    }
  };

  SpaceInvadersUx.prototype.drawAnimatedStars = function() {
    for (var i = 0; i < this.$stars.length; i++) {
      var star = this.$stars[i];
      var brightness = star.brightness + Math.sin(star.twinkle) * 0.3;
      brightness = Math.max(0, Math.min(1, brightness));

      this.$ctx.fillStyle = 'rgba(255, 255, 255, ' + brightness + ')';
      var size = 1 + brightness;
      this.$ctx.fillRect(star.x, star.y, size, size);
    }
  };

  SpaceInvadersUx.prototype.drawPlayer = function() {
    var player = this.$player;

    // Draw ship body
    this.$ctx.fillStyle = player.color;
    this.$ctx.fillRect(player.x, player.y, player.width, player.height);

    // Draw ship details
    this.$ctx.fillStyle = '#ffffff';
    // Cockpit
    this.$ctx.fillRect(player.x + player.width/2 - 5, player.y + 5, 10, 8);
    // Wings
    this.$ctx.fillRect(player.x, player.y + player.height - 10, 15, 8);
    this.$ctx.fillRect(player.x + player.width - 15, player.y + player.height - 10, 15, 8);

    // Thrust animation when moving
    if (this.$player.thrustFrame > 0) {
      var thrustAlpha = this.$player.thrustFrame / 5;
      this.$ctx.fillStyle = 'rgba(255, 100, 0, ' + thrustAlpha + ')';
      var thrustSize = 3 + this.$player.thrustFrame;
      this.$ctx.fillRect(player.x + player.width/2 - thrustSize/2, player.y + player.height, thrustSize, 8);
    }
  };

  SpaceInvadersUx.prototype.drawBulletsWithTrails = function() {
    for (var i = 0; i < this.$bullets.length; i++) {
      var bullet = this.$bullets[i];

      // Draw trail
      for (var j = 0; j < bullet.trail.length; j++) {
        var trail = bullet.trail[j];
        var alpha = j / bullet.trail.length;
        this.$ctx.fillStyle = 'rgba(255, 255, 0, ' + alpha + ')';
        this.$ctx.fillRect(trail.x, trail.y, bullet.width, bullet.height * alpha);
      }

      // Draw bullet
      this.$ctx.fillStyle = '#ffff00';
      this.$ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);

      // Add glow
      this.$ctx.shadowColor = '#ffff00';
      this.$ctx.shadowBlur = 5;
      this.$ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
      this.$ctx.shadowBlur = 0;
    }
  };

  SpaceInvadersUx.prototype.drawEnemyBullets = function() {
    for (var i = 0; i < this.$enemyBullets.length; i++) {
      var bullet = this.$enemyBullets[i];
      this.$ctx.fillStyle = '#ff0000';
      this.$ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);

      // Add red glow
      this.$ctx.shadowColor = '#ff0000';
      this.$ctx.shadowBlur = 3;
      this.$ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
      this.$ctx.shadowBlur = 0;
    }
  };

  SpaceInvadersUx.prototype.drawAnimatedInvaders = function() {
    for (var i = 0; i < this.$invaders.length; i++) {
      var invader = this.$invaders[i];
      if (!invader.alive) continue;

      // Different colors for different types
      var baseColor = invader.type === 3 ? '#ff0080' : invader.type === 2 ? '#0080ff' : '#00ff80';
      this.$ctx.fillStyle = baseColor;
      this.$ctx.fillRect(invader.x, invader.y, invader.width, invader.height);

      // Animated invader pattern
      var animOffset = this.$invaderAnimFrame * 3;
      this.$ctx.fillStyle = '#000000';

      // Eyes (animate position)
      this.$ctx.fillRect(invader.x + 8 + animOffset, invader.y + 8, 4, 4);
      this.$ctx.fillRect(invader.x + 28 - animOffset, invader.y + 8, 4, 4);

      // Mouth (animate)
      if (this.$invaderAnimFrame === 0) {
        this.$ctx.fillRect(invader.x + 15, invader.y + 18, 10, 3);
      } else {
        this.$ctx.fillRect(invader.x + 12, invader.y + 18, 4, 3);
        this.$ctx.fillRect(invader.x + 24, invader.y + 18, 4, 3);
      }

      // Add glow effect
      this.$ctx.shadowColor = baseColor;
      this.$ctx.shadowBlur = 2;
      this.$ctx.strokeStyle = baseColor;
      this.$ctx.strokeRect(invader.x, invader.y, invader.width, invader.height);
      this.$ctx.shadowBlur = 0;
    }
  };

  SpaceInvadersUx.prototype.drawExplosions = function() {
    for (var i = 0; i < this.$explosions.length; i++) {
      var explosion = this.$explosions[i];
      var alpha = explosion.life / explosion.maxLife;

      this.$ctx.fillStyle = explosion.color;
      this.$ctx.globalAlpha = alpha;
      this.$ctx.fillRect(
        explosion.x - explosion.size/2,
        explosion.y - explosion.size/2,
        explosion.size,
        explosion.size
      );

      // Add glow
      this.$ctx.shadowColor = explosion.color;
      this.$ctx.shadowBlur = explosion.size * 2;
      this.$ctx.fillRect(
        explosion.x - explosion.size/2,
        explosion.y - explosion.size/2,
        explosion.size,
        explosion.size
      );
      this.$ctx.shadowBlur = 0;
      this.$ctx.globalAlpha = 1;
    }
  };

  SpaceInvadersUx.prototype.doDestroy = function() {
    // Stop game loop
    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
      this.$gameLoop = null;
    }

    // Remove event listeners to prevent memory leaks
    if (this.$keydownHandler) {
      document.removeEventListener('keydown', this.$keydownHandler);
      this.$keydownHandler = null;
    }
    if (this.$keyupHandler) {
      document.removeEventListener('keyup', this.$keyupHandler);
      this.$keyupHandler = null;
    }

    // Clear DOM references
    this.$container = null;
    this.$canvas = null;
    this.$ctx = null;
    this.$scoreEl = null;
    this.$livesEl = null;
    this.$levelEl = null;

    // Clear game state
    this.$bullets = null;
    this.$invaders = null;
    this.$enemyBullets = null;
    this.$explosions = null;
    this.$stars = null;
    this.$player = null;

    Widget.prototype.doDestroy.call(this);
  };

  return SpaceInvadersUx;
});