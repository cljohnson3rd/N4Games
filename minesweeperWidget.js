define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/minesweeper'
], function(baja, Widget) {
  'use strict';

  var MinesweeperUx = function() {
    var that = this;
    Widget.apply(this, arguments);

    // Game state
    this.$grid = [];
    this.$gameState = 'ready'; // ready, playing, won, lost
    this.$mineCount = 10;
    this.$flagCount = 0;
    this.$revealedCount = 0;
    this.$firstClick = true;
    this.$startTime = null;
    this.$gameTimer = null;
    this.$elapsedTime = 0;

    // Enhanced visual effects
    this.$particles = [];
    this.$explosions = [];
    this.$sparkles = [];
    this.$animationFrame = 0;
    this.$celebrationMode = 0;
    this.$shakeIntensity = 0;

    // Difficulty presets
    this.difficulties = {
      beginner: { width: 9, height: 9, mines: 10 },
      intermediate: { width: 16, height: 16, mines: 40 },
      expert: { width: 30, height: 16, mines: 99 }
    };

    this.$currentDifficulty = 'beginner';
    this.$gridWidth = 9;
    this.$gridHeight = 9;

    // Start animation loop
    this.startAnimationLoop();
  };

  MinesweeperUx.prototype = Object.create(Widget.prototype);
  MinesweeperUx.prototype.constructor = MinesweeperUx;

  // Helper function to safely find elements
  MinesweeperUx.prototype.findElement = function(selector) {
    if (this.$container.querySelector) {
      return this.$container.querySelector(selector);
    } else if (this.$container.nodeType) {
      return this.$container.querySelector(selector);
    } else {
      var elem = this.$container.element || this.$container[0] || this.$container;
      return elem.querySelector ? elem.querySelector(selector) : null;
    }
  };

  MinesweeperUx.prototype.doInitialize = function(element) {
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
      '<div class="minesweeper-container">' +
        '<div class="minesweeper-header">' +
          '<h2>Minesweeper</h2>' +
          '<div class="difficulty-selector">' +
            '<select id="difficulty-select">' +
              '<option value="beginner">Beginner (9×9)</option>' +
              '<option value="intermediate">Intermediate (16×16)</option>' +
              '<option value="expert">Expert (30×16)</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="game-info">' +
          '<div class="mine-counter">' +
            '<div class="digital-display" id="mine-display">010</div>' +
          '</div>' +
          '<div class="game-face">' +
            '<button id="face-button" class="face-button smile">🙂</button>' +
          '</div>' +
          '<div class="timer">' +
            '<div class="digital-display" id="timer-display">000</div>' +
          '</div>' +
        '</div>' +
        '<div class="game-board" id="game-board">' +
          '<!-- Grid will be generated here -->' +
        '</div>' +
        '<div class="game-controls">' +
          '<div class="instructions">' +
            '<div><strong>Left Click:</strong> Reveal cell</div>' +
            '<div><strong>Right Click:</strong> Flag/unflag mine</div>' +
          '</div>' +
        '</div>' +
        '<div class="game-overlay" id="game-overlay" style="display: none;">' +
          '<div class="overlay-content">' +
            '<div class="overlay-message" id="overlay-message"></div>' +
            '<div class="overlay-stats" id="overlay-stats"></div>' +
            '<button id="overlay-new-game">New Game</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Get UI elements
    this.$boardEl = this.findElement('#game-board');
    this.$mineDisplayEl = this.findElement('#mine-display');
    this.$timerDisplayEl = this.findElement('#timer-display');
    this.$faceButtonEl = this.findElement('#face-button');
    this.$difficultySelect = this.findElement('#difficulty-select');
    this.$overlayEl = this.findElement('#game-overlay');
    this.$overlayMessageEl = this.findElement('#overlay-message');
    this.$overlayStatsEl = this.findElement('#overlay-stats');

    // Event listeners
    this.$difficultySelect.addEventListener('change', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.$currentDifficulty = e.target.value;
      that.startNewGame();
    });

    this.$faceButtonEl.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.startNewGame();
    });

    this.findElement('#overlay-new-game').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.startNewGame();
    });

    // Prevent context menu on right-click
    this.$container.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });

    // Initialize game
    this.startNewGame();
  };

  MinesweeperUx.prototype.startAnimationLoop = function() {
    var that = this;
    function animate() {
      that.$animationFrame++;
      that.updateParticles();

      // Update shake effect
      if (that.$shakeIntensity > 0) {
        that.$shakeIntensity *= 0.9;
        if (that.$shakeIntensity < 0.1) {
          that.$shakeIntensity = 0;
        }
      }

      // Update celebration mode
      if (that.$celebrationMode > 0) {
        that.$celebrationMode--;
      }

      requestAnimationFrame(animate);
    }
    animate();
  };

  MinesweeperUx.prototype.createExplosionEffect = function(row, col) {
    var cellRect = this.getCellRect(row, col);
    var centerX = cellRect.x + cellRect.width / 2;
    var centerY = cellRect.y + cellRect.height / 2;

    // Create explosion particles
    for (var i = 0; i < 15; i++) {
      var angle = (i / 15) * Math.PI * 2;
      var speed = 2 + Math.random() * 3;

      this.$particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 40 + Math.random() * 20,
        maxLife: 60,
        color: ['#FF0000', '#FF6600', '#FFAA00', '#666666'][Math.floor(Math.random() * 4)],
        size: 2 + Math.random() * 3
      });
    }

    // Screen shake effect
    this.$shakeIntensity = 15;

    // Add explosion flash
    this.$explosions.push({
      x: centerX,
      y: centerY,
      scale: 0,
      maxScale: 3,
      life: 20
    });
  };

  MinesweeperUx.prototype.createWinEffect = function() {
    // Celebration particles
    for (var i = 0; i < 30; i++) {
      this.$sparkles.push({
        x: Math.random() * this.$container.offsetWidth,
        y: Math.random() * this.$container.offsetHeight,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 80 + Math.random() * 40,
        maxLife: 120,
        color: ['#FFD700', '#FF6B00', '#00FF00', '#0099FF', '#FF00FF'][Math.floor(Math.random() * 5)],
        size: 2 + Math.random() * 2,
        sparkle: Math.random() * 60
      });
    }

    this.$celebrationMode = 300; // 5 seconds at 60fps
  };

  MinesweeperUx.prototype.createFlagEffect = function(row, col) {
    var cellRect = this.getCellRect(row, col);
    var centerX = cellRect.x + cellRect.width / 2;
    var centerY = cellRect.y + cellRect.height / 2;

    // Small flag particles
    for (var i = 0; i < 5; i++) {
      this.$particles.push({
        x: centerX,
        y: centerY,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2 - 1,
        life: 30 + Math.random() * 15,
        maxLife: 45,
        color: '#FF0000',
        size: 1 + Math.random()
      });
    }
  };

  MinesweeperUx.prototype.getCellRect = function(row, col) {
    var cells = this.$boardEl.querySelectorAll('.mine-cell');
    var index = row * this.$gridWidth + col;
    var cell = cells[index];

    if (cell) {
      var rect = cell.getBoundingClientRect();
      var containerRect = this.$container.getBoundingClientRect();
      return {
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height
      };
    }

    return { x: 0, y: 0, width: 25, height: 25 };
  };

  MinesweeperUx.prototype.updateParticles = function() {
    // Update explosion particles
    for (var i = this.$particles.length - 1; i >= 0; i--) {
      var particle = this.$particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.1; // gravity
      particle.vx *= 0.99; // friction
      particle.life--;

      if (particle.life <= 0) {
        this.$particles.splice(i, 1);
      }
    }

    // Update sparkle particles
    for (var i = this.$sparkles.length - 1; i >= 0; i--) {
      var sparkle = this.$sparkles[i];
      sparkle.x += sparkle.vx;
      sparkle.y += sparkle.vy;
      sparkle.sparkle += 0.2;
      sparkle.life--;

      if (sparkle.life <= 0) {
        this.$sparkles.splice(i, 1);
      }
    }

    // Update explosion flashes
    for (var i = this.$explosions.length - 1; i >= 0; i--) {
      var explosion = this.$explosions[i];
      explosion.scale += explosion.maxScale / 20;
      explosion.life--;

      if (explosion.life <= 0) {
        this.$explosions.splice(i, 1);
      }
    }
  };

  MinesweeperUx.prototype.startNewGame = function() {
    var difficulty = this.difficulties[this.$currentDifficulty];
    this.$gridWidth = difficulty.width;
    this.$gridHeight = difficulty.height;
    this.$mineCount = difficulty.mines;

    // Reset game state
    this.$gameState = 'ready';
    this.$flagCount = 0;
    this.$revealedCount = 0;
    this.$firstClick = true;
    this.$elapsedTime = 0;
    this.$shakeIntensity = 0;
    this.$celebrationMode = 0;

    // Clear effects
    this.$particles = [];
    this.$explosions = [];
    this.$sparkles = [];

    // Stop timer
    if (this.$gameTimer) {
      clearInterval(this.$gameTimer);
      this.$gameTimer = null;
    }

    // Initialize grid
    this.initializeGrid();
    this.updateDisplay();
    this.hideOverlay();
    this.setFaceExpression('smile');
  };

  MinesweeperUx.prototype.initializeGrid = function() {
    this.$grid = [];

    for (var row = 0; row < this.$gridHeight; row++) {
      this.$grid[row] = [];
      for (var col = 0; col < this.$gridWidth; col++) {
        this.$grid[row][col] = {
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          adjacentMines: 0,
          row: row,
          col: col
        };
      }
    }

    this.createBoard();
  };

  MinesweeperUx.prototype.placeMines = function(firstClickRow, firstClickCol) {
    var minesPlaced = 0;
    var maxAttempts = this.$gridWidth * this.$gridHeight * 2;
    var attempts = 0;

    while (minesPlaced < this.$mineCount && attempts < maxAttempts) {
      var row = Math.floor(Math.random() * this.$gridHeight);
      var col = Math.floor(Math.random() * this.$gridWidth);

      // Don't place mine on first click or if already has mine
      if ((row === firstClickRow && col === firstClickCol) || this.$grid[row][col].isMine) {
        attempts++;
        continue;
      }

      this.$grid[row][col].isMine = true;
      minesPlaced++;
      attempts++;
    }

    // Calculate adjacent mine counts
    this.calculateAdjacentMines();
  };

  MinesweeperUx.prototype.calculateAdjacentMines = function() {
    for (var row = 0; row < this.$gridHeight; row++) {
      for (var col = 0; col < this.$gridWidth; col++) {
        if (!this.$grid[row][col].isMine) {
          var count = 0;

          // Check all 8 adjacent cells
          for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue; // Skip center cell

              var newRow = row + dr;
              var newCol = col + dc;

              if (this.isValidCell(newRow, newCol) && this.$grid[newRow][newCol].isMine) {
                count++;
              }
            }
          }

          this.$grid[row][col].adjacentMines = count;
        }
      }
    }
  };

  MinesweeperUx.prototype.isValidCell = function(row, col) {
    return row >= 0 && row < this.$gridHeight && col >= 0 && col < this.$gridWidth;
  };

  MinesweeperUx.prototype.createBoard = function() {
    var that = this;
    this.$boardEl.innerHTML = '';

    // Set CSS grid properties
    this.$boardEl.style.gridTemplateColumns = 'repeat(' + this.$gridWidth + ', 25px)';
    this.$boardEl.style.gridTemplateRows = 'repeat(' + this.$gridHeight + ', 25px)';

    // Apply screen shake if active
    if (this.$shakeIntensity > 0) {
      var shakeX = (Math.random() - 0.5) * this.$shakeIntensity;
      var shakeY = (Math.random() - 0.5) * this.$shakeIntensity;
      this.$boardEl.style.transform = 'translate(' + shakeX + 'px, ' + shakeY + 'px)';
    } else {
      this.$boardEl.style.transform = '';
    }

    for (var row = 0; row < this.$gridHeight; row++) {
      for (var col = 0; col < this.$gridWidth; col++) {
        var cellEl = document.createElement('div');
        cellEl.className = 'mine-cell';
        cellEl.dataset.row = row;
        cellEl.dataset.col = col;

        // Add click handlers
        this.addCellEventHandlers(cellEl, row, col);

        this.$boardEl.appendChild(cellEl);
      }
    }
  };

  MinesweeperUx.prototype.addCellEventHandlers = function(cellEl, row, col) {
    var that = this;

    // Left click - reveal cell
    cellEl.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();

      if (that.$gameState === 'ready' || that.$gameState === 'playing') {
        that.revealCell(row, col);
      }
    });

    // Right click - flag/unflag
    cellEl.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      e.stopPropagation();

      if (that.$gameState === 'ready' || that.$gameState === 'playing') {
        that.toggleFlag(row, col);
      }

      return false;
    });

    // Mouse down/up for face expression
    cellEl.addEventListener('mousedown', function(e) {
      if (e.button === 0 && that.$gameState === 'playing') { // Left mouse button
        that.setFaceExpression('worried');
      }
    });

    cellEl.addEventListener('mouseup', function(e) {
      if (that.$gameState === 'playing') {
        that.setFaceExpression('smile');
      }
    });
  };

  MinesweeperUx.prototype.revealCell = function(row, col) {
    if (!this.isValidCell(row, col)) return;

    var cell = this.$grid[row][col];
    if (cell.isRevealed || cell.isFlagged) return;

    // Handle first click
    if (this.$firstClick) {
      this.$firstClick = false;
      this.$gameState = 'playing';
      this.placeMines(row, col);
      this.startTimer();
    }

    // Reveal the cell
    cell.isRevealed = true;
    this.$revealedCount++;

    // Check if mine was hit
    if (cell.isMine) {
      this.createExplosionEffect(row, col);
      this.gameOver(false);
      return;
    }

    // If cell has no adjacent mines, reveal adjacent cells (flood fill)
    if (cell.adjacentMines === 0) {
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          this.revealCell(row + dr, col + dc);
        }
      }
    }

    this.updateDisplay();
    this.checkWinCondition();
  };

  MinesweeperUx.prototype.toggleFlag = function(row, col) {
    if (!this.isValidCell(row, col)) return;

    var cell = this.$grid[row][col];
    if (cell.isRevealed) return;

    if (cell.isFlagged) {
      cell.isFlagged = false;
      this.$flagCount--;
    } else {
      cell.isFlagged = true;
      this.$flagCount++;
      this.createFlagEffect(row, col);
    }

    this.updateDisplay();
  };

  MinesweeperUx.prototype.updateDisplay = function() {
    this.updateMineCounter();
    this.updateTimer();
    this.updateBoard();
  };

  MinesweeperUx.prototype.updateMineCounter = function() {
    var remaining = Math.max(0, this.$mineCount - this.$flagCount);
    this.$mineDisplayEl.textContent = remaining.toString().padStart(3, '0');
  };

  MinesweeperUx.prototype.updateTimer = function() {
    var displayTime = Math.min(999, this.$elapsedTime);
    this.$timerDisplayEl.textContent = displayTime.toString().padStart(3, '0');
  };

  MinesweeperUx.prototype.updateBoard = function() {
    var cells = this.$boardEl.querySelectorAll('.mine-cell');

    // Apply screen shake if active
    if (this.$shakeIntensity > 0) {
      var shakeX = (Math.random() - 0.5) * this.$shakeIntensity;
      var shakeY = (Math.random() - 0.5) * this.$shakeIntensity;
      this.$boardEl.style.transform = 'translate(' + shakeX + 'px, ' + shakeY + 'px)';
    } else {
      this.$boardEl.style.transform = '';
    }

    for (var i = 0; i < cells.length; i++) {
      var cellEl = cells[i];
      var row = parseInt(cellEl.dataset.row);
      var col = parseInt(cellEl.dataset.col);
      var cell = this.$grid[row][col];

      // Reset classes
      cellEl.className = 'mine-cell';
      cellEl.textContent = '';

      if (cell.isRevealed) {
        cellEl.classList.add('revealed');

        if (cell.isMine) {
          cellEl.classList.add('mine');
          if (this.$gameState === 'lost') {
            cellEl.classList.add('exploded');
          }
          cellEl.textContent = '💣';
        } else if (cell.adjacentMines > 0) {
          cellEl.classList.add('number', 'number-' + cell.adjacentMines);
          cellEl.textContent = cell.adjacentMines;
        }
      } else if (cell.isFlagged) {
        cellEl.classList.add('flagged');
        cellEl.textContent = '🚩';
      }

      // Add celebration effect for winning
      if (this.$celebrationMode > 0 && this.$gameState === 'won') {
        var pulse = Math.sin(this.$animationFrame * 0.1 + i * 0.1) * 0.5 + 0.5;
        cellEl.style.boxShadow = '0 0 ' + (5 + pulse * 10) + 'px rgba(255, 215, 0, 0.5)';
      } else {
        cellEl.style.boxShadow = '';
      }
    }
  };

  MinesweeperUx.prototype.startTimer = function() {
    var that = this;
    this.$startTime = Date.now();

    this.$gameTimer = setInterval(function() {
      that.$elapsedTime = Math.floor((Date.now() - that.$startTime) / 1000);
      that.updateTimer();
    }, 1000);
  };

  MinesweeperUx.prototype.checkWinCondition = function() {
    var totalCells = this.$gridWidth * this.$gridHeight;
    var nonMineCells = totalCells - this.$mineCount;

    if (this.$revealedCount === nonMineCells) {
      this.gameOver(true);
    }
  };

  MinesweeperUx.prototype.gameOver = function(won) {
    this.$gameState = won ? 'won' : 'lost';

    // Stop timer
    if (this.$gameTimer) {
      clearInterval(this.$gameTimer);
      this.$gameTimer = null;
    }

    // Update face
    this.setFaceExpression(won ? 'cool' : 'dead');

    // Create effects
    if (won) {
      this.createWinEffect();
    }

    // Reveal all mines if lost
    if (!won) {
      this.revealAllMines();
    }

    // Show overlay after a brief delay
    var that = this;
    setTimeout(function() {
      that.showGameOverMessage(won);
    }, 500);
  };

  MinesweeperUx.prototype.revealAllMines = function() {
    for (var row = 0; row < this.$gridHeight; row++) {
      for (var col = 0; col < this.$gridWidth; col++) {
        var cell = this.$grid[row][col];
        if (cell.isMine && !cell.isRevealed) {
          cell.isRevealed = true;
        }
      }
    }
    this.updateBoard();
  };

  MinesweeperUx.prototype.setFaceExpression = function(expression) {
    var faces = {
      smile: '🙂',
      worried: '😮',
      cool: '😎',
      dead: '😵'
    };

    this.$faceButtonEl.textContent = faces[expression] || faces.smile;
    this.$faceButtonEl.className = 'face-button ' + expression;
  };

  MinesweeperUx.prototype.showGameOverMessage = function(won) {
    var message = won ? 'You Won!' : 'Game Over!';
    var difficulty = this.$currentDifficulty.charAt(0).toUpperCase() + this.$currentDifficulty.slice(1);
    var stats = '';

    if (won) {
      stats = 'Difficulty: ' + difficulty + '<br>' +
              'Time: ' + this.$elapsedTime + ' seconds<br>' +
              'Mines: ' + this.$mineCount;
    } else {
      stats = 'Better luck next time!<br>' +
              'Time survived: ' + this.$elapsedTime + ' seconds';
    }

    this.$overlayMessageEl.textContent = message;
    this.$overlayStatsEl.innerHTML = stats;
    this.$overlayEl.style.display = 'flex';
  };

  MinesweeperUx.prototype.hideOverlay = function() {
    this.$overlayEl.style.display = 'none';
  };

  MinesweeperUx.prototype.doDestroy = function() {
    // Stop timer
    if (this.$gameTimer) {
      clearInterval(this.$gameTimer);
      this.$gameTimer = null;
    }

    // Clear DOM references
    this.$container = null;
    this.$boardEl = null;
    this.$mineDisplayEl = null;
    this.$timerDisplayEl = null;
    this.$faceButtonEl = null;
    this.$difficultySelect = null;
    this.$overlayEl = null;
    this.$overlayMessageEl = null;
    this.$overlayStatsEl = null;

    // Clear game state
    this.$grid = null;
    this.$particles = null;
    this.$explosions = null;
    this.$sparkles = null;

    Widget.prototype.doDestroy.call(this);
  };

  return MinesweeperUx;
});