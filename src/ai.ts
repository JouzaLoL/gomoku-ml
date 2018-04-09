import * as tf from "@tensorflow/tfjs";
import * as brain from "brain.js";
import { cartesianProduct, baseN } from "js-combinatorics";

import { Move, Player, Board } from "./lib";
import { TimeDistributed } from "@tensorflow/tfjs-layers/dist/layers/wrappers";

export class Learner {
	private brain: any;
	constructor() {
		const options = {
			hiddenLayers: [15, 15],
			learningRate: 0.3,
			iterations: 20000,
			errorThresh: 0.005,
			log: true,
			logPeriod: 5,
			momentum: 0.1,
			callback: null,
			callbackPeriod: 10,
			timeout: 10 * 1000
		};
		this.brain = new brain.NeuralNetwork(options);
	}

	public train(board: Board) {
		const trainingData = Converter.labelGame(board.moves, board.winner, board.size);
		return this.brain.trainAsync(trainingData);
	}

	public getBestMoves(board: Board): Array<{
		move: Move,
		likely: [number]
	}> {
		const possibleMoves = Generator
			.possibleMoves(board);

		// Network has not yet been trained, select random move
		if (!this.brain.weights) {
			return [{
				move: Generator.randomItemFrom(possibleMoves),
				likely: undefined
			}];
		} else {
			// Current state
			const moves = board.moves;

			// Assign weights to possible S_t+1
			const weightedMoves =
				possibleMoves
					.map((move) => {
						// Add the next move to the state, creating S_t+1
						const newMoves = moves.concat([move]);
						const newState = Converter.toPropertiesObject(newMoves, board.size);
						// Return the move and it's weight
						return {
							move,
							likely: this.brain.run(newState)
						};
					});

			// Sort the moves by descending weight
			const bestMoves = weightedMoves
				.sort((a, b) => {
					return a.move.playerValue ? b.likely[0] - a.likely[0] : a.likely[0] - b.likely[0];
				});

			// Return the sorted array
			return bestMoves;
		}
	}
}

export class Generator {
	/**
	 * Generates valid moves for a given board
	 *
	 * @static
	 * @param {Board} board
	 * @returns
	 * @memberof Generator
	 */
	public static possibleMoves(board: Board) {
		// Generate all possible moves
		const coordsRange: number[] = Array.apply(null, { length: board.size }).map(Number.call, Number);
		const moves = cartesianProduct(coordsRange, coordsRange, [0, 1])
			.toArray()
			.map((product) => {
				return new Move(product[0].toString(), product[1].toString(), product[2] ? Player.X : Player.O);
			});

		// Filter out illegal moves
		const legalMoves = moves.filter((move) => board.isValidMove(move));

		return legalMoves;
	}
	/**
	 * Returns a random item from an array
	 *
	 * @static
	 * @template T
	 * @param {T[]} array
	 * @returns
	 * @memberof Generator
	 */
	public static randomItemFrom<T>(array: T[]) {
		return array[Math.floor(Math.random() * array.length)];
	}
}

class Converter {
	/**
	 * Labels the game, creating a I/O learning object
	 *
	 * @static
	 * @param {Board} board
	 * @memberof Converter
	 */
	public static labelGame(moves: Move[], winner: Player, size: number) {
		// Discount the game by moves count
		// const discount = (moves.filter((move) => move.p === winner).length - 1 / winSize) * 0.1;

		// Value >> 1 => Player.X is likely to win; Value >> 0 => Player.O is likely to win
		let value;
		switch (winner) {
			case Player.X:
				value = 1;
				break;
			case Player.O:
				value = 0;
				break;
			case undefined:
				value = 0.5;
				break;
			default:
				break;
		}

		return {
			input: Converter.toPropertiesObject(moves, size),
			output: [value]
		};
	}

	/**
	 * Converts a board to a properties object to be used when learning
	 *
	 * @static
	 * @param {Move[]} moves
	 * @param {number} size
	 * @returns
	 * @memberof Converter
	 */
	public static toPropertiesObject(moves: Move[], size: number) {
		const object = {};
		// Generate a range of [0, length]
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

export class SelfPlaySim {
	private board: Board;
	private ai: Learner;
	private lastPlayer: Player;
	get nextPlayer(): Player {
		const nextPlayer = this.lastPlayer === Player.X ? Player.O : Player.X;
		this.lastPlayer = this.lastPlayer === Player.X ? Player.O : Player.X;
		return nextPlayer;
	}
	private stats: {
		x: number;
		o: number
		games: number;
		draw: number;
		winDist: number;
	};
	constructor(board: Board) {
		this.stats = {
			x: 0,
			o: 0,
			games: 0,
			draw: 0,
			get winDist() {
				return this.x / this.o;
			}
		};

		this.lastPlayer = Player.X;
		this.board = board;
		this.ai = new Learner();
	}
	/**
	 * Plays the next move
	 *
	 * @returns
	 * @memberof SelfPlaySim
	 */
	public play() {
		const nextMove = this.ai.getBestMoves(this.board)[0];

		// No valid moves next, game's a draw
		if (!nextMove) {
			// Update stats
			this.stats.draw++;

			// Begin new game
			this.board.restart(this.nextPlayer);
			return;
		}
		// console.log(`Player: ${nextMove.move.p} | Likely: ${nextMove.likely ? nextMove.likely[0] : "random"}`);
		this.board.addMove(nextMove.move);
	}

	public startAutoPlay() {
		this.board.onWin = async () => {
			this.stats.games++;
			switch (this.board.winner) {
				case Player.X:
					this.stats.x++;
					break;
				case Player.O:
					this.stats.o++;
					break;
				default:
					break;
			}
			console.log(`X Winrate: ${(this.stats.x / this.stats.games * 100).toFixed(2)}% | Games: ${this.stats.games} | Draws: ${this.stats.draw}`);

			// Train the network
			await this.ai.train(this.board);

			// Begin new game
			this.board.restart(this.nextPlayer);
			this.play();
		};

		// Actual autoplay
		this.board.onMoveAdded = (m) => {
			if (this.board.moves.length < this.board.size ** 2) {
				this.play();
			} else {
				// Game is a draw, end it via onWin
				this.board.onWin();
			}
		};

		// Start the autoplay
		this.play();
	}
}
