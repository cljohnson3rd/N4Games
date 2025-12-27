define([
  'baja!',
  'bajaux/Widget',
  'css!nmodule/n4games/rc/solitaire'
], function(baja, Widget) {
  'use strict';

  var SolitaireUx = function() {
    var that = this;
    Widget.apply(this, arguments);

    // Game state
    this.$deck = [];
    this.$stock = [];
    this.$waste = [];
    this.$foundations = [[], [], [], []]; // Hearts, Diamonds, Clubs, Spades
    this.$tableau = [[], [], [], [], [], [], []]; // 7 columns
    this.$score = 0;
    this.$moves = 0;
    this.$startTime = null;

    // Enhanced visual effects
    this.$particles = [];
    this.$cardAnimations = [];
    this.$dealingAnimation = false;
    this.$winCelebration = false;
    this.$animationFrame = 0;
    this.$sparkles = [];
    this.$cardTrails = [];

    // Undo/Redo system
    this.$moveHistory = [];
    this.$redoHistory = [];
    this.$maxHistorySize = 100;

    // Win animation state
    this.$bouncingCards = [];
    this.$winAnimationActive = false;

    // Drag state
    this.$dragData = null;
    this.$dragElement = null;
    this.$isDragging = false;

    // Card definitions
    this.suits = ['♥', '♦', '♣', '♠'];
    this.ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    this.suitNames = ['hearts', 'diamonds', 'clubs', 'spades'];
    this.redSuits = [0, 1]; // Hearts, Diamonds
    this.blackSuits = [2, 3]; // Clubs, Spades
  };

  SolitaireUx.prototype = Object.create(Widget.prototype);
  SolitaireUx.prototype.constructor = SolitaireUx;

  // Helper function to safely find elements
  SolitaireUx.prototype.findElement = function(selector) {
    if (this.$container.querySelector) {
      return this.$container.querySelector(selector);
    } else if (this.$container.nodeType) {
      return this.$container.querySelector(selector);
    } else {
      var elem = this.$container.element || this.$container[0] || this.$container;
      return elem.querySelector ? elem.querySelector(selector) : null;
    }
  };

  SolitaireUx.prototype.doInitialize = function(element) {
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
      '<div class="solitaire-container">' +
        '<div class="solitaire-header">' +
          '<h2>Solitaire</h2>' +
          '<div class="game-stats">' +
            '<div class="stat-item">' +
              '<div class="stat-label">Score</div>' +
              '<div class="stat-value" id="score">0</div>' +
            '</div>' +
            '<div class="stat-item">' +
              '<div class="stat-label">Moves</div>' +
              '<div class="stat-value" id="moves">0</div>' +
            '</div>' +
            '<div class="stat-item">' +
              '<div class="stat-label">Time</div>' +
              '<div class="stat-value" id="time">0:00</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="solitaire-controls">' +
          '<button id="new-game-btn">New Game</button>' +
          '<button id="undo-btn" disabled>Undo</button>' +
          '<button id="redo-btn" disabled>Redo</button>' +
          '<button id="auto-complete-btn">Auto Complete</button>' +
          '<button id="hint-btn">Hint</button>' +
        '</div>' +
        '<div class="solitaire-board">' +
          '<canvas id="particle-canvas" class="particle-overlay"></canvas>' +
          '<div class="top-row">' +
            '<div class="stock-area">' +
              '<div class="stock-pile" id="stock-pile"></div>' +
              '<div class="waste-pile" id="waste-pile"></div>' +
            '</div>' +
            '<div class="foundation-area">' +
              '<div class="foundation-pile glow-ready" id="foundation-0" data-suit="0"></div>' +
              '<div class="foundation-pile glow-ready" id="foundation-1" data-suit="1"></div>' +
              '<div class="foundation-pile glow-ready" id="foundation-2" data-suit="2"></div>' +
              '<div class="foundation-pile glow-ready" id="foundation-3" data-suit="3"></div>' +
            '</div>' +
          '</div>' +
          '<div class="tableau-area">' +
            '<div class="tableau-column" id="tableau-0"></div>' +
            '<div class="tableau-column" id="tableau-1"></div>' +
            '<div class="tableau-column" id="tableau-2"></div>' +
            '<div class="tableau-column" id="tableau-3"></div>' +
            '<div class="tableau-column" id="tableau-4"></div>' +
            '<div class="tableau-column" id="tableau-5"></div>' +
            '<div class="tableau-column" id="tableau-6"></div>' +
          '</div>' +
        '</div>' +
        '<div class="game-overlay" id="game-overlay" style="display: none;">' +
          '<div class="overlay-content">' +
            '<div class="overlay-message" id="overlay-message">You Won!</div>' +
            '<div class="final-stats" id="final-stats"></div>' +
            '<button id="overlay-new-game">New Game</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Get UI elements
    this.$scoreEl = this.findElement('#score');
    this.$movesEl = this.findElement('#moves');
    this.$timeEl = this.findElement('#time');
    this.$stockEl = this.findElement('#stock-pile');
    this.$wasteEl = this.findElement('#waste-pile');
    this.$overlayEl = this.findElement('#game-overlay');
    this.$overlayMessageEl = this.findElement('#overlay-message');
    this.$finalStatsEl = this.findElement('#final-stats');

    // Set up particle canvas
    this.$particleCanvas = this.findElement('#particle-canvas');
    this.$ctx = this.$particleCanvas.getContext('2d');

    // Size the canvas to match the board
    this.$particleCanvas.width = 600;
    this.$particleCanvas.height = 450;

    // Foundation and tableau elements
    this.$foundationEls = [];
    this.$tableauEls = [];
    for (var i = 0; i < 4; i++) {
      this.$foundationEls[i] = this.findElement('#foundation-' + i);
    }
    for (var i = 0; i < 7; i++) {
      this.$tableauEls[i] = this.findElement('#tableau-' + i);
    }

    // Event listeners
    this.findElement('#new-game-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.startNewGame();
    });

    this.findElement('#undo-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.undoMove();
    });

    this.findElement('#redo-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.redoMove();
    });

    this.findElement('#auto-complete-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.autoComplete();
    });

    this.findElement('#hint-btn').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.showHint();
    });

    this.findElement('#overlay-new-game').addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.startNewGame();
    });

    // Stock pile click to draw cards
    this.$stockEl.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      that.drawFromStock();
    });

    // Add drag and drop handlers for foundation and tableau
    this.setupDragAndDrop();

    // Initialize game
    this.startNewGame();
    this.startTimer();

    // Initialize undo/redo buttons
    this.updateUndoRedoButtons();

    // Start animation loop after canvas context is ready
    this.startAnimationLoop();
  };

  SolitaireUx.prototype.startAnimationLoop = function() {
    var that = this;
    function animate() {
      that.$animationFrame++;
      that.updateParticles();
      that.updateCardAnimations();
      that.updateBouncingCards(); // Update bouncing cards animation
      that.draw(); // Draw particles on canvas
      requestAnimationFrame(animate);
    }
    animate();
  };

  SolitaireUx.prototype.saveGameState = function(moveDescription) {
    // Save current game state for undo
    var gameState = {
      stock: JSON.parse(JSON.stringify(this.$stock)),
      waste: JSON.parse(JSON.stringify(this.$waste)),
      foundations: JSON.parse(JSON.stringify(this.$foundations)),
      tableau: JSON.parse(JSON.stringify(this.$tableau)),
      score: this.$score,
      moves: this.$moves,
      description: moveDescription
    };

    this.$moveHistory.push(gameState);

    // Limit history size
    if (this.$moveHistory.length > this.$maxHistorySize) {
      this.$moveHistory.shift();
    }

    // Clear redo history when new move is made
    this.$redoHistory = [];

    this.updateUndoRedoButtons();
  };

  SolitaireUx.prototype.undoMove = function() {
    if (this.$moveHistory.length === 0) return;

    // Save current state to redo history
    var currentState = {
      stock: JSON.parse(JSON.stringify(this.$stock)),
      waste: JSON.parse(JSON.stringify(this.$waste)),
      foundations: JSON.parse(JSON.stringify(this.$foundations)),
      tableau: JSON.parse(JSON.stringify(this.$tableau)),
      score: this.$score,
      moves: this.$moves
    };
    this.$redoHistory.push(currentState);

    // Restore previous state
    var previousState = this.$moveHistory.pop();
    this.$stock = previousState.stock;
    this.$waste = previousState.waste;
    this.$foundations = previousState.foundations;
    this.$tableau = previousState.tableau;
    this.$score = previousState.score;
    this.$moves = previousState.moves;

    // Create undo effect
    this.createUndoEffect();

    this.updateDisplay();
    this.updateStats();
    this.updateUndoRedoButtons();
  };

  SolitaireUx.prototype.redoMove = function() {
    if (this.$redoHistory.length === 0) return;

    // Save current state to move history
    this.saveGameStateForRedo();

    // Restore redo state
    var redoState = this.$redoHistory.pop();
    this.$stock = redoState.stock;
    this.$waste = redoState.waste;
    this.$foundations = redoState.foundations;
    this.$tableau = redoState.tableau;
    this.$score = redoState.score;
    this.$moves = redoState.moves;

    // Create redo effect
    this.createRedoEffect();

    this.updateDisplay();
    this.updateStats();
    this.updateUndoRedoButtons();
  };

  SolitaireUx.prototype.saveGameStateForRedo = function() {
    var gameState = {
      stock: JSON.parse(JSON.stringify(this.$stock)),
      waste: JSON.parse(JSON.stringify(this.$waste)),
      foundations: JSON.parse(JSON.stringify(this.$foundations)),
      tableau: JSON.parse(JSON.stringify(this.$tableau)),
      score: this.$score,
      moves: this.$moves
    };
    this.$moveHistory.push(gameState);
  };

  SolitaireUx.prototype.updateUndoRedoButtons = function() {
    var undoBtn = this.findElement('#undo-btn');
    var redoBtn = this.findElement('#redo-btn');

    if (undoBtn) {
      undoBtn.disabled = this.$moveHistory.length === 0;
      undoBtn.title = this.$moveHistory.length > 0 ?
        'Undo: ' + this.$moveHistory[this.$moveHistory.length - 1].description :
        'No moves to undo';
    }

    if (redoBtn) {
      redoBtn.disabled = this.$redoHistory.length === 0;
      redoBtn.title = this.$redoHistory.length > 0 ? 'Redo move' : 'No moves to redo';
    }
  };

  SolitaireUx.prototype.createUndoEffect = function() {
    // Sparkle effect for undo
    for (var i = 0; i < 15; i++) {
      this.$particles.push({
        x: Math.random() * 600,
        y: Math.random() * 200 + 100,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color: '#FFD700',
        size: 2 + Math.random() * 2
      });
    }
  };

  SolitaireUx.prototype.createRedoEffect = function() {
    // Different colored effect for redo
    for (var i = 0; i < 15; i++) {
      this.$particles.push({
        x: Math.random() * 600,
        y: Math.random() * 200 + 100,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color: '#00FFFF',
        size: 2 + Math.random() * 2
      });
    }
  };

  SolitaireUx.prototype.createDealingEffect = function() {
    // Create spectacular dealing animation particles
    for (var i = 0; i < 15; i++) {
      this.$particles.push({
        x: 100 + Math.random() * 400,
        y: 50 + Math.random() * 100,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 2 + 1,
        life: 60 + Math.random() * 30,
        maxLife: 90,
        color: '#FFD700',
        size: 2 + Math.random() * 2
      });
    }
  };

  SolitaireUx.prototype.createCardMoveEffect = function(fromX, fromY, toX, toY) {
    // Create trail effect for card movement
    var dx = toX - fromX;
    var dy = toY - fromY;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(10, Math.floor(distance / 20));

    for (var i = 0; i < steps; i++) {
      var progress = i / steps;
      this.$cardTrails.push({
        x: fromX + dx * progress,
        y: fromY + dy * progress,
        life: 20 + Math.random() * 10,
        maxLife: 30,
        color: '#FFFFFF',
        size: 3 + Math.random() * 2,
        delay: i * 2
      });
    }
  };

  SolitaireUx.prototype.createWinCelebration = function() {
    // Microsoft-style bouncing cards celebration!
    this.$winCelebration = true;
    this.$winAnimationActive = true;
    this.$bouncingCards = [];

    // Create bouncing cards from all foundation piles
    for (var f = 0; f < 4; f++) {
      var foundation = this.$foundations[f];
      for (var i = 0; i < foundation.length; i++) {
        var card = foundation[i];

        // Get foundation position
        var foundationEl = this.$foundationEls[f];
        var rect = foundationEl.getBoundingClientRect();
        var containerRect = this.$container.getBoundingClientRect();

        var startX = rect.left - containerRect.left + rect.width / 2;
        var startY = rect.top - containerRect.top + rect.height / 2;

        // Create bouncing card with random velocity
        this.$bouncingCards.push({
          card: card,
          x: startX,
          y: startY,
          vx: (Math.random() - 0.5) * 12, // Horizontal velocity
          vy: -(Math.random() * 8 + 5),   // Initial upward velocity
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 20,
          gravity: 0.5,
          bounce: 0.7,
          life: 300 + Math.random() * 100,
          maxLife: 400,
          delay: i * 100 + f * 50 // Staggered release
        });
      }
    }

    // Add extra sparkle effects
    for (var i = 0; i < 100; i++) {
      this.$sparkles.push({
        x: Math.random() * 600,
        y: Math.random() * 400,
        vx: (Math.random() - 0.5) * 10,
        vy: -Math.random() * 8 - 3,
        life: 120 + Math.random() * 60,
        maxLife: 180,
        color: ['#FFD700', '#FF6B00', '#00FF00', '#0099FF', '#FF00FF', '#FFFFFF'][Math.floor(Math.random() * 6)],
        size: 3 + Math.random() * 4,
        sparkle: Math.random() * 60
      });
    }

    // FIXED: Removed automatic victory message - now handled by updateBouncingCards when animation completes
    // Show victory message after brief delay
    // var that = this;
    // setTimeout(function() {
    //   that.showWinMessage();
    // }, 2000);
  };

  SolitaireUx.prototype.updateBouncingCards = function() {
    if (!this.$winAnimationActive) return;

    for (var i = this.$bouncingCards.length - 1; i >= 0; i--) {
      var bouncingCard = this.$bouncingCards[i];

      // Handle delay
      if (bouncingCard.delay > 0) {
        bouncingCard.delay -= 16; // Assuming 60fps
        continue;
      }

      // Update physics
      bouncingCard.x += bouncingCard.vx;
      bouncingCard.y += bouncingCard.vy;
      bouncingCard.vy += bouncingCard.gravity; // Gravity
      bouncingCard.rotation += bouncingCard.rotationSpeed;

      // Bounce off bottom
      if (bouncingCard.y > 450 && bouncingCard.vy > 0) {
        bouncingCard.y = 450;
        bouncingCard.vy *= -bouncingCard.bounce;
        bouncingCard.vx *= 0.9; // Friction

        // Create bounce particles
        for (var j = 0; j < 5; j++) {
          this.$particles.push({
            x: bouncingCard.x + (Math.random() - 0.5) * 20,
            y: bouncingCard.y,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 4 - 1,
            life: 20,
            maxLife: 20,
            color: '#FFD700',
            size: 2
          });
        }
      }

      // Bounce off sides
      if ((bouncingCard.x < 0 && bouncingCard.vx < 0) ||
          (bouncingCard.x > 600 && bouncingCard.vx > 0)) {
        bouncingCard.vx *= -0.8;
      }

      // Remove when life expires
      bouncingCard.life--;
      if (bouncingCard.life <= 0) {
        this.$bouncingCards.splice(i, 1);
      }
    }

    // Stop animation when no more bouncing cards
    if (this.$bouncingCards.length === 0) {
      this.$winAnimationActive = false;

      // FIXED: Show win message now that animation is complete
      var that = this;
      setTimeout(function() {
        that.showWinMessage();
      }, 500); // Brief delay after animation ends for dramatic effect
    }
  };

  SolitaireUx.prototype.createFoundationCompleteEffect = function(foundationIndex) {
    var foundationEl = this.$foundationEls[foundationIndex];
    var rect = foundationEl.getBoundingClientRect();
    var containerRect = this.$container.getBoundingClientRect();

    var centerX = rect.left - containerRect.left + rect.width / 2;
    var centerY = rect.top - containerRect.top + rect.height / 2;

    for (var i = 0; i < 12; i++) {
      var angle = (i / 12) * Math.PI * 2;
      this.$particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * 4,
        vy: Math.sin(angle) * 4,
        life: 40 + Math.random() * 20,
        maxLife: 60,
        color: foundationIndex < 2 ? '#FF0000' : '#000000', // Red for hearts/diamonds
        size: 3 + Math.random() * 2
      });
    }
  };

  SolitaireUx.prototype.updateParticles = function() {
    // Update main particles
    for (var i = this.$particles.length - 1; i >= 0; i--) {
      var particle = this.$particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.2; // gravity
      particle.vx *= 0.99;
      particle.life--;

      if (particle.life <= 0) {
        this.$particles.splice(i, 1);
      }
    }

    // Update sparkles
    for (var i = this.$sparkles.length - 1; i >= 0; i--) {
      var sparkle = this.$sparkles[i];
      sparkle.x += sparkle.vx;
      sparkle.y += sparkle.vy;
      sparkle.vy += 0.1;
      sparkle.sparkle += 0.3;
      sparkle.life--;

      if (sparkle.life <= 0) {
        this.$sparkles.splice(i, 1);
      }
    }

    // Update card trails
    for (var i = this.$cardTrails.length - 1; i >= 0; i--) {
      var trail = this.$cardTrails[i];
      if (trail.delay > 0) {
        trail.delay--;
        continue;
      }
      trail.life--;

      if (trail.life <= 0) {
        this.$cardTrails.splice(i, 1);
      }
    }
  };

  SolitaireUx.prototype.updateCardAnimations = function() {
    // Update any active card animations
    for (var i = this.$cardAnimations.length - 1; i >= 0; i--) {
      var anim = this.$cardAnimations[i];
      anim.frame++;

      if (anim.frame >= anim.duration) {
        if (anim.callback) {
          anim.callback();
        }
        this.$cardAnimations.splice(i, 1);
      }
    }
  };

  SolitaireUx.prototype.draw = function() {
    if (!this.$ctx) return;

    // Clear canvas
    this.$ctx.clearRect(0, 0, this.$particleCanvas.width, this.$particleCanvas.height);

    // Draw particles
    for (var i = 0; i < this.$particles.length; i++) {
      var particle = this.$particles[i];
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

    // Draw sparkles
    for (var i = 0; i < this.$sparkles.length; i++) {
      var sparkle = this.$sparkles[i];
      var alpha = sparkle.life / sparkle.maxLife;
      var pulse = Math.sin(sparkle.sparkle) * 0.5 + 0.5;

      this.$ctx.save();
      this.$ctx.globalAlpha = alpha * pulse;
      this.$ctx.fillStyle = sparkle.color;
      this.$ctx.shadowColor = sparkle.color;
      this.$ctx.shadowBlur = 8;
      this.$ctx.fillRect(
        sparkle.x - sparkle.size/2,
        sparkle.y - sparkle.size/2,
        sparkle.size,
        sparkle.size
      );
      this.$ctx.restore();
    }

    // Draw card trails
    for (var i = 0; i < this.$cardTrails.length; i++) {
      var trail = this.$cardTrails[i];
      if (trail.delay > 0) continue;

      var alpha = trail.life / trail.maxLife;

      this.$ctx.save();
      this.$ctx.globalAlpha = alpha * 0.6;
      this.$ctx.fillStyle = trail.color;
      this.$ctx.shadowColor = trail.color;
      this.$ctx.shadowBlur = 3;
      this.$ctx.fillRect(
        trail.x - trail.size/2,
        trail.y - trail.size/2,
        trail.size,
        trail.size
      );
      this.$ctx.restore();
    }

    // Draw bouncing cards for win animation
    if (this.$winAnimationActive) {
      for (var i = 0; i < this.$bouncingCards.length; i++) {
        var bouncingCard = this.$bouncingCards[i];

        if (bouncingCard.delay > 0) continue;

        this.$ctx.save();
        this.$ctx.translate(bouncingCard.x, bouncingCard.y);
        this.$ctx.rotate(bouncingCard.rotation * Math.PI / 180);

        // Draw card back (simplified for performance)
        var cardWidth = 60;
        var cardHeight = 84;

        // Card shadow
        this.$ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.$ctx.fillRect(-cardWidth/2 + 2, -cardHeight/2 + 2, cardWidth, cardHeight);

        // Card face with suit color
        var isRed = bouncingCard.card.isRed;
        this.$ctx.fillStyle = '#ffffff';
        this.$ctx.fillRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight);

        // Card border
        this.$ctx.strokeStyle = '#333333';
        this.$ctx.lineWidth = 1;
        this.$ctx.strokeRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight);

        // Card symbol in center
        this.$ctx.fillStyle = isRed ? '#dc3545' : '#000000';
        this.$ctx.font = 'bold 24px Arial';
        this.$ctx.textAlign = 'center';
        this.$ctx.fillText(bouncingCard.card.symbol, 0, 8);

        this.$ctx.restore();
      }
    }
  };

  SolitaireUx.prototype.createDeck = function() {
    this.$deck = [];
    var id = 0;

    for (var suit = 0; suit < 4; suit++) {
      for (var rank = 0; rank < 13; rank++) {
        this.$deck.push({
          id: id++,
          suit: suit,
          rank: rank,
          faceUp: false,
          symbol: this.suits[suit],
          rankText: this.ranks[rank],
          isRed: this.redSuits.includes(suit),
          value: rank + 1 // Ace = 1, King = 13
        });
      }
    }
  };

  SolitaireUx.prototype.shuffleDeck = function() {
    for (var i = this.$deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = this.$deck[i];
      this.$deck[i] = this.$deck[j];
      this.$deck[j] = temp;
    }
  };

  SolitaireUx.prototype.startNewGame = function() {
    var that = this;

    // Reset game state
    this.$score = 0;
    this.$moves = 0;
    this.$startTime = Date.now();
    this.$stock = [];
    this.$waste = [];
    this.$foundations = [[], [], [], []];
    this.$tableau = [[], [], [], [], [], [], []];
    this.$particles = [];
    this.$sparkles = [];
    this.$cardTrails = [];
    this.$winCelebration = false;
    this.$winAnimationActive = false;
    this.$bouncingCards = [];

    // Clear move history for undo/redo
    this.$moveHistory = [];
    this.$redoHistory = [];
    this.updateUndoRedoButtons();

    // Create and shuffle deck
    this.createDeck();
    this.shuffleDeck();

    // Start dealing animation
    this.$dealingAnimation = true;
    this.createDealingEffect();

    // Deal cards to tableau with animation delay
    var cardIndex = 0;
    var dealDelay = 0;

    for (var col = 0; col < 7; col++) {
      for (var row = 0; row <= col; row++) {
        (function(cardIdx, column, rowIdx, delay) {
          setTimeout(function() {
            var card = that.$deck[cardIdx];
            card.faceUp = (rowIdx === column); // Top card is face up
            that.$tableau[column].push(card);

            if (card.faceUp) {
              that.createCardFlipEffect(column);
            }

            // Update display after each card
            that.updateDisplay();

            // Check if dealing is complete
            if (cardIdx === 27) { // Last tableau card (7+6+5+4+3+2+1 = 28 cards, 0-indexed)
              that.$dealingAnimation = false;
            }
          }, delay);
        })(cardIndex, col, row, dealDelay);

        cardIndex++;
        dealDelay += 100; // 100ms between each card
      }
    }

    // Remaining cards go to stock (after dealing completes)
    setTimeout(function() {
      for (var i = cardIndex; i < that.$deck.length; i++) {
        that.$stock.push(that.$deck[i]);
      }
      that.updateDisplay();
    }, dealDelay + 100);

    this.hideOverlay();
    this.updateStats();
  };

  SolitaireUx.prototype.createCardFlipEffect = function(column) {
    // Add flip effect particles
    for (var i = 0; i < 5; i++) {
      this.$particles.push({
        x: 100 + column * 80,
        y: 200,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 1,
        life: 20 + Math.random() * 15,
        maxLife: 35,
        color: '#FFD700',
        size: 2
      });
    }
  };

  SolitaireUx.prototype.setupDragAndDrop = function() {
    var that = this;

    // Foundation drop zones
    for (var i = 0; i < 4; i++) {
      this.setupDropZone(this.$foundationEls[i], 'foundation', i);
    }

    // Tableau drop zones
    for (var i = 0; i < 7; i++) {
      this.setupDropZone(this.$tableauEls[i], 'tableau', i);
    }

    // Global drag events
    document.addEventListener('dragover', function(e) {
      if (that.$isDragging) {
        e.preventDefault();
      }
    });

    document.addEventListener('drop', function(e) {
      if (that.$isDragging) {
        e.preventDefault();
        that.endDrag();
      }
    });
  };

  SolitaireUx.prototype.setupDropZone = function(element, type, index) {
    var that = this;

    element.addEventListener('dragover', function(e) {
      if (that.$isDragging) {
        e.preventDefault();
        element.classList.add('drag-over');
      }
    });

    element.addEventListener('dragleave', function(e) {
      element.classList.remove('drag-over');
    });

    element.addEventListener('drop', function(e) {
      e.preventDefault();
      element.classList.remove('drag-over');

      if (that.$dragData) {
        that.handleDrop(type, index);
      }
    });
  };

  SolitaireUx.prototype.makeCardDraggable = function(cardEl, card, source, sourceIndex, cardIndex) {
    var that = this;

    cardEl.draggable = true;
    cardEl.addEventListener('dragstart', function(e) {
      that.$dragData = {
        card: card,
        source: source,
        sourceIndex: sourceIndex,
        cardIndex: cardIndex
      };
      that.$dragElement = cardEl;
      that.$isDragging = true;

      cardEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    cardEl.addEventListener('dragend', function(e) {
      cardEl.classList.remove('dragging');
      that.endDrag();
    });

    // Double-click for auto-move to foundation
    cardEl.addEventListener('dblclick', function(e) {
      e.preventDefault();
      that.tryAutoMoveToFoundation(card, source, sourceIndex, cardIndex);
    });
  };

  SolitaireUx.prototype.endDrag = function() {
    this.$isDragging = false;
    this.$dragData = null;
    this.$dragElement = null;

    // Remove drag-over classes
    var dropZones = this.$container.querySelectorAll('.drag-over');
    for (var i = 0; i < dropZones.length; i++) {
      dropZones[i].classList.remove('drag-over');
    }
  };

  SolitaireUx.prototype.handleDrop = function(targetType, targetIndex) {
    var dragData = this.$dragData;
    var validMove = false;
    var moveDescription = '';

    if (targetType === 'foundation') {
      if (this.canMoveToFoundation(dragData.card, targetIndex)) {
        // Save state before move
        moveDescription = dragData.card.rankText + ' ' + dragData.card.symbol + ' to foundation';
        this.saveGameState(moveDescription);

        this.moveCardToFoundation(dragData, targetIndex);
        validMove = true;
      }
    } else if (targetType === 'tableau') {
      if (this.canMoveToTableau(dragData.card, targetIndex)) {
        // Save state before move
        moveDescription = dragData.card.rankText + ' ' + dragData.card.symbol + ' to tableau column ' + (targetIndex + 1);
        this.saveGameState(moveDescription);

        this.moveCardToTableau(dragData, targetIndex);
        validMove = true;
      }
    }

    if (validMove) {
      this.$moves++;
      this.updateAfterMove();

      // Create move effect
      if (this.$dragElement) {
        var rect = this.$dragElement.getBoundingClientRect();
        this.createCardMoveEffect(rect.left, rect.top, rect.left + 100, rect.top);
      }
    }
  };

  SolitaireUx.prototype.tryAutoMoveToFoundation = function(card, source, sourceIndex, cardIndex) {
    // Try to move card to appropriate foundation
    for (var f = 0; f < 4; f++) {
      if (this.canMoveToFoundation(card, f)) {
        // Save state before auto-move
        var moveDescription = card.rankText + ' ' + card.symbol + ' to foundation (double-click)';
        this.saveGameState(moveDescription);

        var dragData = {
          card: card,
          source: source,
          sourceIndex: sourceIndex,
          cardIndex: cardIndex
        };

        this.moveCardToFoundation(dragData, f);
        this.$moves++;
        this.updateAfterMove();
        break;
      }
    }
  };

  SolitaireUx.prototype.canMoveToFoundation = function(card, foundationIndex) {
    // Must be same suit and next in sequence (A, 2, 3, ... K)
    if (card.suit !== foundationIndex) return false;

    var foundation = this.$foundations[foundationIndex];
    if (foundation.length === 0) {
      return card.value === 1; // Ace
    } else {
      var topCard = foundation[foundation.length - 1];
      return card.value === topCard.value + 1;
    }
  };

  SolitaireUx.prototype.canMoveToTableau = function(card, tableauIndex) {
    var tableau = this.$tableau[tableauIndex];

    if (tableau.length === 0) {
      return card.value === 13; // Only King on empty tableau
    } else {
      var topCard = tableau[tableau.length - 1];
      return topCard.faceUp &&
             (card.isRed !== topCard.isRed) &&
             (card.value === topCard.value - 1);
    }
  };

  SolitaireUx.prototype.moveCardToFoundation = function(dragData, foundationIndex) {
    this.removeCardFromSource(dragData);
    this.$foundations[foundationIndex].push(dragData.card);
    this.$score += 10;

    // Create foundation effect
    this.createFoundationMoveEffect(foundationIndex);

    // Check if foundation is complete
    if (this.$foundations[foundationIndex].length === 13) {
      this.createFoundationCompleteEffect(foundationIndex);
      this.$foundationEls[foundationIndex].classList.add('foundation-complete');
    }
  };

  SolitaireUx.prototype.moveCardToTableau = function(dragData, tableauIndex) {
    var cardsToMove = [dragData.card];

    // If moving from tableau, include all cards on top
    if (dragData.source === 'tableau') {
      var sourceCards = this.$tableau[dragData.sourceIndex];
      for (var i = dragData.cardIndex + 1; i < sourceCards.length; i++) {
        cardsToMove.push(sourceCards[i]);
      }
    }

    this.removeCardFromSource(dragData);

    for (var i = 0; i < cardsToMove.length; i++) {
      this.$tableau[tableauIndex].push(cardsToMove[i]);
    }

    if (dragData.source === 'waste') {
      this.$score += 5;
    }
  };

  SolitaireUx.prototype.createFoundationMoveEffect = function(foundationIndex) {
    // Sparkle effect for foundation move
    for (var i = 0; i < 8; i++) {
      this.$particles.push({
        x: 400 + foundationIndex * 80,
        y: 80,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2 - 1,
        life: 30 + Math.random() * 15,
        maxLife: 45,
        color: '#FFD700',
        size: 2 + Math.random()
      });
    }
  };

  SolitaireUx.prototype.removeCardFromSource = function(dragData) {
    if (dragData.source === 'waste') {
      this.$waste.pop();
    } else if (dragData.source === 'tableau') {
      var sourceCards = this.$tableau[dragData.sourceIndex];
      sourceCards.splice(dragData.cardIndex);

      // Flip next card if it exists and is face down
      if (sourceCards.length > 0 && !sourceCards[sourceCards.length - 1].faceUp) {
        sourceCards[sourceCards.length - 1].faceUp = true;
        this.$score += 5;
        this.createCardFlipEffect(dragData.sourceIndex);
      }
    }
  };

  SolitaireUx.prototype.drawFromStock = function() {
    // Save state before stock draw
    this.saveGameState('Draw from stock');

    if (this.$stock.length === 0 && this.$waste.length > 0) {
      // Reset stock from waste with animation
      while (this.$waste.length > 0) {
        var card = this.$waste.pop();
        card.faceUp = false;
        this.$stock.push(card);
      }

      // Create reset effect
      for (var i = 0; i < 10; i++) {
        this.$particles.push({
          x: 150,
          y: 80,
          vx: (Math.random() - 0.5) * 4,
          vy: -Math.random() * 3,
          life: 25,
          maxLife: 25,
          color: '#FFFFFF',
          size: 2
        });
      }
    } else if (this.$stock.length > 0) {
      // Draw 3 cards (or remaining)
      var cardsToDraw = Math.min(3, this.$stock.length);
      for (var i = 0; i < cardsToDraw; i++) {
        var card = this.$stock.pop();
        card.faceUp = true;
        this.$waste.push(card);
      }

      // Create draw effect
      this.createCardFlipEffect(1);
    }

    this.updateDisplay();
    this.updateUndoRedoButtons();
  };

  SolitaireUx.prototype.showHint = function() {
    // Simple hint system - highlight possible moves
    var hintsFound = 0;

    // Check waste to foundation
    if (this.$waste.length > 0) {
      var wasteCard = this.$waste[this.$waste.length - 1];
      for (var f = 0; f < 4; f++) {
        if (this.canMoveToFoundation(wasteCard, f)) {
          this.$foundationEls[f].classList.add('hint-glow');
          hintsFound++;
          setTimeout(() => {
            this.$foundationEls[f].classList.remove('hint-glow');
          }, 2000);
          break;
        }
      }
    }

    // Check tableau to foundation
    for (var col = 0; col < 7; col++) {
      var tableau = this.$tableau[col];
      if (tableau.length > 0) {
        var topCard = tableau[tableau.length - 1];
        if (topCard.faceUp) {
          for (var f = 0; f < 4; f++) {
            if (this.canMoveToFoundation(topCard, f)) {
              this.$foundationEls[f].classList.add('hint-glow');
              hintsFound++;
              setTimeout(() => {
                this.$foundationEls[f].classList.remove('hint-glow');
              }, 2000);
              break;
            }
          }
        }
      }
    }

    if (hintsFound === 0) {
      // No foundation moves, check tableau moves
      // This is a simplified hint system
    }
  };

  SolitaireUx.prototype.updateDisplay = function() {
    this.renderStock();
    this.renderWaste();
    this.renderFoundations();
    this.renderTableau();
  };

  SolitaireUx.prototype.renderStock = function() {
    this.$stockEl.innerHTML = '';
    if (this.$stock.length > 0) {
      var cardEl = this.createCardElement(null, true);
      cardEl.classList.add('stock-card');
      this.$stockEl.appendChild(cardEl);
    }
  };

  SolitaireUx.prototype.renderWaste = function() {
    this.$wasteEl.innerHTML = '';
    if (this.$waste.length > 0) {
      var topCard = this.$waste[this.$waste.length - 1];
      var cardEl = this.createCardElement(topCard, false);
      cardEl.classList.add('waste-card');
      this.makeCardDraggable(cardEl, topCard, 'waste', 0, this.$waste.length - 1);
      this.$wasteEl.appendChild(cardEl);
    }
  };

  SolitaireUx.prototype.renderFoundations = function() {
    for (var f = 0; f < 4; f++) {
      var foundation = this.$foundations[f];
      var foundationEl = this.$foundationEls[f];

      foundationEl.innerHTML = '';

      if (foundation.length > 0) {
        var topCard = foundation[foundation.length - 1];
        var cardEl = this.createCardElement(topCard, false);
        foundationEl.appendChild(cardEl);
      }
    }
  };

  SolitaireUx.prototype.renderTableau = function() {
    var that = this;

    for (var col = 0; col < 7; col++) {
      var tableau = this.$tableau[col];
      var tableauEl = this.$tableauEls[col];

      tableauEl.innerHTML = '';

      for (var i = 0; i < tableau.length; i++) {
        var card = tableau[i];
        var cardEl = this.createCardElement(card, !card.faceUp);

        cardEl.style.position = 'absolute';
        cardEl.style.top = (i * 20) + 'px';
        cardEl.style.zIndex = i;

        if (card.faceUp) {
          this.makeCardDraggable(cardEl, card, 'tableau', col, i);
        } else {
          // Face-down cards can be clicked to flip if they're the top card
          if (i === tableau.length - 1) {
            cardEl.addEventListener('click', (function(c, colIndex) {
              return function(e) {
                e.preventDefault();
                that.flipCard(c, colIndex);
              };
            })(card, col));
          }
        }

        tableauEl.appendChild(cardEl);
      }
    }
  };

  SolitaireUx.prototype.createCardElement = function(card, isFaceDown) {
    var cardEl = document.createElement('div');
    cardEl.className = 'playing-card';

    if (isFaceDown) {
      cardEl.classList.add('face-down');
      cardEl.innerHTML = '<div class="card-back">🂠</div>';
    } else if (card) {
      cardEl.classList.add('face-up');
      cardEl.classList.add(card.isRed ? 'red' : 'black');

      cardEl.innerHTML =
        '<div class="card-face">' +
          '<div class="card-rank top-left">' + card.rankText + '</div>' +
          '<div class="card-suit top-left">' + card.symbol + '</div>' +
          '<div class="card-center">' + card.symbol + '</div>' +
          '<div class="card-rank bottom-right">' + card.rankText + '</div>' +
          '<div class="card-suit bottom-right">' + card.symbol + '</div>' +
        '</div>';
    }

    return cardEl;
  };

  SolitaireUx.prototype.flipCard = function(card, columnIndex) {
    var tableau = this.$tableau[columnIndex];
    var topCard = tableau[tableau.length - 1];

    if (topCard === card && !card.faceUp) {
      // Save state before flip
      this.saveGameState('Flip card in column ' + (columnIndex + 1));

      card.faceUp = true;
      this.$moves++;
      this.$score += 5;
      this.createCardFlipEffect(columnIndex);
      this.updateAfterMove();
    }
  };

  SolitaireUx.prototype.updateAfterMove = function() {
    this.updateDisplay();
    this.updateStats();

    if (this.checkWin()) {
      setTimeout(() => {
        this.createWinCelebration();
        // FIXED: Removed showWinMessage() - let animation complete first
      }, 500);
    }
  };

  SolitaireUx.prototype.checkWin = function() {
    for (var i = 0; i < 4; i++) {
      if (this.$foundations[i].length !== 13) {
        return false;
      }
    }
    return true;
  };

  SolitaireUx.prototype.autoComplete = function() {
    var movesMade = true;
    var autoMoves = 0;

    while (movesMade && autoMoves < 52) { // Prevent infinite loop
      movesMade = false;
      autoMoves++;

      // Check waste pile
      if (this.$waste.length > 0) {
        var wasteCard = this.$waste[this.$waste.length - 1];
        for (var f = 0; f < 4; f++) {
          if (this.canMoveToFoundation(wasteCard, f)) {
            this.$waste.pop();
            this.$foundations[f].push(wasteCard);
            this.$moves++;
            this.$score += 10;
            movesMade = true;
            this.createFoundationMoveEffect(f);
            break;
          }
        }
      }

      // Check tableau columns
      if (!movesMade) {
        for (var col = 0; col < 7; col++) {
          var tableau = this.$tableau[col];
          if (tableau.length > 0) {
            var topCard = tableau[tableau.length - 1];
            if (topCard.faceUp) {
              for (var f = 0; f < 4; f++) {
                if (this.canMoveToFoundation(topCard, f)) {
                  tableau.pop();
                  this.$foundations[f].push(topCard);
                  this.$moves++;
                  this.$score += 10;
                  movesMade = true;
                  this.createFoundationMoveEffect(f);

                  // Flip next card if available
                  if (tableau.length > 0 && !tableau[tableau.length - 1].faceUp) {
                    tableau[tableau.length - 1].faceUp = true;
                    this.$score += 5;
                    this.createCardFlipEffect(col);
                  }
                  break;
                }
              }
              if (movesMade) break;
            }
          }
        }
      }
    }

    this.updateAfterMove();
  };

  SolitaireUx.prototype.updateStats = function() {
    this.$scoreEl.textContent = this.$score;
    this.$movesEl.textContent = this.$moves;

    if (this.$startTime) {
      var elapsed = Math.floor((Date.now() - this.$startTime) / 1000);
      var minutes = Math.floor(elapsed / 60);
      var seconds = elapsed % 60;
      this.$timeEl.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }
  };

  SolitaireUx.prototype.startTimer = function() {
    var that = this;
    setInterval(function() {
      if (!that.$dealingAnimation) {
        that.updateStats();
      }
    }, 1000);
  };

  SolitaireUx.prototype.showWinMessage = function() {
    var elapsed = Math.floor((Date.now() - this.$startTime) / 1000);
    var minutes = Math.floor(elapsed / 60);
    var seconds = elapsed % 60;
    var timeStr = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

    this.$finalStatsEl.innerHTML =
      '<div class="final-score">Final Score: ' + this.$score + '</div>' +
      '<div class="final-moves">Moves: ' + this.$moves + '</div>' +
      '<div class="final-time">Time: ' + timeStr + '</div>';

    this.$overlayEl.style.display = 'flex';
  };

  SolitaireUx.prototype.hideOverlay = function() {
    this.$overlayEl.style.display = 'none';
  };

  SolitaireUx.prototype.doDestroy = function() {
    // Clear DOM references
    this.$container = null;
    this.$scoreEl = null;
    this.$movesEl = null;
    this.$timeEl = null;
    this.$stockEl = null;
    this.$wasteEl = null;
    this.$overlayEl = null;
    this.$overlayMessageEl = null;
    this.$finalStatsEl = null;
    this.$foundationEls = null;
    this.$tableauEls = null;
    this.$particleCanvas = null;
    this.$ctx = null;

    // Clear game state
    this.$deck = null;
    this.$stock = null;
    this.$waste = null;
    this.$foundations = null;
    this.$tableau = null;
    this.$dragData = null;
    this.$dragElement = null;
    this.$particles = null;
    this.$sparkles = null;
    this.$cardTrails = null;
    this.$cardAnimations = null;
    this.$moveHistory = null;
    this.$redoHistory = null;
    this.$bouncingCards = null;

    Widget.prototype.doDestroy.call(this);
  };

  return SolitaireUx;
});