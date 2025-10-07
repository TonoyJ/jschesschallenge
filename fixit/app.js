/* app.js
   Requires: jQuery, chess.js, chessboard.js
*/

"use strict";

let board = null;
let game = new Chess();
let $status = null;
let $fen = null;
let $pgn = null;
let promotionPending = null; // {from, to, piece, callback}
let config = null;

// helper: update UI status
function updateStatus() {
  document.getElementById('turn').textContent = game.turn() === 'w' ? 'White' : 'Black';
  const statusEl = document.getElementById('status');
  if (game.in_checkmate()) {
    statusEl.textContent = 'Checkmate';
  } else if (game.in_draw()) {
    statusEl.textContent = 'Draw';
  } else {
    statusEl.textContent = (game.in_check() ? 'Check' : 'Game in progress');
  }
  // update move list
  renderMoveList();
  // update PGN box
  document.getElementById('pgnArea').value = game.pgn();
}

// render move list (algebraic)
function renderMoveList() {
  const moves = game.history({ verbose: true });
  const ol = document.getElementById('moveList');
  ol.innerHTML = '';
  for (let i = 0; i < moves.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const li = document.createElement('li');
    const white = moves[i] ? moves[i].san : '';
    const black = moves[i + 1] ? moves[i + 1].san : '';
    li.innerHTML = `<strong>${moveNum}.</strong> ${white} ${black ? '&nbsp;&nbsp;' + black : ''}`;
    ol.appendChild(li);
  }
  ol.scrollTop = ol.scrollHeight;
}

// square highlighting helpers
function removeHighlights() {
  $('#board .square-55d63').removeClass('square-highlight square-origin');
}
function highlightSquare(sq, cls) {
  const squareEl = $('#board .square-' + sq);
  squareEl.addClass(cls);
}

// show legal moves for given square
function showLegalMoves(square) {
  removeHighlights();
  const moves = game.moves({ square, verbose: true });
  if (moves.length === 0) return;
  highlightSquare(square, 'square-origin');
  moves.forEach(m => highlightSquare(m.to, 'square-highlight'));
}

// Board callbacks
function onDragStart(source, piece, position, orientation) {
  // do not allow drag if game over
  if (game.game_over()) return false;
  // only allow dragging same color as turn
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false;
  }
}

function onDrop(source, target, piece, newPos, oldPos, orientation) {
  removeHighlights();

  // handle promotion: if pawn moving to last rank, show promotion UI
  const moves = game.moves({ verbose: true, square: source });
  // check if any move from source to target is a promotion
  const promotionMove = moves.find(m => m.to === target && m.promotion);
  if (promotionMove) {
    // store pending promotion and show modal
    promotionPending = { from: source, to: target, piece: promotionMove.piece };
    showPromotionModal();
    // return 'snapback' for now; actual move will be played after selection
    return 'snapback';
  }

  // try the move normally
  const move = game.move({ from: source, to: target, promotion: 'q' }); // default queen if needed
  if (move === null) {
    return 'snapback';
  } else {
    board.position(game.fen());
    updateStatus();
  }
}

function onSnapEnd() {
  board.position(game.fen());
}

// hover events
function onMouseoverSquare(square, piece) {
  // show legal moves
  const moves = game.moves({ square, verbose: true });
  if (moves.length === 0) return;
  showLegalMoves(square);
}
function onMouseoutSquare(square, piece) {
  removeHighlights();
}

// initialize board
function init() {
  $status = $('#status');
  config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    onMouseoutSquare: onMouseoutSquare,
    onMouseoverSquare: onMouseoverSquare,
    pieceTheme: function(piece) {
      // use chessboard.js default sprite; if you want different images, change URL
      return 'https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/img/chesspieces/wikipedia/{piece}.png'.replace('{piece}', piece);
    }
  };
  board = Chessboard('board', config);

  // initial UI
  updateStatus();

  // buttons
  document.getElementById('btnUndo').addEventListener('click', () => {
    const undone = game.undo();
    if (undone) {
      board.position(game.fen());
      updateStatus();
    }
  });

  document.getElementById('btnRestart').addEventListener('click', () => {
    game.reset();
    board.start();
    updateStatus();
  });

  document.getElementById('btnFlip').addEventListener('click', () => {
    board.flip();
  });

  document.getElementById('btnExport').addEventListener('click', () => {
    const pgn = game.pgn();
    document.getElementById('pgnArea').value = pgn;
    alert('PGN copied into textarea below (you can copy it).');
  });

  document.getElementById('btnImport').addEventListener('click', () => {
    const pgn = document.getElementById('pgnArea').value.trim();
    if (!pgn) { alert('Paste PGN into the textarea to import.'); return; }
    const loaded = game.load_pgn(pgn);
    if (!loaded) {
      alert('Failed to load PGN — check format.');
      return;
    }
    board.position(game.fen());
    updateStatus();
  });

  // promotion modal handlers
  document.querySelectorAll('.promo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pieceChar = e.currentTarget.getAttribute('data-piece'); // q/r/b/n
      if (!promotionPending) {
        hidePromotionModal();
        return;
      }
      const from = promotionPending.from;
      const to = promotionPending.to;
      // perform move with chosen promotion
      const move = game.move({ from, to, promotion: pieceChar });
      promotionPending = null;
      hidePromotionModal();
      if (move === null) {
        // shouldn't happen; snap back board
        board.position(game.fen());
      } else {
        board.position(game.fen());
        updateStatus();
      }
    });
  });

  // hide modal on click outside
  document.getElementById('promoModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('promoModal')) {
      // cancel promotion (snapback)
      promotionPending = null;
      hidePromotionModal();
    }
  });

  // wire up keyboard: 'u' for undo
  document.addEventListener('keydown', (e) => {
    if (e.key === 'u' || e.key === 'U') {
      game.undo();
      board.position(game.fen());
      updateStatus();
    }
  });
}

function showPromotionModal() {
  document.getElementById('promoModal').classList.remove('hidden');
}

function hidePromotionModal() {
  document.getElementById('promoModal').classList.add('hidden');
}

// start
$(document).ready(function() {
  init();
});
