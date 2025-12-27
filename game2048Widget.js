define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/game2048'
], function(baja, Widget) {
  'use strict';

  var Game2048Ux = function() {
    var that = this;
    Widget.apply(this, arguments);

    // Game state
    this.$grid = [];
    this.$score = 0;
    this.$bestScore = 0;
    this.$gameWon = false;
    this.$gameOver = false;
    this.$gridSize = 4;

    // Enhanced visual effects
    this.$particles = [];
    this.$scoreParticles = [];
    this.$mergeAnimations = [];
    this.$tileAnimations = [];
    this.$animationFrame = 0;
    this.$celebrationMode = 0;

    // Animation handling
    this.$animating = false;
    this.$moveCount = 0;

    // Load best score from localStorage if available
    try {
      this.$bestScore = parseInt(localStorage.getItem('2048-best-score') || '0');
    } catch(e) {
      this.$bestScore = 0;
    }
  };

  Game2048Ux.prototype = Object.create(Widget.prototype);
  Game2048Ux.prototype.constructor = Game2048Ux;

  // Helper function to safely find elements
  Game2048Ux.prototype.findElement = function(selector) {
    if (this.$container.querySelector) {
      return this.$container.querySelector(selector);
    } else if (this.$container.nodeType) {
      return this.$container.querySelector(selector);
    } else {
      var elem = this.$container.element || this.$container[0] || this.$container;
      return elem.querySelector ? elem.querySelector(selector) : null;
    }
  };

  // MINIMAL FIX: Add cleanup function for stuck transforms
  Game2048Ux.prototype.cleanupTileTransforms = function() {
    // Clean up any stuck CSS transforms that cause sizing issues
    var cells = this.$boardEl.querySelectorAll('.tile-cell');
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      // Only clean if there's a transform that might be stuck
      if (cell.style.transform && cell.style.transform.indexOf('scale') !== -1) {
        // Remove only problematic scale transforms, keep other styling
        cell.style.transform = cell.style.transform.replace(/scale\([^)]*\)/g, '');
        if (cell.style.transform.trim() === '') {
          cell.style.transform = '';
        }
      }
    }
  };

  Game2048Ux.prototype.doInitialize = function(element) {
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
      '<div class="game2048-container">' +
        '<div class="game2048-header">' +
          '<h1>2048</h1>' +
          '<div class="score-container">' +
            '<div class="score-box">' +
              '<div class="score-label">Score</div>' +
              '<div class="score-value" id="current-score">0</div>' +
            '</div>' +
            '<div class="score-box">' +
              '<div class="score-label">Best</div>' +
              '<div class="score-value" id="best-score">' + this.$bestScore + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="game2048-controls">' +
          '<button id="new-game-btn">New Game</button>' +
          '<button id="restart-btn">Restart</button>' +
        '</div>' +
        '<div class="game2048-board" id="game-board">' +
          this.createGridHTML() +
        '</div>' +
        '<div class="game2048-instructions">' +
          '<div><strong>HOW TO PLAY:</strong> Use arrow keys to move tiles. When two tiles with the same number touch, they merge into one!</div>' +
          '<div><strong>GOAL:</strong> Reach the 2048 tile!</div>' +
        '</div>' +
        '<div class="game2048-overlay" id="game-overlay" style="display: none;">' +
          '<div class="overlay-content">' +
            '<div class="overlay-message" id="overlay-message"></div>' +
            '<button id="overlay-continue" style="display: none;">Continue</button>' +
            '<button id="overlay-restart">Try Again</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Get element references with safety checks
    this.$boardEl = this.findElement('#game-board');
    this.$scoreEl = this.findElement('#current-score');
    this.$bestScoreEl = this.findElement('#best-score');
    this.$overlayEl = this.findElement('#game-overlay');
    this.$overlayMessageEl = this.findElement('#overlay-message');

    if (!this.$boardEl || !this.$scoreEl || !this.$bestScoreEl) {
      console.error('Game2048: Failed to find required elements');
      return;
    }

    // Button event handlers
    var newGameBtn = this.findElement('#new-game-btn');
    var restartBtn = this.findElement('#restart-btn');
    var continueBtn = this.findElement('#overlay-continue');
    var overlayRestartBtn = this.findElement('#overlay-restart');

    if (newGameBtn) {
      newGameBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        that.startNewGame();
      });
    }

    if (restartBtn) {
      restartBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        that.restartGame();
      });
    }

    if (continueBtn) {
      continueBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        that.hideOverlay();
      });
    }

    if (overlayRestartBtn) {
      overlayRestartBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        that.hideOverlay();
        that.startNewGame();
      });
    }

    // Keyboard controls - listen globally but only respond when game is visible/active
    this.$keydownHandler = function(e) {
      // Only respond if the game widget is in the DOM and not animating
      if (that.$container && document.body.contains(that.$container) && !that.$animating) {
        if (e.keyCode >= 37 && e.keyCode <= 40) {
          e.preventDefault();
          e.stopPropagation();
          that.handleKeyPress(e);
        }
      }
    };

    // Add keyboard listener
    document.addEventListener('keydown', this.$keydownHandler);

    // Make container focusable
    this.$container.tabIndex = 0;
    this.$container.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.$container.focus();
    });

    // Initialize game grid
    this.initializeGrid();

    // Start with new game
    this.startNewGame();

    // Focus container for keyboard input
    this.$container.focus();
  };

  Game2048Ux.prototype.doDestroy = function() {
    if (this.$keydownHandler) {
      document.removeEventListener('keydown', this.$keydownHandler);
    }
  };

  Game2048Ux.prototype.createGridHTML = function() {
    var html = '';
    for (var i = 0; i < this.$gridSize * this.$gridSize; i++) {
      html += '<div class="tile-cell" data-index="' + i + '"></div>';
    }
    return html;
  };

  Game2048Ux.prototype.initializeGrid = function() {
    this.$grid = [];
    for (var row = 0; row < this.$gridSize; row++) {
      this.$grid[row] = [];
      for (var col = 0; col < this.$gridSize; col++) {
        this.$grid[row][col] = 0;
      }
    }
  };

  Game2048Ux.prototype.startNewGame = function() {
    this.initializeGrid();
    this.$score = 0;
    this.$gameWon = false;
    this.$gameOver = false;
    this.$moveCount = 0;
    this.$particles = [];
    this.$scoreParticles = [];
    this.$mergeAnimations = [];
    this.$celebrationMode = 0;
    this.updateScore();
    this.hideOverlay();

    // Add two initial tiles
    this.addRandomTile();
    this.addRandomTile();

    this.updateDisplay();
  };

  Game2048Ux.prototype.restartGame = function() {
    this.startNewGame();
  };

  Game2048Ux.prototype.addRandomTile = function() {
    var emptyCells = [];

    // Find all empty cells
    for (var row = 0; row < this.$gridSize; row++) {
      for (var col = 0; col < this.$gridSize; col++) {
        if (this.$grid[row][col] === 0) {
          emptyCells.push({row: row, col: col});
        }
      }
    }

    if (emptyCells.length === 0) return false;

    // Pick a random empty cell
    var randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];

    // Add 2 (90% chance) or 4 (10% chance)
    var value = Math.random() < 0.9 ? 2 : 4;
    this.$grid[randomCell.row][randomCell.col] = value;

    return true;
  };

  Game2048Ux.prototype.createMergeEffect = function(row, col, value) {
    // Create spectacular merge particles
    var centerX = col * 70 + 35; // Approximate tile center
    var centerY = row * 70 + 35;

    for (var i = 0; i < 8; i++) {
      var angle = (i / 8) * Math.PI * 2;
      this.$particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        life: 30,
        maxLife: 30,
        color: this.getTileColor(value),
        size: 3
      });
    }

    // Score burst effect
    this.$scoreParticles.push({
      x: centerX,
      y: centerY,
      vx: 0,
      vy: -2,
      life: 60,
      maxLife: 60,
      text: '+' + value,
      color: '#f69c3d',
      size: 18
    });

    // Add merge animation
    this.$mergeAnimations.push({
      row: row,
      col: col,
      life: 20,
      scale: 1.2
    });
  };

  Game2048Ux.prototype.getTileColor = function(value) {
    var colors = {
      2: '#eee4da',
      4: '#ede0c8',
      8: '#f2b179',
      16: '#f59563',
      32: '#f67c5f',
      64: '#f65e3b',
      128: '#edcf72',
      256: '#edcc61',
      512: '#edc850',
      1024: '#edc53f',
      2048: '#edc22e'
    };
    return colors[value] || '#3c3a32';
  };

  Game2048Ux.prototype.updateParticles = function() {
    // Update particles
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
  };

  Game2048Ux.prototype.updateAnimations = function() {
    // Update merge animations
    for (var i = this.$mergeAnimations.length - 1; i >= 0; i--) {
      var anim = this.$mergeAnimations[i];
      anim.life--;
      anim.scale = 1 + (0.3 * Math.sin((20 - anim.life) * 0.3));

      if (anim.life <= 0) {
        this.$mergeAnimations.splice(i, 1);
      }
    }
  };

  Game2048Ux.prototype.handleKeyPress = function(e) {
    if (this.$gameOver || this.$animating) return;

    var moved = false;

    switch(e.keyCode) {
      case 37: // Left
        moved = this.move('left');
        break;
      case 38: // Up
        moved = this.move('up');
        break;
      case 39: // Right
        moved = this.move('right');
        break;
      case 40: // Down
        moved = this.move('down');
        break;
    }

    if (moved) {
      this.$moveCount++;
      this.addRandomTile();

      // MINIMAL FIX: Clean up transforms before updating display
      var that = this;
      setTimeout(function() {
        that.cleanupTileTransforms();
      }, 250);

      this.updateDisplay();

      if (this.checkWin() && !this.$gameWon) {
        this.$gameWon = true;
        this.$celebrationMode = 180; // 3 seconds at 60fps
        this.showWinMessage();
      } else if (this.checkGameOver()) {
        this.$gameOver = true;
        this.showGameOverMessage();
      }
    }
  };

  Game2048Ux.prototype.move = function(direction) {
    var moved = false;
    var previousGrid = JSON.parse(JSON.stringify(this.$grid));

    if (direction === 'left') {
      for (var row = 0; row < this.$gridSize; row++) {
        var result = this.processLine(this.$grid[row], row, 'horizontal');
        if (result.moved) moved = true;
        this.$grid[row] = result.line;
      }
    } else if (direction === 'right') {
      for (var row = 0; row < this.$gridSize; row++) {
        var reversed = this.$grid[row].slice().reverse();
        var result = this.processLine(reversed, row, 'horizontal');
        if (result.moved) moved = true;
        this.$grid[row] = result.line.reverse();
      }
    } else if (direction === 'up') {
      for (var col = 0; col < this.$gridSize; col++) {
        var column = [];
        for (var row = 0; row < this.$gridSize; row++) {
          column.push(this.$grid[row][col]);
        }
        var result = this.processLine(column, col, 'vertical');
        if (result.moved) moved = true;
        for (var row = 0; row < this.$gridSize; row++) {
          this.$grid[row][col] = result.line[row];
        }
      }
    } else if (direction === 'down') {
      for (var col = 0; col < this.$gridSize; col++) {
        var column = [];
        for (var row = 0; row < this.$gridSize; row++) {
          column.push(this.$grid[row][col]);
        }
        column.reverse();
        var result = this.processLine(column, col, 'vertical');
        if (result.moved) moved = true;
        column = result.line.reverse();
        for (var row = 0; row < this.$gridSize; row++) {
          this.$grid[row][col] = column[row];
        }
      }
    }

    return moved;
  };

  Game2048Ux.prototype.processLine = function(line, index, direction) {
    var moved = false;
    var merged = [false, false, false, false];

    // Move all tiles to the left (compress)
    var newLine = line.filter(function(val) { return val !== 0; });
    while (newLine.length < 4) {
      newLine.push(0);
    }

    // Check if anything moved during compression
    for (var i = 0; i < 4; i++) {
      if (line[i] !== newLine[i]) {
        moved = true;
        break;
      }
    }

    // Merge tiles and create effects
    for (var i = 0; i < 3; i++) {
      if (newLine[i] !== 0 && newLine[i] === newLine[i + 1] && !merged[i] && !merged[i + 1]) {
        newLine[i] *= 2;
        newLine[i + 1] = 0;
        merged[i] = true;
        moved = true;

        // Update score and create effects
        this.$score += newLine[i];

        // Create merge effects at correct position
        var row, col;
        if (direction === 'horizontal') {
          row = index;
          col = i;
        } else {
          row = i;
          col = index;
        }

        this.createMergeEffect(row, col, newLine[i]);
      }
    }

    // Final compression after merges
    newLine = newLine.filter(function(val) { return val !== 0; });
    while (newLine.length < 4) {
      newLine.push(0);
    }

    return {line: newLine, moved: moved};
  };

  Game2048Ux.prototype.updateDisplay = function() {
    var that = this;
    this.$animating = true;

    // Update tiles
    var cells = this.$boardEl.querySelectorAll('.tile-cell');
    for (var i = 0; i < cells.length; i++) {
      var row = Math.floor(i / this.$gridSize);
      var col = i % this.$gridSize;
      var value = this.$grid[row][col];
      var cell = cells[i];

      // Clear previous classes
      cell.className = 'tile-cell';
      cell.textContent = '';

      if (value > 0) {
        cell.classList.add('tile');
        cell.classList.add('tile-' + value);
        cell.textContent = value;

        // Add animation class for new tiles
        if (this.$moveCount > 0) {
          cell.classList.add('tile-new');
        }

        // Special win tile animation
        if (value === 2048) {
          cell.classList.add('tile-2048');
        }

        // Apply merge animation if exists
        for (var j = 0; j < this.$mergeAnimations.length; j++) {
          var anim = this.$mergeAnimations[j];
          if (anim.row === row && anim.col === col) {
            cell.style.transform = 'scale(' + anim.scale + ')';
            break;
          }
        }
      }
    }

    this.updateScore();

    // Reset animation flag after animation completes
    setTimeout(function() {
      that.$animating = false;
    }, 200);
  };

  Game2048Ux.prototype.updateScore = function() {
    var that = this;
    this.$scoreEl.textContent = this.$score;

    if (this.$score > this.$bestScore) {
      this.$bestScore = this.$score;
      this.$bestScoreEl.textContent = this.$bestScore;
      this.$bestScoreEl.classList.add('score-increase');

      // Save best score
      try {
        localStorage.setItem('2048-best-score', this.$bestScore.toString());
      } catch(e) {
        // localStorage not available
      }

      // Remove animation class after animation
      setTimeout(function() {
        that.$bestScoreEl.classList.remove('score-increase');
      }, 300);
    }
  };

  Game2048Ux.prototype.checkWin = function() {
    for (var row = 0; row < this.$gridSize; row++) {
      for (var col = 0; col < this.$gridSize; col++) {
        if (this.$grid[row][col] === 2048) {
          return true;
        }
      }
    }
    return false;
  };

  Game2048Ux.prototype.checkGameOver = function() {
    // Check if there are any empty cells
    for (var row = 0; row < this.$gridSize; row++) {
      for (var col = 0; col < this.$gridSize; col++) {
        if (this.$grid[row][col] === 0) {
          return false;
        }
      }
    }

    // Check if any merges are possible
    for (var row = 0; row < this.$gridSize; row++) {
      for (var col = 0; col < this.$gridSize; col++) {
        var current = this.$grid[row][col];

        // Check right neighbor
        if (col < this.$gridSize - 1 && this.$grid[row][col + 1] === current) {
          return false;
        }

        // Check bottom neighbor
        if (row < this.$gridSize - 1 && this.$grid[row + 1][col] === current) {
          return false;
        }
      }
    }

    return true;
  };

  Game2048Ux.prototype.showWinMessage = function() {
    this.$overlayMessageEl.textContent = 'You Win!';
    this.findElement('#overlay-continue').style.display = 'inline-block';
    this.$overlayEl.style.display = 'flex';

    // Create celebration particles
    for (var i = 0; i < 30; i++) {
      var angle = Math.random() * Math.PI * 2;
      this.$particles.push({
        x: this.$container.offsetWidth / 2,
        y: this.$container.offsetHeight / 2,
        vx: Math.cos(angle) * (2 + Math.random() * 3),
        vy: Math.sin(angle) * (2 + Math.random() * 3),
        life: 60,
        maxLife: 60,
        color: '#f69c3d',
        size: 4
      });
    }
  };

  Game2048Ux.prototype.showGameOverMessage = function() {
    this.$overlayMessageEl.textContent = 'Game Over!';
    this.findElement('#overlay-continue').style.display = 'none';
    this.$overlayEl.style.display = 'flex';
  };

  Game2048Ux.prototype.hideOverlay = function() {
    this.$overlayEl.style.display = 'none';
  };

  return Game2048Ux;
});