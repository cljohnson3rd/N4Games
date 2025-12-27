define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/centipede'
], function(baja, Widget) {
  'use strict';

  var CentipedeUx = function() {
    var that = this;
    Widget.apply(this, arguments);
    
    // Game constants
    this.CANVAS_WIDTH = 400;
    this.CANVAS_HEIGHT = 600;
    this.CELL_SIZE = 20;
    this.GRID_WIDTH = 20;
    this.GRID_HEIGHT = 30;
    this.PLAYER_ZONE = 24; // Bottom 6 rows for player movement
    
    // Game state
    this.$gameRunning = false;
    this.$gamePaused = false;
    this.$gameOverFlag = false;
    this.$score = 0;
    this.$lives = 3;
    this.$level = 1;
    
    // Game objects with optimized positioning
    this.$player = { x: 200, y: 540, speed: 4 };
    this.$bullets = [];
    this.$centipedes = [];
    this.$mushrooms = [];
    this.$enemies = [];
    this.$particles = [];
    this.$explosions = [];

    // Optimized input system
    this.$keys = {};
    this.$shootCooldown = 0;
    this.$maxShootCooldown = 8;

    // Animation and timing
    this.$frameCount = 0;
    this.$gameLoopId = null;

    // Enemy spawn timers with better pacing
    this.$spiderTimer = 0;
    this.$fleaTimer = 0;
    this.$scorpionTimer = 0;

    // Performance optimizations
    this.$lastUpdateTime = 0;
    this.$deltaTime = 0;
  };

  CentipedeUx.prototype = Object.create(Widget.prototype);
  CentipedeUx.prototype.constructor = CentipedeUx;

  CentipedeUx.prototype.findElement = function(selector) {
    if (this.$container.querySelector) {
      return this.$container.querySelector(selector);
    } else if (this.$container.nodeType) {
      return this.$container.querySelector(selector);
    } else {
      var elem = this.$container.element || this.$container[0] || this.$container;
      return elem.querySelector ? elem.querySelector(selector) : null;
    }
  };

  CentipedeUx.prototype.doInitialize = function(element) {
    var that = this;

    // Handle Niagara element wrappers
    if (element.nodeType) {
      this.$container = element;
    } else if (element.element) {
      this.$container = element.element;
    } else if (element[0] && element[0].nodeType) {
      this.$container = element[0];
    } else {
      this.$container = element;
    }

    // Create HTML
    this.$container.innerHTML =
      '<div class="centipede-container">' +
        '<div class="centipede-game">' +
          '<canvas id="centipede-board" width="' + this.CANVAS_WIDTH + '" height="' + this.CANVAS_HEIGHT + '" tabindex="0"></canvas>' +
        '</div>' +
        '<div class="centipede-sidebar">' +
          '<div class="centipede-info">' +
            '<div>Score: <span id="score">0</span></div>' +
            '<div>Level: <span id="level">1</span></div>' +
            '<div>Mushrooms: <span id="mushrooms">0</span></div>' +
          '</div>' +
          '<div class="centipede-lives">' +
            '<div>Lives</div>' +
            '<div class="life-display" id="life-display"></div>' +
          '</div>' +
          '<div class="centipede-enemies">' +
            '<div>Enemies</div>' +
            '<div class="enemy-icons">' +
              '<div class="enemy-icon centipede"></div>' +
              '<div class="enemy-icon spider"></div>' +
              '<div class="enemy-icon flea"></div>' +
              '<div class="enemy-icon scorpion"></div>' +
            '</div>' +
          '</div>' +
          '<div class="centipede-controls">' +
            '<button id="start-btn">Start</button>' +
            '<button id="pause-btn">Pause</button>' +
            '<button id="reset-btn">Reset</button>' +
          '</div>' +
          '<div class="centipede-instructions">' +
            '<div><strong>Controls:</strong></div>' +
            '<div>← → Move</div>' +
            '<div>↑ ↓ Move Up/Down</div>' +
            '<div>Space: Shoot</div>' +
            '<div>Destroy all centipedes!</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Get canvas and context
    this.$canvas = this.findElement('#centipede-board');
    this.$ctx = this.$canvas.getContext('2d');

    // Get UI elements
    this.$scoreEl = this.findElement('#score');
    this.$levelEl = this.findElement('#level');
    this.$mushroomsEl = this.findElement('#mushrooms');
    this.$livesEl = this.findElement('#life-display');

    // Event listeners
    this.findElement('#start-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.startGame();
    });

    this.findElement('#pause-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.pauseGame();
    });

    this.findElement('#reset-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.resetGame();
    });

    // Optimized keyboard controls
    this.$keydownHandler = function(e) {
      that.$keys[e.keyCode] = true;
      if (e.keyCode === 32) { // Space
        e.preventDefault();
        e.stopPropagation();
      }
    };

    this.$keyupHandler = function(e) {
      that.$keys[e.keyCode] = false;
    };

    document.addEventListener('keydown', this.$keydownHandler);
    document.addEventListener('keyup', this.$keyupHandler);

    // Make canvas focusable
    this.$canvas.tabIndex = 0;
    this.$canvas.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.$canvas.focus();
    });

    // Initialize game
    this.initializeGame();
    this.updateDisplay();
    this.draw();
  };

  CentipedeUx.prototype.initializeGame = function() {
    // Reset game objects
    this.$bullets = [];
    this.$centipedes = [];
    this.$enemies = [];
    this.$particles = [];
    this.$explosions = [];

    // Generate optimized mushroom field
    this.generateMushrooms();

    // Create centipede with better pacing
    this.createCentipede(0, 0, 8 + Math.floor(this.$level * 2));

    // Reset player to center bottom
    this.$player = {
      x: this.CANVAS_WIDTH / 2,
      y: this.CANVAS_HEIGHT - 60,
      speed: 4
    };

    // Reset timers
    this.$frameCount = 0;
    this.$shootCooldown = 0;
    this.$spiderTimer = 300 + Math.random() * 300;
    this.$fleaTimer = 600 + Math.random() * 300;
    this.$scorpionTimer = 900 + Math.random() * 300;
    this.$lastUpdateTime = performance.now();
  };

  CentipedeUx.prototype.generateMushrooms = function() {
    this.$mushrooms = [];
    var mushroomCount = 20 + (this.$level * 3);
    var attempts = 0;

    while (this.$mushrooms.length < mushroomCount && attempts < mushroomCount * 3) {
      var x = Math.floor(Math.random() * this.GRID_WIDTH) * this.CELL_SIZE;
      var y = Math.floor(Math.random() * (this.PLAYER_ZONE - 2)) * this.CELL_SIZE;

      // Ensure mushrooms aren't too close to each other
      var tooClose = false;
      for (var i = 0; i < this.$mushrooms.length; i++) {
        var dx = this.$mushrooms[i].x - x;
        var dy = this.$mushrooms[i].y - y;
        if (Math.abs(dx) < this.CELL_SIZE * 2 && Math.abs(dy) < this.CELL_SIZE * 2) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        this.$mushrooms.push({
          x: x + this.CELL_SIZE/2,
          y: y + this.CELL_SIZE/2,
          health: 4,
          maxHealth: 4
        });
      }
      attempts++;
    }
  };

  CentipedeUx.prototype.createCentipede = function(x, y, segments) {
    var centipede = {
      segments: [],
      direction: 1,
      speed: 1 + (this.$level - 1) * 0.3,
      moveTimer: 0,
      color: '#ef4444',
      id: Date.now() + Math.random()
    };

    for (var i = 0; i < segments; i++) {
      centipede.segments.push({
        x: x - (i * this.CELL_SIZE),
        y: y,
        isHead: i === 0,
        trail: []
      });
    }

    this.$centipedes.push(centipede);
  };

  CentipedeUx.prototype.startGame = function() {
    this.$gameRunning = true;
    this.$gameOverFlag = false;
    this.$gamePaused = false;
    this.$lastUpdateTime = performance.now();

    if (this.$gameLoopId) {
      cancelAnimationFrame(this.$gameLoopId);
    }
    this.gameLoop();
  };

  CentipedeUx.prototype.pauseGame = function() {
    this.$gamePaused = !this.$gamePaused;
    if (!this.$gamePaused && this.$gameRunning) {
      this.$lastUpdateTime = performance.now();
      this.gameLoop();
    }
  };

  CentipedeUx.prototype.resetGame = function() {
    this.$gameRunning = false;
    this.$gameOverFlag = false;
    this.$gamePaused = false;
    this.$score = 0;
    this.$lives = 3;
    this.$level = 1;

    if (this.$gameLoopId) {
      cancelAnimationFrame(this.$gameLoopId);
      this.$gameLoopId = null;
    }

    this.initializeGame();
    this.updateDisplay();
    this.draw();
  };

  CentipedeUx.prototype.gameLoop = function() {
    var that = this;

    if (this.$gameRunning && !this.$gamePaused) {
      var currentTime = performance.now();
      this.$deltaTime = currentTime - this.$lastUpdateTime;
      this.$lastUpdateTime = currentTime;

      this.handleInput();
      this.updateGame();
    }

    this.updateEffects();
    this.draw();

    this.$gameLoopId = requestAnimationFrame(function() {
      that.gameLoop();
    });
  };

  CentipedeUx.prototype.handleInput = function() {
    var moveSpeed = this.$player.speed;

    // Smooth 8-directional movement
    if (this.$keys[37] && this.$player.x > this.CELL_SIZE/2) { // Left
      this.$player.x -= moveSpeed;
    }
    if (this.$keys[39] && this.$player.x < this.CANVAS_WIDTH - this.CELL_SIZE/2) { // Right
      this.$player.x += moveSpeed;
    }
    if (this.$keys[38] && this.$player.y > this.PLAYER_ZONE * this.CELL_SIZE) { // Up
      this.$player.y -= moveSpeed;
    }
    if (this.$keys[40] && this.$player.y < this.CANVAS_HEIGHT - this.CELL_SIZE/2) { // Down
      this.$player.y += moveSpeed;
    }

    // Shooting with proper cooldown
    if (this.$keys[32] && this.$shootCooldown <= 0) {
      this.shoot();
      this.$shootCooldown = this.$maxShootCooldown;
    }

    if (this.$shootCooldown > 0) {
      this.$shootCooldown--;
    }
  };

  CentipedeUx.prototype.shoot = function() {
    this.$bullets.push({
      x: this.$player.x,
      y: this.$player.y - this.CELL_SIZE/2,
      speed: 12,
      trail: []
    });

    this.createMuzzleFlash(this.$player.x, this.$player.y);
  };

  CentipedeUx.prototype.updateGame = function() {
    this.$frameCount++;

    this.updateBullets();
    this.updateCentipedes();
    this.updateEnemies();
    this.spawnEnemies();
    this.checkCollisions();
    this.checkWinCondition();
    this.updateDisplay();
  };

  CentipedeUx.prototype.updateBullets = function() {
    for (var i = this.$bullets.length - 1; i >= 0; i--) {
      var bullet = this.$bullets[i];

      // Update trail
      if (bullet.trail.length > 5) {
        bullet.trail.shift();
      }
      bullet.trail.push({ x: bullet.x, y: bullet.y, alpha: 1 });

      bullet.y -= bullet.speed;

      if (bullet.y < 0) {
        this.$bullets.splice(i, 1);
      }
    }
  };

  CentipedeUx.prototype.updateCentipedes = function() {
    for (var i = this.$centipedes.length - 1; i >= 0; i--) {
      var centipede = this.$centipedes[i];

      if (centipede.segments.length === 0) {
        this.$centipedes.splice(i, 1);
        continue;
      }

      centipede.moveTimer++;

      if (centipede.moveTimer >= Math.max(10, 20 - this.$level)) {
        centipede.moveTimer = 0;
        this.moveCentipede(centipede);
      }
    }
  };

  CentipedeUx.prototype.moveCentipede = function(centipede) {
    if (centipede.segments.length === 0) return;

    var head = centipede.segments[0];
    var newX = head.x + (centipede.direction * this.CELL_SIZE);
    var blocked = false;

    // Check boundaries and mushroom collisions
    if (newX < 0 || newX >= this.CANVAS_WIDTH || this.getMushroomAt(newX, head.y)) {
      blocked = true;
    }

    if (blocked) {
      // Change direction and move down
      centipede.direction *= -1;

      for (var j = 0; j < centipede.segments.length; j++) {
        centipede.segments[j].y += this.CELL_SIZE;

        // Speed up in player zone
        if (centipede.segments[j].y >= this.PLAYER_ZONE * this.CELL_SIZE) {
          centipede.speed = Math.min(3, centipede.speed * 1.5);
        }
      }
    } else {
      // Move segments forward (snake-like movement)
      for (var j = centipede.segments.length - 1; j > 0; j--) {
        centipede.segments[j].x = centipede.segments[j - 1].x;
        centipede.segments[j].y = centipede.segments[j - 1].y;
      }
      head.x = newX;
    }

    // Check if centipede reached bottom
    if (head.y >= this.CANVAS_HEIGHT) {
      this.playerDied();
    }
  };

  CentipedeUx.prototype.updateEnemies = function() {
    for (var i = this.$enemies.length - 1; i >= 0; i--) {
      var enemy = this.$enemies[i];

      switch (enemy.type) {
        case 'spider':
          this.updateSpider(enemy);
          break;
        case 'flea':
          this.updateFlea(enemy);
          break;
        case 'scorpion':
          this.updateScorpion(enemy);
          break;
      }

      // Remove enemies that are off-screen
      if (enemy.x < -50 || enemy.x > this.CANVAS_WIDTH + 50 ||
          enemy.y < -50 || enemy.y > this.CANVAS_HEIGHT + 50) {
        this.$enemies.splice(i, 1);
      }
    }
  };

  CentipedeUx.prototype.updateSpider = function(spider) {
    spider.moveTimer++;

    if (spider.moveTimer >= spider.speed) {
      spider.moveTimer = 0;

      // Smart spider movement - tends toward player
      var playerDx = this.$player.x - spider.x;
      var playerDy = this.$player.y - spider.y;

      spider.dirX += (Math.sign(playerDx) * 0.3 + (Math.random() - 0.5) * 0.7) * 2;
      spider.dirY += (Math.sign(playerDy) * 0.2 + (Math.random() - 0.5) * 0.8) * 2;

      // Clamp movement
      spider.dirX = Math.max(-3, Math.min(3, spider.dirX));
      spider.dirY = Math.max(-2, Math.min(2, spider.dirY));

      spider.x += spider.dirX;
      spider.y += spider.dirY;

      // Keep in player zone
      if (spider.y < this.PLAYER_ZONE * this.CELL_SIZE) {
        spider.y = this.PLAYER_ZONE * this.CELL_SIZE;
        spider.dirY = Math.abs(spider.dirY);
      }
      if (spider.y > this.CANVAS_HEIGHT - this.CELL_SIZE) {
        spider.y = this.CANVAS_HEIGHT - this.CELL_SIZE;
        spider.dirY = -Math.abs(spider.dirY);
      }
    }
  };

  CentipedeUx.prototype.updateFlea = function(flea) {
    flea.y += flea.speed;

    // Drop mushrooms occasionally
    if (Math.random() < 0.05 && flea.y > this.CELL_SIZE * 2 && flea.y < this.PLAYER_ZONE * this.CELL_SIZE) {
      var mushX = Math.floor(flea.x / this.CELL_SIZE) * this.CELL_SIZE + this.CELL_SIZE/2;
      var mushY = Math.floor(flea.y / this.CELL_SIZE) * this.CELL_SIZE + this.CELL_SIZE/2;

      if (!this.getMushroomAt(mushX, mushY)) {
        this.$mushrooms.push({ x: mushX, y: mushY, health: 4, maxHealth: 4 });
      }
    }
  };

  CentipedeUx.prototype.updateScorpion = function(scorpion) {
    scorpion.x += scorpion.direction * scorpion.speed;

    // Poison mushrooms
    var mushroom = this.getMushroomAt(scorpion.x, scorpion.y);
    if (mushroom && !mushroom.poisoned) {
      mushroom.poisoned = true;
      mushroom.health = 1;
      this.createPoisonEffect(mushroom.x, mushroom.y);
    }
  };

  CentipedeUx.prototype.spawnEnemies = function() {
    // Spider spawning
    this.$spiderTimer--;
    if (this.$spiderTimer <= 0) {
      this.$spiderTimer = 400 + Math.random() * 400;
      this.$enemies.push({
        type: 'spider',
        x: Math.random() < 0.5 ? -20 : this.CANVAS_WIDTH + 20,
        y: (this.PLAYER_ZONE + 2) * this.CELL_SIZE + Math.random() * 60,
        dirX: 0,
        dirY: 0,
        speed: 15 + Math.random() * 10,
        moveTimer: 0,
        color: '#7c3aed',
        health: 1
      });
    }

    // Flea spawning (when few mushrooms in player area)
    this.$fleaTimer--;
    if (this.$fleaTimer <= 0) {
      var playerAreaMushrooms = this.$mushrooms.filter(function(m) {
        return m.y >= this.PLAYER_ZONE * this.CELL_SIZE;
      }, this);

      if (playerAreaMushrooms.length < 3) {
        this.$fleaTimer = 600 + Math.random() * 400;
        this.$enemies.push({
          type: 'flea',
          x: Math.random() * (this.CANVAS_WIDTH - this.CELL_SIZE),
          y: 0,
          speed: 3 + Math.random() * 2,
          color: '#22c55e',
          health: 2
        });
      } else {
        this.$fleaTimer = 300; // Check again soon
      }
    }

    // Scorpion spawning
    this.$scorpionTimer--;
    if (this.$scorpionTimer <= 0) {
      this.$scorpionTimer = 800 + Math.random() * 600;
      this.$enemies.push({
        type: 'scorpion',
        x: Math.random() < 0.5 ? -20 : this.CANVAS_WIDTH + 20,
        y: Math.random() * (this.PLAYER_ZONE * this.CELL_SIZE),
        direction: Math.random() < 0.5 ? 1 : -1,
        speed: 2 + Math.random(),
        color: '#f59e0b',
        health: 1
      });
    }
  };

  CentipedeUx.prototype.checkCollisions = function() {
    // Bullet vs Centipede collisions
    for (var i = this.$bullets.length - 1; i >= 0; i--) {
      var bullet = this.$bullets[i];

      for (var j = this.$centipedes.length - 1; j >= 0; j--) {
        var centipede = this.$centipedes[j];

        for (var k = centipede.segments.length - 1; k >= 0; k--) {
          var segment = centipede.segments[k];

          var dx = bullet.x - segment.x;
          var dy = bullet.y - segment.y;
          if (Math.sqrt(dx * dx + dy * dy) < this.CELL_SIZE * 0.7) {
            this.$bullets.splice(i, 1);
            this.hitCentipedeSegment(centipede, k);
            this.createExplosion(segment.x, segment.y, '#ef4444');
            this.$score += 100;
            i = -1; // Exit bullet loop
            break;
          }
        }
      }
    }

    // Bullet vs Mushroom collisions
    for (var i = this.$bullets.length - 1; i >= 0; i--) {
      var bullet = this.$bullets[i];
      var mushroom = this.getMushroomAt(bullet.x, bullet.y);

      if (mushroom) {
        this.$bullets.splice(i, 1);
        mushroom.health--;

        if (mushroom.health <= 0) {
          var index = this.$mushrooms.indexOf(mushroom);
          if (index > -1) {
            this.$mushrooms.splice(index, 1);
          }
          this.$score += mushroom.poisoned ? 5 : 1;
          this.createExplosion(mushroom.x, mushroom.y, '#22c55e');
        } else {
          this.createHitEffect(mushroom.x, mushroom.y);
        }
      }
    }

    // Bullet vs Enemy collisions
    for (var i = this.$bullets.length - 1; i >= 0; i--) {
      var bullet = this.$bullets[i];

      for (var j = this.$enemies.length - 1; j >= 0; j--) {
        var enemy = this.$enemies[j];

        var dx = bullet.x - enemy.x;
        var dy = bullet.y - enemy.y;
        if (Math.sqrt(dx * dx + dy * dy) < this.CELL_SIZE * 0.8) {
          this.$bullets.splice(i, 1);
          enemy.health--;

          if (enemy.health <= 0) {
            this.$enemies.splice(j, 1);
            var points = { spider: 300, flea: 200, scorpion: 1000 }[enemy.type];
            this.$score += points;
            this.createExplosion(enemy.x, enemy.y, enemy.color);
            this.addScoreParticle(enemy.x, enemy.y, '+' + points);
          } else {
            this.createHitEffect(enemy.x, enemy.y);
          }
          i = -1; // Exit bullet loop
          break;
        }
      }
    }

    // Player vs Enemy collisions
    for (var i = 0; i < this.$enemies.length; i++) {
      var enemy = this.$enemies[i];

      var dx = this.$player.x - enemy.x;
      var dy = this.$player.y - enemy.y;
      if (Math.sqrt(dx * dx + dy * dy) < this.CELL_SIZE * 0.9) {
        this.playerDied();
        return;
      }
    }

    // Player vs Centipede collisions
    for (var i = 0; i < this.$centipedes.length; i++) {
      var centipede = this.$centipedes[i];

      for (var j = 0; j < centipede.segments.length; j++) {
        var segment = centipede.segments[j];

        var dx = this.$player.x - segment.x;
        var dy = this.$player.y - segment.y;
        if (Math.sqrt(dx * dx + dy * dy) < this.CELL_SIZE * 0.9) {
          this.playerDied();
          return;
        }
      }
    }
  };

  CentipedeUx.prototype.hitCentipedeSegment = function(centipede, segmentIndex) {
    var segment = centipede.segments[segmentIndex];

    // Create mushroom at hit location
    this.$mushrooms.push({
      x: segment.x,
      y: segment.y,
      health: 4,
      maxHealth: 4
    });

    if (segmentIndex === 0) {
      // Hit head - remove and make next segment head
      centipede.segments.shift();
      if (centipede.segments.length > 0) {
        centipede.segments[0].isHead = true;
        centipede.direction *= -1; // Change direction
      }
    } else {
      // Hit body - split centipede
      var tailSegments = centipede.segments.splice(segmentIndex);
      tailSegments.shift(); // Remove hit segment

      if (tailSegments.length > 0) {
        var newCentipede = {
          segments: tailSegments,
          direction: centipede.direction * -1,
          speed: centipede.speed,
          moveTimer: 0,
          color: centipede.color,
          id: Date.now() + Math.random()
        };
        newCentipede.segments[0].isHead = true;
        this.$centipedes.push(newCentipede);
      }
    }
  };

  CentipedeUx.prototype.getMushroomAt = function(x, y) {
    for (var i = 0; i < this.$mushrooms.length; i++) {
      var mushroom = this.$mushrooms[i];
      var dx = mushroom.x - x;
      var dy = mushroom.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < this.CELL_SIZE * 0.8) {
        return mushroom;
      }
    }
    return null;
  };

  CentipedeUx.prototype.checkWinCondition = function() {
    if (this.$centipedes.length === 0) {
      this.levelComplete();
    }
  };

  CentipedeUx.prototype.levelComplete = function() {
    this.$level++;

    // Bonus points for remaining lives
    this.$score += this.$lives * 100;
    this.addScoreParticle(this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2, '+' + (this.$lives * 100));

    // Start next level
    this.initializeGame();
  };

  CentipedeUx.prototype.playerDied = function() {
    this.$lives--;
    this.createExplosion(this.$player.x, this.$player.y, '#22d3ee');

    if (this.$lives <= 0) {
      this.gameOver();
    } else {
      // Reset player position
      this.$player.x = this.CANVAS_WIDTH / 2;
      this.$player.y = this.CANVAS_HEIGHT - 60;
    }
  };

  CentipedeUx.prototype.gameOver = function() {
    this.$gameRunning = false;
    this.$gameOverFlag = true;

    if (this.$gameLoopId) {
      cancelAnimationFrame(this.$gameLoopId);
      this.$gameLoopId = null;
    }

    // Create game over explosion
    for (var i = 0; i < 20; i++) {
      this.$particles.push({
        x: this.CANVAS_WIDTH / 2,
        y: this.CANVAS_HEIGHT / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 60,
        maxLife: 60,
        color: '#dc2626',
        size: 4
      });
    }
  };

  CentipedeUx.prototype.updateEffects = function() {
    // Update particles
    for (var i = this.$particles.length - 1; i >= 0; i--) {
      var particle = this.$particles[i];
      particle.life--;
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.life <= 0) {
        this.$particles.splice(i, 1);
      }
    }

    // Update explosions
    for (var i = this.$explosions.length - 1; i >= 0; i--) {
      var explosion = this.$explosions[i];
      explosion.life--;
      explosion.size += 2;

      if (explosion.life <= 0) {
        this.$explosions.splice(i, 1);
      }
    }

    // Update bullet trails
    for (var i = 0; i < this.$bullets.length; i++) {
      var bullet = this.$bullets[i];
      for (var j = bullet.trail.length - 1; j >= 0; j--) {
        bullet.trail[j].alpha -= 0.15;
        if (bullet.trail[j].alpha <= 0) {
          bullet.trail.splice(j, 1);
        }
      }
    }
  };

  CentipedeUx.prototype.draw = function() {
    // Clear canvas
    this.$ctx.fillStyle = '#000000';
    this.$ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    // Draw player zone line
    this.$ctx.strokeStyle = '#22d3ee';
    this.$ctx.lineWidth = 2;
    this.$ctx.beginPath();
    this.$ctx.moveTo(0, this.PLAYER_ZONE * this.CELL_SIZE);
    this.$ctx.lineTo(this.CANVAS_WIDTH, this.PLAYER_ZONE * this.CELL_SIZE);
    this.$ctx.stroke();

    this.drawMushrooms();
    this.drawBullets();
    this.drawCentipedes();
    this.drawEnemies();
    this.drawPlayer();
    this.drawEffects();

    // Draw game over
    if (this.$gameOverFlag && !this.$gameRunning) {
      this.$ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      this.$ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

      this.$ctx.fillStyle = '#fff';
      this.$ctx.font = 'bold 32px Arial';
      this.$ctx.textAlign = 'center';
      this.$ctx.fillText('GAME OVER', this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2);

      this.$ctx.font = '16px Arial';
      this.$ctx.fillText('Score: ' + this.$score, this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2 + 40);
    }
  };

  CentipedeUx.prototype.drawMushrooms = function() {
    for (var i = 0; i < this.$mushrooms.length; i++) {
      var mushroom = this.$mushrooms[i];

      var healthRatio = mushroom.health / mushroom.maxHealth;
      var colors = ['#dc2626', '#f97316', '#fbbf24', '#22c55e'];
      var color = colors[Math.floor(healthRatio * 3)];

      if (mushroom.poisoned) {
        color = '#7c3aed';
      }

      this.$ctx.fillStyle = color;
      this.$ctx.shadowColor = color;
      this.$ctx.shadowBlur = 6;

      // Mushroom cap
      this.$ctx.beginPath();
      this.$ctx.arc(mushroom.x, mushroom.y - 4, this.CELL_SIZE/3, 0, Math.PI * 2);
      this.$ctx.fill();

      // Mushroom stem
      this.$ctx.fillRect(mushroom.x - 2, mushroom.y, 4, this.CELL_SIZE/3);

      this.$ctx.shadowBlur = 0;
    }
  };

  CentipedeUx.prototype.drawBullets = function() {
    for (var i = 0; i < this.$bullets.length; i++) {
      var bullet = this.$bullets[i];

      // Draw trail
      for (var j = 0; j < bullet.trail.length; j++) {
        var trail = bullet.trail[j];
        this.$ctx.save();
        this.$ctx.globalAlpha = trail.alpha * 0.8;
        this.$ctx.fillStyle = '#67e8f9';
        this.$ctx.fillRect(trail.x - 1, trail.y - 3, 2, 6);
        this.$ctx.restore();
      }

      // Draw bullet
      this.$ctx.fillStyle = '#22d3ee';
      this.$ctx.shadowColor = '#67e8f9';
      this.$ctx.shadowBlur = 8;
      this.$ctx.fillRect(bullet.x - 2, bullet.y - 6, 4, 12);
      this.$ctx.shadowBlur = 0;
    }
  };

  CentipedeUx.prototype.drawCentipedes = function() {
    for (var i = 0; i < this.$centipedes.length; i++) {
      var centipede = this.$centipedes[i];

      for (var j = 0; j < centipede.segments.length; j++) {
        var segment = centipede.segments[j];
        var radius = this.CELL_SIZE/2 - 2;

        if (segment.isHead) {
          // Draw head
          this.$ctx.fillStyle = '#dc2626';
          this.$ctx.shadowColor = '#f87171';
          this.$ctx.shadowBlur = 10;

          this.$ctx.beginPath();
          this.$ctx.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
          this.$ctx.fill();

          // Head eyes
          this.$ctx.fillStyle = '#ffffff';
          this.$ctx.beginPath();
          this.$ctx.arc(segment.x - 4, segment.y - 3, 2, 0, Math.PI * 2);
          this.$ctx.arc(segment.x + 4, segment.y - 3, 2, 0, Math.PI * 2);
          this.$ctx.fill();
        } else {
          // Draw body segment
          this.$ctx.fillStyle = '#ef4444';
          this.$ctx.shadowColor = '#fca5a5';
          this.$ctx.shadowBlur = 6;

          this.$ctx.beginPath();
          this.$ctx.arc(segment.x, segment.y, radius - 2, 0, Math.PI * 2);
          this.$ctx.fill();
        }
      }
    }

    this.$ctx.shadowBlur = 0;
  };

  CentipedeUx.prototype.drawEnemies = function() {
    for (var i = 0; i < this.$enemies.length; i++) {
      var enemy = this.$enemies[i];

      this.$ctx.fillStyle = enemy.color;
      this.$ctx.shadowColor = enemy.color;
      this.$ctx.shadowBlur = 8;

      switch (enemy.type) {
        case 'spider':
          // Spider body
          this.$ctx.beginPath();
          this.$ctx.arc(enemy.x, enemy.y, 8, 0, Math.PI * 2);
          this.$ctx.fill();

          // Spider legs
          this.$ctx.strokeStyle = enemy.color;
          this.$ctx.lineWidth = 2;
          for (var leg = 0; leg < 8; leg++) {
            var angle = (leg * Math.PI * 2) / 8;
            this.$ctx.beginPath();
            this.$ctx.moveTo(enemy.x, enemy.y);
            this.$ctx.lineTo(enemy.x + Math.cos(angle) * 12, enemy.y + Math.sin(angle) * 12);
            this.$ctx.stroke();
          }
          break;

        case 'flea':
          // Flea body
          this.$ctx.fillRect(enemy.x - 6, enemy.y - 8, 12, 16);

          // Flea antennae
          this.$ctx.strokeStyle = enemy.color;
          this.$ctx.lineWidth = 2;
          this.$ctx.beginPath();
          this.$ctx.moveTo(enemy.x - 3, enemy.y - 8);
          this.$ctx.lineTo(enemy.x - 6, enemy.y - 12);
          this.$ctx.moveTo(enemy.x + 3, enemy.y - 8);
          this.$ctx.lineTo(enemy.x + 6, enemy.y - 12);
          this.$ctx.stroke();
          break;

        case 'scorpion':
          // Scorpion body
          this.$ctx.beginPath();
          this.$ctx.arc(enemy.x, enemy.y, 10, 0, Math.PI * 2);
          this.$ctx.fill();

          // Scorpion tail
          this.$ctx.strokeStyle = enemy.color;
          this.$ctx.lineWidth = 3;
          this.$ctx.beginPath();
          this.$ctx.moveTo(enemy.x, enemy.y);
          this.$ctx.quadraticCurveTo(enemy.x + 15, enemy.y - 10, enemy.x + 20, enemy.y - 20);
          this.$ctx.stroke();

          // Tail stinger
          this.$ctx.fillStyle = '#ff0000';
          this.$ctx.beginPath();
          this.$ctx.arc(enemy.x + 20, enemy.y - 20, 3, 0, Math.PI * 2);
          this.$ctx.fill();
          break;
      }
    }

    this.$ctx.shadowBlur = 0;
  };

  CentipedeUx.prototype.drawPlayer = function() {
    this.$ctx.fillStyle = '#22d3ee';
    this.$ctx.shadowColor = '#67e8f9';
    this.$ctx.shadowBlur = 12;

    // Player ship (triangle)
    this.$ctx.beginPath();
    this.$ctx.moveTo(this.$player.x, this.$player.y - 10);
    this.$ctx.lineTo(this.$player.x - 8, this.$player.y + 8);
    this.$ctx.lineTo(this.$player.x + 8, this.$player.y + 8);
    this.$ctx.closePath();
    this.$ctx.fill();

    // Player core
    this.$ctx.fillStyle = '#ffffff';
    this.$ctx.beginPath();
    this.$ctx.arc(this.$player.x, this.$player.y, 3, 0, Math.PI * 2);
    this.$ctx.fill();

    this.$ctx.shadowBlur = 0;
  };

  CentipedeUx.prototype.drawEffects = function() {
    // Draw particles
    for (var i = 0; i < this.$particles.length; i++) {
      var particle = this.$particles[i];
      var alpha = particle.life / particle.maxLife;

      this.$ctx.save();
      this.$ctx.globalAlpha = alpha;
      this.$ctx.fillStyle = particle.color;

      if (particle.text) {
        this.$ctx.font = 'bold 12px Arial';
        this.$ctx.textAlign = 'center';
        this.$ctx.fillText(particle.text, particle.x, particle.y);
      } else {
        this.$ctx.beginPath();
        this.$ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        this.$ctx.fill();
      }

      this.$ctx.restore();
    }

    // Draw explosions
    for (var i = 0; i < this.$explosions.length; i++) {
      var explosion = this.$explosions[i];
      var alpha = explosion.life / explosion.maxLife;

      this.$ctx.save();
      this.$ctx.globalAlpha = alpha;
      this.$ctx.strokeStyle = explosion.color;
      this.$ctx.lineWidth = 3;
      this.$ctx.beginPath();
      this.$ctx.arc(explosion.x, explosion.y, explosion.size, 0, Math.PI * 2);
      this.$ctx.stroke();
      this.$ctx.restore();
    }
  };

  CentipedeUx.prototype.createExplosion = function(x, y, color) {
    this.$explosions.push({
      x: x,
      y: y,
      size: 5,
      color: color,
      life: 30,
      maxLife: 30
    });

    // Add explosion particles
    for (var i = 0; i < 8; i++) {
      this.$particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        size: 3,
        color: color,
        life: 40,
        maxLife: 40
      });
    }
  };

  CentipedeUx.prototype.createHitEffect = function(x, y) {
    for (var i = 0; i < 3; i++) {
      this.$particles.push({
        x: x + (Math.random() - 0.5) * 5,
        y: y + (Math.random() - 0.5) * 5,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        size: 2,
        color: '#ffffff',
        life: 20,
        maxLife: 20
      });
    }
  };

  CentipedeUx.prototype.createMuzzleFlash = function(x, y) {
    for (var i = 0; i < 3; i++) {
      this.$particles.push({
        x: x + (Math.random() - 0.5) * 5,
        y: y - 5,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 3,
        size: 2,
        color: '#67e8f9',
        life: 15,
        maxLife: 15
      });
    }
  };

  CentipedeUx.prototype.createPoisonEffect = function(x, y) {
    for (var i = 0; i < 5; i++) {
      this.$particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: 2,
        color: '#7c3aed',
        life: 40,
        maxLife: 40
      });
    }
  };

  CentipedeUx.prototype.addScoreParticle = function(x, y, text) {
    this.$particles.push({
      x: x,
      y: y,
      vx: 0,
      vy: -2,
      size: 0,
      color: '#fbbf24',
      text: text,
      life: 90,
      maxLife: 90
    });
  };

  CentipedeUx.prototype.updateDisplay = function() {
    this.$scoreEl.textContent = this.$score;
    this.$levelEl.textContent = this.$level;
    this.$mushroomsEl.textContent = this.$mushrooms.length;

    // Update lives display
    this.$livesEl.innerHTML = '';
    for (var i = 0; i < this.$lives; i++) {
      var life = document.createElement('div');
      life.className = 'life-icon';
      this.$livesEl.appendChild(life);
    }
  };

  CentipedeUx.prototype.doDestroy = function() {
    this.$gameRunning = false;

    if (this.$gameLoopId) {
      cancelAnimationFrame(this.$gameLoopId);
      this.$gameLoopId = null;
    }

    if (this.$keydownHandler) {
      document.removeEventListener('keydown', this.$keydownHandler);
      this.$keydownHandler = null;
    }

    if (this.$keyupHandler) {
      document.removeEventListener('keyup', this.$keyupHandler);
      this.$keyupHandler = null;
    }

    this.$container = null;
    this.$canvas = null;
    this.$ctx = null;
    this.$scoreEl = null;
    this.$levelEl = null;
    this.$mushroomsEl = null;
    this.$livesEl = null;

    this.$player = null;
    this.$bullets = null;
    this.$centipedes = null;
    this.$mushrooms = null;
    this.$enemies = null;
    this.$particles = null;
    this.$explosions = null;
    
    Widget.prototype.doDestroy.call(this);
  };

  return CentipedeUx;
});