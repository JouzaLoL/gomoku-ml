import './index.html';
import "./index.css";
import "./img/circle.svg";
import "./img/cross.svg";

import Vector from "victor";
Vector.prototype.absVector = function () {
	const [x, y] = [this.x, this.y].map(Math.abs);
	return new Vector(x, y);
};

Vector.prototype.equals = function (anotherVector) {
	const [x, y] = [anotherVector.x, anotherVector.y];
	return this.x === x && this.y === y;
};

import brain from 'brain.js/src/index';
import * as localforage from "localforage";

class Board {
    /**
     * Creates an instance of Board.
     * @param {number} size 
     * @memberof Board
     */
	constructor(size = 16, startingPlayer = "x") {
		this.moves = [];
		this.size = size;
		this.winner = undefined;
		this.currentPlayer = startingPlayer;
		this.name = "";

		// Win callback
		this.onWin = () => { };
	}

	toJSON() {
		return JSON.stringify({
			moves: this.moves,
			winner: this.winner
		});
	}

	toObject() {
		return {
			moves: this.moves,
			winner: this.winner
		};
	}

	addMove(m) {
		// Update the current player
		const cp = this.currentPlayer;
		this.currentPlayer = this.currentPlayer === "x" ? "o" : "x";

		// Don't mark already occupied col
		if (
			this.moves.some((move) => move.x === m.x && move.y === m.y)
		) {
			return;
		} // Freeze if game ended
		else if (this.winner) {
			return;
		}

		// Add move to collection
		this.moves.push(m);

		// Determine win
		this.checkWin(m);

		// Log the move
		console.log(`Player ${this.currentPlayer} clicked ${m.x}:${m.y}`);
	}

	checkWin(lastMove = this.moves[this.moves.size]) {
		const { x, y, p } = lastMove;

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
			this.onWin(p);
		}

		function isBetween(pointA, pointB, pointBetween) {
			const AtoB = pointA.clone().subtract(pointB);
			const AtoX = pointA.clone().subtract(pointBetween);
			const BtoX = pointB.clone().subtract(pointBetween);
			return AtoB.absVector().equals(AtoX.absVector().add(BtoX.absVector()));
		}
	}

	render() {
		return this.renderBoard().concat(this.renderStats());
	}

	renderStats() {
		return `
        <div id="stats">
            <div class="cp">
                <b>Current player:</b>
                <span class="cp ${this.currentPlayer}">${this.currentPlayer}</span>
			</div>
            <b>Moves:</b>
        	<table class="moves">
            <thead>
                <th>#</th>
                <th>Player</th>
                <th>Coords</th>
			</thead>
			<tbody>
           ${this.moves.map((move, index) => {
				return `
			   <tr class="move ${this.winner === move.p ? "winmove" : ''}">
				   <td class="number">${index}</td>
				   <td class="player ${move.p}">${move.p}</td>
				   <td class="coords">[${move.x}, ${move.y}]</td>
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
				return `<td class="col ${move ? move.p : ''} ${this.winner && move && this.winner === move.p ? "wincol" : ''}" x="${x}" y="${y}"></td>`;
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


class App {
	constructor(target, board) {
		this.target = target;
		this.board = board;

		this.key = "savedBoards";

		// First render
		this.render();

		// Auto save on game end
		this.board.onWin = async (player) => {
			await this.saveCurrentBoard(new Date().toJSON());
			this.render();
		};
	}

	async render() {
		let html = "";

		const savedBoards = await this.getSavedBoards() || [];
		html += `
		<div class="boardSelector">
		<select name="boards" id="boards">
		${savedBoards.map((board, index) => {
				return `<option id="${index}">${board.name}</option>`;
			})}
		</select>
		<input type="button" value="Load" id="loadButton">
		</div>
		`;

		html += `
		<div class="boardSaver">
		<input type="text" name="boardSaver" id="saveName">
		<input type="button" value="Save" id="saveButton">
		</div>
		`;

		html += this.board.render();

		document.querySelector(this.target).innerHTML = html;
		this.registerEventHandlers();
	}

	registerEventHandlers() {
		document.querySelectorAll("td.col").forEach((col) => {
			col.addEventListener("click", (event) => {
				onClickCol(event.target, this);
			});
		});

		function onClickCol(col, app) {
			const [x, y] = [col.getAttribute("x"), col.getAttribute("y")];
			app.board.addMove(new Move(x, y, app.board.currentPlayer));
			app.render();
		}

		// Saving
		document
			.querySelector("#saveButton")
			.addEventListener("click", async () => {
				await this.saveCurrentBoard(
					document
						.querySelector("#saveName")
						.value
				);
				this.render();
			});

		// Loading
		document
			.querySelector("#loadButton")
			.addEventListener("click", async () => {
				const value = document
					.querySelector("select#boards")
					.value;

				const boards = await this.getSavedBoards();
				const boardToLoad = boards.find((b) => {
					return b.name === value;
				});

				this.loadBoard(boardToLoad);
			});
	}

	async loadBoard(board) {
		this.board = Object.assign(new Board(), {
			...board,
			moves: [
				...board.moves.map((move) => {
					return new Move(move.x, move.y, move.p);
				})
			]
		});
		await this.render();
		const lastMove = this.board.moves[this.board.moves.length - 1];
		this.board.checkWin(lastMove.x, lastMove.y, lastMove.p);
	}

	async saveCurrentBoard(name) {
		const savedBoards = await localforage.getItem(this.key) || [];
		const boardToSave = Object.assign(this.board.toObject(), { name });
		await localforage.setItem(this.key, [...savedBoards, boardToSave]);
	}

	async getSavedBoards() {
		return await localforage.getItem(this.key);
	}

	// TODO: add saved boards display - table, with option to load or delete
}

const app = new App("#app", new Board(16));