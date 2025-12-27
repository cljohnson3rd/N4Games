define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/galaga'
], function(baja, Widget) {
  'use strict';

  var GalagaUx = function() {
    var that = this;
    Widget.apply(this, arguments);
    
    // Game constants
    this.CANVAS_WIDTH = 420;
    this.CANVAS_HEIGHT = 600;
    this.SHIP_SIZE = 20;
    this.ENEMY_SIZE = 16;
    this.BULLET_SPEED = 8;
    
    // Game state
    this.$gameRunning = false;
    this.$gamePaused = false;
    this.$gameOverFlag = false;
    this.$score = 0;
    this.$lives = 3;
    this.$level = 1;
    this.$stage = 'formation'; // formation, attacking, bonus

    // Game objects with optimized positioning
    this.$player = { x: 200, y: 550, speed: 5, doubleShip: false };
    this.$bullets = [];
    this.$enemyBullets = [];
    this.$enemies = [];
    this.$powerUps = [];
    this.$particles = [];
    this.$stars = [];
    this.$explosions = [];

    // Game mechanics
    this.$weaponType = 'laser'; // laser, spread, rapid
    this.$frameCount = 0;
    this.$stageTimer = 0;
    this.$formationComplete = false;
    this.$shootCooldown = 0;
    this.$enemyAttackTimer = 0;
    this.$gameLoopId = null;

    // Performance optimization
    this.$lastUpdateTime = 0;
    this.$deltaTime = 0;

    // Enhanced enemy types
    this.ENEMY_TYPES = {
      galaga: { points: 150, color: '#ef4444', pattern: 'dive', health: 2, speed: 1.2 },
      bee: { points: 100, color: '#fbbf24', pattern: 'swarm', health: 1, speed: 1.5 },
      butterfly: { points: 160, color: '#22c55e', pattern: 'loop', health: 1, speed: 1.3 },
      boss: { points: 400, color: '#8b5cf6', pattern: 'boss', health: 3, speed: 0.8 }
    };

    // Optimized formations
    this.FORMATIONS = [
      { pattern: 'spread', enemies: 12, types: ['bee', 'galaga'] },
      { pattern: 'wings', enemies: 16, types: ['butterfly', 'bee', 'galaga'] },
      { pattern: 'boss', enemies: 20, types: ['bee', 'galaga', 'butterfly', 'boss'] }
    ];
  };

  GalagaUx.prototype = Object.create(Widget.prototype);
  GalagaUx.prototype.constructor = GalagaUx;

  GalagaUx.prototype.findElement = function(selector) {
    if (this.$container.querySelector) {
      return this.$container.querySelector(selector);
    } else if (this.$container.nodeType) {
      return this.$container.querySelector(selector);
    } else {
      var elem = this.$container.element || this.$container[0] || this.$container;
      return elem.querySelector ? elem.querySelector(selector) : null;
    }
  };

  GalagaUx.prototype.doInitialize = function(element) {
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
      '<div class="galaga-container">' +
        '<div class="galaga-game">' +
          '<canvas id="galaga-board" width="' + this.CANVAS_WIDTH + '" height="' + this.CANVAS_HEIGHT + '" tabindex="0"></canvas>' +
        '</div>' +
        '<div class="galaga-sidebar">' +
          '<div class="galaga-info">' +
            '<div>Score: <span id="score">0</span></div>' +
            '<div>Stage: <span id="stage">1</span></div>' +
            '<div>Weapon: <span id="weapon">Laser</span></div>' +
          '</div>' +
          '<div class="galaga-lives">' +
            '<div>Ships</div>' +
            '<div class="life-display" id="life-display"></div>' +
          '</div>' +
          '<div class="galaga-weapons">' +
            '<div>Weapons</div>' +
            '<div class="weapon-icons">' +
              '<div class="weapon-icon laser"></div>' +
              '<div class="weapon-icon spread"></div>' +
              '<div class="weapon-icon rapid"></div>' +
            '</div>' +
          '</div>' +
          '<div class="galaga-controls">' +
            '<button id="start-btn">Start</button>' +
            '<button id="pause-btn">Pause</button>' +
            '<button id="reset-btn">Reset</button>' +
          '</div>' +
          '<div class="galaga-instructions">' +
            '<div><strong>Controls:</strong></div>' +
            '<div>← → Move</div>' +
            '<div>Space: Fire</div>' +
            '<div>Destroy all enemies!</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Get canvas and context
    this.$canvas = this.findElement('#galaga-board');
    this.$ctx = this.$canvas.getContext('2d');

    // Get UI elements
    this.$scoreEl = this.findElement('#score');
    this.$stageEl = this.findElement('#stage');
    this.$weaponEl = this.findElement('#weapon');
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

    // Enhanced keyboard controls
    this.$keys = {};
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
    this.createStarfield();
    this.updateDisplay();
    this.draw();
  };

  GalagaUx.prototype.initializeGame = function() {
    this.$bullets = [];
    this.$enemyBullets = [];
    this.$enemies = [];
    this.$powerUps = [];
    this.$particles = [];
    this.$explosions = [];

    this.$player = { x: this.CANVAS_WIDTH / 2, y: this.CANVAS_HEIGHT - 50, speed: 5, doubleShip: false };
    this.$frameCount = 0;
    this.$stageTimer = 0;
    this.$formationComplete = false;
    this.$shootCooldown = 0;
    this.$enemyAttackTimer = 0;
    this.$stage = 'formation';
    this.$lastUpdateTime = performance.now();

    this.createEnemyFormation();
  };

  GalagaUx.prototype.createStarfield = function() {
    this.$stars = [];
    for (var i = 0; i < 80; i++) { // Reduced for performance
      this.$stars.push({
        x: Math.random() * this.CANVAS_WIDTH,
        y: Math.random() * this.CANVAS_HEIGHT,
        speed: Math.random() * 1.5 + 0.5,
        size: Math.random() * 1.5 + 0.5,
        twinkle: Math.random() * 100,
        brightness: Math.random() * 0.5 + 0.5
      });
    }
  };

  GalagaUx.prototype.createEnemyFormation = function() {
    var formation = this.FORMATIONS[(this.$level - 1) % this.FORMATIONS.length];
    var cols = 6; // Reduced for better spacing
    var rows = Math.ceil(formation.enemies / cols);

    for (var i = 0; i < formation.enemies; i++) {
      var row = Math.floor(i / cols);
      var col = i % cols;
      var typeIndex = i % formation.types.length;
      var type = formation.types[typeIndex];
      var config = this.ENEMY_TYPES[type];

      var startX = 80 + col * 50;
      var startY = 60 + row * 40;

      this.$enemies.push({
        type: type,
        x: startX,
        y: startY,
        targetX: startX,
        targetY: startY,
        pixelX: startX,
        pixelY: startY,
        speed: config.speed,
        health: config.health,
        maxHealth: config.health,
        attackTimer: Math.random() * 600 + 300,
        inFormation: true,
        attacking: false,
        trail: [],
        formationOffset: { x: 0, y: 0 },
        attackPath: null,
        attackIndex: 0
      });
    }

    // Formation completion timer
    setTimeout(function() {
      this.$formationComplete = true;
      this.$stage = 'attacking';
    }.bind(this), 2000);
  };

  GalagaUx.prototype.startGame = function() {
    this.$gameRunning = true;
    this.$gameOverFlag = false;
    this.$gamePaused = false;
    this.$lastUpdateTime = performance.now();

    if (this.$gameLoopId) {
      cancelAnimationFrame(this.$gameLoopId);
    }
    this.gameLoop();
  };

  GalagaUx.prototype.pauseGame = function() {
    this.$gamePaused = !this.$gamePaused;
    if (!this.$gamePaused && this.$gameRunning) {
      this.$lastUpdateTime = performance.now();
      this.gameLoop();
    }
  };

  GalagaUx.prototype.resetGame = function() {
    this.$gameRunning = false;
    this.$gameOverFlag = false;
    this.$gamePaused = false;
    this.$score = 0;
    this.$lives = 3;
    this.$level = 1;
    this.$weaponType = 'laser';

    if (this.$gameLoopId) {
      cancelAnimationFrame(this.$gameLoopId);
      this.$gameLoopId = null;
    }

    this.initializeGame();
    this.updateDisplay();
    this.draw();
  };

  GalagaUx.prototype.gameLoop = function() {
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

  GalagaUx.prototype.handleInput = function() {
    var moveSpeed = this.$player.speed;

    // Move player left/right with bounds checking
    if (this.$keys[37] && this.$player.x > this.SHIP_SIZE) {
      this.$player.x -= moveSpeed;
    }
    if (this.$keys[39] && this.$player.x < this.CANVAS_WIDTH - this.SHIP_SIZE) {
      this.$player.x += moveSpeed;
    }

    // Shooting with weapon-specific cooldown
    var cooldownTime = this.$weaponType === 'rapid' ? 5 : (this.$weaponType === 'spread' ? 12 : 8);
    if (this.$keys[32] && this.$shootCooldown <= 0) {
      this.shoot();
      this.$shootCooldown = cooldownTime;
    }

    if (this.$shootCooldown > 0) {
      this.$shootCooldown--;
    }
  };

  GalagaUx.prototype.shoot = function() {
    var bulletSpeed = this.BULLET_SPEED;

    switch (this.$weaponType) {
      case 'laser':
        this.$bullets.push({
          x: this.$player.x,
          y: this.$player.y - 10,
          vx: 0,
          vy: -bulletSpeed,
          type: 'laser',
          color: '#60a5fa',
          damage: 1
        });

        if (this.$player.doubleShip) {
          this.$bullets.push({
            x: this.$player.x + 25,
            y: this.$player.y - 10,
            vx: 0,
            vy: -bulletSpeed,
            type: 'laser',
            color: '#60a5fa',
            damage: 1
          });
        }
        break;

      case 'spread':
        var angles = [-0.5, 0, 0.5];
        for (var i = 0; i < angles.length; i++) {
          this.$bullets.push({
            x: this.$player.x,
            y: this.$player.y - 10,
            vx: Math.sin(angles[i]) * bulletSpeed,
            vy: -Math.cos(angles[i]) * bulletSpeed,
            type: 'spread',
            color: '#fbbf24',
            damage: 1
          });
        }
        break;

      case 'rapid':
        this.$bullets.push({
          x: this.$player.x,
          y: this.$player.y - 10,
          vx: 0,
          vy: -bulletSpeed * 1.3,
          type: 'rapid',
          color: '#22c55e',
          damage: 1
        });
        break;
    }

    this.createMuzzleFlash();
  };

  GalagaUx.prototype.updateGame = function() {
    this.$frameCount++;
    this.$stageTimer++;

    this.updateStarfield();
    this.updateBullets();
    this.updateEnemies();
    this.updateEnemyBullets();
    this.updatePowerUps();
    this.checkCollisions();
    this.checkWinCondition();
    this.updateDisplay();
  };

  GalagaUx.prototype.updateStarfield = function() {
    // Only update every other frame for performance
    if (this.$frameCount % 2 !== 0) return;

    for (var i = 0; i < this.$stars.length; i++) {
      var star = this.$stars[i];
      star.y += star.speed;
      star.twinkle += 1;

      if (star.y > this.CANVAS_HEIGHT) {
        star.y = -5;
        star.x = Math.random() * this.CANVAS_WIDTH;
      }
    }
  };

  GalagaUx.prototype.updateBullets = function() {
    // Update player bullets
    for (var i = this.$bullets.length - 1; i >= 0; i--) {
      var bullet = this.$bullets[i];
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;

      // Remove off-screen bullets
      if (bullet.y < 0 || bullet.x < 0 || bullet.x > this.CANVAS_WIDTH || bullet.y > this.CANVAS_HEIGHT) {
        this.$bullets.splice(i, 1);
      }
    }
  };

  GalagaUx.prototype.updateEnemies = function() {
    var time = this.$frameCount * 0.02;

    for (var i = this.$enemies.length - 1; i >= 0; i--) {
      var enemy = this.$enemies[i];

      // Update formation movement with smoother animations
      if (enemy.inFormation && this.$formationComplete) {
        enemy.formationOffset.x = Math.sin(time + i * 0.5) * 15;
        enemy.formationOffset.y = Math.sin(time * 0.7 + i * 0.3) * 8;

        // Smooth interpolation to formation position
        var targetX = enemy.targetX + enemy.formationOffset.x;
        var targetY = enemy.targetY + enemy.formationOffset.y;

        enemy.pixelX += (targetX - enemy.pixelX) * 0.1;
        enemy.pixelY += (targetY - enemy.pixelY) * 0.1;

        enemy.x = enemy.pixelX;
        enemy.y = enemy.pixelY;

        // Attack timer
        enemy.attackTimer--;
        if (enemy.attackTimer <= 0 && Math.random() < 0.001) {
          this.startEnemyAttack(enemy);
        }
      }

      // Update attacking enemies
      if (enemy.attacking) {
        this.updateAttackingEnemy(enemy);
      }

      // Enemy shooting
      if (enemy.inFormation && Math.random() < 0.0008) {
        this.enemyShoot(enemy);
      }

      // Update trail with fade
      if (enemy.trail.length > 8) {
        enemy.trail.shift();
      }
      enemy.trail.push({ x: enemy.x, y: enemy.y, alpha: 1 });

      for (var j = 0; j < enemy.trail.length; j++) {
        enemy.trail[j].alpha -= 0.1;
      }
    }
  };

  GalagaUx.prototype.startEnemyAttack = function(enemy) {
    enemy.attacking = true;
    enemy.inFormation = false;
    enemy.attackPhase = 'dive';
    enemy.attackTimer = 0;
    enemy.returnTimer = 240;

    // Generate smoother attack paths
    var pattern = this.ENEMY_TYPES[enemy.type].pattern;
    switch (pattern) {
      case 'dive':
        enemy.attackPath = this.generateSmoothDivePath(enemy);
        break;
      case 'loop':
        enemy.attackPath = this.generateSmoothLoopPath(enemy);
        break;
      case 'swarm':
        enemy.attackPath = this.generateSmoothSwarmPath(enemy);
        break;
    }
    enemy.attackIndex = 0;
  };

  GalagaUx.prototype.generateSmoothDivePath = function(enemy) {
    var path = [];
    var startX = enemy.x;
    var startY = enemy.y;
    var playerX = this.$player.x;

    // Smoother curve with more points
    for (var i = 0; i < 80; i++) {
      var t = i / 79;
      var curve = Math.sin(t * Math.PI);
      path.push({
        x: startX + (playerX - startX) * t + Math.sin(t * Math.PI * 3) * 40 * curve,
        y: startY + t * (this.CANVAS_HEIGHT - startY + 100)
      });
    }

    return path;
  };

  GalagaUx.prototype.generateSmoothLoopPath = function(enemy) {
    var path = [];
    var centerX = this.CANVAS_WIDTH / 2;
    var centerY = this.CANVAS_HEIGHT / 2;

    // Create smooth loop with varying radius
    for (var i = 0; i < 120; i++) {
      var angle = (i / 120) * Math.PI * 4;
      var radiusVariation = 1 + Math.sin(i / 20) * 0.3;
      var radius = 80 * radiusVariation;
      path.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius * 0.6
      });
    }

    return path;
  };

  GalagaUx.prototype.generateSmoothSwarmPath = function(enemy) {
    var path = [];
    var startX = enemy.x;
    var startY = enemy.y;

    // Smoother erratic movement
    for (var i = 0; i < 100; i++) {
      var t = i / 99;
      var noise = Math.sin(t * Math.PI * 8) * Math.cos(t * Math.PI * 6);
      path.push({
        x: startX + Math.sin(t * Math.PI * 4) * 80 + noise * 20,
        y: startY + t * 250 + Math.cos(t * Math.PI * 6) * 30
      });
    }

    return path;
  };

  GalagaUx.prototype.updateAttackingEnemy = function(enemy) {
    enemy.attackIndex++;

    if (enemy.attackIndex < enemy.attackPath.length) {
      var target = enemy.attackPath[enemy.attackIndex];

      // Smooth movement to attack path point
      enemy.x += (target.x - enemy.x) * 0.3;
      enemy.y += (target.y - enemy.y) * 0.3;

      // Shoot while attacking
      if (enemy.attackIndex % 20 === 0 && Math.random() < 0.7) {
        this.enemyShoot(enemy);
      }
    } else {
      // Return to formation smoothly
      enemy.returnTimer--;
      var returnSpeed = 2;
      var dx = enemy.targetX - enemy.x;
      var dy = enemy.targetY - enemy.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > returnSpeed) {
        enemy.x += (dx / dist) * returnSpeed;
        enemy.y += (dy / dist) * returnSpeed;
        enemy.pixelX = enemy.x;
        enemy.pixelY = enemy.y;
      } else {
        enemy.x = enemy.targetX;
        enemy.y = enemy.targetY;
        enemy.pixelX = enemy.x;
        enemy.pixelY = enemy.y;
        enemy.attacking = false;
        enemy.inFormation = true;
        enemy.attackTimer = 400 + Math.random() * 800;
      }
    }
  };

  GalagaUx.prototype.enemyShoot = function(enemy) {
    var dx = this.$player.x - enemy.x;
    var dy = this.$player.y - enemy.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      var speed = 3;
      this.$enemyBullets.push({
        x: enemy.x,
        y: enemy.y + 10,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        color: '#ef4444'
      });
    }
  };

  GalagaUx.prototype.updateEnemyBullets = function() {
    for (var i = this.$enemyBullets.length - 1; i >= 0; i--) {
      var bullet = this.$enemyBullets[i];
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;

      if (bullet.y > this.CANVAS_HEIGHT || bullet.x < 0 || bullet.x > this.CANVAS_WIDTH) {
        this.$enemyBullets.splice(i, 1);
      }
    }
  };

  GalagaUx.prototype.updatePowerUps = function() {
    for (var i = this.$powerUps.length - 1; i >= 0; i--) {
      var powerUp = this.$powerUps[i];
      powerUp.y += 1.5;
      powerUp.rotation += 0.08;

      if (powerUp.y > this.CANVAS_HEIGHT) {
        this.$powerUps.splice(i, 1);
      }
    }
  };

  GalagaUx.prototype.checkCollisions = function() {
    // Player bullets vs enemies (optimized with spatial partitioning concept)
    for (var i = this.$bullets.length - 1; i >= 0; i--) {
      var bullet = this.$bullets[i];

      for (var j = this.$enemies.length - 1; j >= 0; j--) {
        var enemy = this.$enemies[j];
        var dx = bullet.x - enemy.x;
        var dy = bullet.y - enemy.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.ENEMY_SIZE + 5) {
          this.$bullets.splice(i, 1);
          enemy.health -= bullet.damage || 1;

          if (enemy.health <= 0) {
            var points = this.ENEMY_TYPES[enemy.type].points;
            this.$score += points;
            this.createEnemyExplosion(enemy.x, enemy.y);
            this.addScoreParticle(enemy.x, enemy.y, '+' + points);

            // Power-up drop chance
            if (Math.random() < 0.15) {
              this.createPowerUp(enemy.x, enemy.y);
            }

            this.$enemies.splice(j, 1);
          } else {
            this.createHitParticles(enemy.x, enemy.y);
          }
          break;
        }
      }
    }

    // Enemy bullets vs player
    for (var i = this.$enemyBullets.length - 1; i >= 0; i--) {
      var bullet = this.$enemyBullets[i];
      var dx = bullet.x - this.$player.x;
      var dy = bullet.y - this.$player.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.SHIP_SIZE) {
        this.$enemyBullets.splice(i, 1);
        this.playerDied();
        break;
      }
    }

    // Player vs power-ups
    for (var i = this.$powerUps.length - 1; i >= 0; i--) {
      var powerUp = this.$powerUps[i];
      var dx = powerUp.x - this.$player.x;
      var dy = powerUp.y - this.$player.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.SHIP_SIZE + 10) {
        this.collectPowerUp(powerUp);
        this.$powerUps.splice(i, 1);
      }
    }

    // Player vs enemies (collision)
    for (var i = 0; i < this.$enemies.length; i++) {
      var enemy = this.$enemies[i];
      var dx = enemy.x - this.$player.x;
      var dy = enemy.y - this.$player.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.SHIP_SIZE + 5) {
        this.playerDied();
        break;
      }
    }
  };

  GalagaUx.prototype.createPowerUp = function(x, y) {
    var types = ['weapon', 'double', 'points'];
    var type = types[Math.floor(Math.random() * types.length)];

    this.$powerUps.push({
      x: x,
      y: y,
      type: type,
      rotation: 0,
      color: type === 'weapon' ? '#fbbf24' : type === 'double' ? '#22c55e' : '#8b5cf6'
    });
  };

  GalagaUx.prototype.collectPowerUp = function(powerUp) {
    switch (powerUp.type) {
      case 'weapon':
        var weapons = ['laser', 'spread', 'rapid'];
        var currentIndex = weapons.indexOf(this.$weaponType);
        this.$weaponType = weapons[(currentIndex + 1) % weapons.length];
        break;
      case 'double':
        this.$player.doubleShip = true;
        break;
      case 'points':
        this.$score += 500;
        this.addScoreParticle(powerUp.x, powerUp.y, '+500');
        break;
    }

    this.createPowerUpParticles(powerUp.x, powerUp.y, powerUp.color);
  };

  GalagaUx.prototype.checkWinCondition = function() {
    if (this.$enemies.length === 0) {
      this.levelComplete();
    }
  };

  GalagaUx.prototype.levelComplete = function() {
    this.$level++;
    this.initializeGame();
  };

  GalagaUx.prototype.playerDied = function() {
    this.$lives--;
    this.createPlayerExplosion();
    this.$player.doubleShip = false;

    if (this.$lives <= 0) {
      this.gameOver();
    } else {
      // Reset player position
      this.$player.x = this.CANVAS_WIDTH / 2;
      this.$player.y = this.CANVAS_HEIGHT - 50;
    }
  };

  GalagaUx.prototype.gameOver = function() {
    this.$gameRunning = false;
    this.$gameOverFlag = true;

    if (this.$gameLoopId) {
      cancelAnimationFrame(this.$gameLoopId);
      this.$gameLoopId = null;
    }

    // Create game over explosion
    for (var i = 0; i < 25; i++) {
      this.$particles.push({
        x: this.CANVAS_WIDTH / 2,
        y: this.CANVAS_HEIGHT / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 120,
        maxLife: 120,
        color: '#dc2626',
        size: 5
      });
    }
  };

  GalagaUx.prototype.updateEffects = function() {
    // Update particles
    for (var i = this.$particles.length - 1; i >= 0; i--) {
      var particle = this.$particles[i];
      particle.life--;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.08; // subtle gravity

      if (particle.life <= 0) {
        this.$particles.splice(i, 1);
      }
    }

    // Update explosions
    for (var i = this.$explosions.length - 1; i >= 0; i--) {
      var explosion = this.$explosions[i];
      explosion.life--;
      explosion.size += 2.5;

      if (explosion.life <= 0) {
        this.$explosions.splice(i, 1);
      }
    }
  };

  GalagaUx.prototype.draw = function() {
    // Clear with space gradient
    var gradient = this.$ctx.createLinearGradient(0, 0, 0, this.CANVAS_HEIGHT);
    gradient.addColorStop(0, '#000011');
    gradient.addColorStop(1, '#0a0a23');
    this.$ctx.fillStyle = gradient;
    this.$ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    this.drawStarfield();
    this.drawPlayer();
    this.drawBullets();
    this.drawEnemies();
    this.drawEnemyBullets();
    this.drawPowerUps();
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

  GalagaUx.prototype.drawStarfield = function() {
    for (var i = 0; i < this.$stars.length; i++) {
      var star = this.$stars[i];
      var alpha = (Math.sin(star.twinkle * 0.05) + 1) * 0.5 * star.brightness;

      this.$ctx.save();
      this.$ctx.globalAlpha = alpha;
      this.$ctx.fillStyle = '#ffffff';
      this.$ctx.fillRect(star.x, star.y, star.size, star.size);
      this.$ctx.restore();
    }
  };

  GalagaUx.prototype.drawPlayer = function() {
    this.$ctx.fillStyle = '#60a5fa';
    this.$ctx.shadowColor = '#93c5fd';
    this.$ctx.shadowBlur = 10;

    // Main ship
    this.$ctx.beginPath();
    this.$ctx.moveTo(this.$player.x, this.$player.y - this.SHIP_SIZE);
    this.$ctx.lineTo(this.$player.x - this.SHIP_SIZE/2, this.$player.y + this.SHIP_SIZE);
    this.$ctx.lineTo(this.$player.x + this.SHIP_SIZE/2, this.$player.y + this.SHIP_SIZE);
    this.$ctx.closePath();
    this.$ctx.fill();

    // Double ship effect
    if (this.$player.doubleShip) {
      this.$ctx.save();
      this.$ctx.globalAlpha = 0.7;
      this.$ctx.beginPath();
      this.$ctx.moveTo(this.$player.x + 25, this.$player.y - this.SHIP_SIZE);
      this.$ctx.lineTo(this.$player.x + 25 - this.SHIP_SIZE/2, this.$player.y + this.SHIP_SIZE);
      this.$ctx.lineTo(this.$player.x + 25 + this.SHIP_SIZE/2, this.$player.y + this.SHIP_SIZE);
      this.$ctx.closePath();
      this.$ctx.fill();
      this.$ctx.restore();
    }

    this.$ctx.shadowBlur = 0;
  };

  GalagaUx.prototype.drawBullets = function() {
    for (var i = 0; i < this.$bullets.length; i++) {
      var bullet = this.$bullets[i];

      this.$ctx.fillStyle = bullet.color;
      this.$ctx.shadowColor = bullet.color;
      this.$ctx.shadowBlur = 6;
      this.$ctx.fillRect(bullet.x - 2, bullet.y - 8, 4, 16);
      this.$ctx.shadowBlur = 0;
    }
  };

  GalagaUx.prototype.drawEnemies = function() {
    for (var i = 0; i < this.$enemies.length; i++) {
      var enemy = this.$enemies[i];
      var type = this.ENEMY_TYPES[enemy.type];

      // Draw fading trail
      for (var j = 0; j < enemy.trail.length; j++) {
        var trail = enemy.trail[j];
        if (trail.alpha > 0) {
          this.$ctx.save();
          this.$ctx.globalAlpha = trail.alpha * 0.3;
          this.$ctx.fillStyle = type.color;
          this.$ctx.fillRect(trail.x - 3, trail.y - 3, 6, 6);
          this.$ctx.restore();
        }
      }

      // Draw enemy
      this.$ctx.fillStyle = type.color;
      this.$ctx.shadowColor = type.color;
      this.$ctx.shadowBlur = 8;

      switch (enemy.type) {
        case 'galaga':
          this.drawGalagaEnemy(enemy);
          break;
        case 'bee':
          this.drawBeeEnemy(enemy);
          break;
        case 'butterfly':
          this.drawButterflyEnemy(enemy);
          break;
        case 'boss':
          this.drawBossEnemy(enemy);
          break;
      }

      this.$ctx.shadowBlur = 0;
    }
  };

  GalagaUx.prototype.drawGalagaEnemy = function(enemy) {
    var size = this.ENEMY_SIZE;
    this.$ctx.fillRect(enemy.x - size/2, enemy.y - size/2, size, size);

    // Add details
    this.$ctx.fillStyle = '#ffffff';
    this.$ctx.fillRect(enemy.x - 4, enemy.y - 4, 2, 2);
    this.$ctx.fillRect(enemy.x + 2, enemy.y - 4, 2, 2);
  };

  GalagaUx.prototype.drawBeeEnemy = function(enemy) {
    var size = this.ENEMY_SIZE * 0.8;
    this.$ctx.beginPath();
    this.$ctx.arc(enemy.x, enemy.y, size/2, 0, Math.PI * 2);
    this.$ctx.fill();

    // Wing flutter effect
    if (Math.sin(this.$frameCount * 0.5) > 0) {
      this.$ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.$ctx.fillRect(enemy.x - size/2 - 4, enemy.y - 2, 3, 4);
      this.$ctx.fillRect(enemy.x + size/2 + 1, enemy.y - 2, 3, 4);
    }
  };

  GalagaUx.prototype.drawButterflyEnemy = function(enemy) {
    var size = this.ENEMY_SIZE;
    this.$ctx.save();
    this.$ctx.translate(enemy.x, enemy.y);
    this.$ctx.rotate(Math.sin(this.$frameCount * 0.1) * 0.3);
    this.$ctx.fillRect(-size/2, -size/2, size, size/2);
    this.$ctx.fillRect(-size/4, 0, size/2, size/2);
    this.$ctx.restore();
  };

  GalagaUx.prototype.drawBossEnemy = function(enemy) {
    var size = this.ENEMY_SIZE * 1.3;
    this.$ctx.fillRect(enemy.x - size/2, enemy.y - size/2, size, size);

    // Boss details
    this.$ctx.fillStyle = '#ffffff';
    this.$ctx.fillRect(enemy.x - 6, enemy.y - 6, 3, 3);
    this.$ctx.fillRect(enemy.x + 3, enemy.y - 6, 3, 3);
    this.$ctx.fillRect(enemy.x - 1.5, enemy.y + 2, 3, 4);

    // Health indicator
    if (enemy.health < enemy.maxHealth) {
      var healthRatio = enemy.health / enemy.maxHealth;
      this.$ctx.fillStyle = healthRatio > 0.5 ? '#22c55e' : '#ef4444';
      this.$ctx.fillRect(enemy.x - 8, enemy.y - 12, 16 * healthRatio, 2);
    }
  };

  GalagaUx.prototype.drawEnemyBullets = function() {
    for (var i = 0; i < this.$enemyBullets.length; i++) {
      var bullet = this.$enemyBullets[i];

      this.$ctx.fillStyle = bullet.color;
      this.$ctx.shadowColor = bullet.color;
      this.$ctx.shadowBlur = 6;
      this.$ctx.beginPath();
      this.$ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      this.$ctx.fill();
      this.$ctx.shadowBlur = 0;
    }
  };

  GalagaUx.prototype.drawPowerUps = function() {
    for (var i = 0; i < this.$powerUps.length; i++) {
      var powerUp = this.$powerUps[i];

      this.$ctx.save();
      this.$ctx.translate(powerUp.x, powerUp.y);
      this.$ctx.rotate(powerUp.rotation);
      this.$ctx.fillStyle = powerUp.color;
      this.$ctx.shadowColor = powerUp.color;
      this.$ctx.shadowBlur = 8;
      this.$ctx.fillRect(-8, -8, 16, 16);
      this.$ctx.restore();
    }
  };

  GalagaUx.prototype.drawEffects = function() {
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
      this.$ctx.lineWidth = 4;
      this.$ctx.beginPath();
      this.$ctx.arc(explosion.x, explosion.y, explosion.size, 0, Math.PI * 2);
      this.$ctx.stroke();
      this.$ctx.restore();
    }
  };

  GalagaUx.prototype.createEnemyExplosion = function(x, y) {
    this.$explosions.push({
      x: x,
      y: y,
      size: 10,
      color: '#ef4444',
      life: 30,
      maxLife: 30
    });

    for (var i = 0; i < 10; i++) {
      this.$particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        size: 3,
        color: '#fbbf24',
        life: 50,
        maxLife: 50
      });
    }
  };

  GalagaUx.prototype.createPlayerExplosion = function() {
    for (var i = 0; i < 15; i++) {
      this.$particles.push({
        x: this.$player.x,
        y: this.$player.y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        size: 4,
        color: '#60a5fa',
        life: 80,
        maxLife: 80
      });
    }
  };

  GalagaUx.prototype.createHitParticles = function(x, y) {
    for (var i = 0; i < 3; i++) {
      this.$particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        size: 2,
        color: '#ffffff',
        life: 25,
        maxLife: 25
      });
    }
  };

  GalagaUx.prototype.createPowerUpParticles = function(x, y, color) {
    for (var i = 0; i < 6; i++) {
      this.$particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        size: 3,
        color: color,
        life: 40,
        maxLife: 40
      });
    }
  };

  GalagaUx.prototype.createMuzzleFlash = function() {
    for (var i = 0; i < 2; i++) {
      this.$particles.push({
        x: this.$player.x + (Math.random() - 0.5) * 8,
        y: this.$player.y - 12,
        vx: (Math.random() - 0.5) * 1,
        vy: -Math.random() * 2,
        size: 1,
        color: '#93c5fd',
        life: 12,
        maxLife: 12
      });
    }
  };

  GalagaUx.prototype.addScoreParticle = function(x, y, text) {
    this.$particles.push({
      x: x,
      y: y,
      vx: 0,
      vy: -1.5,
      size: 0,
      color: '#fbbf24',
      text: text,
      life: 80,
      maxLife: 80
    });
  };

  GalagaUx.prototype.updateDisplay = function() {
    this.$scoreEl.textContent = this.$score;
    this.$stageEl.textContent = this.$level;
    this.$weaponEl.textContent = this.$weaponType.charAt(0).toUpperCase() + this.$weaponType.slice(1);

    // Update lives display
    this.$livesEl.innerHTML = '';
    for (var i = 0; i < this.$lives; i++) {
      var life = document.createElement('div');
      life.className = 'life-icon';
      this.$livesEl.appendChild(life);
    }
  };

  GalagaUx.prototype.doDestroy = function() {
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
    this.$stageEl = null;
    this.$weaponEl = null;
    this.$livesEl = null;

    this.$player = null;
    this.$bullets = null;
    this.$enemyBullets = null;
    this.$enemies = null;
    this.$powerUps = null;
    this.$particles = null;
    this.$stars = null;
    this.$explosions = null;
    
    Widget.prototype.doDestroy.call(this);
  };

  return GalagaUx;
});