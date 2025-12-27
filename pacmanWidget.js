define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/pacman'
], function(baja, Widget) {
  'use strict';

  var PacmanUx = function() {
    Widget.apply(this, arguments);
    
    // IMPROVED: Larger game configuration
    this.CONFIG = {
      CANVAS_WIDTH: 608,
      CANVAS_HEIGHT: 672,
      CELL_SIZE : 32,
      MAZE_WIDTH: 19,
      MAZE_HEIGHT: 21,
      MOVE_SPEED: 0.06,
      GHOST_SPEED_MULTIPLIER: 0.8,
      POWER_MODE_DURATION: 480,
      COLLISION_THRESHOLD: 0.7,
      GRID_CENTER_THRESHOLD: 0.15,
      GHOST_HOUSE_EXIT_Y: 9
    };

    this.DIRECTIONS = {
      RIGHT: 0, DOWN: 1, LEFT: 2, UP: 3
    };

    this.DIRECTION_VECTORS = {
      0: { x: 1, y: 0 },
      1: { x: 0, y: 1 },
      2: { x: -1, y: 0 },
      3: { x: 0, y: -1 }
    };

    // Game State
    this.state = {
      gameRunning: false,
      gamePaused: false,
      gameOver: false,
      score: 0,
      lives: 3,
      level: 1,
      pelletsCollected: 0,
      totalPellets: 0,
      powerModeTime: 0,
      powerModeActive: false,
      hasStartedMoving: false,
      frameCount: 0,
      gameLoopStarted: false
    };

    // Game Objects
    this.pacman = null;
    this.ghosts = [];
    this.ghostEyes = [];
    this.maze = [];
    this.particles = [];
    this.animations = [];

    // DOM Elements
    this.elements = {
      container: null,
      canvas: null,
      ctx: null,
      scoreEl: null,
      levelEl: null,
      pelletsEl: null,
      livesEl: null,
      overlay: null
    };

    this.handlers = {
      keydown: null
    };

    this.gameLoopId = null;
    this.lastTime = 0;

    // FIXED: Ghost house layout with proper ghost box visibility
    this.MAZE_LAYOUT = [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
      [1,2,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,2,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,0,1],
      [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
      [1,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1],
      [1,1,1,1,0,1,0,0,0,0,0,0,0,1,0,1,1,1,1],
      [1,1,1,1,0,1,0,1,4,4,4,1,0,1,0,1,1,1,1],
      [0,0,0,0,0,0,0,1,4,4,4,1,0,0,0,0,0,0,0],
      [1,1,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,1,1],
      [1,1,1,1,0,1,0,0,0,0,0,0,0,1,0,1,1,1,1],
      [1,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
      [1,2,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,2,1],
      [1,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,1],
      [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
      [1,0,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ];

    // FIXED: All ghosts start in house and are visible
    this.GHOST_CONFIGS = {
      blinky: {
        color: '#ef4444',
        startX: 8, startY: 9,
        personality: 'aggressive',
        releaseDelay: 180
      },
      pinky: {
        color: '#ec4899',
        startX: 9, startY: 8,
        personality: 'ambush',
        releaseDelay: 60
      },
      inky: {
        color: '#06b6d4',
        startX: 9, startY: 9,
        personality: 'patrol',
        releaseDelay: 360
      },
      clyde: {
        color: '#f97316',
        startX: 10, startY: 9,
        personality: 'patrol',
        releaseDelay: 540
      }
    };
  };

  PacmanUx.prototype = Object.create(Widget.prototype);
  PacmanUx.prototype.constructor = PacmanUx;

  // Initialization
  PacmanUx.prototype.doInitialize = function(element) {
    try {
      this.elements.container = this.getElement(element);
      if (!this.elements.container) {
        throw new Error('Failed to get container element');
      }

      this.createGameHTML();
      this.setupCanvas();
      this.bindEvents();
      this.initializeGame();
      this.updateUI();
      this.render();

      console.log('Pac-Man game initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Pac-Man game:', error);
    }
  };

  PacmanUx.prototype.getElement = function(element) {
    if (element && element.nodeType) return element;
    if (element && element.element) return element.element;
    if (element && element[0] && element[0].nodeType) return element[0];
    return element;
  };

  PacmanUx.prototype.createGameHTML = function() {
    this.elements.container.className = 'pacman-widget';
    this.elements.container.innerHTML = [
      '<div class="pacman-header">',
        '<h1 class="pacman-title">PAC-MAN</h1>',
        '<div class="pacman-controls">',
          '<button type="button" class="btn btn-start" id="startBtn">Start</button>',
          '<button type="button" class="btn btn-pause" id="pauseBtn">Pause</button>',
          '<button type="button" class="btn btn-reset" id="resetBtn">Reset</button>',
        '</div>',
      '</div>',
      '<div class="pacman-game-area">',
        '<div class="pacman-canvas-container">',
          '<canvas id="gameCanvas" class="pacman-canvas" width="' + this.CONFIG.CANVAS_WIDTH + '" height="' + this.CONFIG.CANVAS_HEIGHT + '" tabindex="0"></canvas>',
          '<div class="pacman-overlay" id="gameOverlay">',
            '<div class="overlay-content">',
              '<h3 id="overlayTitle">Ready to Play?</h3>',
              '<p id="overlayText">Press START and use arrow keys to move</p>',
            '</div>',
          '</div>',
        '</div>',
        '<div class="pacman-sidebar">',
          '<div class="panel score-panel">',
            '<h3>Game Status</h3>',
            '<div class="stat">',
              '<label>Score</label>',
              '<span class="value score" id="scoreValue">0</span>',
            '</div>',
            '<div class="stat">',
              '<label>Level</label>',
              '<span class="value level" id="levelValue">1</span>',
            '</div>',
            '<div class="stat">',
              '<label>Pellets</label>',
              '<span class="value pellets" id="pelletsValue">0/0</span>',
            '</div>',
          '</div>',
          '<div class="panel lives-panel">',
            '<h3>Lives</h3>',
            '<div class="lives-container" id="livesContainer"></div>',
          '</div>',
          '<div class="panel ghost-panel">',
            '<h3>Ghosts</h3>',
            '<div class="ghost-preview">',
              '<div class="ghost-icon blinky" title="Blinky - Aggressive"></div>',
              '<div class="ghost-icon pinky" title="Pinky - Ambush"></div>',
              '<div class="ghost-icon inky" title="Inky - Patrol"></div>',
              '<div class="ghost-icon clyde" title="Clyde - Random"></div>',
            '</div>',
          '</div>',
          '<div class="panel instructions-panel">',
            '<h3>Instructions</h3>',
            '<div class="instructions">',
              '<div><strong>← → ↑ ↓</strong> Move Pac-Man</div>',
              '<div><strong>●</strong> Collect pellets</div>',
              '<div><strong>◉</strong> Power pellets</div>',
              '<div><strong>👻</strong> Avoid/Eat ghosts</div>',
              '<div>Game starts when you move!</div>',
            '</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
  };

  PacmanUx.prototype.setupCanvas = function() {
    this.elements.canvas = this.findElement('#gameCanvas');
    if (this.elements.canvas) {
      this.elements.ctx = this.elements.canvas.getContext('2d');
    }
    this.elements.overlay = this.findElement('#gameOverlay');

    if (!this.elements.ctx) {
      throw new Error('Failed to get canvas context');
    }

    this.elements.ctx.imageSmoothingEnabled = false;
    this.elements.ctx.textAlign = 'center';
    this.elements.ctx.textBaseline = 'middle';
  };

  PacmanUx.prototype.findElement = function(selector) {
    if (this.elements.container && this.elements.container.querySelector) {
      return this.elements.container.querySelector(selector);
    }
    return null;
  };

  // Event Handling
  PacmanUx.prototype.bindEvents = function() {
    this.bindButtonEvents();
    this.bindKeyboardEvents();
    this.bindCanvasEvents();
  };

  PacmanUx.prototype.bindButtonEvents = function() {
    var that = this;
    var startBtn = this.findElement('#startBtn');
    var pauseBtn = this.findElement('#pauseBtn');
    var resetBtn = this.findElement('#resetBtn');

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
  };

  PacmanUx.prototype.bindKeyboardEvents = function() {
    var that = this;
    this.handlers.keydown = function(e) {
      if (!that.state.gameRunning || that.state.gamePaused) {
        return;
      }

      var direction = that.getDirectionFromKey(e.keyCode);
      if (direction !== null) {
        e.preventDefault();
        e.stopPropagation();
        that.handleInput(direction);
      }
    };

    document.addEventListener('keydown', this.handlers.keydown);
  };

  PacmanUx.prototype.bindCanvasEvents = function() {
    var that = this;
    var canvas = this.elements.canvas;
    if (canvas) {
      canvas.addEventListener('click', function() {
        try {
          canvas.focus();
        } catch (e) {
          // Ignore focus errors
        }
      });
    }
  };

  PacmanUx.prototype.getDirectionFromKey = function(keyCode) {
    switch (keyCode) {
      case 37: return this.DIRECTIONS.LEFT;
      case 38: return this.DIRECTIONS.UP;
      case 39: return this.DIRECTIONS.RIGHT;
      case 40: return this.DIRECTIONS.DOWN;
      default: return null;
    }
  };

  PacmanUx.prototype.handleInput = function(direction) {
    if (!this.state.hasStartedMoving) {
      this.state.hasStartedMoving = true;
      this.pacman.moving = true;
    }
    this.pacman.nextDirection = direction;
  };

  // Game Logic
  PacmanUx.prototype.initializeGame = function() {
    this.initializeMaze();
    this.initializePacman();
    this.initializeGhosts();
    this.resetGameState();
    this.clearEffects();
  };

  PacmanUx.prototype.initializeMaze = function() {
    this.maze = [];
    this.state.totalPellets = 0;

    for (var y = 0; y < this.CONFIG.MAZE_HEIGHT; y++) {
      this.maze[y] = [];
      for (var x = 0; x < this.CONFIG.MAZE_WIDTH; x++) {
        this.maze[y][x] = this.MAZE_LAYOUT[y][x];
        if (this.maze[y][x] === 0 || this.maze[y][x] === 2) {
          this.state.totalPellets++;
        }
      }
    }
  };

  PacmanUx.prototype.initializePacman = function() {
    this.pacman = {
      gridX: 9, gridY: 15,
      pixelX: 9.0, pixelY: 15.0,
      direction: this.DIRECTIONS.RIGHT,
      nextDirection: this.DIRECTIONS.RIGHT,
      speed: this.CONFIG.MOVE_SPEED,
      moving: false,
      mouthPhase: 0
    };
  };

  PacmanUx.prototype.initializeGhosts = function() {
    this.ghosts = [];
    this.ghostEyes = [];
    var ghostNames = Object.keys(this.GHOST_CONFIGS);

    for (var i = 0; i < ghostNames.length; i++) {
      var name = ghostNames[i];
      var config = this.GHOST_CONFIGS[name];
      this.ghosts.push({
        name: name,
        gridX: config.startX,
        gridY: config.startY,
        pixelX: config.startX + 0.0,
        pixelY: config.startY + 0.0,
        direction: this.DIRECTIONS.UP,
        speed: this.CONFIG.MOVE_SPEED * this.CONFIG.GHOST_SPEED_MULTIPLIER,
        color: config.color,
        personality: config.personality,
        mode: 'chase',
        target: { x: 0, y: 0 },
        inHouse: true,
        releaseTimer: config.releaseDelay,
        frightened: false,
        eaten: false
      });
    }
  };

  PacmanUx.prototype.resetGameState = function() {
    this.state.pelletsCollected = 0;
    this.state.powerModeTime = 0;
    this.state.powerModeActive = false;
    this.state.hasStartedMoving = false;
    this.state.frameCount = 0;
  };

  PacmanUx.prototype.clearEffects = function() {
    this.particles = [];
    this.animations = [];
  };

  // Game State Management
  PacmanUx.prototype.startGame = function() {
    try {
      if (this.state.gameLoopStarted && this.state.gameRunning) {
        return;
      }

      if (this.state.gameOver) {
        this.resetGame();
        return;
      }

      this.state.gameRunning = true;
      this.state.gamePaused = false;
      this.state.gameOver = false;

      this.hideOverlay();

      if (!this.state.gameLoopStarted) {
        this.startGameLoop();
      }

      if (this.elements.canvas) {
        try {
          this.elements.canvas.focus();
        } catch (e) {
          // Ignore focus errors
        }
      }

      console.log('Game started');
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  };

  PacmanUx.prototype.pauseGame = function() {
    if (!this.state.gameRunning) return;

    this.state.gamePaused = !this.state.gamePaused;

    if (this.state.gamePaused) {
      this.showOverlay('Game Paused', 'Click PAUSE to resume');
    } else {
      this.hideOverlay();
      if (this.elements.canvas) {
        try {
          this.elements.canvas.focus();
        } catch (e) {
          // Ignore focus errors
        }
      }
    }
  };

  PacmanUx.prototype.resetGame = function() {
    try {
      this.stopGameLoop();

      this.state = {
        gameRunning: false,
        gamePaused: false,
        gameOver: false,
        score: 0,
        lives: 3,
        level: 1,
        pelletsCollected: 0,
        totalPellets: 0,
        powerModeTime: 0,
        powerModeActive: false,
        hasStartedMoving: false,
        frameCount: 0,
        gameLoopStarted: false
      };

      this.initializeGame();
      this.updateUI();
      this.render();
      this.showOverlay('Ready to Play?', 'Press START and use arrow keys to move');

      console.log('Game reset');
    } catch (error) {
      console.error('Failed to reset game:', error);
    }
  };

  // Game Loop
  PacmanUx.prototype.startGameLoop = function() {
    var that = this;
    this.state.gameLoopStarted = true;
    this.lastTime = performance.now();

    function gameLoop(currentTime) {
      try {
        var deltaTime = currentTime - that.lastTime;
        that.lastTime = currentTime;

        if (that.state.gameRunning && !that.state.gamePaused) {
          that.updateGame(deltaTime);
        }

        that.render();

        if (that.state.gameLoopStarted) {
          that.gameLoopId = requestAnimationFrame(gameLoop);
        }
      } catch (error) {
        console.error('Game loop error:', error);
        if (that.state.gameLoopStarted) {
          that.gameLoopId = requestAnimationFrame(gameLoop);
        }
      }
    }

    this.gameLoopId = requestAnimationFrame(gameLoop);
  };

  PacmanUx.prototype.stopGameLoop = function() {
    this.state.gameLoopStarted = false;
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }
  };

  PacmanUx.prototype.updateGame = function(deltaTime) {
    this.state.frameCount++;

    this.updatePowerMode();
    this.updatePacman();
    this.updateGhosts();
    this.updateGhostEyes();
    this.updateParticles();
    this.updateAnimations();

    this.checkCollisions();
    this.checkWinCondition();
    this.updateUI();
  };

  // Entity Updates
  PacmanUx.prototype.updatePowerMode = function() {
    if (this.state.powerModeActive) {
      this.state.powerModeTime--;
      if (this.state.powerModeTime <= 0) {
        this.state.powerModeActive = false;
        for (var i = 0; i < this.ghosts.length; i++) {
          var ghost = this.ghosts[i];
          if (ghost.frightened) {
            ghost.frightened = false;
            ghost.mode = 'chase';
          }
        }
      }
    }
  };

  PacmanUx.prototype.updatePacman = function() {
    if (!this.state.hasStartedMoving) return;

    var pac = this.pacman;

    // More responsive direction changes with proper centering
    if (Math.abs(pac.pixelX - Math.round(pac.pixelX)) < 0.2 &&
        Math.abs(pac.pixelY - Math.round(pac.pixelY)) < 0.2) {
      if (pac.nextDirection !== pac.direction && this.canMove(Math.round(pac.pixelX), Math.round(pac.pixelY), pac.nextDirection)) {
        pac.direction = pac.nextDirection;
        pac.moving = true;
      }
    }

    if (!pac.moving && this.canMove(Math.round(pac.pixelX), Math.round(pac.pixelY), pac.direction)) {
      pac.moving = true;
    }

    if (pac.moving) {
      var dir = this.DIRECTION_VECTORS[pac.direction];
      pac.pixelX += dir.x * pac.speed;
      pac.pixelY += dir.y * pac.speed;
      pac.mouthPhase += pac.speed * 25;

      var newGridX = Math.round(pac.pixelX);
      var newGridY = Math.round(pac.pixelY);

      if (newGridX !== pac.gridX || newGridY !== pac.gridY) {
        pac.gridX = newGridX;
        pac.gridY = newGridY;

        this.handleTunnel(pac);
        this.checkPelletCollection();

        if (!this.canMove(pac.gridX, pac.gridY, pac.direction)) {
          pac.moving = false;
          pac.pixelX = pac.gridX;
          pac.pixelY = pac.gridY;
        }
      }
    }
  };

  PacmanUx.prototype.updateGhosts = function() {
    for (var i = 0; i < this.ghosts.length; i++) {
      this.updateSingleGhost(this.ghosts[i]);
    }
  };

  PacmanUx.prototype.updateSingleGhost = function(ghost) {
    if (ghost.eaten) return;

    if (ghost.inHouse) {
      if (ghost.releaseTimer > 0) {
        ghost.releaseTimer--;
        return;
      } else {
        this.releaseGhost(ghost);
      }
    }

    this.updateGhostAI(ghost);
    this.moveGhost(ghost);
  };

  PacmanUx.prototype.releaseGhost = function(ghost) {
    ghost.inHouse = false;
    ghost.gridX = 9;
    ghost.gridY = this.CONFIG.GHOST_HOUSE_EXIT_Y;
    ghost.pixelX = 9.0;
    ghost.pixelY = this.CONFIG.GHOST_HOUSE_EXIT_Y + 0.0;
    ghost.direction = this.DIRECTIONS.UP;
  };

  PacmanUx.prototype.updateGhostEyes = function() {
    for (var i = this.ghostEyes.length - 1; i >= 0; i--) {
      var eyes = this.ghostEyes[i];

      var targetX = this.GHOST_CONFIGS[eyes.name].startX;
      var targetY = this.GHOST_CONFIGS[eyes.name].startY;

      var dx = targetX - eyes.pixelX;
      var dy = targetY - eyes.pixelY;
      var distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 0.5) {
        var ghost = this.findGhost(eyes.name);
        if (ghost) {
          ghost.eaten = false;
          ghost.inHouse = true;
          ghost.releaseTimer = 240;
          ghost.gridX = targetX;
          ghost.gridY = targetY;
          ghost.pixelX = targetX + 0.0;
          ghost.pixelY = targetY + 0.0;
          ghost.frightened = false;
          ghost.mode = 'chase';
        }
        this.ghostEyes.splice(i, 1);
      } else {
        eyes.pixelX += (dx / distance) * eyes.speed;
        eyes.pixelY += (dy / distance) * eyes.speed;
        eyes.gridX = Math.round(eyes.pixelX);
        eyes.gridY = Math.round(eyes.pixelY);
      }
    }
  };

  PacmanUx.prototype.findGhost = function(name) {
    for (var i = 0; i < this.ghosts.length; i++) {
      if (this.ghosts[i].name === name) {
        return this.ghosts[i];
      }
    }
    return null;
  };

  PacmanUx.prototype.updateGhostAI = function(ghost) {
    if (ghost.frightened) {
      if (this.state.frameCount % 30 === 0) {
        this.changeGhostDirection(ghost);
      }
      return;
    }

    this.setGhostTarget(ghost);

    if (this.isAtGridCenter(ghost) && this.state.frameCount % 12 === 0) {
      this.updateGhostDirection(ghost);
    }
  };

  PacmanUx.prototype.setGhostTarget = function(ghost) {
    var pac = this.pacman;

    switch (ghost.personality) {
      case 'aggressive':
        ghost.target = { x: pac.gridX, y: pac.gridY };
        break;
      case 'ambush':
        var ahead = 4;
        var dir = this.DIRECTION_VECTORS[pac.direction];
        ghost.target = {
          x: pac.gridX + dir.x * ahead,
          y: pac.gridY + dir.y * ahead
        };
        break;
      case 'patrol':
        var distance = this.getDistance(ghost, pac);
        if (distance > 8) {
          ghost.target = { x: pac.gridX, y: pac.gridY };
        } else {
          ghost.target = { x: 0, y: this.CONFIG.MAZE_HEIGHT - 1 };
        }
        break;
      default:
        ghost.target = { x: pac.gridX, y: pac.gridY };
    }
  };

  PacmanUx.prototype.updateGhostDirection = function(ghost) {
    if (!this.isAtGridCenter(ghost)) return;

    var bestDirection = ghost.direction;
    var bestDistance = Infinity;

    for (var dir = 0; dir < 4; dir++) {
      if (dir === (ghost.direction + 2) % 4) continue;

      if (this.canMove(ghost.gridX, ghost.gridY, dir)) {
        var dirVector = this.DIRECTION_VECTORS[dir];
        var testX = ghost.gridX + dirVector.x;
        var testY = ghost.gridY + dirVector.y;
        var distance = this.getDistance({ x: testX, y: testY }, ghost.target);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestDirection = dir;
        }
      }
    }

    if (this.canMove(ghost.gridX, ghost.gridY, bestDirection)) {
      ghost.direction = bestDirection;
    } else {
      this.changeGhostDirection(ghost);
    }
  };

  PacmanUx.prototype.moveGhost = function(ghost) {
    if (ghost.inHouse) return;

    var dir = this.DIRECTION_VECTORS[ghost.direction];
    var newPixelX = ghost.pixelX + dir.x * ghost.speed;
    var newPixelY = ghost.pixelY + dir.y * ghost.speed;
    var newGridX = Math.round(newPixelX);
    var newGridY = Math.round(newPixelY);

    if (newGridX < 0) {
      ghost.gridX = this.CONFIG.MAZE_WIDTH - 1;
      ghost.pixelX = ghost.gridX;
      return;
    } else if (newGridX >= this.CONFIG.MAZE_WIDTH) {
      ghost.gridX = 0;
      ghost.pixelX = 0;
      return;
    }

    if (newGridY >= 0 && newGridY < this.CONFIG.MAZE_HEIGHT &&
        this.maze[newGridY] && this.maze[newGridY][newGridX] !== 1) {

      ghost.pixelX = newPixelX;
      ghost.pixelY = newPixelY;

      if (newGridX !== ghost.gridX || newGridY !== ghost.gridY) {
        ghost.gridX = newGridX;
        ghost.gridY = newGridY;
      }
    } else {
      this.changeGhostDirection(ghost);
      ghost.pixelX = ghost.gridX;
      ghost.pixelY = ghost.gridY;
    }
  };

  PacmanUx.prototype.changeGhostDirection = function(ghost) {
    var validDirections = [];

    for (var dir = 0; dir < 4; dir++) {
      if (this.canMove(ghost.gridX, ghost.gridY, dir)) {
        validDirections.push(dir);
      }
    }

    if (validDirections.length > 0) {
      var nonReverseDirections = [];
      for (var i = 0; i < validDirections.length; i++) {
        if (validDirections[i] !== (ghost.direction + 2) % 4) {
          nonReverseDirections.push(validDirections[i]);
        }
      }

      if (nonReverseDirections.length > 0) {
        ghost.direction = nonReverseDirections[Math.floor(Math.random() * nonReverseDirections.length)];
      } else {
        ghost.direction = validDirections[0];
      }
    }
  };

  // Utility Functions
  PacmanUx.prototype.isAtGridCenter = function(entity) {
    return Math.abs(entity.pixelX - entity.gridX) < this.CONFIG.GRID_CENTER_THRESHOLD &&
           Math.abs(entity.pixelY - entity.gridY) < this.CONFIG.GRID_CENTER_THRESHOLD;
  };

  PacmanUx.prototype.canMove = function(gridX, gridY, direction) {
    var dir = this.DIRECTION_VECTORS[direction];
    var newX = gridX + dir.x;
    var newY = gridY + dir.y;

    // Treat out-of-bounds as empty so tunnels work
    if (newX < 0 || newX >= this.CONFIG.MAZE_WIDTH) {
      return newY >= 0 && newY < this.CONFIG.MAZE_HEIGHT;
    }

    if (newY < 0 || newY >= this.CONFIG.MAZE_HEIGHT) {
      return false;
    }

    return this.maze[newY][newX] !== 1;
  };

  PacmanUx.prototype.handleTunnel = function(entity) {
    if (entity.gridX < 0) {
      entity.gridX = this.CONFIG.MAZE_WIDTH - 1;
      entity.pixelX = entity.gridX;
    } else if (entity.gridX >= this.CONFIG.MAZE_WIDTH) {
      entity.gridX = 0;
      entity.pixelX = 0;
    }
  };

  PacmanUx.prototype.getDistance = function(obj1, obj2) {
    var dx = obj1.x - obj2.x;
    var dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Game Mechanics
  PacmanUx.prototype.checkPelletCollection = function() {
    var x = this.pacman.gridX;
    var y = this.pacman.gridY;

    if (!this.maze[y] || x < 0 || x >= this.CONFIG.MAZE_WIDTH) return;

    var cell = this.maze[y][x];

    if (cell === 0) {
      this.collectPellet(x, y, 10);
    } else if (cell === 2) {
      this.collectPowerPellet(x, y, 50);
    }
  };

  PacmanUx.prototype.collectPellet = function(x, y, points) {
    this.maze[y][x] = 3;
    this.state.score += points;
    this.state.pelletsCollected++;
    this.createPelletParticles(x, y);
    this.createScoreAnimation(x, y, '+' + points);
  };

  // Simplified power pellet without heavy DOM operations
  PacmanUx.prototype.collectPowerPellet = function(x, y, points) {
    this.maze[y][x] = 3;
    this.state.score += points;
    this.state.pelletsCollected++;
    this.state.powerModeActive = true;
    this.state.powerModeTime = this.CONFIG.POWER_MODE_DURATION;

    for (var i = 0; i < this.ghosts.length; i++) {
      var ghost = this.ghosts[i];
      if (!ghost.inHouse && !ghost.eaten) {
        ghost.frightened = true;
        ghost.mode = 'frightened';
        ghost.direction = (ghost.direction + 2) % 4;
      }
    }

    this.createPowerPelletParticles(x, y);
    this.createScoreAnimation(x, y, '+' + points);
  };

  PacmanUx.prototype.checkCollisions = function() {
    for (var i = 0; i < this.ghosts.length; i++) {
      var ghost = this.ghosts[i];
      if (ghost.inHouse || ghost.eaten) continue;

      var distance = this.getDistance(
        { x: this.pacman.pixelX, y: this.pacman.pixelY },
        { x: ghost.pixelX, y: ghost.pixelY }
      );

      if (distance < this.CONFIG.COLLISION_THRESHOLD) {
        if (ghost.frightened) {
          this.eatGhost(ghost);
        } else {
          this.pacmanDies();
          return;
        }
      }
    }
  };

  PacmanUx.prototype.eatGhost = function(ghost) {
    this.state.score += 200;
    ghost.eaten = true;
    ghost.frightened = false;

    this.ghostEyes.push({
      name: ghost.name,
      gridX: ghost.gridX,
      gridY: ghost.gridY,
      pixelX: ghost.pixelX,
      pixelY: ghost.pixelY,
      speed: this.CONFIG.MOVE_SPEED * 1.5
    });

    this.createGhostEatenParticles(ghost.pixelX, ghost.pixelY);
    this.createScoreAnimation(ghost.gridX, ghost.gridY, '+200');
  };

  PacmanUx.prototype.pacmanDies = function() {
    this.state.lives--;
    this.createDeathParticles(this.pacman.pixelX, this.pacman.pixelY);

    if (this.state.lives <= 0) {
      this.gameOver();
    } else {
      this.resetPositions();
    }
  };

  PacmanUx.prototype.resetPositions = function() {
    this.pacman.gridX = 9;
    this.pacman.gridY = 15;
    this.pacman.pixelX = 9.0;
    this.pacman.pixelY = 15.0;
    this.pacman.direction = this.DIRECTIONS.RIGHT;
    this.pacman.moving = false;
    this.state.hasStartedMoving = false;

    for (var i = 0; i < this.ghosts.length; i++) {
      var ghost = this.ghosts[i];
      var config = this.GHOST_CONFIGS[ghost.name];
      ghost.gridX = config.startX;
      ghost.gridY = config.startY;
      ghost.pixelX = config.startX + 0.0;
      ghost.pixelY = config.startY + 0.0;
      ghost.inHouse = true;
      ghost.frightened = false;
      ghost.eaten = false;
      ghost.mode = 'chase';
      ghost.releaseTimer = config.releaseDelay;
    }

    this.ghostEyes = [];
    this.state.powerModeActive = false;
    this.state.powerModeTime = 0;
  };

  PacmanUx.prototype.checkWinCondition = function() {
    if (this.state.pelletsCollected >= this.state.totalPellets) {
      this.levelComplete();
    }
  };

  PacmanUx.prototype.levelComplete = function() {
    var that = this;
    this.state.level++;

    var currentScore = this.state.score;
    var currentLevel = this.state.level;

    this.initializeGame();
    this.state.score = currentScore;
    this.state.level = currentLevel;

    for (var i = 0; i < this.ghosts.length; i++) {
      var ghost = this.ghosts[i];
      ghost.speed += 0.005;
      ghost.releaseTimer = Math.max(60, ghost.releaseTimer - 15);
    }

    this.createLevelCompleteEffect();
    this.showOverlay('Level ' + this.state.level + '!', 'Get ready for the next challenge!');

    setTimeout(function() {
      that.hideOverlay();
    }, 2000);
  };

  PacmanUx.prototype.gameOver = function() {
    this.state.gameRunning = false;
    this.state.gameOver = true;

    this.createGameOverEffect();
    this.showOverlay('Game Over', 'Final Score: ' + this.state.score.toLocaleString() + ' - Press START to play again');
  };

  // Particle Systems
  PacmanUx.prototype.updateParticles = function() {
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var particle = this.particles[i];
      particle.life--;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.02;

      if (particle.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  };

  PacmanUx.prototype.updateAnimations = function() {
    for (var i = this.animations.length - 1; i >= 0; i--) {
      var anim = this.animations[i];
      anim.time++;

      if (anim.time >= anim.duration) {
        this.animations.splice(i, 1);
      }
    }
  };

  PacmanUx.prototype.createPelletParticles = function(x, y) {
    var centerX = x * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;
    var centerY = y * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;

    for (var i = 0; i < 5; i++) {
      this.particles.push({
        x: centerX + (Math.random() - 0.5) * 10,
        y: centerY + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        life: 30,
        maxLife: 30,
        color: '#fbbf24',
        size: 2
      });
    }
  };

  PacmanUx.prototype.createPowerPelletParticles = function(x, y) {
    var centerX = x * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;
    var centerY = y * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;

    for (var i = 0; i < 12; i++) {
      this.particles.push({
        x: centerX + (Math.random() - 0.5) * 20,
        y: centerY + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 60,
        maxLife: 60,
        color: '#fde047',
        size: 3
      });
    }
  };

  PacmanUx.prototype.createGhostEatenParticles = function(x, y) {
    var centerX = x * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;
    var centerY = y * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;

    for (var i = 0; i < 8; i++) {
      this.particles.push({
        x: centerX + (Math.random() - 0.5) * 15,
        y: centerY + (Math.random() - 0.5) * 15,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 45,
        maxLife: 45,
        color: '#ffffff',
        size: 2
      });
    }
  };

  PacmanUx.prototype.createDeathParticles = function(x, y) {
    var centerX = x * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;
    var centerY = y * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;

    for (var i = 0; i < 15; i++) {
      this.particles.push({
        x: centerX + (Math.random() - 0.5) * 20,
        y: centerY + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 60,
        maxLife: 60,
        color: '#ef4444',
        size: 3
      });
    }
  };

  PacmanUx.prototype.createLevelCompleteEffect = function() {
    for (var i = 0; i < 20; i++) {
      this.particles.push({
        x: Math.random() * this.CONFIG.CANVAS_WIDTH,
        y: Math.random() * this.CONFIG.CANVAS_HEIGHT,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 120,
        maxLife: 120,
        color: '#fbbf24',
        size: 4
      });
    }
  };

  PacmanUx.prototype.createGameOverEffect = function() {
    var centerX = this.CONFIG.CANVAS_WIDTH / 2;
    var centerY = this.CONFIG.CANVAS_HEIGHT / 2;

    for (var i = 0; i < 15; i++) {
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 60,
        maxLife: 60,
        color: '#dc2626',
        size: 4
      });
    }
  };

  PacmanUx.prototype.createScoreAnimation = function(x, y, text) {
    this.animations.push({
      type: 'score',
      x: x * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2,
      y: y * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2,
      text: text,
      time: 0,
      duration: 60
    });
  };

  // Rendering
  PacmanUx.prototype.clearCanvas = function() {
    this.elements.ctx.fillStyle = '#000';
    this.elements.ctx.fillRect(0, 0, this.CONFIG.CANVAS_WIDTH, this.CONFIG.CANVAS_HEIGHT);
  };

  // NEW renderMaze + wall + ghost house behavior
  PacmanUx.prototype.render = function() {
    if (!this.elements.ctx) return;

    try {
      this.clearCanvas();
      this.renderMaze();
      this.renderCharacters();
      this.renderGhostEyes();
      this.renderParticles();
      this.renderAnimations();
      this.renderPowerModeEffect();
    } catch (error) {
      console.error('Render error:', error);
    }
  };

  PacmanUx.prototype.renderMaze = function() {
    this.elements.ctx.strokeStyle = '#0ea5e9';
    this.elements.ctx.lineWidth = 3;
    this.elements.ctx.lineCap = 'round';

    for (var y = 0; y < this.CONFIG.MAZE_HEIGHT; y++) {
      for (var x = 0; x < this.CONFIG.MAZE_WIDTH; x++) {
        var cell = this.maze[y][x];
        var drawX = x * this.CONFIG.CELL_SIZE;
        var drawY = y * this.CONFIG.CELL_SIZE;

        switch (cell) {
          case 1:
            this.renderWall(drawX, drawY, x, y);
            break;
          case 0:
            this.renderPellet(drawX + this.CONFIG.CELL_SIZE / 2, drawY + this.CONFIG.CELL_SIZE / 2);
            break;
          case 2:
            this.renderPowerPellet(drawX + this.CONFIG.CELL_SIZE / 2, drawY + this.CONFIG.CELL_SIZE / 2);
            break;
          case 4:
            this.renderGhostHouse(drawX, drawY);
            break;
        }
      }
    }
  };

  // FIX 1: wall neighbour logic so outer blue border isn’t cut off
  PacmanUx.prototype.renderWall = function(x, y, gridX, gridY) {
    var maze = this.maze;
    var W = this.CONFIG.MAZE_WIDTH;
    var H = this.CONFIG.MAZE_HEIGHT;

    var hasWallLeft  = (gridX > 0     && maze[gridY][gridX - 1] === 1);
    var hasWallRight = (gridX < W - 1 && maze[gridY][gridX + 1] === 1);
    var hasWallUp    = (gridY > 0     && maze[gridY - 1][gridX] === 1);
    var hasWallDown  = (gridY < H - 1 && maze[gridY + 1][gridX] === 1);

    var ctx = this.elements.ctx;
    ctx.beginPath();

    if (!hasWallLeft) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + this.CONFIG.CELL_SIZE);
    }
    if (!hasWallRight) {
      ctx.moveTo(x + this.CONFIG.CELL_SIZE, y);
      ctx.lineTo(x + this.CONFIG.CELL_SIZE, y + this.CONFIG.CELL_SIZE);
    }
    if (!hasWallUp) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + this.CONFIG.CELL_SIZE, y);
    }
    if (!hasWallDown) {
      ctx.moveTo(x, y + this.CONFIG.CELL_SIZE);
      ctx.lineTo(x + this.CONFIG.CELL_SIZE, y + this.CONFIG.CELL_SIZE);
    }

    ctx.stroke();
  };

  PacmanUx.prototype.renderPellet = function(x, y) {
    this.elements.ctx.fillStyle = '#fbbf24';
    this.elements.ctx.beginPath();
    this.elements.ctx.arc(x, y, 4, 0, Math.PI * 2);
    this.elements.ctx.fill();
  };

  PacmanUx.prototype.renderPowerPellet = function(x, y) {
    var pulseSize = 10 + Math.sin(this.state.frameCount * 0.3) * 3;
    this.elements.ctx.fillStyle = '#fbbf24';
    this.elements.ctx.shadowColor = '#fbbf24';
    this.elements.ctx.shadowBlur = 15;
    this.elements.ctx.beginPath();
    this.elements.ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
    this.elements.ctx.fill();
    this.elements.ctx.shadowBlur = 0;
  };

  // FIX 2: ghost house as solid darker tiles – no grid stroke
  PacmanUx.prototype.renderGhostHouse = function(x, y) {
    var ctx = this.elements.ctx;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, this.CONFIG.CELL_SIZE, this.CONFIG.CELL_SIZE);
  };

  PacmanUx.prototype.renderCharacters = function() {
    this.renderPacman();
    this.renderGhosts();
  };

  PacmanUx.prototype.renderPacman = function() {
    var x = this.pacman.pixelX * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;
    var y = this.pacman.pixelY * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;
    var radius = this.CONFIG.CELL_SIZE * 0.4;

    this.elements.ctx.fillStyle = '#fbbf24';
    this.elements.ctx.shadowColor = '#fde047';
    this.elements.ctx.shadowBlur = 10;

    var mouthAngle = Math.PI / 4 * Math.abs(Math.sin(this.pacman.mouthPhase * 0.3));

    this.elements.ctx.save();
    this.elements.ctx.translate(x, y);
    this.elements.ctx.rotate(this.pacman.direction * Math.PI / 2);

    this.elements.ctx.beginPath();
    this.elements.ctx.arc(0, 0, radius, mouthAngle, Math.PI * 2 - mouthAngle);
    this.elements.ctx.lineTo(0, 0);
    this.elements.ctx.fill();

    this.elements.ctx.restore();
    this.elements.ctx.shadowBlur = 0;
  };

  PacmanUx.prototype.renderGhosts = function() {
    for (var i = 0; i < this.ghosts.length; i++) {
      var ghost = this.ghosts[i];
      if (ghost.eaten) continue;
      this.renderGhost(ghost, i);
    }
  };

  PacmanUx.prototype.renderGhost = function(ghost, index) {
    var x = ghost.pixelX * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;
    var y = ghost.pixelY * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;
    var size = this.CONFIG.CELL_SIZE * 0.4;

    var color = ghost.color;
    if (ghost.frightened) {
      if (this.state.powerModeTime < 120 && this.state.frameCount % 10 < 5) {
        color = '#ffffff';
      } else {
        color = '#3b82f6';
      }
    }

    this.elements.ctx.fillStyle = color;
    this.elements.ctx.shadowColor = color;
    this.elements.ctx.shadowBlur = 8;

    this.elements.ctx.beginPath();
    this.elements.ctx.arc(x, y - 3, size, Math.PI, 0);

    var waveOffset = Math.sin(this.state.frameCount * 0.2 + index) * 3;
    this.elements.ctx.lineTo(x + size, y + size);
    this.elements.ctx.lineTo(x + size - 6, y + size - 4 + waveOffset);
    this.elements.ctx.lineTo(x + 6, y + size - 4 - waveOffset);
    this.elements.ctx.lineTo(x, y + size);
    this.elements.ctx.lineTo(x - 6, y + size - 4 + waveOffset);
    this.elements.ctx.lineTo(x - size + 6, y + size - 4 - waveOffset);
    this.elements.ctx.lineTo(x - size, y + size);
    this.elements.ctx.closePath();
    this.elements.ctx.fill();

    if (!ghost.frightened) {
      this.elements.ctx.fillStyle = '#ffffff';
      this.elements.ctx.fillRect(x - 8, y - 10, 5, 8);
      this.elements.ctx.fillRect(x + 3, y - 10, 5, 8);

      this.elements.ctx.fillStyle = '#000000';
      this.elements.ctx.fillRect(x - 7, y - 8, 3, 3);
      this.elements.ctx.fillRect(x + 4, y - 8, 3, 3);
    }

    this.elements.ctx.shadowBlur = 0;
  };

  PacmanUx.prototype.renderGhostEyes = function() {
    for (var i = 0; i < this.ghostEyes.length; i++) {
      var eyes = this.ghostEyes[i];
      var x = eyes.pixelX * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;
      var y = eyes.pixelY * this.CONFIG.CELL_SIZE + this.CONFIG.CELL_SIZE / 2;

      this.elements.ctx.fillStyle = '#ffffff';
      this.elements.ctx.fillRect(x - 8, y - 5, 5, 8);
      this.elements.ctx.fillRect(x + 3, y - 5, 5, 8);

      this.elements.ctx.fillStyle = '#000000';
      this.elements.ctx.fillRect(x - 7, y - 3, 3, 3);
      this.elements.ctx.fillRect(x + 4, y - 3, 3, 3);
    }
  };

  PacmanUx.prototype.renderParticles = function() {
    for (var i = 0; i < this.particles.length; i++) {
      var particle = this.particles[i];
      var alpha = particle.life / particle.maxLife;
      this.elements.ctx.save();
      this.elements.ctx.globalAlpha = alpha;
      this.elements.ctx.fillStyle = particle.color;
      this.elements.ctx.beginPath();
      this.elements.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.elements.ctx.fill();
      this.elements.ctx.restore();
    }
  };

  PacmanUx.prototype.renderAnimations = function() {
    for (var i = 0; i < this.animations.length; i++) {
      var anim = this.animations[i];
      if (anim.type === 'score') {
        var alpha = 1 - (anim.time / anim.duration);
        var y = anim.y - anim.time;

        this.elements.ctx.save();
        this.elements.ctx.globalAlpha = alpha;
        this.elements.ctx.fillStyle = '#fbbf24';
        this.elements.ctx.font = 'bold 16px Arial';
        this.elements.ctx.textAlign = 'center';
        this.elements.ctx.fillText(anim.text, anim.x, y);
        this.elements.ctx.restore();
      }
    }
  };

  PacmanUx.prototype.renderPowerModeEffect = function() {
    if (this.state.powerModeActive) {
      var alpha = 0.05 + Math.sin(this.state.frameCount * 0.2) * 0.03;
      this.elements.ctx.fillStyle = 'rgba(251, 191, 36, ' + alpha + ')';
      this.elements.ctx.fillRect(0, 0, this.CONFIG.CANVAS_WIDTH, this.CONFIG.CANVAS_HEIGHT);
    }
  };

  // UI Management
  PacmanUx.prototype.updateUI = function() {
    this.updateScore();
    this.updateLevel();
    this.updatePellets();
    this.updateLives();
  };

  PacmanUx.prototype.updateScore = function() {
    var scoreEl = this.findElement('#scoreValue');
    if (scoreEl) {
      scoreEl.textContent = this.state.score.toLocaleString();
    }
  };

  PacmanUx.prototype.updateLevel = function() {
    var levelEl = this.findElement('#levelValue');
    if (levelEl) {
      levelEl.textContent = this.state.level;
    }
  };

  PacmanUx.prototype.updatePellets = function() {
    var pelletsEl = this.findElement('#pelletsValue');
    if (pelletsEl) {
      pelletsEl.textContent = this.state.pelletsCollected + '/' + this.state.totalPellets;
    }
  };

  PacmanUx.prototype.updateLives = function() {
    var livesEl = this.findElement('#livesContainer');
    if (!livesEl) return;

    livesEl.innerHTML = '';
    for (var i = 0; i < this.state.lives; i++) {
      var life = document.createElement('div');
      life.className = 'life-icon';
      livesEl.appendChild(life);
    }
  };

  PacmanUx.prototype.showOverlay = function(title, text) {
    var overlay = this.elements.overlay;
    var titleEl = this.findElement('#overlayTitle');
    var textEl = this.findElement('#overlayText');

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (overlay && overlay.classList) overlay.classList.remove('hidden');
  };

  PacmanUx.prototype.hideOverlay = function() {
    var overlay = this.elements.overlay;
    if (overlay && overlay.classList) overlay.classList.add('hidden');
  };

  // Cleanup
  PacmanUx.prototype.doDestroy = function() {
    try {
      this.stopGameLoop();
      this.unbindEvents();
      this.clearReferences();

      Widget.prototype.doDestroy.call(this);
      console.log('Pac-Man game destroyed successfully');
    } catch (error) {
      console.error('Error destroying Pac-Man game:', error);
    }
  };

  PacmanUx.prototype.unbindEvents = function() {
    if (this.handlers.keydown) {
      document.removeEventListener('keydown', this.handlers.keydown);
      this.handlers.keydown = null;
    }
  };

  PacmanUx.prototype.clearReferences = function() {
    var keys = Object.keys(this.elements);
    for (var i = 0; i < keys.length; i++) {
      this.elements[keys[i]] = null;
    }

    this.pacman = null;
    this.ghosts = null;
    this.ghostEyes = null;
    this.maze = null;
    this.particles = null;
    this.animations = null;
  };

  return PacmanUx;
});
