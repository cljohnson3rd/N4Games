define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/asteroid'
], function(baja, Widget) {
  'use strict';

  var AsteroidsUx = function() {
    var that = this;
    Widget.apply(this, arguments);

    // Game state
    this.$score = 0;
    this.$lives = 3;
    this.$level = 1;
    this.$gameRunning = false;
    this.$gameOver = false;
    this.$gameLoop = null;

    // Ship
    this.$ship = {
      x: 0,
      y: 0,
      angle: 0,
      velocity: { x: 0, y: 0 },
      size: 15,
      thrust: false,
      invulnerable: 0,
      thrustParticles: []
    };

    // Game objects
    this.$bullets = [];
    this.$asteroids = [];
    this.$particles = [];
    this.$stars = [];
    this.$thrustTrail = [];

    // Animation state
    this.$animationFrame = 0;
    this.$screenShake = 0;

    // Game constants
    this.CANVAS_WIDTH = 800;
    this.CANVAS_HEIGHT = 600;
    this.BULLET_SPEED = 8;
    this.BULLET_LIFETIME = 60; // frames
    this.MAX_BULLETS = 8;
    this.ASTEROID_SIZES = [60, 40, 20]; // Large, Medium, Small

    // Physics
    this.FRICTION = 0.98;
    this.THRUST_POWER = 0.3;
    this.ROTATION_SPEED = 0.15;

    // Input handling
    this.$keys = {};

    // Initialize animated starfield
    this.initStarfield();
  };

  AsteroidsUx.prototype = Object.create(Widget.prototype);
  AsteroidsUx.prototype.constructor = AsteroidsUx;

  AsteroidsUx.prototype.initStarfield = function() {
    this.$stars = [];
    for (var i = 0; i < 200; i++) {
      this.$stars.push({
        x: Math.random() * this.CANVAS_WIDTH,
        y: Math.random() * this.CANVAS_HEIGHT,
        z: Math.random() * 100 + 1,
        brightness: Math.random(),
        twinkle: Math.random() * 60,
        color: Math.random() < 0.1 ? '#ffaaaa' : Math.random() < 0.1 ? '#aaaaff' : '#ffffff'
      });
    }
  };

  // Helper function to safely find elements
  AsteroidsUx.prototype.findElement = function(selector) {
    if (this.$container.querySelector) {
      return this.$container.querySelector(selector);
    } else if (this.$container.nodeType) {
      return this.$container.querySelector(selector);
    } else {
      var elem = this.$container.element || this.$container[0] || this.$container;
      return elem.querySelector ? elem.querySelector(selector) : null;
    }
  };

  AsteroidsUx.prototype.doInitialize = function(element) {
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
      '<div class="asteroids-container">' +
        '<div class="asteroids-game">' +
          '<canvas id="asteroids-board" width="800" height="600"></canvas>' +
        '</div>' +
        '<div class="asteroids-sidebar">' +
          '<div class="asteroids-info">' +
            '<div>Score: <span id="ast-score">0</span></div>' +
            '<div>Lives: <span id="ast-lives">3</span></div>' +
            '<div>Level: <span id="ast-level">1</span></div>' +
          '</div>' +
          '<div class="asteroids-controls">' +
            '<button id="ast-start-btn">Start Game</button>' +
            '<button id="ast-pause-btn">Pause</button>' +
            '<button id="ast-reset-btn">Reset</button>' +
          '</div>' +
          '<div class="asteroids-instructions">' +
            '<div><strong>Controls:</strong></div>' +
            '<div>← → Rotate</div>' +
            '<div>↑ Thrust</div>' +
            '<div>Space: Shoot</div>' +
            '<div>Enter: Hyperspace</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Get canvas elements
    this.$canvas = this.findElement('#asteroids-board');
    this.$ctx = this.$canvas.getContext('2d');

    // Get UI elements
    this.$scoreEl = this.findElement('#ast-score');
    this.$livesEl = this.findElement('#ast-lives');
    this.$levelEl = this.findElement('#ast-level');

    // Initialize game
    this.initGame();

    // Event listeners
    this.findElement('#ast-start-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.startGame();
    });

    this.findElement('#ast-pause-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.pauseGame();
    });

    this.findElement('#ast-reset-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.resetGame();
    });

    // Keyboard controls - store handler for cleanup
    this.$keydownHandler = function(e) {
      if (that.$gameRunning && that.$container &&
          (document.activeElement === that.$canvas || that.$container.contains(document.activeElement))) {

        // Handle arrow keys, space, and enter
        if ((e.keyCode >= 37 && e.keyCode <= 40) || e.keyCode === 32 || e.keyCode === 13) {
          e.preventDefault();
          e.stopPropagation();
          that.handleKeyPress(e, true);
        }
      }
    };

    this.$keyupHandler = function(e) {
      if (that.$gameRunning && that.$container &&
          (document.activeElement === that.$canvas || that.$container.contains(document.activeElement))) {

        if ((e.keyCode >= 37 && e.keyCode <= 40) || e.keyCode === 32 || e.keyCode === 13) {
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

  AsteroidsUx.prototype.initGame = function() {
    // Set ship starting position
    this.$ship.x = this.CANVAS_WIDTH / 2;
    this.$ship.y = this.CANVAS_HEIGHT / 2;
    this.$ship.angle = 0;
    this.$ship.velocity = { x: 0, y: 0 };
    this.$ship.thrust = false;
    this.$ship.invulnerable = 0;
    this.$ship.thrustParticles = [];

    // Clear arrays
    this.$bullets = [];
    this.$particles = [];
    this.$thrustTrail = [];

    // Reset animation state
    this.$animationFrame = 0;
    this.$screenShake = 0;

    this.createAsteroids();
  };

  AsteroidsUx.prototype.createAsteroids = function() {
    this.$asteroids = [];
    var numAsteroids = Math.min(4 + this.$level, 8);

    for (var i = 0; i < numAsteroids; i++) {
      var x, y;
      do {
        x = Math.random() * this.CANVAS_WIDTH;
        y = Math.random() * this.CANVAS_HEIGHT;
      } while (this.getDistance(x, y, this.$ship.x, this.$ship.y) < 100);

      this.createAsteroid(x, y, 0); // Size 0 = large
    }
  };

  AsteroidsUx.prototype.createAsteroid = function(x, y, size) {
    var asteroid = {
      x: x,
      y: y,
      size: size,
      radius: this.ASTEROID_SIZES[size],
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      },
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      vertices: this.generateAsteroidVertices(),
      trail: []
    };

    this.$asteroids.push(asteroid);
  };

  AsteroidsUx.prototype.generateAsteroidVertices = function() {
    var vertices = [];
    var numVertices = 8 + Math.floor(Math.random() * 4);

    for (var i = 0; i < numVertices; i++) {
      var angle = (i / numVertices) * Math.PI * 2;
      var radius = 0.8 + Math.random() * 0.4; // Random radius variation
      vertices.push({ angle: angle, radius: radius });
    }

    return vertices;
  };

  AsteroidsUx.prototype.createExplosion = function(x, y, size, color) {
    size = size || 'normal';
    color = color || '#ffaa00';
    var particleCount = size === 'big' ? 20 : size === 'medium' ? 12 : 8;
    var speed = size === 'big' ? 5 : size === 'medium' ? 3 : 2;

    for (var i = 0; i < particleCount; i++) {
      this.$particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: (Math.random() - 0.5) * speed * 2,
        life: 40 + Math.random() * 30,
        maxLife: 70,
        color: color,
        size: size === 'big' ? 4 : size === 'medium' ? 3 : 2,
        trail: []
      });
    }

    // Screen shake for explosions
    if (size === 'big') {
      this.$screenShake = 15;
    } else if (size === 'medium') {
      this.$screenShake = 8;
    }
  };

  AsteroidsUx.prototype.createThrustParticle = function(x, y, angle) {
    this.$ship.thrustParticles.push({
      x: x,
      y: y,
      vx: -Math.cos(angle) * 3 + (Math.random() - 0.5),
      vy: -Math.sin(angle) * 3 + (Math.random() - 0.5),
      life: 20 + Math.random() * 10,
      maxLife: 30,
      color: ['#ff6600', '#ff0000', '#ffff00'][Math.floor(Math.random() * 3)],
      size: 2
    });
  };

  AsteroidsUx.prototype.handleKeyPress = function(e, isDown) {
    if (!this.$gameRunning) return;

    switch(e.keyCode) {
      case 37: // Left
        this.$keys.left = isDown;
        break;
      case 39: // Right
        this.$keys.right = isDown;
        break;
      case 38: // Up (thrust)
        this.$keys.thrust = isDown;
        break;
      case 32: // Space
        if (isDown) {
          this.shoot();
        }
        break;
      case 13: // Enter (hyperspace)
        if (isDown) {
          this.hyperspace();
        }
        break;
    }
  };

  AsteroidsUx.prototype.shoot = function() {
    if (this.$bullets.length < this.MAX_BULLETS) {
      var angle = this.$ship.angle;
      this.$bullets.push({
        x: this.$ship.x + Math.cos(angle) * this.$ship.size,
        y: this.$ship.y + Math.sin(angle) * this.$ship.size,
        velocity: {
          x: Math.cos(angle) * this.BULLET_SPEED + this.$ship.velocity.x,
          y: Math.sin(angle) * this.BULLET_SPEED + this.$ship.velocity.y
        },
        lifetime: this.BULLET_LIFETIME,
        trail: []
      });
    }
  };

  AsteroidsUx.prototype.hyperspace = function() {
    // Create hyperspace effect
    this.createExplosion(this.$ship.x, this.$ship.y, 'medium', '#00aaff');

    // Teleport to random location with risk
    if (Math.random() < 0.7) { // 70% chance of safe teleport
      this.$ship.x = Math.random() * this.CANVAS_WIDTH;
      this.$ship.y = Math.random() * this.CANVAS_HEIGHT;
      this.$ship.velocity = { x: 0, y: 0 };
      this.$ship.invulnerable = 60; // Brief invulnerability

      // Arrival effect
      this.createExplosion(this.$ship.x, this.$ship.y, 'normal', '#00ff00');
    } else {
      // Risky teleport - lose a life
      this.$lives--;
      this.$ship.x = this.CANVAS_WIDTH / 2;
      this.$ship.y = this.CANVAS_HEIGHT / 2;
      this.$ship.velocity = { x: 0, y: 0 };
      this.$ship.invulnerable = 120;

      // Bad hyperspace effect
      this.createExplosion(this.$ship.x, this.$ship.y, 'big', '#ff0000');
    }
  };

  AsteroidsUx.prototype.startGame = function() {
    var that = this;
    this.$gameRunning = true;
    this.$gameOver = false;
    this.$score = 0;
    this.$lives = 3;
    this.$level = 1;
    this.initGame();
    this.updateUI();

    this.$gameLoop = setInterval(function() {
      that.gameStep();
    }, 16); // ~60 FPS
  };

  AsteroidsUx.prototype.pauseGame = function() {
    this.$gameRunning = !this.$gameRunning;
  };

  AsteroidsUx.prototype.resetGame = function() {
    this.$gameRunning = false;
    this.$gameOver = false;
    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
      this.$gameLoop = null;
    }
    this.$score = 0;
    this.$lives = 3;
    this.$level = 1;
    this.initGame();
    this.updateUI();
    this.draw();
  };

  AsteroidsUx.prototype.gameStep = function() {
    if (!this.$gameRunning) return;

    // Update animation frame
    this.$animationFrame++;

    // Update screen shake
    if (this.$screenShake > 0) {
      this.$screenShake--;
    }

    // Handle input
    if (this.$keys.left) {
      this.$ship.angle -= this.ROTATION_SPEED;
    }
    if (this.$keys.right) {
      this.$ship.angle += this.ROTATION_SPEED;
    }
    if (this.$keys.thrust) {
      this.$ship.thrust = true;
      this.$ship.velocity.x += Math.cos(this.$ship.angle) * this.THRUST_POWER;
      this.$ship.velocity.y += Math.sin(this.$ship.angle) * this.THRUST_POWER;

      // Create thrust particles
      if (this.$animationFrame % 2 === 0) {
        this.createThrustParticle(
          this.$ship.x - Math.cos(this.$ship.angle) * this.$ship.size,
          this.$ship.y - Math.sin(this.$ship.angle) * this.$ship.size,
          this.$ship.angle
        );
      }

      // Add to thrust trail
      this.$thrustTrail.push({
        x: this.$ship.x,
        y: this.$ship.y,
        life: 10
      });
    } else {
      this.$ship.thrust = false;
    }

    // Apply friction to ship
    this.$ship.velocity.x *= this.FRICTION;
    this.$ship.velocity.y *= this.FRICTION;

    // Move ship
    this.$ship.x += this.$ship.velocity.x;
    this.$ship.y += this.$ship.velocity.y;

    // Wrap ship around screen
    this.wrapPosition(this.$ship);

    // Update invulnerability
    if (this.$ship.invulnerable > 0) {
      this.$ship.invulnerable--;
    }

    // Update game objects
    this.updateBullets();
    this.updateAsteroids();
    this.updateParticles();
    this.updateThrustEffects();
    this.updateStarfield();

    // Check collisions
    this.checkCollisions();

    // Check game state
    this.checkGameState();

    this.draw();
  };

  AsteroidsUx.prototype.updateBullets = function() {
    for (var i = this.$bullets.length - 1; i >= 0; i--) {
      var bullet = this.$bullets[i];

      // Add to trail
      bullet.trail.push({x: bullet.x, y: bullet.y, life: 5});
      if (bullet.trail.length > 8) {
        bullet.trail.shift();
      }

      bullet.x += bullet.velocity.x;
      bullet.y += bullet.velocity.y;
      bullet.lifetime--;

      this.wrapPosition(bullet);

      if (bullet.lifetime <= 0) {
        this.$bullets.splice(i, 1);
      }
    }
  };

  AsteroidsUx.prototype.updateAsteroids = function() {
    for (var i = 0; i < this.$asteroids.length; i++) {
      var asteroid = this.$asteroids[i];

      // Add to trail
      asteroid.trail.push({x: asteroid.x, y: asteroid.y, life: 3});
      if (asteroid.trail.length > 5) {
        asteroid.trail.shift();
      }

      asteroid.x += asteroid.velocity.x;
      asteroid.y += asteroid.velocity.y;
      asteroid.rotation += asteroid.rotationSpeed;
      this.wrapPosition(asteroid);
    }
  };

  AsteroidsUx.prototype.updateParticles = function() {
    for (var i = this.$particles.length - 1; i >= 0; i--) {
      var particle = this.$particles[i];

      // Add to trail
      particle.trail.push({x: particle.x, y: particle.y});
      if (particle.trail.length > 3) {
        particle.trail.shift();
      }

      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      particle.life--;

      if (particle.life <= 0) {
        this.$particles.splice(i, 1);
      }
    }
  };

  AsteroidsUx.prototype.updateThrustEffects = function() {
    // Update thrust particles
    for (var i = this.$ship.thrustParticles.length - 1; i >= 0; i--) {
      var particle = this.$ship.thrustParticles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.95;
      particle.vy *= 0.95;
      particle.life--;

      if (particle.life <= 0) {
        this.$ship.thrustParticles.splice(i, 1);
      }
    }

    // Update thrust trail
    for (var i = this.$thrustTrail.length - 1; i >= 0; i--) {
      this.$thrustTrail[i].life--;
      if (this.$thrustTrail[i].life <= 0) {
        this.$thrustTrail.splice(i, 1);
      }
    }
  };

  AsteroidsUx.prototype.updateStarfield = function() {
    for (var i = 0; i < this.$stars.length; i++) {
      var star = this.$stars[i];
      star.twinkle += 0.05;
      star.brightness = 0.3 + Math.sin(star.twinkle) * 0.3;
    }
  };

  AsteroidsUx.prototype.wrapPosition = function(obj) {
    if (obj.x < 0) obj.x = this.CANVAS_WIDTH;
    if (obj.x > this.CANVAS_WIDTH) obj.x = 0;
    if (obj.y < 0) obj.y = this.CANVAS_HEIGHT;
    if (obj.y > this.CANVAS_HEIGHT) obj.y = 0;
  };

  AsteroidsUx.prototype.checkCollisions = function() {
    // Bullets vs Asteroids
    for (var i = this.$bullets.length - 1; i >= 0; i--) {
      for (var j = this.$asteroids.length - 1; j >= 0; j--) {
        var bullet = this.$bullets[i];
        var asteroid = this.$asteroids[j];

        if (this.getDistance(bullet.x, bullet.y, asteroid.x, asteroid.y) < asteroid.radius) {
          // Hit!
          this.$bullets.splice(i, 1);
          this.breakAsteroid(asteroid, j);
          break;
        }
      }
    }

    // Ship vs Asteroids
    if (this.$ship.invulnerable === 0) {
      for (var i = 0; i < this.$asteroids.length; i++) {
        var asteroid = this.$asteroids[i];
        if (this.getDistance(this.$ship.x, this.$ship.y, asteroid.x, asteroid.y) < asteroid.radius + this.$ship.size) {
          this.$lives--;
          this.$ship.invulnerable = 120;
          this.$ship.x = this.CANVAS_WIDTH / 2;
          this.$ship.y = this.CANVAS_HEIGHT / 2;
          this.$ship.velocity = { x: 0, y: 0 };
          this.createExplosion(this.$ship.x, this.$ship.y, 'big', '#ff0000');
          break;
        }
      }
    }
  };

  AsteroidsUx.prototype.breakAsteroid = function(asteroid, index) {
    var points = [100, 50, 20][asteroid.size];
    this.$score += points;

    var explosionSize = asteroid.size === 0 ? 'big' : asteroid.size === 1 ? 'medium' : 'normal';
    this.createExplosion(asteroid.x, asteroid.y, explosionSize, '#ffaa00');

    // Create smaller asteroids
    if (asteroid.size < 2) { // Can break into smaller pieces
      for (var i = 0; i < 2; i++) {
        var newAsteroid = {
          x: asteroid.x + (Math.random() - 0.5) * 20,
          y: asteroid.y + (Math.random() - 0.5) * 20,
          size: asteroid.size + 1,
          radius: this.ASTEROID_SIZES[asteroid.size + 1],
          velocity: {
            x: (Math.random() - 0.5) * 3,
            y: (Math.random() - 0.5) * 3
          },
          rotation: 0,
          rotationSpeed: (Math.random() - 0.5) * 0.15,
          vertices: this.generateAsteroidVertices(),
          trail: []
        };
        this.$asteroids.push(newAsteroid);
      }
    }

    this.$asteroids.splice(index, 1);
  };

  AsteroidsUx.prototype.getDistance = function(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  };

  AsteroidsUx.prototype.checkGameState = function() {
    // Check if all asteroids destroyed
    if (this.$asteroids.length === 0) {
      this.nextLevel();
    }

    // Check game over
    if (this.$lives <= 0) {
      this.gameOver();
    }

    this.updateUI();
  };

  AsteroidsUx.prototype.nextLevel = function() {
    this.$level++;
    this.$bullets = [];
    this.$particles = [];
    this.createAsteroids();
    this.$score += 1000; // Level bonus

    // Level complete celebration effect
    for (var i = 0; i < 15; i++) {
      this.createExplosion(
        Math.random() * this.CANVAS_WIDTH,
        Math.random() * this.CANVAS_HEIGHT,
        'normal',
        '#00ff00'
      );
    }
  };

  AsteroidsUx.prototype.gameOver = function() {
    this.$gameRunning = false;
    this.$gameOver = true;
    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
      this.$gameLoop = null;
    }

    // Final explosion
    this.createExplosion(this.$ship.x, this.$ship.y, 'big', '#ff0000');

    this.draw();
  };

  AsteroidsUx.prototype.updateUI = function() {
    this.$scoreEl.textContent = this.$score;
    this.$livesEl.textContent = this.$lives;
    this.$levelEl.textContent = this.$level;
  };

  AsteroidsUx.prototype.draw = function() {
    // Apply screen shake
    var shakeX = this.$screenShake > 0 ? (Math.random() - 0.5) * this.$screenShake : 0;
    var shakeY = this.$screenShake > 0 ? (Math.random() - 0.5) * this.$screenShake : 0;

    this.$ctx.save();
    this.$ctx.translate(shakeX, shakeY);

    // Clear with deep space background
    this.$ctx.fillStyle = '#000011';
    this.$ctx.fillRect(-shakeX, -shakeY, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    // Draw enhanced starfield
    this.drawEnhancedStarfield();

    // Draw thrust trail
    this.drawThrustTrail();

    // Draw ship with enhanced graphics
    if (this.$ship.invulnerable === 0 || Math.floor(this.$ship.invulnerable / 5) % 2) {
      this.drawEnhancedShip();
    }

    // Draw thrust particles
    this.drawThrustParticles();

    // Draw bullets with trails
    this.drawBulletsWithTrails();

    // Draw asteroids with enhanced graphics
    this.drawEnhancedAsteroids();

    // Draw particles
    this.drawParticles();

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

  AsteroidsUx.prototype.drawEnhancedStarfield = function() {
    for (var i = 0; i < this.$stars.length; i++) {
      var star = this.$stars[i];
      var size = (1 - star.z / 100) * 2 + 0.5;
      var brightness = Math.max(0, Math.min(1, star.brightness));

      this.$ctx.fillStyle = star.color;
      this.$ctx.globalAlpha = brightness;
      this.$ctx.fillRect(star.x, star.y, size, size);

      // Add glow for brighter stars
      if (brightness > 0.7) {
        this.$ctx.shadowColor = star.color;
        this.$ctx.shadowBlur = size * 2;
        this.$ctx.fillRect(star.x, star.y, size, size);
        this.$ctx.shadowBlur = 0;
      }
      this.$ctx.globalAlpha = 1;
    }
  };

  AsteroidsUx.prototype.drawThrustTrail = function() {
    for (var i = 0; i < this.$thrustTrail.length; i++) {
      var trail = this.$thrustTrail[i];
      var alpha = trail.life / 10;
      this.$ctx.fillStyle = 'rgba(255, 100, 0, ' + alpha + ')';
      this.$ctx.fillRect(trail.x - 2, trail.y - 2, 4, 4);
    }
  };

  AsteroidsUx.prototype.drawEnhancedShip = function() {
    this.$ctx.save();
    this.$ctx.translate(this.$ship.x, this.$ship.y);
    this.$ctx.rotate(this.$ship.angle);

    // Ship outline with glow
    this.$ctx.strokeStyle = '#ffffff';
    this.$ctx.lineWidth = 2;
    this.$ctx.shadowColor = '#ffffff';
    this.$ctx.shadowBlur = 3;

    this.$ctx.beginPath();
    this.$ctx.moveTo(this.$ship.size, 0);
    this.$ctx.lineTo(-this.$ship.size, -this.$ship.size * 0.6);
    this.$ctx.lineTo(-this.$ship.size * 0.5, 0);
    this.$ctx.lineTo(-this.$ship.size, this.$ship.size * 0.6);
    this.$ctx.closePath();
    this.$ctx.stroke();

    // Ship details
    this.$ctx.shadowBlur = 0;
    this.$ctx.strokeStyle = '#aaaaff';
    this.$ctx.lineWidth = 1;
    this.$ctx.beginPath();
    this.$ctx.moveTo(this.$ship.size * 0.5, -this.$ship.size * 0.3);
    this.$ctx.lineTo(this.$ship.size * 0.5, this.$ship.size * 0.3);
    this.$ctx.stroke();

    this.$ctx.restore();
  };

  AsteroidsUx.prototype.drawThrustParticles = function() {
    for (var i = 0; i < this.$ship.thrustParticles.length; i++) {
      var particle = this.$ship.thrustParticles[i];
      var alpha = particle.life / particle.maxLife;

      this.$ctx.fillStyle = particle.color;
      this.$ctx.globalAlpha = alpha;
      this.$ctx.fillRect(
        particle.x - particle.size/2,
        particle.y - particle.size/2,
        particle.size,
        particle.size
      );

      // Add glow
      this.$ctx.shadowColor = particle.color;
      this.$ctx.shadowBlur = particle.size;
      this.$ctx.fillRect(
        particle.x - particle.size/2,
        particle.y - particle.size/2,
        particle.size,
        particle.size
      );
      this.$ctx.shadowBlur = 0;
      this.$ctx.globalAlpha = 1;
    }
  };

  AsteroidsUx.prototype.drawBulletsWithTrails = function() {
    for (var i = 0; i < this.$bullets.length; i++) {
      var bullet = this.$bullets[i];

      // Draw trail
      for (var j = 0; j < bullet.trail.length; j++) {
        var trail = bullet.trail[j];
        var alpha = (j + 1) / bullet.trail.length;
        this.$ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha * 0.5 + ')';
        this.$ctx.fillRect(trail.x - 1, trail.y - 1, 2, 2);
      }

      // Draw bullet with glow
      this.$ctx.fillStyle = '#ffffff';
      this.$ctx.shadowColor = '#ffffff';
      this.$ctx.shadowBlur = 3;
      this.$ctx.fillRect(bullet.x - 1, bullet.y - 1, 2, 2);
      this.$ctx.shadowBlur = 0;
    }
  };

  AsteroidsUx.prototype.drawEnhancedAsteroids = function() {
    for (var i = 0; i < this.$asteroids.length; i++) {
      var asteroid = this.$asteroids[i];

      // Draw trail
      for (var j = 0; j < asteroid.trail.length; j++) {
        var trail = asteroid.trail[j];
        var alpha = (j + 1) / asteroid.trail.length;
        this.$ctx.fillStyle = 'rgba(204, 204, 204, ' + alpha * 0.2 + ')';
        this.$ctx.fillRect(trail.x - 2, trail.y - 2, 4, 4);
      }

      this.$ctx.save();
      this.$ctx.translate(asteroid.x, asteroid.y);
      this.$ctx.rotate(asteroid.rotation);

      // Asteroid outline with subtle glow
      this.$ctx.strokeStyle = '#cccccc';
      this.$ctx.lineWidth = 2;
      this.$ctx.shadowColor = '#cccccc';
      this.$ctx.shadowBlur = 1;

      this.$ctx.beginPath();
      for (var j = 0; j < asteroid.vertices.length; j++) {
        var vertex = asteroid.vertices[j];
        var x = Math.cos(vertex.angle) * vertex.radius * asteroid.radius;
        var y = Math.sin(vertex.angle) * vertex.radius * asteroid.radius;

        if (j === 0) {
          this.$ctx.moveTo(x, y);
        } else {
          this.$ctx.lineTo(x, y);
        }
      }
      this.$ctx.closePath();
      this.$ctx.stroke();
      this.$ctx.shadowBlur = 0;

      // Asteroid details (cracks/features)
      this.$ctx.strokeStyle = '#999999';
      this.$ctx.lineWidth = 1;
      this.$ctx.beginPath();
      this.$ctx.moveTo(-asteroid.radius * 0.3, -asteroid.radius * 0.2);
      this.$ctx.lineTo(asteroid.radius * 0.2, asteroid.radius * 0.1);
      this.$ctx.moveTo(-asteroid.radius * 0.1, asteroid.radius * 0.3);
      this.$ctx.lineTo(asteroid.radius * 0.3, -asteroid.radius * 0.1);
      this.$ctx.stroke();

      this.$ctx.restore();
    }
  };

  AsteroidsUx.prototype.drawParticles = function() {
    for (var i = 0; i < this.$particles.length; i++) {
      var particle = this.$particles[i];
      var alpha = particle.life / particle.maxLife;

      // Draw trail
      for (var j = 0; j < particle.trail.length; j++) {
        var trail = particle.trail[j];
        var trailAlpha = alpha * (j + 1) / particle.trail.length * 0.5;
        this.$ctx.fillStyle = particle.color;
        this.$ctx.globalAlpha = trailAlpha;
        this.$ctx.fillRect(trail.x - 1, trail.y - 1, 2, 2);
      }

      // Draw particle
      this.$ctx.fillStyle = particle.color;
      this.$ctx.globalAlpha = alpha;
      this.$ctx.fillRect(
        particle.x - particle.size/2,
        particle.y - particle.size/2,
        particle.size,
        particle.size
      );

      // Add glow
      this.$ctx.shadowColor = particle.color;
      this.$ctx.shadowBlur = particle.size * 2;
      this.$ctx.fillRect(
        particle.x - particle.size/2,
        particle.y - particle.size/2,
        particle.size,
        particle.size
      );
      this.$ctx.shadowBlur = 0;
      this.$ctx.globalAlpha = 1;
    }
  };

  AsteroidsUx.prototype.doDestroy = function() {
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
    this.$asteroids = null;
    this.$particles = null;
    this.$stars = null;
    this.$ship = null;
    this.$thrustTrail = null;
    
    Widget.prototype.doDestroy.call(this);
  };

  return AsteroidsUx;
});