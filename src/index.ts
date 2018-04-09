import "./index.html";
import "./index.css";
import "./img/circle.svg";
import "./img/cross.svg";

import * as flatten from "array-flatten";
import { cartesianProduct } from "js-combinatorics";
import * as Vector from "victor";
// tslint:disable-next-line:interface-name
interface Vector { x: number; y: number; }
Vector.prototype.absVector = function () {
	const [x, y] = [this.x, this.y].map(Math.abs);
	return new Vector(x, y);
};

Vector.prototype.equals = function (anotherVector) {
	const [x, y] = [anotherVector.x, anotherVector.y];
	return this.x === x && this.y === y;
};

import * as localforage from "localforage";
import { Learner, Generator, SelfPlaySim } from "./ai";

import { Board, Move, Player } from "./lib";

class App {
	public onBoardLoaded: (board: Board) => void;
	public onBoardSaved: (board: Board) => void;
	public onRenderComplete: () => void;
	public onGameEnd: () => void;
	public board: Board;
	private target: any;
	private key: string;
	constructor(target, board) {
		this.target = target;
		this.board = board;

		this.key = "savedBoards";

		// First render
		this.render();

		// Init events
		this.onRenderComplete = () => false;
		this.onBoardLoaded = () => this.render();
		this.onBoardSaved = () => false;
		this.onGameEnd = () => false;

		// Auto save on game end
		this.board.onWin = async () => {
			await this.saveCurrentBoard(new Date().toJSON());
			await this.render();
			this.onGameEnd();
		};

		this.board.onMoveAdded = () => {
			this.render();
		};
	}

	public async render() {
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
		<input type="button" value="Delete" id="deleteButton">
		</div>
		`;

		html += `
		<div class="boardSaver">
		<input type="text" name="boardSaver" id="saveName">
		<input type="button" value="Save" id="saveButton">
		</div>
		`;

		html += `
		<div class="console">
			<input type="text" name="console" id="console" autocomplete="on">
		</div>
		`;

		html += this.board.render();

		document.querySelector(this.target).innerHTML = html;
		this.registerEventHandlers();
		this.onRenderComplete();
	}

	public registerEventHandlers() {
		document.querySelectorAll("td.col").forEach((col) => {
			col.addEventListener("click", (event) => {
				onClickCol(event.target, this);
			});
		});

		function onClickCol(col, appInstance) {
			const [x, y] = [col.getAttribute("x"), col.getAttribute("y")];
			appInstance.board.addMove(new Move(x, y, appInstance.board.currentPlayer));
			appInstance.render();
		}

		// Saving
		document
			.querySelector("#saveButton")
			.addEventListener("click", async () => {
				await this.saveCurrentBoard(
					(document
						.querySelector("#saveName") as HTMLSelectElement)
						.value
				);
				await this.render();
				this.onBoardSaved(this.board);
			});

		// Loading
		document
			.querySelector("#loadButton")
			.addEventListener("click", async () => {
				const value = (document
					.querySelector("select#boards") as HTMLSelectElement)
					.value;

				const boards = await this.getSavedBoards();
				const boardToLoad = boards.find((b) => {
					return b.name === value;
				});

				await this.loadBoard(boardToLoad);
				this.board.checkWin();
				this.onBoardLoaded(this.board);
			});

		// Deleting
		document
			.querySelector("#deleteButton")
			.addEventListener("click", async () => {
				const value = (document
					.querySelector("select#boards") as HTMLSelectElement)
					.value;

				this.deleteBoard(value);
				this.render();
			});

		// Console
		document
			.querySelector("#console")
			.addEventListener("keyup", async (e) => {
				// Enter key was pressed
				if ((e as KeyboardEvent).keyCode === 13) {
					const command = (e.target as HTMLInputElement).value;
					if (command === "dl") {
						downloadObjectAsJson(await this.getSavedBoards(), "games");
						return;
					}
					// tslint:disable-next-line:no-eval
					eval(command);
				}

				async function downloadObjectAsJson(exportObj, exportName) {
					const s = JSON.stringify(exportObj);
					const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
				}
			});
	}

	public async loadBoard(board) {
		this.board = Object.assign(new Board(), {
			...board,
			moves: [
				...board.moves.map((move) => {
					return new Move(move.x, move.y, move.p);
				})
			]
		});
		await this.render();
	}

	public async saveCurrentBoard(name) {
		const savedBoards = await localforage.getItem(this.key) || [];
		const boardToSave = Object.assign(this.board.toObject(), { name });
		await localforage.setItem(this.key, [...savedBoards as Board[], boardToSave]);
	}

	public async deleteBoard(name) {
		const savedBoards = (await localforage.getItem(this.key) as Board[]) || [];
		const updatedBoards = savedBoards.filter((board) => board.name !== name);
		await localforage.setItem(this.key, updatedBoards);
		await this.render();
	}

	public async getSavedBoards() {
		return (await localforage.getItem(this.key) as Board[]);
	}
}
// TODO: normalize nomenclature
// TODO: extract selectors from HTML Templates to Selectors property

class SelfPlayer {
	private app: App;
	private ai: Learner;
	private lastPlayer: Player;
	private humanPlayed: number;
	private stats: {
		x: number;
		o: number
		games: number;
		draw: number;
	};
	constructor(app: App) {
		this.lastPlayer = Player.X;
		this.app = app;
		this.ai = new Learner();
		this.stats = { x: 0, o: 0, games: 0, draw: 0 };
		this.humanPlayed = 0;
		this.app.board.onMoveAdded = () => {
			this.humanPlayed++;
		};
		this.app.onGameEnd = async () => {
			this.stats.games++;
			switch (this.app.board.winner) {
				case Player.X:
					this.stats.x++;
					break;
				case Player.O:
					this.stats.o++;
					break;
				case undefined:
					this.stats.draw++;
					break;
				default:
					break;
			}
			await this.ai.train(this.app.board);
			const nextPlayer = this.lastPlayer === Player.X ? Player.O : Player.X;
			this.app.board.restart(nextPlayer);
			this.lastPlayer = nextPlayer;
			await this.app.render();
			console.log(JSON.stringify(this.stats));
		};
	}

	public play() {
		const moveWeights = this.ai.getBestMoves(this.app.board);
		const nextMove = moveWeights[0].move;
		if (nextMove === undefined) {
			console.log("Draw");
			this.app.onGameEnd();
			return;
		}
		if (!this.app.board.isValidMove(nextMove)) {
			this.play();
		} else {
			this.app.board.addMove(nextMove);
			this.app.board.moveWeights = moveWeights;
		}
	}

	public playOnRenderComplete() {
		this.app.onRenderComplete = () => {
			if (this.humanPlayed % 2) {
				return;
			}
			if (!this.app.board.winner || this.app.board.moves.length < Math.pow(this.app.board.size, 2)) {
				this.play();
			}
		};
	}
}

// const appI = new App("#app", new Board(5, Player.X, 4));
// const selfPlayer = new SelfPlayer(appI);
// selfPlayer.playOnRenderComplete();

const sim = new SelfPlaySim(new Board(3, Player.O, 3));
sim.startAutoPlay();
