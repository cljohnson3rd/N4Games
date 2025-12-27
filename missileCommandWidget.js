define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/missileCommand'
], function(baja, Widget) {
  'use strict';

  var MissileCommandUx = function() {
    var that = this;
    Widget.apply(this, arguments);
    
    // Game constants
    this.CANVAS_WIDTH = 420;
    this.CANVAS_HEIGHT = 600;
    this.GROUND_LEVEL = 550;
    this.CITY_COUNT = 6;
    this.SILO_COUNT = 3;
    
    // Game state
    this.$gameRunning = false;
    this.$gamePaused = false;
    this.$gameOverFlag = false;
    this.$score = 0;
    this.$wave = 1;
    this.$level = 1;
    this.$bonusPoints = 0;
    
    // Game objects
    this.$cities = [];
    this.$silos = [];
    this.$incomingMissiles = [];
    this.$defensiveMissiles = [];
    this.$explosions = [];
    this.$particles = [];
    this.$trails = [];
    this.$crosshair = { x: 200, y: 300, visible: false };
    
    // Game mechanics
    this.$frameCount = 0;
    this.$waveTimer = 0;
    this.$missileSpawnTimer = 0;
    this.$totalCities = this.CITY_COUNT;
    this.$activeMissiles = 0;
    this.$targetingMode = false;
    
    // Mouse/touch controls
    this.$mouseX = 0;
    this.$mouseY = 0;
    this.$mouseDown = false;
    
    // Missile types
    this.MISSILE_TYPES = {
      icbm: { speed: 2, points: 25, color: '#ef4444', trail: '#fca5a5' },
      mirv: { speed: 1.5, points: 50, color: '#dc2626', trail: '#f87171', splits: 3 },
      cruise: { speed: 3, points: 15, color: '#f97316', trail: '#fdba74' },
      smart: { speed: 2.5, points: 40, color: '#8b5cf6', trail: '#c4b5fd' }
    };
  };

  MissileCommandUx.prototype = Object.create(Widget.prototype);
  MissileCommandUx.prototype.constructor = MissileCommandUx;

  MissileCommandUx.prototype.findElement = function(selector) {
    if (this.$container.querySelector) {
      return this.$container.querySelector(selector);
    } else if (this.$container.nodeType) {
      return this.$container.querySelector(selector);
    } else {
      var elem = this.$container.element || this.$container[0] || this.$container;
      return elem.querySelector ? elem.querySelector(selector) : null;
    }
  };

  MissileCommandUx.prototype.doInitialize = function(element) {
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
      '<div class="missile-command-container">' +
        '<div class="missile-command-game">' +
          '<canvas id="missile-command-board" width="' + this.CANVAS_WIDTH + '" height="' + this.CANVAS_HEIGHT + '" tabindex="0"></canvas>' +
        '</div>' +
        '<div class="missile-command-sidebar">' +
          '<div class="missile-command-info">' +
            '<div>Score: <span id="score">0</span></div>' +
            '<div>Wave: <span id="wave">1</span></div>' +
            '<div>Cities: <span id="cities">6</span></div>' +
          '</div>' +
          '<div class="missile-command-cities">' +
            '<div>Cities Status</div>' +
            '<div class="city-display" id="city-display"></div>' +
          '</div>' +
          '<div class="missile-command-weapons">' +
            '<div>Missile Silos</div>' +
            '<div class="weapon-status">' +
              '<span>Left:</span><span id="silo-left">10</span>' +
            '</div>' +
            '<div class="ammo-bar"><div class="ammo-fill" id="ammo-left"></div></div>' +
            '<div class="weapon-status">' +
              '<span>Center:</span><span id="silo-center">10</span>' +
            '</div>' +
            '<div class="ammo-bar"><div class="ammo-fill" id="ammo-center"></div></div>' +
            '<div class="weapon-status">' +
              '<span>Right:</span><span id="silo-right">10</span>' +
            '</div>' +
            '<div class="ammo-bar"><div class="ammo-fill" id="ammo-right"></div></div>' +
          '</div>' +
          '<div class="missile-command-controls">' +
            '<button id="start-btn">LAUNCH</button>' +
            '<button id="pause-btn">PAUSE</button>' +
            '<button id="reset-btn">RESET</button>' +
          '</div>' +
          '<div class="missile-command-instructions">' +
            '<div><strong>COMMANDS:</strong></div>' +
            '<div>CLICK: Target & Fire</div>' +
            '<div>ESC: Cancel Target</div>' +
            '<div>Defend the cities!</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Get canvas and context
    this.$canvas = this.findElement('#missile-command-board');
    this.$ctx = this.$canvas.getContext('2d');
    
    // Get UI elements
    this.$scoreEl = this.findElement('#score');
    this.$waveEl = this.findElement('#wave');
    this.$citiesEl = this.findElement('#cities');
    this.$cityDisplayEl = this.findElement('#city-display');
    this.$siloLeftEl = this.findElement('#silo-left');
    this.$siloCenterEl = this.findElement('#silo-center');
    this.$siloRightEl = this.findElement('#silo-right');
    this.$ammoLeftEl = this.findElement('#ammo-left');
    this.$ammoCenterEl = this.findElement('#ammo-center');
    this.$ammoRightEl = this.findElement('#ammo-right');
    
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
    
    // Mouse controls
    this.$canvas.addEventListener('mousemove', function(e) {
      var rect = that.$canvas.getBoundingClientRect();
      that.$mouseX = e.clientX - rect.left;
      that.$mouseY = e.clientY - rect.top;
      that.$crosshair.x = that.$mouseX;
      that.$crosshair.y = that.$mouseY;
      that.$crosshair.visible = true;
    });
    
    this.$canvas.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (that.$gameRunning && !that.$gamePaused) {
        that.fireMissile(that.$mouseX, that.$mouseY);
      }
      that.$canvas.focus();
    });
    
    this.$canvas.addEventListener('mouseleave', function(e) {
      that.$crosshair.visible = false;
    });
    
    // Keyboard controls
    this.$keydownHandler = function(e) {
      if (e.keyCode === 27) { // Escape
        that.$targetingMode = false;
        that.$crosshair.visible = false;
      }
    };
    document.addEventListener('keydown', this.$keydownHandler);
    
    // Make canvas focusable
    this.$canvas.tabIndex = 0;

    // Initialize game
    this.initializeGame();
    this.updateDisplay();
    this.draw();
  };

  MissileCommandUx.prototype.initializeGame = function() {
    // Initialize cities
    this.$cities = [];
    var citySpacing = this.CANVAS_WIDTH / (this.CITY_COUNT + 1);
    for (var i = 0; i < this.CITY_COUNT; i++) {
      this.$cities.push({
        x: citySpacing * (i + 1),
        y: this.GROUND_LEVEL,
        width: 30,
        height: 40,
        alive: true,
        buildings: this.generateCityBuildings(citySpacing * (i + 1))
      });
    }
    
    // Initialize missile silos
    this.$silos = [
      { x: 80, y: this.GROUND_LEVEL, ammo: 10, maxAmmo: 10 },
      { x: this.CANVAS_WIDTH / 2, y: this.GROUND_LEVEL, ammo: 10, maxAmmo: 10 },
      { x: this.CANVAS_WIDTH - 80, y: this.GROUND_LEVEL, ammo: 10, maxAmmo: 10 }
    ];
    
    // Reset arrays
    this.$incomingMissiles = [];
    this.$defensiveMissiles = [];
    this.$explosions = [];
    this.$particles = [];
    this.$trails = [];
    
    // Reset timers
    this.$frameCount = 0;
    this.$waveTimer = 0;
    this.$missileSpawnTimer = 0;
    this.$activeMissiles = 0;
    this.$totalCities = this.CITY_COUNT;
  };

  MissileCommandUx.prototype.generateCityBuildings = function(centerX) {
    var buildings = [];
    var buildingCount = 3 + Math.floor(Math.random() * 3);
    
    for (var i = 0; i < buildingCount; i++) {
      buildings.push({
        x: centerX - 15 + (i * 8),
        y: this.GROUND_LEVEL - 20 - Math.random() * 20,
        width: 6,
        height: 15 + Math.random() * 15
      });
    }
    
    return buildings;
  };

  MissileCommandUx.prototype.startGame = function() {
    this.$gameRunning = true;
    this.$gameOverFlag = false;
    this.$gamePaused = false;
    
    if (!this.$gameLoop) {
      this.gameLoop();
    }
    
    this.startWave();
  };

  MissileCommandUx.prototype.pauseGame = function() {
    this.$gamePaused = !this.$gamePaused;
  };

  MissileCommandUx.prototype.resetGame = function() {
    this.$gameRunning = false;
    this.$gameOverFlag = false;
    this.$gamePaused = false;
    this.$score = 0;
    this.$wave = 1;
    this.$level = 1;
    this.$bonusPoints = 0;
    
    this.initializeGame();
    this.updateDisplay();
    this.draw();
  };

  MissileCommandUx.prototype.startWave = function() {
    var missileCount = 3 + (this.$wave * 2) + Math.floor(this.$level * 1.5);
    this.$activeMissiles = missileCount;
    this.$missileSpawnTimer = 0;
    
    // Spawn missiles over time
    for (var i = 0; i < missileCount; i++) {
      setTimeout(function() {
        this.spawnIncomingMissile();
      }.bind(this), i * (2000 / missileCount));
    }
  };

  MissileCommandUx.prototype.spawnIncomingMissile = function() {
    if (!this.$gameRunning) return;
    
    var types = Object.keys(this.MISSILE_TYPES);
    var type = types[Math.floor(Math.random() * types.length)];
    var config = this.MISSILE_TYPES[type];
    
    // Random start position (top of screen)
    var startX = Math.random() * this.CANVAS_WIDTH;
    
    // Target cities or silos
    var targets = [];
    for (var i = 0; i < this.$cities.length; i++) {
      if (this.$cities[i].alive) targets.push(this.$cities[i]);
    }
    for (var i = 0; i < this.$silos.length; i++) {
      if (this.$silos[i].ammo > 0) targets.push(this.$silos[i]);
    }
    
    if (targets.length === 0) return;
    
    var target = targets[Math.floor(Math.random() * targets.length)];
    var dx = target.x - startX;
    var dy = target.y - 0;
    var dist = Math.sqrt(dx * dx + dy * dy);
    
    var missile = {
      x: startX,
      y: 0,
      targetX: target.x + (Math.random() - 0.5) * 60,
      targetY: target.y,
      vx: (dx / dist) * config.speed,
      vy: (dy / dist) * config.speed,
      type: type,
      config: config,
      trail: [],
      splits: config.splits || 0,
      hasSplit: false
    };
    
    this.$incomingMissiles.push(missile);
  };

  MissileCommandUx.prototype.fireMissile = function(targetX, targetY) {
    // Find closest silo with ammo
    var closestSilo = null;
    var minDist = Infinity;
    
    for (var i = 0; i < this.$silos.length; i++) {
      var silo = this.$silos[i];
      if (silo.ammo > 0) {
        var dist = Math.abs(silo.x - targetX);
        if (dist < minDist) {
          minDist = dist;
          closestSilo = silo;
        }
      }
    }
    
    if (!closestSilo) return;
    
    // Launch defensive missile
    var dx = targetX - closestSilo.x;
    var dy = targetY - closestSilo.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var speed = 6;
    
    this.$defensiveMissiles.push({
      x: closestSilo.x,
      y: closestSilo.y,
      targetX: targetX,
      targetY: targetY,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      trail: []
    });
    
    closestSilo.ammo--;
    this.createLaunchEffect(closestSilo.x, closestSilo.y);
  };

  MissileCommandUx.prototype.gameLoop = function() {
    var that = this;
    
    if (this.$gameRunning && !this.$gamePaused) {
      this.updateGame();
    }
    
    this.updateEffects();
    this.draw();
    
    requestAnimationFrame(function() {
      that.gameLoop();
    });
  };

  MissileCommandUx.prototype.updateGame = function() {
    this.$frameCount++;
    this.$waveTimer++;
    
    this.updateIncomingMissiles();
    this.updateDefensiveMissiles();
    this.updateExplosions();
    this.checkCollisions();
    this.checkWaveComplete();
    this.updateDisplay();
  };

  MissileCommandUx.prototype.updateIncomingMissiles = function() {
    for (var i = this.$incomingMissiles.length - 1; i >= 0; i--) {
      var missile = this.$incomingMissiles[i];
      
      // Update trail
      if (missile.trail.length > 20) {
        missile.trail.shift();
      }
      missile.trail.push({ x: missile.x, y: missile.y, alpha: 1 });
      
      // Move missile
      missile.x += missile.vx;
      missile.y += missile.vy;
      
      // Check for MIRV split
      if (missile.type === 'mirv' && !missile.hasSplit && missile.y > this.CANVAS_HEIGHT * 0.4) {
        this.splitMirv(missile, i);
        continue;
      }
      
      // Check if missile hit ground
      if (missile.y >= missile.targetY) {
        this.missileImpact(missile.x, missile.y);
        this.$incomingMissiles.splice(i, 1);
        this.$activeMissiles--;
      }
    }
  };

  MissileCommandUx.prototype.splitMirv = function(missile, index) {
    missile.hasSplit = true;
    
    // Create multiple warheads
    for (var j = 0; j < missile.splits; j++) {
      var angle = (j - (missile.splits - 1) / 2) * 0.3;
      var speed = missile.config.speed;
      
      var newMissile = {
        x: missile.x,
        y: missile.y,
        targetX: missile.targetX + (j - 1) * 50,
        targetY: missile.targetY,
        vx: Math.sin(angle) * speed + missile.vx,
        vy: Math.cos(angle) * speed + missile.vy,
        type: 'icbm',
        config: this.MISSILE_TYPES.icbm,
        trail: [],
        splits: 0,
        hasSplit: false
      };
      
      this.$incomingMissiles.push(newMissile);
      this.$activeMissiles++;
    }
    
    this.$incomingMissiles.splice(index, 1);
    this.$activeMissiles--;
  };

  MissileCommandUx.prototype.updateDefensiveMissiles = function() {
    for (var i = this.$defensiveMissiles.length - 1; i >= 0; i--) {
      var missile = this.$defensiveMissiles[i];
      
      // Update trail
      if (missile.trail.length > 15) {
        missile.trail.shift();
      }
      missile.trail.push({ x: missile.x, y: missile.y, alpha: 1 });
      
      // Move missile
      missile.x += missile.vx;
      missile.y += missile.vy;
      
      // Check if reached target
      var dx = missile.targetX - missile.x;
      var dy = missile.targetY - missile.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 10) {
        this.createExplosion(missile.x, missile.y, 50, '#22c55e');
        this.$defensiveMissiles.splice(i, 1);
      }
    }
  };

  MissileCommandUx.prototype.updateExplosions = function() {
    for (var i = this.$explosions.length - 1; i >= 0; i--) {
      var explosion = this.$explosions[i];
      explosion.life--;
      
      if (explosion.growing) {
        explosion.radius += explosion.growthRate;
        if (explosion.radius >= explosion.maxRadius) {
          explosion.growing = false;
        }
      } else {
        explosion.radius -= explosion.shrinkRate;
      }
      
      if (explosion.life <= 0 || explosion.radius <= 0) {
        this.$explosions.splice(i, 1);
      }
    }
  };

  MissileCommandUx.prototype.checkCollisions = function() {
    // Check incoming missiles vs explosions
    for (var i = this.$incomingMissiles.length - 1; i >= 0; i--) {
      var missile = this.$incomingMissiles[i];
      
      for (var j = 0; j < this.$explosions.length; j++) {
        var explosion = this.$explosions[j];
        var dx = missile.x - explosion.x;
        var dy = missile.y - explosion.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < explosion.radius) {
          // Missile destroyed
          this.$score += missile.config.points;
          this.addScoreParticle(missile.x, missile.y, '+' + missile.config.points);
          this.createExplosion(missile.x, missile.y, 30, '#fbbf24');
          this.$incomingMissiles.splice(i, 1);
          this.$activeMissiles--;
          break;
        }
      }
    }
  };

  MissileCommandUx.prototype.missileImpact = function(x, y) {
    this.createExplosion(x, y, 60, '#ef4444');
    
    // Check city/silo destruction
    for (var i = 0; i < this.$cities.length; i++) {
      var city = this.$cities[i];
      if (city.alive && Math.abs(city.x - x) < 40) {
        city.alive = false;
        this.$totalCities--;
        this.createCityDestructionEffect(city);
      }
    }
    
    for (var i = 0; i < this.$silos.length; i++) {
      var silo = this.$silos[i];
      if (silo.ammo > 0 && Math.abs(silo.x - x) < 30) {
        silo.ammo = 0;
        this.createSiloDestructionEffect(silo.x, silo.y);
      }
    }
    
    // Check game over
    if (this.$totalCities <= 0) {
      this.gameOver();
    }
  };

  MissileCommandUx.prototype.checkWaveComplete = function() {
    if (this.$activeMissiles <= 0 && this.$incomingMissiles.length === 0) {
      this.waveComplete();
    }
  };

  MissileCommandUx.prototype.waveComplete = function() {
    // Bonus points
    this.$bonusPoints = 0;
    
    // City bonus
    for (var i = 0; i < this.$cities.length; i++) {
      if (this.$cities[i].alive) {
        this.$bonusPoints += 100;
      }
    }
    
    // Ammo bonus
    for (var i = 0; i < this.$silos.length; i++) {
      this.$bonusPoints += this.$silos[i].ammo * 5;
    }
    
    this.$score += this.$bonusPoints;
    this.addScoreParticle(this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2, '+' + this.$bonusPoints);
    
    // Restock ammo
    for (var i = 0; i < this.$silos.length; i++) {
      if (this.$silos[i].ammo < this.$silos[i].maxAmmo) {
        this.$silos[i].ammo = this.$silos[i].maxAmmo;
      }
    }
    
    this.$wave++;
    if (this.$wave % 5 === 0) {
      this.$level++;
    }
    
    // Start next wave after delay
    setTimeout(function() {
      if (this.$gameRunning) {
        this.startWave();
      }
    }.bind(this), 3000);
  };

  MissileCommandUx.prototype.gameOver = function() {
    this.$gameRunning = false;
    this.$gameOverFlag = true;
    
    // Create game over explosion
    for (var i = 0; i < 30; i++) {
      this.$particles.push({
        x: this.CANVAS_WIDTH / 2,
        y: this.CANVAS_HEIGHT / 2,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        life: 120,
        maxLife: 120,
        color: '#dc2626',
        size: 6
      });
    }
  };

  MissileCommandUx.prototype.updateEffects = function() {
    // Update particles
    for (var i = this.$particles.length - 1; i >= 0; i--) {
      var particle = this.$particles[i];
      particle.life--;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.1; // gravity
      
      if (particle.life <= 0) {
        this.$particles.splice(i, 1);
      }
    }
    
    // Update missile trails
    for (var i = 0; i < this.$incomingMissiles.length; i++) {
      var missile = this.$incomingMissiles[i];
      for (var j = missile.trail.length - 1; j >= 0; j--) {
        missile.trail[j].alpha -= 0.05;
        if (missile.trail[j].alpha <= 0) {
          missile.trail.splice(j, 1);
        }
      }
    }
    
    for (var i = 0; i < this.$defensiveMissiles.length; i++) {
      var missile = this.$defensiveMissiles[i];
      for (var j = missile.trail.length - 1; j >= 0; j--) {
        missile.trail[j].alpha -= 0.08;
        if (missile.trail[j].alpha <= 0) {
          missile.trail.splice(j, 1);
        }
      }
    }
  };

  MissileCommandUx.prototype.draw = function() {
    // Clear with gradient background
    var gradient = this.$ctx.createLinearGradient(0, 0, 0, this.CANVAS_HEIGHT);
    gradient.addColorStop(0, '#000022');
    gradient.addColorStop(0.7, '#001133');
    gradient.addColorStop(1, '#003300');
    this.$ctx.fillStyle = gradient;
    this.$ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
    
    this.drawTerrain();
    this.drawCities();
    this.drawSilos();
    this.drawMissiles();
    this.drawExplosions();
    this.drawCrosshair();
    this.drawEffects();
    
    // Draw game over
    if (this.$gameOverFlag && !this.$gameRunning) {
      this.$ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      this.$ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
      
      this.$ctx.fillStyle = '#ef4444';
      this.$ctx.font = 'bold 32px Courier New';
      this.$ctx.textAlign = 'center';
      this.$ctx.fillText('GAME OVER', this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2 - 40);
      
      this.$ctx.fillStyle = '#fff';
      this.$ctx.font = '16px Courier New';
      this.$ctx.fillText('ALL CITIES DESTROYED', this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2 - 10);
      this.$ctx.fillText('Final Score: ' + this.$score, this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2 + 15);
      this.$ctx.fillText('Wave Reached: ' + this.$wave, this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2 + 40);
    }
  };

  MissileCommandUx.prototype.drawTerrain = function() {
    // Draw ground
    this.$ctx.fillStyle = '#22c55e';
    this.$ctx.fillRect(0, this.GROUND_LEVEL, this.CANVAS_WIDTH, this.CANVAS_HEIGHT - this.GROUND_LEVEL);
    
    // Draw horizon line
    this.$ctx.strokeStyle = '#16a34a';
    this.$ctx.lineWidth = 2;
    this.$ctx.beginPath();
    this.$ctx.moveTo(0, this.GROUND_LEVEL);
    this.$ctx.lineTo(this.CANVAS_WIDTH, this.GROUND_LEVEL);
    this.$ctx.stroke();
  };

  MissileCommandUx.prototype.drawCities = function() {
    for (var i = 0; i < this.$cities.length; i++) {
      var city = this.$cities[i];
      
      if (city.alive) {
        // Draw city buildings
        this.$ctx.fillStyle = '#22c55e';
        this.$ctx.shadowColor = '#4ade80';
        this.$ctx.shadowBlur = 8;
        
        for (var j = 0; j < city.buildings.length; j++) {
          var building = city.buildings[j];
          this.$ctx.fillRect(building.x, building.y, building.width, building.height);
        }
        
        this.$ctx.shadowBlur = 0;
      } else {
        // Draw destroyed city (rubble)
        this.$ctx.fillStyle = '#dc2626';
        this.$ctx.fillRect(city.x - 15, this.GROUND_LEVEL - 5, 30, 5);
        
        // Draw smoke particles
        if (Math.random() < 0.3) {
          this.$particles.push({
            x: city.x + (Math.random() - 0.5) * 30,
            y: this.GROUND_LEVEL - 5,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 3 - 1,
            life: 60,
            maxLife: 60,
            color: '#6b7280',
            size: 3
          });
        }
      }
    }
  };

  MissileCommandUx.prototype.drawSilos = function() {
    for (var i = 0; i < this.$silos.length; i++) {
      var silo = this.$silos[i];
      
      if (silo.ammo > 0) {
        // Draw active silo
        this.$ctx.fillStyle = '#22c55e';
        this.$ctx.shadowColor = '#4ade80';
        this.$ctx.shadowBlur = 10;
        
        // Silo base
        this.$ctx.fillRect(silo.x - 15, this.GROUND_LEVEL - 10, 30, 10);
        
        // Launcher
        this.$ctx.fillRect(silo.x - 5, this.GROUND_LEVEL - 20, 10, 15);
        
        this.$ctx.shadowBlur = 0;
      } else {
        // Draw destroyed silo
        this.$ctx.fillStyle = '#991b1b';
        this.$ctx.fillRect(silo.x - 10, this.GROUND_LEVEL - 5, 20, 5);
      }
    }
  };

  MissileCommandUx.prototype.drawMissiles = function() {
    // Draw incoming missiles
    for (var i = 0; i < this.$incomingMissiles.length; i++) {
      var missile = this.$incomingMissiles[i];
      
      // Draw trail
      for (var j = 0; j < missile.trail.length; j++) {
        var trail = missile.trail[j];
        var size = (j / missile.trail.length) * 3;
        
        this.$ctx.save();
        this.$ctx.globalAlpha = trail.alpha * 0.8;
        this.$ctx.fillStyle = missile.config.trail;
        this.$ctx.fillRect(trail.x - size, trail.y - size, size * 2, size * 2);
        this.$ctx.restore();
      }
      
      // Draw missile
      this.$ctx.fillStyle = missile.config.color;
      this.$ctx.shadowColor = missile.config.color;
      this.$ctx.shadowBlur = 8;
      this.$ctx.fillRect(missile.x - 3, missile.y - 6, 6, 12);
      this.$ctx.shadowBlur = 0;
    }
    
    // Draw defensive missiles
    for (var i = 0; i < this.$defensiveMissiles.length; i++) {
      var missile = this.$defensiveMissiles[i];
      
      // Draw trail
      for (var j = 0; j < missile.trail.length; j++) {
        var trail = missile.trail[j];
        var size = (j / missile.trail.length) * 2;
        
        this.$ctx.save();
        this.$ctx.globalAlpha = trail.alpha;
        this.$ctx.fillStyle = '#4ade80';
        this.$ctx.fillRect(trail.x - size, trail.y - size, size * 2, size * 2);
        this.$ctx.restore();
      }
      
      // Draw missile
      this.$ctx.fillStyle = '#22c55e';
      this.$ctx.shadowColor = '#4ade80';
      this.$ctx.shadowBlur = 6;
      this.$ctx.fillRect(missile.x - 2, missile.y - 4, 4, 8);
      this.$ctx.shadowBlur = 0;
    }
  };

  MissileCommandUx.prototype.drawExplosions = function() {
    for (var i = 0; i < this.$explosions.length; i++) {
      var explosion = this.$explosions[i];
      var alpha = explosion.life / explosion.maxLife;
      
      this.$ctx.save();
      this.$ctx.globalAlpha = alpha;
      
      // Outer ring
      this.$ctx.strokeStyle = explosion.color;
      this.$ctx.lineWidth = 4;
      this.$ctx.beginPath();
      this.$ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
      this.$ctx.stroke();
      
      // Inner glow
      this.$ctx.fillStyle = explosion.color;
      this.$ctx.shadowColor = explosion.color;
      this.$ctx.shadowBlur = 20;
      this.$ctx.beginPath();
      this.$ctx.arc(explosion.x, explosion.y, explosion.radius * 0.3, 0, Math.PI * 2);
      this.$ctx.fill();
      
      this.$ctx.restore();
    }
  };

  MissileCommandUx.prototype.drawCrosshair = function() {
    if (!this.$crosshair.visible || !this.$gameRunning) return;
    
    var x = this.$crosshair.x;
    var y = this.$crosshair.y;
    
    this.$ctx.strokeStyle = '#22c55e';
    this.$ctx.lineWidth = 2;
    this.$ctx.shadowColor = '#4ade80';
    this.$ctx.shadowBlur = 10;
    
    // Crosshair lines
    this.$ctx.beginPath();
    this.$ctx.moveTo(x - 15, y);
    this.$ctx.lineTo(x - 5, y);
    this.$ctx.moveTo(x + 5, y);
    this.$ctx.lineTo(x + 15, y);
    this.$ctx.moveTo(x, y - 15);
    this.$ctx.lineTo(x, y - 5);
    this.$ctx.moveTo(x, y + 5);
    this.$ctx.lineTo(x, y + 15);
    this.$ctx.stroke();
    
    // Center circle
    this.$ctx.beginPath();
    this.$ctx.arc(x, y, 3, 0, Math.PI * 2);
    this.$ctx.stroke();
    
    this.$ctx.shadowBlur = 0;
  };

  MissileCommandUx.prototype.drawEffects = function() {
    // Draw particles
    for (var i = 0; i < this.$particles.length; i++) {
      var particle = this.$particles[i];
      var alpha = particle.life / particle.maxLife;
      
      this.$ctx.save();
      this.$ctx.globalAlpha = alpha;
      this.$ctx.fillStyle = particle.color;
      
      if (particle.text) {
        this.$ctx.font = 'bold 14px Courier New';
        this.$ctx.textAlign = 'center';
        this.$ctx.shadowColor = particle.color;
        this.$ctx.shadowBlur = 8;
        this.$ctx.fillText(particle.text, particle.x, particle.y);
      } else {
        this.$ctx.beginPath();
        this.$ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        this.$ctx.fill();
      }
      
      this.$ctx.restore();
    }
  };

  MissileCommandUx.prototype.createExplosion = function(x, y, maxRadius, color) {
    this.$explosions.push({
      x: x,
      y: y,
      radius: 5,
      maxRadius: maxRadius,
      growthRate: 4,
      shrinkRate: 2,
      color: color,
      life: 80,
      maxLife: 80,
      growing: true
    });
    
    // Create explosion particles
    for (var i = 0; i < 15; i++) {
      this.$particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 60,
        maxLife: 60,
        color: color,
        size: 4
      });
    }
  };

  MissileCommandUx.prototype.createLaunchEffect = function(x, y) {
    for (var i = 0; i < 8; i++) {
      this.$particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 8 - 2,
        life: 40,
        maxLife: 40,
        color: '#fbbf24',
        size: 3
      });
    }
  };

  MissileCommandUx.prototype.createCityDestructionEffect = function(city) {
    for (var i = 0; i < 20; i++) {
      this.$particles.push({
        x: city.x + (Math.random() - 0.5) * 60,
        y: city.y - Math.random() * 40,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 12,
        life: 90,
        maxLife: 90,
        color: Math.random() < 0.5 ? '#dc2626' : '#6b7280',
        size: 4
      });
    }
  };

  MissileCommandUx.prototype.createSiloDestructionEffect = function(x, y) {
    for (var i = 0; i < 12; i++) {
      this.$particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y - Math.random() * 20,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 8,
        life: 70,
        maxLife: 70,
        color: '#ef4444',
        size: 3
      });
    }
  };

  MissileCommandUx.prototype.addScoreParticle = function(x, y, text) {
    this.$particles.push({
      x: x,
      y: y,
      vx: 0,
      vy: -3,
      size: 0,
      color: '#22c55e',
      text: text,
      life: 120,
      maxLife: 120
    });
  };

  MissileCommandUx.prototype.updateDisplay = function() {
    this.$scoreEl.textContent = this.$score;
    this.$waveEl.textContent = this.$wave;
    this.$citiesEl.textContent = this.$totalCities + '/' + this.CITY_COUNT;
    
    // Update silo ammo displays
    this.$siloLeftEl.textContent = this.$silos[0].ammo;
    this.$siloCenterEl.textContent = this.$silos[1].ammo;
    this.$siloRightEl.textContent = this.$silos[2].ammo;
    
    // Update ammo bars
    this.$ammoLeftEl.style.width = (this.$silos[0].ammo / this.$silos[0].maxAmmo * 100) + '%';
    this.$ammoCenterEl.style.width = (this.$silos[1].ammo / this.$silos[1].maxAmmo * 100) + '%';
    this.$ammoRightEl.style.width = (this.$silos[2].ammo / this.$silos[2].maxAmmo * 100) + '%';
    
    // Update city display
    this.$cityDisplayEl.innerHTML = '';
    for (var i = 0; i < this.$cities.length; i++) {
      var cityIcon = document.createElement('div');
      cityIcon.className = 'city-icon' + (this.$cities[i].alive ? '' : ' destroyed');
      this.$cityDisplayEl.appendChild(cityIcon);
    }
  };

  MissileCommandUx.prototype.doDestroy = function() {
    this.$gameRunning = false;

    if (this.$keydownHandler) {
      document.removeEventListener('keydown', this.$keydownHandler);
      this.$keydownHandler = null;
    }

    this.$container = null;
    this.$canvas = null;
    this.$ctx = null;
    this.$scoreEl = null;
    this.$waveEl = null;
    this.$citiesEl = null;
    this.$cityDisplayEl = null;
    this.$siloLeftEl = null;
    this.$siloCenterEl = null;
    this.$siloRightEl = null;
    this.$ammoLeftEl = null;
    this.$ammoCenterEl = null;
    this.$ammoRightEl = null;

    this.$cities = null;
    this.$silos = null;
    this.$incomingMissiles = null;
    this.$defensiveMissiles = null;
    this.$explosions = null;
    this.$particles = null;
    this.$trails = null;
    
    Widget.prototype.doDestroy.call(this);
  };

  return MissileCommandUx;
});