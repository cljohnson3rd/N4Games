define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/frogger'
], function(baja, Widget) {
  'use strict';

  var FroggerUx = function() {
    var that = this;
    Widget.apply(this, arguments);
    
    // Medium-scale constants - bigger but not massive
    this.CANVAS_WIDTH = 600;   // Much more reasonable (was 800)
    this.CANVAS_HEIGHT = 900;  // Nice proportions (was 1200)
    this.GRID_SIZE = 45;       // Perfect visibility (was 60)
    this.LANES = 20;          // Good variety
    this.FROG_SIZE = 35;      // Visible but not huge

    // Game state
    this.$gameRunning = false;
    this.$gamePaused = false;
    this.$gameOverFlag = false;
    this.$score = 0;
    this.$lives = 5;
    this.$level = 1;
    this.$timeLeft = 60;

    // Game objects with precise positioning
    this.$frog = { gridX: 6, gridY: 18, animating: false, animationProgress: 0 };
    this.$cars = [];
    this.$logs = [];
    this.$turtles = [];
    this.$particles = [];
    this.$ripples = [];
    this.$frameCount = 0;
    this.$gameLoopId = null;

    // Enhanced movement system
    this.$pendingMove = null;
    this.$moveQueue = [];

    // Lane configuration (0=water, 1=road, 2=safe, 3=goal)
    this.LANE_TYPES = [
      3, 2, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2
    ];

    // Well-balanced lane configurations
    this.LANE_CONFIG = {
      2: { type: 'log', speed: -1.8, color: '#92400e', objects: [{x: 0, width: 3}, {x: 5, width: 3}, {x: 9, width: 2}] },
      3: { type: 'turtle', speed: 1.5, color: '#065f46', objects: [{x: 1, width: 1}, {x: 3, width: 1}, {x: 5, width: 1}, {x: 7, width: 1}, {x: 9, width: 1}] },
      4: { type: 'log', speed: 2.2, color: '#92400e', objects: [{x: 2, width: 4}, {x: 7, width: 3}, {x: 11, width: 2}] },
      5: { type: 'turtle', speed: -1.6, color: '#065f46', objects: [{x: 0, width: 1}, {x: 2.5, width: 1}, {x: 5, width: 1}, {x: 7.5, width: 1}, {x: 10, width: 1}] },
      6: { type: 'log', speed: 2.5, color: '#92400e', objects: [{x: 1, width: 3}, {x: 6, width: 3}, {x: 10, width: 2}] },
      7: { type: 'turtle', speed: -2, color: '#065f46', objects: [{x: 1, width: 1}, {x: 4, width: 1}, {x: 7, width: 1}, {x: 10, width: 1}] },
      9: { type: 'car', speed: -2.5, color: '#dc2626', objects: [{x: 0, width: 2}, {x: 4, width: 2}, {x: 8, width: 2}, {x: 11, width: 1.5}] },
      10: { type: 'car', speed: 3, color: '#991b1b', objects: [{x: 2, width: 1.5}, {x: 5.5, width: 1.5}, {x: 9, width: 1.5}] },
      11: { type: 'car', speed: -3, color: '#1e40af', objects: [{x: 1, width: 2}, {x: 5, width: 1.5}, {x: 8, width: 2}, {x: 11, width: 1.5}] },
      12: { type: 'car', speed: 2, color: '#7c3aed', objects: [{x: 0, width: 2.5}, {x: 4.5, width: 2}, {x: 8, width: 2}] },
      13: { type: 'car', speed: -3.5, color: '#be185d', objects: [{x: 2, width: 2}, {x: 6, width: 2}, {x: 10, width: 2}] },
      14: { type: 'car', speed: 4, color: '#059669', objects: [{x: 1, width: 1.5}, {x: 4, width: 2}, {x: 7.5, width: 1.5}, {x: 10.5, width: 1.5}] }
    };
  };

  FroggerUx.prototype = Object.create(Widget.prototype);
  FroggerUx.prototype.constructor = FroggerUx;

  FroggerUx.prototype.findElement = function(selector) {
    if (this.$container.querySelector) {
      return this.$container.querySelector(selector);
    } else if (this.$container.nodeType) {
      return this.$container.querySelector(selector);
    } else {
      var elem = this.$container.element || this.$container[0] || this.$container;
      return elem.querySelector ? elem.querySelector(selector) : null;
    }
  };

  FroggerUx.prototype.doInitialize = function(element) {
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

    // Create HTML with medium scale layout
    this.$container.innerHTML =
      '<div class="frogger-container" style="display: flex; gap: 20px; align-items: flex-start;">' +
        '<div class="frogger-game">' +
          '<canvas id="frogger-board" width="' + this.CANVAS_WIDTH + '" height="' + this.CANVAS_HEIGHT + '" tabindex="0" style="border: 2px solid #22d3ee; border-radius: 8px;"></canvas>' +
        '</div>' +
        '<div class="frogger-sidebar" style="min-width: 240px; max-width: 280px; background: rgba(0,20,40,0.8); padding: 20px; border-radius: 8px; color: white;">' +
          '<div class="frogger-info" style="margin-bottom: 20px;">' +
            '<h3 style="color: #22d3ee; margin-bottom: 12px; font-size: 16px;">Game Status</h3>' +
            '<div style="font-size: 14px; margin-bottom: 6px;">Score: <span id="score" style="color: #fbbf24; font-weight: bold;">0</span></div>' +
            '<div style="font-size: 14px; margin-bottom: 6px;">Level: <span id="level" style="color: #22c55e; font-weight: bold;">1</span></div>' +
            '<div style="font-size: 14px; margin-bottom: 6px;">Time: <span id="time" style="color: #ef4444; font-weight: bold;">60</span>s</div>' +
          '</div>' +
          '<div class="frogger-lives" style="margin-bottom: 20px;">' +
            '<h3 style="color: #22d3ee; margin-bottom: 12px; font-size: 16px;">Lives</h3>' +
            '<div class="life-display" id="life-display" style="display: flex; gap: 6px; flex-wrap: wrap;"></div>' +
          '</div>' +
          '<div class="frogger-controls" style="margin-bottom: 20px;">' +
            '<h3 style="color: #22d3ee; margin-bottom: 12px; font-size: 16px;">Controls</h3>' +
            '<button id="start-btn" style="margin: 4px; padding: 8px 16px; font-size: 12px; background: #22c55e; color: white; border: none; border-radius: 4px; cursor: pointer;">Start Game</button><br>' +
            '<button id="pause-btn" style="margin: 4px; padding: 8px 16px; font-size: 12px; background: #fbbf24; color: black; border: none; border-radius: 4px; cursor: pointer;">Pause</button><br>' +
            '<button id="reset-btn" style="margin: 4px; padding: 8px 16px; font-size: 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Reset</button>' +
          '</div>' +
          '<div class="frogger-instructions">' +
            '<h3 style="color: #22d3ee; margin-bottom: 12px; font-size: 16px;">How to Play</h3>' +
            '<div style="font-size: 13px; line-height: 1.5;">' +
              '<div style="margin-bottom: 6px;"><strong>Movement:</strong></div>' +
              '<div style="margin-bottom: 3px;">← → ↑ ↓ Arrow Keys</div>' +
              '<div style="margin-bottom: 10px; font-size: 11px; color: #94a3b8;">Use arrow keys to move frog</div>' +
              '<div style="margin-bottom: 6px;"><strong>Objective:</strong></div>' +
              '<div style="margin-bottom: 3px;">Get frog to goal safely!</div>' +
              '<div style="margin-bottom: 3px;">• Avoid cars on roads</div>' +
              '<div style="margin-bottom: 3px;">• Use logs & turtles in water</div>' +
              '<div style="margin-bottom: 3px;">• Don\'t fall off platforms</div>' +
              '<div style="font-size: 11px; color: #94a3b8;">Each level gets faster!</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Get canvas and context
    this.$canvas = this.findElement('#frogger-board');
    this.$ctx = this.$canvas.getContext('2d');

    // Get UI elements
    this.$scoreEl = this.findElement('#score');
    this.$levelEl = this.findElement('#level');
    this.$timeEl = this.findElement('#time');
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

    // Enhanced keyboard controls with proper grid movement
    this.$keydownHandler = function(e) {
      if (that.$gameRunning && !that.$gamePaused && !that.$frog.animating &&
          (document.activeElement === that.$canvas || that.$container.contains(document.activeElement))) {
        if (e.keyCode >= 37 && e.keyCode <= 40) {
          e.preventDefault();
          e.stopPropagation();
          that.queueMove(e.keyCode);
        }
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
    this.initializeGame();
    this.updateDisplay();
    this.draw();
  };

  FroggerUx.prototype.initializeGame = function() {
    this.$frog = { gridX: 6, gridY: 18, animating: false, animationProgress: 0 };
    this.$cars = [];
    this.$logs = [];
    this.$turtles = [];
    this.$particles = [];
    this.$ripples = [];
    this.$frameCount = 0;
    this.$pendingMove = null;
    this.$moveQueue = [];

    // Create initial objects with optimized positioning
    this.createLaneObjects();
  };

  FroggerUx.prototype.createLaneObjects = function() {
    var that = this;
    var gridWidth = Math.floor(this.CANVAS_WIDTH / this.GRID_SIZE);

    Object.keys(this.LANE_CONFIG).forEach(function(lane) {
      var config = that.LANE_CONFIG[lane];
      var laneY = parseInt(lane);

      config.objects.forEach(function(objConfig) {
        var obj = {
          x: objConfig.x,
          y: laneY,
          width: objConfig.width,
          height: 1,
          speed: config.speed * (1 + (that.$level - 1) * 0.2),
          color: config.color,
          type: config.type
        };

        if (config.type === 'car') {
          that.$cars.push(obj);
        } else if (config.type === 'log') {
          that.$logs.push(obj);
        } else if (config.type === 'turtle') {
          that.$turtles.push(obj);
        }
      });
    });
  };

  FroggerUx.prototype.queueMove = function(keyCode) {
    if (this.$moveQueue.length < 2) { // Allow buffering one move
      this.$moveQueue.push(keyCode);
    }
    this.processNextMove();
  };

  FroggerUx.prototype.processNextMove = function() {
    if (this.$frog.animating || this.$moveQueue.length === 0) return;

    var keyCode = this.$moveQueue.shift();
    var newGridX = this.$frog.gridX;
    var newGridY = this.$frog.gridY;
    var gridWidth = Math.floor(this.CANVAS_WIDTH / this.GRID_SIZE);

    switch(keyCode) {
      case 37: // Left
        newGridX = Math.max(0, this.$frog.gridX - 1);
        break;
      case 39: // Right
        newGridX = Math.min(gridWidth - 1, this.$frog.gridX + 1);
        break;
      case 38: // Up
        newGridY = Math.max(0, this.$frog.gridY - 1);
        break;
      case 40: // Down
        newGridY = Math.min(this.LANES - 1, this.$frog.gridY + 1);
        break;
    }

    if (newGridX !== this.$frog.gridX || newGridY !== this.$frog.gridY) {
      this.startMove(newGridX, newGridY);
    }
  };

  FroggerUx.prototype.startMove = function(newGridX, newGridY) {
    this.$pendingMove = { targetX: newGridX, targetY: newGridY };
    this.$frog.animating = true;
    this.$frog.animationProgress = 0;

    // Create splash effect if moving into water
    if (this.LANE_TYPES[newGridY] === 0) {
      this.createWaterRipple(newGridX * this.GRID_SIZE + this.GRID_SIZE/2,
                           newGridY * this.GRID_SIZE + this.GRID_SIZE/2);
    }
  };

  FroggerUx.prototype.updateFrogAnimation = function() {
    if (!this.$frog.animating || !this.$pendingMove) return;

    this.$frog.animationProgress += 0.2; // Smooth movement

    if (this.$frog.animationProgress >= 1) {
      // Complete the move
      this.$frog.gridX = this.$pendingMove.targetX;
      this.$frog.gridY = this.$pendingMove.targetY;
      this.$frog.animating = false;
      this.$frog.animationProgress = 0;
      this.$pendingMove = null;

      // Check collisions after move completes
      this.checkFrogPosition();
      this.checkGoal();

      // Process next queued move
      setTimeout(function() {
        this.processNextMove();
      }.bind(this), 50);
    }
  };

  FroggerUx.prototype.getFrogRenderPosition = function() {
    var baseX = this.$frog.gridX * this.GRID_SIZE + this.GRID_SIZE/2;
    var baseY = this.$frog.gridY * this.GRID_SIZE + this.GRID_SIZE/2;

    if (this.$frog.animating && this.$pendingMove) {
      var startX = this.$frog.gridX * this.GRID_SIZE + this.GRID_SIZE/2;
      var startY = this.$frog.gridY * this.GRID_SIZE + this.GRID_SIZE/2;
      var targetX = this.$pendingMove.targetX * this.GRID_SIZE + this.GRID_SIZE/2;
      var targetY = this.$pendingMove.targetY * this.GRID_SIZE + this.GRID_SIZE/2;

      var t = this.easeInOutQuad(this.$frog.animationProgress);
      baseX = startX + (targetX - startX) * t;
      baseY = startY + (targetY - startY) * t;
    }

    return { x: baseX, y: baseY };
  };

  FroggerUx.prototype.easeInOutQuad = function(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  };

  FroggerUx.prototype.startGame = function() {
    this.$gameRunning = true;
    this.$gameOverFlag = false;
    this.$gamePaused = false;
    this.$timeLeft = 60;

    if (this.$gameLoopId) {
      clearInterval(this.$gameLoopId);
    }
    this.$gameLoopId = setInterval(function() {
      this.gameStep();
    }.bind(this), 16); // 60fps
  };

  FroggerUx.prototype.pauseGame = function() {
    this.$gamePaused = !this.$gamePaused;
  };

  FroggerUx.prototype.resetGame = function() {
    this.$gameRunning = false;
    this.$gameOverFlag = false;
    this.$gamePaused = false;
    this.$score = 0;
    this.$lives = 5;
    this.$level = 1;
    this.$timeLeft = 60;

    if (this.$gameLoopId) {
      clearInterval(this.$gameLoopId);
      this.$gameLoopId = null;
    }

    this.initializeGame();
    this.updateDisplay();
    this.draw();
  };

  FroggerUx.prototype.gameStep = function() {
    if (!this.$gameRunning || this.$gamePaused) return;

    this.$frameCount++;

    // Update timer
    if (this.$frameCount % 60 === 0) {
      this.$timeLeft--;
      if (this.$timeLeft <= 0) {
        this.frogDied('time up');
        this.$timeLeft = 60;
      }
    }

    // Update frog animation
    this.updateFrogAnimation();

    // Update moving objects
    this.updateMovingObjects();

    // Update effects
    this.updateParticles();

    this.updateDisplay();
    this.draw();
  };

  FroggerUx.prototype.updateMovingObjects = function() {
    var gridWidth = Math.floor(this.CANVAS_WIDTH / this.GRID_SIZE);

    // Update cars
    for (var i = 0; i < this.$cars.length; i++) {
      var car = this.$cars[i];
      car.x += car.speed / 60;

      // Wrap around
      if (car.speed > 0 && car.x > gridWidth + car.width) {
        car.x = -car.width;
      } else if (car.speed < 0 && car.x < -car.width) {
        car.x = gridWidth;
      }
    }

    // Update logs and turtles
    var allWaterObjects = this.$logs.concat(this.$turtles);
    for (var i = 0; i < allWaterObjects.length; i++) {
      var obj = allWaterObjects[i];
      obj.x += obj.speed / 60;

      // Wrap around
      if (obj.speed > 0 && obj.x > gridWidth + obj.width) {
        obj.x = -obj.width;
      } else if (obj.speed < 0 && obj.x < -obj.width) {
        obj.x = gridWidth;
      }
    }
  };

  FroggerUx.prototype.checkFrogPosition = function() {
    var laneType = this.LANE_TYPES[this.$frog.gridY];

    // Check water lanes - must be on log or turtle
    if (laneType === 0) {
      var onPlatform = false;
      var platformSpeed = 0;

      // Check logs
      for (var i = 0; i < this.$logs.length; i++) {
        var log = this.$logs[i];
        if (log.y === this.$frog.gridY) {
          var logLeft = log.x;
          var logRight = log.x + log.width;

          if (this.$frog.gridX >= Math.floor(logLeft) && this.$frog.gridX < Math.ceil(logRight)) {
            onPlatform = true;
            platformSpeed = log.speed;
            break;
          }
        }
      }

      // Check turtles if not on log
      if (!onPlatform) {
        for (var i = 0; i < this.$turtles.length; i++) {
          var turtle = this.$turtles[i];
          if (turtle.y === this.$frog.gridY) {
            var turtleLeft = turtle.x;
            var turtleRight = turtle.x + turtle.width;

            if (this.$frog.gridX >= Math.floor(turtleLeft) && this.$frog.gridX < Math.ceil(turtleRight)) {
              onPlatform = true;
              platformSpeed = turtle.speed;
              break;
            }
          }
        }
      }

      if (!onPlatform) {
        this.frogDied('drowned');
        return;
      }

      // Move frog with platform (but keep in bounds)
      if (platformSpeed !== 0) {
        var movement = platformSpeed / 60;
        var newX = this.$frog.gridX + movement;
        var gridWidth = Math.floor(this.CANVAS_WIDTH / this.GRID_SIZE);

        if (newX < 0 || newX >= gridWidth) {
          this.frogDied('swept away');
          return;
        }
      }
    }

    // Check road lanes - avoid cars
    if (laneType === 1) {
      for (var i = 0; i < this.$cars.length; i++) {
        var car = this.$cars[i];
        if (car.y === this.$frog.gridY) {
          var carLeft = car.x;
          var carRight = car.x + car.width;

          if (this.$frog.gridX >= Math.floor(carLeft) && this.$frog.gridX < Math.ceil(carRight)) {
            this.frogDied('hit by car');
            return;
          }
        }
      }
    }
  };

  FroggerUx.prototype.checkGoal = function() {
    if (this.$frog.gridY === 0) {
      // Reached goal!
      this.$score += 200 + (this.$timeLeft * 5);
      this.createSuccessEffect();
      this.$frog.gridX = 6;
      this.$frog.gridY = 18;

      // Level up
      this.$level++;
      this.$timeLeft = 60;
      this.initializeGame();

      this.addScoreParticle(this.CANVAS_WIDTH / 2, 100, '+' + (200 + (this.$timeLeft * 5)));
    }
  };

  FroggerUx.prototype.frogDied = function(reason) {
    this.$lives--;
    this.createDeathEffect(reason);

    // Reset frog position
    this.$frog.gridX = 6;
    this.$frog.gridY = 18;
    this.$frog.animating = false;
    this.$pendingMove = null;
    this.$moveQueue = [];

    if (this.$lives <= 0) {
      this.gameOver();
    }
  };

  FroggerUx.prototype.gameOver = function() {
    this.$gameRunning = false;
    this.$gameOverFlag = true;

    if (this.$gameLoopId) {
      clearInterval(this.$gameLoopId);
      this.$gameLoopId = null;
    }

    // Create game over explosion
    for (var i = 0; i < 20; i++) {
      this.$particles.push({
        x: this.CANVAS_WIDTH / 2,
        y: this.CANVAS_HEIGHT / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 80,
        maxLife: 80,
        color: '#dc2626',
        size: 6
      });
    }
  };

  FroggerUx.prototype.updateParticles = function() {
    // Update particles
    for (var i = this.$particles.length - 1; i >= 0; i--) {
      var particle = this.$particles[i];
      particle.life--;
      particle.y += particle.vy;
      particle.x += particle.vx;
      particle.vy += 0.15; // gravity

      if (particle.life <= 0) {
        this.$particles.splice(i, 1);
      }
    }

    // Update ripples
    for (var i = this.$ripples.length - 1; i >= 0; i--) {
      var ripple = this.$ripples[i];
      ripple.radius += 3;
      ripple.alpha -= 0.03;

      if (ripple.alpha <= 0) {
        this.$ripples.splice(i, 1);
      }
    }
  };

  FroggerUx.prototype.draw = function() {
    // Clear canvas with gradient background
    var gradient = this.$ctx.createLinearGradient(0, 0, 0, this.CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0369a1');
    gradient.addColorStop(0.5, '#0891b2');
    gradient.addColorStop(1, '#0e7490');
    this.$ctx.fillStyle = gradient;
    this.$ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    this.drawBackground();
    this.drawLogs();
    this.drawTurtles();
    this.drawCars();
    this.drawFrog();
    this.drawEffects();

    // Draw game over
    if (this.$gameOverFlag && !this.$gameRunning) {
      this.$ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      this.$ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

      this.$ctx.fillStyle = '#fff';
      this.$ctx.font = 'bold 36px Arial';
      this.$ctx.textAlign = 'center';
      this.$ctx.fillText('GAME OVER', this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2);

      this.$ctx.font = '20px Arial';
      this.$ctx.fillText('Final Score: ' + this.$score, this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2 + 50);

      this.$ctx.font = '16px Arial';
      this.$ctx.fillStyle = '#94a3b8';
      this.$ctx.fillText('Press Reset to play again', this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2 + 80);
    }
  };

  FroggerUx.prototype.drawBackground = function() {
    for (var y = 0; y < this.LANES; y++) {
      var laneType = this.LANE_TYPES[y];
      var laneY = y * this.GRID_SIZE;

      switch(laneType) {
        case 0: // Water
          this.$ctx.fillStyle = '#1e40af';
          break;
        case 1: // Road
          this.$ctx.fillStyle = '#374151';
          break;
        case 2: // Safe
          this.$ctx.fillStyle = '#16a34a';
          break;
        case 3: // Goal
          this.$ctx.fillStyle = '#fbbf24';
          break;
      }

      this.$ctx.fillRect(0, laneY, this.CANVAS_WIDTH, this.GRID_SIZE);

      // Add lane markings for roads
      if (laneType === 1) {
        this.$ctx.fillStyle = '#fbbf24';
        for (var x = 0; x < this.CANVAS_WIDTH; x += 30) {
          this.$ctx.fillRect(x, laneY + this.GRID_SIZE/2 - 1.5, 15, 3);
        }
      }
    }

    // Draw grid lines for better visual clarity
    this.$ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.$ctx.lineWidth = 1;

    var gridWidth = Math.floor(this.CANVAS_WIDTH / this.GRID_SIZE);
    for (var x = 0; x <= gridWidth; x++) {
      this.$ctx.beginPath();
      this.$ctx.moveTo(x * this.GRID_SIZE, 0);
      this.$ctx.lineTo(x * this.GRID_SIZE, this.CANVAS_HEIGHT);
      this.$ctx.stroke();
    }

    for (var y = 0; y <= this.LANES; y++) {
      this.$ctx.beginPath();
      this.$ctx.moveTo(0, y * this.GRID_SIZE);
      this.$ctx.lineTo(this.CANVAS_WIDTH, y * this.GRID_SIZE);
      this.$ctx.stroke();
    }
  };

  FroggerUx.prototype.drawCars = function() {
    for (var i = 0; i < this.$cars.length; i++) {
      var car = this.$cars[i];

      // Enhanced car drawing with better proportions
      this.$ctx.fillStyle = car.color;
      this.$ctx.shadowColor = car.color;
      this.$ctx.shadowBlur = 6;

      var carX = car.x * this.GRID_SIZE;
      var carY = car.y * this.GRID_SIZE + this.GRID_SIZE * 0.15;
      var carWidth = car.width * this.GRID_SIZE;
      var carHeight = this.GRID_SIZE * 0.7;

      // Main car body
      this.$ctx.fillRect(carX, carY, carWidth, carHeight);

      // Car details - windows
      this.$ctx.fillStyle = '#87ceeb';
      this.$ctx.fillRect(carX + 4, carY + 4, carWidth - 8, carHeight * 0.4);

      // Car wheels
      this.$ctx.fillStyle = '#1f2937';
      var wheelSize = 6;
      this.$ctx.fillRect(carX + 4, carY + carHeight - 4, wheelSize, wheelSize);
      this.$ctx.fillRect(carX + carWidth - 10, carY + carHeight - 4, wheelSize, wheelSize);
      this.$ctx.fillRect(carX + 4, carY - 2, wheelSize, wheelSize);
      this.$ctx.fillRect(carX + carWidth - 10, carY - 2, wheelSize, wheelSize);

      this.$ctx.shadowBlur = 0;
    }
  };

  FroggerUx.prototype.drawLogs = function() {
    for (var i = 0; i < this.$logs.length; i++) {
      var log = this.$logs[i];

      this.$ctx.fillStyle = log.color;
      this.$ctx.shadowColor = '#8b4513';
      this.$ctx.shadowBlur = 4;

      var logX = log.x * this.GRID_SIZE;
      var logY = log.y * this.GRID_SIZE + this.GRID_SIZE * 0.2;
      var logWidth = log.width * this.GRID_SIZE;
      var logHeight = this.GRID_SIZE * 0.6;

      // Main log body
      this.$ctx.fillRect(logX, logY, logWidth, logHeight);

      // Log texture - rings
      this.$ctx.strokeStyle = '#654321';
      this.$ctx.lineWidth = 2;
      for (var j = 1; j < log.width; j++) {
        this.$ctx.beginPath();
        this.$ctx.moveTo(logX + j * this.GRID_SIZE, logY);
        this.$ctx.lineTo(logX + j * this.GRID_SIZE, logY + logHeight);
        this.$ctx.stroke();
      }

      // Log ends
      this.$ctx.fillStyle = '#d2691e';
      this.$ctx.fillRect(logX, logY, 6, logHeight);
      this.$ctx.fillRect(logX + logWidth - 6, logY, 6, logHeight);

      this.$ctx.shadowBlur = 0;
    }
  };

  FroggerUx.prototype.drawTurtles = function() {
    for (var i = 0; i < this.$turtles.length; i++) {
      var turtle = this.$turtles[i];

      var centerX = turtle.x * this.GRID_SIZE + (turtle.width * this.GRID_SIZE)/2;
      var centerY = turtle.y * this.GRID_SIZE + this.GRID_SIZE/2;

      // Turtle shell
      this.$ctx.fillStyle = turtle.color;
      this.$ctx.shadowColor = turtle.color;
      this.$ctx.shadowBlur = 6;
      this.$ctx.beginPath();
      this.$ctx.arc(centerX, centerY, 18, 0, Math.PI * 2);
      this.$ctx.fill();

      // Turtle shell pattern
      this.$ctx.fillStyle = '#022c22';
      this.$ctx.beginPath();
      this.$ctx.arc(centerX, centerY, 13, 0, Math.PI * 2);
      this.$ctx.fill();

      // Shell details
      this.$ctx.strokeStyle = '#065f46';
      this.$ctx.lineWidth = 2;
      this.$ctx.beginPath();
      this.$ctx.moveTo(centerX - 10, centerY);
      this.$ctx.lineTo(centerX + 10, centerY);
      this.$ctx.moveTo(centerX, centerY - 10);
      this.$ctx.lineTo(centerX, centerY + 10);
      this.$ctx.stroke();

      // Turtle head
      if (Math.sin(this.$frameCount * 0.05 + i) > 0.5) {
        this.$ctx.fillStyle = '#16a34a';
        this.$ctx.beginPath();
        this.$ctx.arc(centerX, centerY - 20, 5, 0, Math.PI * 2);
        this.$ctx.fill();
      }

      this.$ctx.shadowBlur = 0;
    }
  };

  FroggerUx.prototype.drawFrog = function() {
    var pos = this.getFrogRenderPosition();
    var frogX = pos.x;
    var frogY = pos.y;

    // Frog shadow
    this.$ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.$ctx.beginPath();
    this.$ctx.arc(frogX, frogY + 4, this.FROG_SIZE/2 + 3, 0, Math.PI * 2);
    this.$ctx.fill();

    // Frog body
    this.$ctx.fillStyle = '#22c55e';
    this.$ctx.shadowColor = '#4ade80';
    this.$ctx.shadowBlur = 10;
    this.$ctx.beginPath();
    this.$ctx.arc(frogX, frogY, this.FROG_SIZE/2, 0, Math.PI * 2);
    this.$ctx.fill();

    // Frog spots
    this.$ctx.fillStyle = '#16a34a';
    this.$ctx.beginPath();
    this.$ctx.arc(frogX - 6, frogY - 4, 2.5, 0, Math.PI * 2);
    this.$ctx.arc(frogX + 6, frogY - 4, 2.5, 0, Math.PI * 2);
    this.$ctx.arc(frogX, frogY + 6, 3, 0, Math.PI * 2);
    this.$ctx.fill();

    // Frog eyes
    this.$ctx.fillStyle = '#ffffff';
    this.$ctx.beginPath();
    this.$ctx.arc(frogX - 8, frogY - 10, 5, 0, Math.PI * 2);
    this.$ctx.arc(frogX + 8, frogY - 10, 5, 0, Math.PI * 2);
    this.$ctx.fill();

    this.$ctx.fillStyle = '#000000';
    this.$ctx.beginPath();
    this.$ctx.arc(frogX - 8, frogY - 10, 2.5, 0, Math.PI * 2);
    this.$ctx.arc(frogX + 8, frogY - 10, 2.5, 0, Math.PI * 2);
    this.$ctx.fill();

    // Eye highlights
    this.$ctx.fillStyle = '#ffffff';
    this.$ctx.beginPath();
    this.$ctx.arc(frogX - 7.5, frogY - 10.5, 1, 0, Math.PI * 2);
    this.$ctx.arc(frogX + 8.5, frogY - 10.5, 1, 0, Math.PI * 2);
    this.$ctx.fill();

    this.$ctx.shadowBlur = 0;
  };

  FroggerUx.prototype.drawEffects = function() {
    // Draw particles
    for (var i = 0; i < this.$particles.length; i++) {
      var particle = this.$particles[i];
      var alpha = particle.life / particle.maxLife;

      this.$ctx.save();
      this.$ctx.globalAlpha = alpha;
      this.$ctx.fillStyle = particle.color;

      if (particle.text) {
        this.$ctx.font = 'bold 18px Arial';
        this.$ctx.textAlign = 'center';
        this.$ctx.fillText(particle.text, particle.x, particle.y);
      } else {
        this.$ctx.fillRect(
          particle.x - particle.size/2,
          particle.y - particle.size/2,
          particle.size,
          particle.size
        );
      }

      this.$ctx.restore();
    }

    // Draw water ripples
    for (var i = 0; i < this.$ripples.length; i++) {
      var ripple = this.$ripples[i];

      this.$ctx.save();
      this.$ctx.globalAlpha = ripple.alpha;
      this.$ctx.strokeStyle = '#60a5fa';
      this.$ctx.lineWidth = 2;
      this.$ctx.beginPath();
      this.$ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      this.$ctx.stroke();
      this.$ctx.restore();
    }
  };

  FroggerUx.prototype.createWaterRipple = function(x, y) {
    this.$ripples.push({
      x: x,
      y: y,
      radius: 6,
      alpha: 1
    });
  };

  FroggerUx.prototype.createSuccessEffect = function() {
    for (var i = 0; i < 15; i++) {
      this.$particles.push({
        x: this.CANVAS_WIDTH / 2 + Math.random() * 150 - 75,
        y: 60 + Math.random() * 80,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        size: 5,
        color: '#fbbf24',
        life: 70,
        maxLife: 70
      });
    }
  };

  FroggerUx.prototype.createDeathEffect = function(reason) {
    var pos = this.getFrogRenderPosition();
    for (var i = 0; i < 18; i++) {
      this.$particles.push({
        x: pos.x + Math.random() * 30 - 15,
        y: pos.y + Math.random() * 30 - 15,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
        size: 4,
        color: '#dc2626',
        life: 55,
        maxLife: 55
      });
    }
  };

  FroggerUx.prototype.addScoreParticle = function(x, y, text) {
    this.$particles.push({
      x: x,
      y: y,
      vx: 0,
      vy: -2.5,
      size: 0,
      color: '#fbbf24',
      text: text,
      life: 100,
      maxLife: 100
    });
  };

  FroggerUx.prototype.updateDisplay = function() {
    this.$scoreEl.textContent = this.$score;
    this.$levelEl.textContent = this.$level;
    this.$timeEl.textContent = this.$timeLeft;

    // Update lives display with enhanced styling
    this.$livesEl.innerHTML = '';
    for (var i = 0; i < this.$lives; i++) {
      var life = document.createElement('div');
      life.style.cssText = 'width: 22px; height: 22px; background: #22c55e; border-radius: 50%; display: inline-block; margin: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';
      this.$livesEl.appendChild(life);
    }
  };

  FroggerUx.prototype.doDestroy = function() {
    // Stop game loop
    this.$gameRunning = false;
    if (this.$gameLoopId) {
      clearInterval(this.$gameLoopId);
      this.$gameLoopId = null;
    }

    // Remove event listeners
    if (this.$keydownHandler) {
      document.removeEventListener('keydown', this.$keydownHandler);
      this.$keydownHandler = null;
    }

    // Clear DOM references
    this.$container = null;
    this.$canvas = null;
    this.$ctx = null;
    this.$scoreEl = null;
    this.$levelEl = null;
    this.$timeEl = null;
    this.$livesEl = null;

    // Clear game state
    this.$frog = null;
    this.$cars = null;
    this.$logs = null;
    this.$turtles = null;
    this.$particles = null;
    this.$ripples = null;
    
    Widget.prototype.doDestroy.call(this);
  };

  return FroggerUx;
});