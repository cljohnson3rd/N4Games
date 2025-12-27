define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/tetris'
], function(baja, Widget) {
  'use strict';

  var TetrisUx = function() {
    var that = this;
    Widget.apply(this, arguments);
    
    // Game state
    this.$board = [];
    this.$currentPiece = null;
    this.$nextPiece = null;
    this.$score = 0;
    this.$lines = 0;
    this.$level = 1;
    this.$gameRunning = false;
    this.$gameLoop = null;
    this.$dropTime = 0;
    
    // Enhanced visual effects
    this.$particles = [];
    this.$lineParticles = [];
    this.$ghostPiece = null;
    this.$animationFrame = 0;
    this.$screenShake = 0;
    this.$levelUpEffect = 0;
    this.$gameOverFlag = false;

    // FIXED: Perfect dimensions that match CSS exactly
    this.BOARD_WIDTH = 10;
    this.BOARD_HEIGHT = 20;
    this.CANVAS_WIDTH = 375;     // Exact CSS match
    this.CANVAS_HEIGHT = 600;    // Exact CSS match
    this.CELL_SIZE = 30;         // Clean integer

    // FIXED: Calculate board positioning within canvas
    this.BOARD_PIXEL_WIDTH = this.BOARD_WIDTH * this.CELL_SIZE;  // 300px
    this.BOARD_PIXEL_HEIGHT = this.BOARD_HEIGHT * this.CELL_SIZE; // 600px
    this.BOARD_OFFSET_X = (this.CANVAS_WIDTH - this.BOARD_PIXEL_WIDTH) / 2; // 37.5px offset

    // Next piece canvas constants
    this.NEXT_CANVAS_WIDTH = 120;
    this.NEXT_CANVAS_HEIGHT = 120;

    // Tetris pieces with enhanced definitions
    this.PIECES = {
      'I': {
        rotations: [
          ['....', '####', '....', '....'],  // Horizontal
          ['.#..', '.#..', '.#..', '.#..']   // Vertical
        ],
        color: '#00FFFF',
        glow: '#00AAAA'
      },
      'O': {
        rotations: [['##', '##']],
        color: '#FFFF00',
        glow: '#AAAA00'
      },
      'T': {
        rotations: [
          ['.#.', '###', '...'],
          ['#..', '##.', '#..'],
          ['...', '###', '.#.'],
          ['.#.', '##.', '.#.']
        ],
        color: '#800080',
        glow: '#550055'
      },
      'S': {
        rotations: [
          ['.##', '##.', '...'],
          ['#..', '##.', '.#.']
        ],
        color: '#00FF00',
        glow: '#00AA00'
      },
      'Z': {
        rotations: [
          ['##.', '.##', '...'],
          ['.#.', '##.', '#..']
        ],
        color: '#FF0000',
        glow: '#AA0000'
      },
      'J': {
        rotations: [
          ['#..', '###', '...'],
          ['.##', '.#.', '.#.'],
          ['...', '###', '..#'],
          ['.#.', '.#.', '##.']
        ],
        color: '#0000FF',
        glow: '#0000AA'
      },
      'L': {
        rotations: [
          ['..#', '###', '...'],
          ['.#.', '.#.', '.##'],
          ['...', '###', '#..'],
          ['##.', '.#.', '.#.']
        ],
        color: '#FFA500',
        glow: '#AA6600'
      }
    };
  };

  TetrisUx.prototype = Object.create(Widget.prototype);
  TetrisUx.prototype.constructor = TetrisUx;

  // Helper function to safely find elements
  TetrisUx.prototype.findElement = function(selector) {
    if (this.$container.querySelector) {
      return this.$container.querySelector(selector);
    } else if (this.$container.nodeType) {
      return this.$container.querySelector(selector);
    } else {
      var elem = this.$container.element || this.$container[0] || this.$container;
      return elem.querySelector ? elem.querySelector(selector) : null;
    }
  };

  TetrisUx.prototype.doInitialize = function(element) {
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

    // Create HTML with exact canvas dimensions
    this.$container.innerHTML =
      '<div class="tetris-container">' +
        '<div class="tetris-game">' +
          '<canvas id="tetris-board" width="' + this.CANVAS_WIDTH + '" height="' + this.CANVAS_HEIGHT + '"></canvas>' +
        '</div>' +
        '<div class="tetris-sidebar">' +
          '<div class="tetris-info">' +
            '<div>Score: <span id="score">0</span></div>' +
            '<div>Lines: <span id="lines">0</span></div>' +
            '<div>Level: <span id="level">1</span></div>' +
          '</div>' +
          '<div class="tetris-next">' +
            '<div>Next:</div>' +
            '<canvas id="tetris-next" width="' + this.NEXT_CANVAS_WIDTH + '" height="' + this.NEXT_CANVAS_HEIGHT + '"></canvas>' +
          '</div>' +
          '<div class="tetris-controls">' +
            '<button id="start-btn">Start Game</button>' +
            '<button id="pause-btn">Pause</button>' +
            '<button id="reset-btn">Reset</button>' +
          '</div>' +
          '<div class="tetris-instructions">' +
            '<div><strong>Controls:</strong></div>' +
            '<div>← → Move</div>' +
            '<div>↓ Drop</div>' +
            '<div>↑ Rotate</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Get canvas elements and ensure proper sizing
    this.$canvas = this.findElement('#tetris-board');
    this.$ctx = this.$canvas.getContext('2d');
    this.$nextCanvas = this.findElement('#tetris-next');
    this.$nextCtx = this.$nextCanvas.getContext('2d');

    // FORCE correct canvas dimensions
    this.$canvas.width = this.CANVAS_WIDTH;
    this.$canvas.height = this.CANVAS_HEIGHT;
    this.$nextCanvas.width = this.NEXT_CANVAS_WIDTH;
    this.$nextCanvas.height = this.NEXT_CANVAS_HEIGHT;

    // Get UI elements
    this.$scoreEl = this.findElement('#score');
    this.$linesEl = this.findElement('#lines');
    this.$levelEl = this.findElement('#level');

    // FIXED: Initialize properly without game over
    this.initBoard();
    this.$gameOverFlag = false;
    this.$currentPiece = null;
    this.$nextPiece = null;

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
    this.$keydownHandler = function(e) {
      if (that.$gameRunning && that.$container &&
          (document.activeElement === that.$canvas || that.$container.contains(document.activeElement))) {

        if (e.keyCode >= 37 && e.keyCode <= 40) {
          e.preventDefault();
          e.stopPropagation();
          that.handleKeyPress(e);
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

    this.draw();
  };

  TetrisUx.prototype.initBoard = function() {
    this.$board = [];
    for (var y = 0; y < this.BOARD_HEIGHT; y++) {
      this.$board[y] = [];
      for (var x = 0; x < this.BOARD_WIDTH; x++) {
        this.$board[y][x] = 0;
      }
    }
  };

  TetrisUx.prototype.createPiece = function() {
    var pieces = Object.keys(this.PIECES);
    var randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
    return {
      type: randomPiece,
      shape: this.PIECES[randomPiece].rotations[0],
      x: Math.floor(this.BOARD_WIDTH / 2) - 1,
      y: 0,
      rotation: 0
    };
  };

  TetrisUx.prototype.updateGhostPiece = function() {
    if (!this.$currentPiece) return;

    this.$ghostPiece = Object.assign({}, this.$currentPiece);
    while (this.isValidPosition(this.$ghostPiece)) {
      this.$ghostPiece.y++;
    }
    this.$ghostPiece.y--; // Move back to last valid position
  };

  TetrisUx.prototype.createLineParticles = function(lineY) {
    // Create spectacular line clear particles
    for (var x = 0; x < this.BOARD_WIDTH; x++) {
      for (var i = 0; i < 3; i++) {
        this.$lineParticles.push({
          x: this.BOARD_OFFSET_X + x * this.CELL_SIZE + this.CELL_SIZE / 2,
          y: lineY * this.CELL_SIZE + this.CELL_SIZE / 2,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8 - 2,
          life: 30 + Math.random() * 20,
          maxLife: 50,
          color: ['#FFD700', '#FF6B00', '#FF0000', '#FFFFFF'][Math.floor(Math.random() * 4)],
          size: 2 + Math.random() * 3
        });
      }
    }

    // Screen shake for line clear
    this.$screenShake = 8;
  };

  TetrisUx.prototype.createScoreParticles = function(points) {
    // Score burst particles
    for (var i = 0; i < 5; i++) {
      this.$particles.push({
        x: this.$canvas.width / 2,
        y: this.$canvas.height / 2,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 6 - 2,
        life: 40 + Math.random() * 20,
        maxLife: 60,
        color: '#FFD700',
        size: 3,
        text: '+' + points,
        textLife: 60
      });
    }
  };

  TetrisUx.prototype.rotatePiece = function(piece) {
    var rotations = this.PIECES[piece.type].rotations;
    var newRotation = (piece.rotation + 1) % rotations.length;
    return {
      type: piece.type,
      shape: rotations[newRotation],
      x: piece.x,
      y: piece.y,
      rotation: newRotation
    };
  };

  TetrisUx.prototype.isValidPosition = function(piece) {
    for (var y = 0; y < piece.shape.length; y++) {
      for (var x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x] !== '.') {
          var boardX = piece.x + x;
          var boardY = piece.y + y;

          if (boardX < 0 || boardX >= this.BOARD_WIDTH ||
              boardY >= this.BOARD_HEIGHT ||
              (boardY >= 0 && this.$board[boardY][boardX])) {
            return false;
          }
        }
      }
    }
    return true;
  };

  TetrisUx.prototype.placePiece = function(piece) {
    for (var y = 0; y < piece.shape.length; y++) {
      for (var x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x] !== '.') {
          var boardY = piece.y + y;
          var boardX = piece.x + x;
          if (boardY >= 0) {
            this.$board[boardY][boardX] = piece.type;
          }
        }
      }
    }
  };

  TetrisUx.prototype.clearLines = function() {
    var linesCleared = [];

    // Find complete lines
    for (var y = this.BOARD_HEIGHT - 1; y >= 0; y--) {
      if (this.$board[y].every(function(cell) { return cell !== 0; })) {
        linesCleared.push(y);
      }
    }

    if (linesCleared.length > 0) {
      // Create particle effects for each cleared line
      for (var i = 0; i < linesCleared.length; i++) {
        this.createLineParticles(linesCleared[i]);
      }

      // Remove the lines
      for (var i = 0; i < linesCleared.length; i++) {
        this.$board.splice(linesCleared[i], 1);
        this.$board.unshift(new Array(this.BOARD_WIDTH).fill(0));

        // Adjust line indices for remaining lines
        for (var j = i + 1; j < linesCleared.length; j++) {
          linesCleared[j]++;
        }
      }

      var previousLevel = this.$level;
      this.$lines += linesCleared.length;
      this.$score += linesCleared.length * 100 * this.$level;
      this.$level = Math.floor(this.$lines / 10) + 1;

      // Create score particles
      this.createScoreParticles(linesCleared.length * 100 * this.$level);

      // Level up effect
      if (this.$level > previousLevel) {
        this.$levelUpEffect = 60;
        this.$screenShake = 15;
      }

      this.updateUI();
    }
  };

  TetrisUx.prototype.handleKeyPress = function(e) {
    if (!this.$gameRunning) return;

    var newPiece = Object.assign({}, this.$currentPiece);

    switch(e.keyCode) {
      case 37: // Left
        newPiece.x--;
        break;
      case 39: // Right
        newPiece.x++;
        break;
      case 40: // Down
        newPiece.y++;
        break;
      case 38: // Up (rotate)
        newPiece = this.rotatePiece(newPiece);
        break;
      default:
        return;
    }

    if (this.isValidPosition(newPiece)) {
      this.$currentPiece = newPiece;
      this.updateGhostPiece();
      this.draw();
    }
  };

  TetrisUx.prototype.startGame = function() {
    var that = this;
    this.$gameRunning = true;
    this.$gameOverFlag = false;
    this.$score = 0;
    this.$lines = 0;
    this.$level = 1;
    this.$particles = [];
    this.$lineParticles = [];
    this.$screenShake = 0;
    this.$levelUpEffect = 0;
    this.$animationFrame = 0;

    this.initBoard();
    this.$currentPiece = this.createPiece();
    this.$nextPiece = this.createPiece();
    this.updateGhostPiece();
    this.updateUI();

    this.$dropTime = Date.now();
    this.$gameLoop = setInterval(function() {
      that.gameStep();
    }, 16); // 60fps for smooth animations
  };

  TetrisUx.prototype.pauseGame = function() {
    this.$gameRunning = !this.$gameRunning;
    if (this.$gameRunning) {
      this.$dropTime = Date.now();
    }
  };

  TetrisUx.prototype.resetGame = function() {
    this.$gameRunning = false;
    this.$gameOverFlag = false;
    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
      this.$gameLoop = null;
    }
    this.initBoard();
    this.$currentPiece = null;
    this.$nextPiece = null;
    this.$ghostPiece = null;
    this.$particles = [];
    this.$lineParticles = [];
    this.$score = 0;
    this.$lines = 0;
    this.$level = 1;
    this.$screenShake = 0;
    this.$levelUpEffect = 0;
    this.updateUI();
    this.draw();
  };

  TetrisUx.prototype.gameStep = function() {
    if (!this.$gameRunning) return;

    // Update animation frame
    this.$animationFrame++;

    // Update screen shake
    if (this.$screenShake > 0) {
      this.$screenShake--;
    }

    // Update level up effect
    if (this.$levelUpEffect > 0) {
      this.$levelUpEffect--;
    }

    // Update particles
    this.updateParticles();

    var now = Date.now();
    var dropInterval = Math.max(50, 500 - (this.$level - 1) * 50);

    if (now - this.$dropTime > dropInterval) {
      var newPiece = Object.assign({}, this.$currentPiece);
      newPiece.y++;

      if (this.isValidPosition(newPiece)) {
        this.$currentPiece = newPiece;
        this.updateGhostPiece();
      } else {
        // Piece landed
        this.placePiece(this.$currentPiece);
        this.clearLines();
        this.$currentPiece = this.$nextPiece;
        this.$nextPiece = this.createPiece();
        this.updateGhostPiece();

        // Check game over
        if (!this.isValidPosition(this.$currentPiece)) {
          this.gameOver();
          return;
        }
      }

      this.$dropTime = now;
    }

    this.draw();
  };

  TetrisUx.prototype.updateParticles = function() {
    // Update line particles
    for (var i = this.$lineParticles.length - 1; i >= 0; i--) {
      var particle = this.$lineParticles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.3; // gravity
      particle.vx *= 0.99; // friction
      particle.life--;

      if (particle.life <= 0) {
        this.$lineParticles.splice(i, 1);
      }
    }

    // Update score particles
    for (var i = this.$particles.length - 1; i >= 0; i--) {
      var particle = this.$particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.2;
      particle.life--;
      particle.textLife--;

      if (particle.life <= 0) {
        this.$particles.splice(i, 1);
      }
    }
  };

  TetrisUx.prototype.gameOver = function() {
    this.$gameRunning = false;
    this.$gameOverFlag = true;
    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
      this.$gameLoop = null;
    }

    // Create game over explosion
    for (var i = 0; i < 20; i++) {
      this.$particles.push({
        x: this.$canvas.width / 2,
        y: this.$canvas.height / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 60 + Math.random() * 40,
        maxLife: 100,
        color: '#FF0000',
        size: 3 + Math.random() * 3
      });
    }

    this.draw();
  };

  TetrisUx.prototype.updateUI = function() {
    this.$scoreEl.textContent = this.$score;
    this.$linesEl.textContent = this.$lines;
    this.$levelEl.textContent = this.$level;
  };

  TetrisUx.prototype.drawEnhancedBlock = function(ctx, x, y, size, color, glow, alpha) {
    alpha = alpha || 1;

    // Create gradient for 3D effect
    var gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, this.lightenColor(color, 0.3));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, this.darkenColor(color, 0.3));

    // Draw main block with gradient
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);

    // Add glow effect
    if (glow && alpha > 0.3) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, size, size);
    }

    // Add highlights
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.lightenColor(color, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.stroke();

    // Add shadows
    ctx.strokeStyle = this.darkenColor(color, 0.5);
    ctx.beginPath();
    ctx.moveTo(x + size, y);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x, y + size);
    ctx.stroke();

    ctx.restore();
  };

  TetrisUx.prototype.lightenColor = function(color, percent) {
    var num = parseInt(color.replace("#",""),16);
    var amt = Math.round(2.55 * percent * 100);
    var R = (num >> 16) + amt;
    var B = (num >> 8 & 0x00FF) + amt;
    var G = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1);
  };

  TetrisUx.prototype.darkenColor = function(color, percent) {
    var num = parseInt(color.replace("#",""),16);
    var amt = Math.round(2.55 * percent * 100);
    var R = (num >> 16) - amt;
    var B = (num >> 8 & 0x00FF) - amt;
    var G = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R>1?R<255?R:255:0)*0x10000 + (B>1?B<255?B:255:0)*0x100 + (G>1?G<255?G:255:0)).toString(16).slice(1);
  };

  TetrisUx.prototype.draw = function() {
    // Apply screen shake
    var shakeX = this.$screenShake > 0 ? (Math.random() - 0.5) * this.$screenShake : 0;
    var shakeY = this.$screenShake > 0 ? (Math.random() - 0.5) * this.$screenShake : 0;

    this.$ctx.save();
    this.$ctx.translate(shakeX, shakeY);

    // Clear with enhanced background
    var bgGradient = this.$ctx.createLinearGradient(0, 0, 0, this.$canvas.height);
    bgGradient.addColorStop(0, '#001122');
    bgGradient.addColorStop(1, '#000011');
    this.$ctx.fillStyle = bgGradient;
    this.$ctx.fillRect(0, 0, this.$canvas.width, this.$canvas.height);

    // FIXED: Draw grid with proper offset to center board in canvas
    this.$ctx.strokeStyle = 'rgba(100, 150, 255, 0.2)';
    this.$ctx.lineWidth = 1;

    // Vertical lines with offset
    for (var x = 0; x <= this.BOARD_WIDTH; x++) {
      var lineX = this.BOARD_OFFSET_X + (x * this.CELL_SIZE);
      this.$ctx.beginPath();
      this.$ctx.moveTo(lineX, 0);
      this.$ctx.lineTo(lineX, this.$canvas.height);
      this.$ctx.stroke();
    }

    // Horizontal lines
    for (var y = 0; y <= this.BOARD_HEIGHT; y++) {
      var lineY = y * this.CELL_SIZE;
      this.$ctx.beginPath();
      this.$ctx.moveTo(this.BOARD_OFFSET_X, lineY);
      this.$ctx.lineTo(this.BOARD_OFFSET_X + this.BOARD_PIXEL_WIDTH, lineY);
      this.$ctx.stroke();
    }

    // Draw placed pieces with offset
    for (var y = 0; y < this.BOARD_HEIGHT; y++) {
      for (var x = 0; x < this.BOARD_WIDTH; x++) {
        if (this.$board[y][x]) {
          var pieceInfo = this.PIECES[this.$board[y][x]];
          this.drawEnhancedBlock(
            this.$ctx,
            this.BOARD_OFFSET_X + x * this.CELL_SIZE + 1,
            y * this.CELL_SIZE + 1,
            this.CELL_SIZE - 2,
            pieceInfo.color,
            pieceInfo.glow
          );
        }
      }
    }

    // Draw ghost piece with offset
    if (this.$ghostPiece && this.$currentPiece) {
      var pieceInfo = this.PIECES[this.$currentPiece.type];
      for (var y = 0; y < this.$ghostPiece.shape.length; y++) {
        for (var x = 0; x < this.$ghostPiece.shape[y].length; x++) {
          if (this.$ghostPiece.shape[y][x] !== '.') {
            var drawX = this.BOARD_OFFSET_X + (this.$ghostPiece.x + x) * this.CELL_SIZE + 1;
            var drawY = (this.$ghostPiece.y + y) * this.CELL_SIZE + 1;

            this.$ctx.save();
            this.$ctx.globalAlpha = 0.3;
            this.$ctx.strokeStyle = pieceInfo.color;
            this.$ctx.lineWidth = 2;
            this.$ctx.strokeRect(drawX, drawY, this.CELL_SIZE - 2, this.CELL_SIZE - 2);
            this.$ctx.restore();
          }
        }
      }
    }

    // Draw current piece with offset
    if (this.$currentPiece) {
      var pieceInfo = this.PIECES[this.$currentPiece.type];
      for (var y = 0; y < this.$currentPiece.shape.length; y++) {
        for (var x = 0; x < this.$currentPiece.shape[y].length; x++) {
          if (this.$currentPiece.shape[y][x] !== '.') {
            var drawX = this.BOARD_OFFSET_X + (this.$currentPiece.x + x) * this.CELL_SIZE + 1;
            var drawY = (this.$currentPiece.y + y) * this.CELL_SIZE + 1;

            this.drawEnhancedBlock(
              this.$ctx,
              drawX, drawY,
              this.CELL_SIZE - 2,
              pieceInfo.color,
              pieceInfo.glow
            );
          }
        }
      }
    }

    // Draw particles
    this.drawParticles();

    this.$ctx.restore();

    // Draw level up effect
    if (this.$levelUpEffect > 0) {
      this.$ctx.save();
      this.$ctx.globalAlpha = this.$levelUpEffect / 60;
      this.$ctx.fillStyle = '#FFD700';
      this.$ctx.font = 'bold 32px Arial';
      this.$ctx.textAlign = 'center';
      this.$ctx.fillText('LEVEL UP!', this.$canvas.width / 2, this.$canvas.height / 2);
      this.$ctx.restore();
    }

    // FIXED: Only show game over when actually over
    if (this.$gameOverFlag && !this.$gameRunning) {
      this.$ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      this.$ctx.fillRect(0, 0, this.$canvas.width, this.$canvas.height);

      var pulse = Math.sin(this.$animationFrame * 0.1) * 0.5 + 0.5;
      this.$ctx.fillStyle = 'rgb(' + Math.floor(255 * pulse) + ', 50, 50)';
      this.$ctx.font = 'bold 32px Arial';
      this.$ctx.textAlign = 'center';
      this.$ctx.fillText('GAME OVER', this.$canvas.width / 2, this.$canvas.height / 2 - 40);

      this.$ctx.fillStyle = '#fff';
      this.$ctx.font = '18px Arial';
      this.$ctx.fillText('Score: ' + this.$score, this.$canvas.width / 2, this.$canvas.height / 2 - 10);
      this.$ctx.fillText('Lines: ' + this.$lines, this.$canvas.width / 2, this.$canvas.height / 2 + 15);
      this.$ctx.fillText('Level: ' + this.$level, this.$canvas.width / 2, this.$canvas.height / 2 + 40);
      this.$ctx.fillText('Click Reset to play again', this.$canvas.width / 2, this.$canvas.height / 2 + 70);
    }

    // Draw enhanced next piece
    this.drawNextPiece();
  };

  TetrisUx.prototype.drawParticles = function() {
    // Draw line particles
    for (var i = 0; i < this.$lineParticles.length; i++) {
      var particle = this.$lineParticles[i];
      var alpha = particle.life / particle.maxLife;

      this.$ctx.save();
      this.$ctx.globalAlpha = alpha;
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

    // Draw score particles
    for (var i = 0; i < this.$particles.length; i++) {
      var particle = this.$particles[i];
      var alpha = particle.life / particle.maxLife;

      this.$ctx.save();
      this.$ctx.globalAlpha = alpha;
      this.$ctx.fillStyle = particle.color;
      this.$ctx.shadowColor = particle.color;
      this.$ctx.shadowBlur = 3;
      this.$ctx.fillRect(
        particle.x - particle.size/2,
        particle.y - particle.size/2,
        particle.size,
        particle.size
      );

      // Draw score text
      if (particle.text && particle.textLife > 0) {
        this.$ctx.fillStyle = '#FFD700';
        this.$ctx.font = 'bold 14px Arial';
        this.$ctx.textAlign = 'center';
        this.$ctx.fillText(particle.text, particle.x, particle.y - 10);
      }

      this.$ctx.restore();
    }
  };

  // FIXED: Simple, reliable next piece centering
  TetrisUx.prototype.drawNextPiece = function() {
    // Clear canvas
    this.$nextCtx.fillStyle = '#001122';
    this.$nextCtx.fillRect(0, 0, this.NEXT_CANVAS_WIDTH, this.NEXT_CANVAS_HEIGHT);

    if (this.$nextPiece) {
      var pieceInfo = this.PIECES[this.$nextPiece.type];
      var cellSize = 20;
      var offsetX, offsetY;

      // FIXED: Simple piece-specific centering
      if (this.$nextPiece.type === 'I') {
        // I-piece is 4 blocks wide (horizontal)
        offsetX = (this.NEXT_CANVAS_WIDTH - (4 * cellSize)) / 2;
        offsetY = (this.NEXT_CANVAS_HEIGHT - cellSize) / 2;

        // Draw horizontal line
        for (var x = 0; x < 4; x++) {
          this.drawEnhancedBlock(
            this.$nextCtx,
            offsetX + x * cellSize,
            offsetY,
            cellSize - 1,
            pieceInfo.color,
            pieceInfo.glow
          );
        }
      }
      else if (this.$nextPiece.type === 'O') {
        // O-piece is 2x2
        offsetX = (this.NEXT_CANVAS_WIDTH - (2 * cellSize)) / 2;
        offsetY = (this.NEXT_CANVAS_HEIGHT - (2 * cellSize)) / 2;

        for (var y = 0; y < 2; y++) {
          for (var x = 0; x < 2; x++) {
            this.drawEnhancedBlock(
              this.$nextCtx,
              offsetX + x * cellSize,
              offsetY + y * cellSize,
              cellSize - 1,
              pieceInfo.color,
              pieceInfo.glow
            );
          }
        }
      }
      else {
        // T, S, Z, J, L pieces - all 3 wide, 2 high
        offsetX = (this.NEXT_CANVAS_WIDTH - (3 * cellSize)) / 2;
        offsetY = (this.NEXT_CANVAS_HEIGHT - (2 * cellSize)) / 2;

        for (var y = 0; y < this.$nextPiece.shape.length; y++) {
          for (var x = 0; x < this.$nextPiece.shape[y].length; x++) {
            if (this.$nextPiece.shape[y][x] !== '.') {
              this.drawEnhancedBlock(
                this.$nextCtx,
                offsetX + x * cellSize,
                offsetY + y * cellSize,
                cellSize - 1,
                pieceInfo.color,
                pieceInfo.glow
              );
            }
          }
        }
      }
    }
  };

  TetrisUx.prototype.doDestroy = function() {
    // Stop game loop
    if (this.$gameLoop) {
      clearInterval(this.$gameLoop);
      this.$gameLoop = null;
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
    this.$nextCanvas = null;
    this.$nextCtx = null;
    this.$scoreEl = null;
    this.$linesEl = null;
    this.$levelEl = null;

    // Clear game state
    this.$board = null;
    this.$currentPiece = null;
    this.$nextPiece = null;
    this.$ghostPiece = null;
    this.$particles = null;
    this.$lineParticles = null;
    
    Widget.prototype.doDestroy.call(this);
  };

  return TetrisUx;
});