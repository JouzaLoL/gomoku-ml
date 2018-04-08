import * as tf from "@tensorflow/tfjs";
import brain from "brain.js/src/index";
import { cartesianProduct, baseN } from "js-combinatorics";

import { Move, Player, Board } from "./index";

export class Learner {
	private brain: any;
	constructor() {
		const options = {
			hiddenLayers: [16, 16],
			learningRate: 0.1
		};
		this.brain = new brain.NeuralNetwork(options);
	}

	public async train(board: Board) {
		await this.brain.trainAsync(Converter.labelGame(board, Player.O), { log: true });
	}

	public nextMove(board: Board): Move {
		const possibleMoves = Generator
			.possibleMoves(board);

		// Network has not yet been trained, select random move
		if (!this.brain.weights) {
			return Generator.randomItem(possibleMoves);
		} else {
			// Current state
			const moves = board.moves;

			// Assign weights to moves
			const moveWeights =
				possibleMoves
					.map((move) => {
						const newMoves = moves.concat([move]);
						const newState = Converter.toPropertiesObject(newMoves, board.size);
						return {
							move,
							likely: this.brain.run(newState)
						};
					});

			const bestMoves = moveWeights
				.filter((mW) => mW.move.p === board.currentPlayer)
				.sort((a, b) => {
					return a.likely[board.currentPlayer] - b.likely[board.currentPlayer];
				});

			/* if (moveWeights[0].likely < 0.9) {
				return Generator.randomItem(possibleMoves);
			} */

			// Choose the most likely move
			return bestMoves[0].move;
		}
	}
}

export class Generator {

	public static possibleMoves(board: Board) {
		// Generate all possible moves
		const coordsRange: number[] = Array.apply(null, { length: board.size }).map(Number.call, Number);
		const moves = cartesianProduct(coordsRange, coordsRange, [0, 1])
			.toArray()
			.map((product) => {
				return new Move(product[0].toString(), product[1].toString(), product[2] ? Player.X : Player.O);
			});

		// Filter out illegal moves
		const legalMoves = moves.filter((move) => {
			return board.isValidMove(move);
		});

		return legalMoves;
	}

	public static randomItem(array) {
		return array[Math.floor(Math.random() * array.length)];
	}
}

class Converter {
	public static labelGame(board: Board, p: Player) {
		return {
			input: Converter.toPropertiesObject(board.moves, board.size),
			output: {
				x: board.winner === Player.X ? 1 : 0,
				o: board.winner === Player.O ? 1 : 0
			}
		};
	}

	public static toPropertiesObject(moves: Move[], size: number) {
		const object = {};
		const coordsRange: number[] = Array.apply(null, { length: size }).map(Number.call, Number);

		// Initialize object with empty indicators - 0.5
		baseN(coordsRange, 2)
			.toArray()
			.map((coord) => {
				return coord.join("");
			})
			.forEach((coord) => {
				object[coord] = 0.5;
			});

		// Add move values to object
		moves.forEach((move) => {
			object[move.x.toString() + move.y] = move.playerValue;
		});

		return object;
	}
}

export class SimSelfPlayer {
	private board: Board;
	private ai: Learner;
	private lastPlayer: Player;
	constructor(board: Board) {
		this.lastPlayer = Player.X;
		this.board = board;
		this.ai = new Learner();
	}

	public play() {
		const nextMove = this.ai.nextMove(this.board);
		this.board.addMove(nextMove);
	}

	public startAutoPlay() {
		this.board.onWin = async () => {
			console.log(`Game ended | Winner: ${this.board.winner}`);

			await this.ai.train(this.board);

			const nextPlayer = this.lastPlayer === Player.X ? Player.O : Player.X;
			this.lastPlayer = nextPlayer;

			this.board.restart(nextPlayer);

			// Start new game
			this.play();
		};

		this.board.onMoveAdded = (m) => {
			console.log(`Move: ${m.p} => ${m.x}, ${m.y}`);
			if (!this.board.winner || this.board.moves.length !== Math.pow(this.board.size, 2) - 1) {
				this.play();
			} else {
				console.log("It's a draw");
			}
		};

		// Start the autoplay
		this.play();
	}
}
