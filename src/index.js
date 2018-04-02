import './index.html';
import "./index.css";

import brain from 'brain.js/src/index';

const net = new brain.NeuralNetwork({
    hiddenLayers: 16,
    log: true
});


/**
 * 
 * 
 * @class Board
 */
class Board {
    /**
     * Creates an instance of Board.
     * @param {number} size 
     * @memberof Board
     */
    constructor(size) {
        this.moves = [];
        this.winner = undefined;
        this.size = size || 16;
    }
}
class Move {
    constructor(x = 0, y = 0, p = 0) {
        this.x = x;
        this.y = y;
        this.p = p;
    }
}

document.querySelector("#app").innerHTML = renderBoard(new Board(16));

/**
 * 
 * 
 * @param {Board} [board] 
 */
function renderBoard(board) {
    const rows = [...Array(board.size)].map((row, y) => {
        const cols = [...Array(board.size)].map((col, x) => {
            return `<td class="col" x="${x}" y="${y}"></td>`;
        });

        return `<tr class="row">${cols.join("")}</tr>`;
    });

    return `
    <table id="board">
        ${rows.join("")}
    </table>`;
}
