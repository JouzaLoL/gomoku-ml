import './index.html';
import "./index.css";

import Vector from "victor";
Vector.prototype.absVector = function () {
	const [x, y] = [this.x, this.y].map(Math.abs);
	return new Vector(x, y);
};

Vector.prototype.equals = function (anotherVector) {
	const [x, y] = [this.x, this.y];
	return this.x === x && this.y === y;
};

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
	constructor(size = 16, target = "#app") {
		this.target = target;
		this.moves = [];
		this.winner = undefined;
		this.size = size;
		this.render(target);
	}

	addMove(m) {
		// Don't mark already occupied col
		if (
			this.moves.some((move) => {
				return move.x === m.x && move.y === m.y;
			})
		) {
			return;
		} else if (this.winner) {
			return;
		}

		// Add move to collection
		this.moves.push(m);

		// Determine win
		this.checkWin(m.x, m.y, m.p);

		// Log the move
		console.log(`Player ${state.currentPlayer} clicked ${m.x}:${m.y}`);

		// Trigger render
		this.render(this.target);
		registerEventHandlers();
	}

	checkWin(x, y, p) {
		const ownMoves = this.moves
			.filter((move) => move.p === p);

		if (ownMoves.length < 5) {
			return;
		}

		// How many in adjacent are needed to win?
		const n = 5;
		const distance = n - 1;

		// find points in distance n or sqrt(2)n to point
		const thisVector = new Vector(x, y);

		// convert own moves to vectors
		const ownVectors = ownMoves
			.map((move) => {
				return new Vector(move.x, move.y);
			});

		const vectorsOnSquare = ownVectors
			.filter((vector) => {
				return (vector.distanceSq(thisVector) === Math.pow(distance, 2)
					|| vector.distanceSq(thisVector) === 2 * Math.pow(distance, 2));
			});

		const vectorsInSquare = ownVectors
			.filter((vector) => {
				return (vector.distanceSq(thisVector) < Math.pow(distance, 2)
					|| vector.distanceSq(thisVector) < 2 * Math.pow(distance, 2));
			})
			.filter((vector) => {
				return !(vector.x === thisVector.x && vector.y === thisVector.y);
			})
			.filter((vector) => {
				return !vectorsOnSquare.includes(vector);
			});

		const hasWon = vectorsOnSquare
			.some((squareVector) => {
				return vectorsInSquare
					.filter((vector) => {
						return isBetween(thisVector, squareVector, vector);
					})
					.length === 3;
			});

		if (hasWon) {
			this.winner = p;
		}

		function isBetween(pointA, pointB, pointBetween) {
			const AtoB = pointA.clone().subtract(pointB);
			const AtoX = pointA.clone().subtract(pointBetween);
			const BtoX = pointB.clone().subtract(pointBetween);
			return AtoB.absVector().equals(AtoX.absVector().add(BtoX.absVector()));
		}
	}

	findMove(x, y) {
		return this.moves.find((move) => {
			return move.x === x && move.y === y;
		}) || new Move(-1, -1, "");
	}

    /**
     * 
     * 
     * @returns void
     * @memberof Board
     */
	render(target) {
		const html = this.renderBoard().concat(this.renderStats())
		document.querySelector(target).innerHTML = html;

		if (this.winner) {
			alert(this.winner);
		}
	}

	renderStats() {
		return `
        <div id="stats">
            <div class="cp">
                <b>Current player:</b>
                <span class="cp ${state.currentPlayer}">${state.currentPlayer}</span>
            </div>
        <table class="moves">
            <b>Moves:</b>
            <thead>
                <th>#</th>
                <th>Player</th>
                <th>X</th>
                <th>Y</th>
			</thead>
			<tbody>
           ${this.moves.map((move, index) => {
				return `
			   <tr class="move">
				   <td class="number">${index}</td>
				   <td class="player">${move.p}</td>
				   <td class="x">${move.x}</td>
				   <td class="y">${move.y}</td>
			   </tr>
		   `;
			})}
			</tbody>
        </table>
		</div>
    `;
	}

	renderBoard() {
		const rows = [...Array(this.size)].map((row, y) => {
			const cols = [...Array(this.size)].map((col, x) => {
				const move = this
					.moves
					.find((move) => {
						return move.x === x && move.y === y;
					});
				return `<td class="col ${move ? move.p : ''}" x="${x}" y="${y}"></td>`;
			});
			return `<tr class="row">${cols.join("")}</tr>`;
		});

		return `
        <table id="board">
            ${rows.join("")}
		 </table>`;
	}
}
class Move {
	constructor(x, y, p = "x") {
		this.x = parseInt(x);
		this.y = parseInt(y);
		this.p = p;
	}
}

function registerEventHandlers() {
	document.querySelectorAll("td.col ").forEach((col) => {
		col.addEventListener("click", onClickCol);
	});

	function onClickCol() {
		const [x, y] = [this.getAttribute("x"), this.getAttribute("y")]

		const cp = state.currentPlayer;

		// Update the state to next player
		state.currentPlayer = state.currentPlayer === "x" ? "o" : "x";

		// Add the move to board moves list
		state.board.addMove(new Move(x, y, cp));
	}
}


const state = {
	currentPlayer: "x",
	board: null
};

state.board = new Board(16, "#app");
registerEventHandlers();