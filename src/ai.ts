import * as tf from "@tensorflow/tfjs";
import brain from "brain.js/src/index";
import { cartesianProduct } from "js-combinatorics";

import { Move, Player, Board } from "./index";
import { TimeDistributed } from "@tensorflow/tfjs-layers/dist/layers/wrappers";

export class Learner {
	private brain: any;
	constructor() {
		const options = {
			hiddenLayers: [9, 9],
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

	public async train(board: Board) {
		const trainingData = Converter.labelGame(board);
		await this.brain.trainAsync(trainingData);
	}

	public getBestMoves(board: Board): Array<{
		move: Move,
		likely: any
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
						// Actual S_t+1
						const newState = Converter.toPropertiesObject(newMoves, board.size);
						// Return the move and it's weight
						return {
							move,
							likely: this.brain.run(newState)[board.currentPlayer]
						};
					});

			// Sort the moves by descending weight
			const bestMoves = weightedMoves
				.sort((a, b) => {
					return b.likely - a.likely;
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
		const legalMoves = moves.filter(board.isValidMove);

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
	public static labelGame(board: Board) {
		// Discount the game by moves count
		const discount = (board.moves.filter((move) => move.p === board.winner).length - 1 / board.winSize) * 0.1;

		// Value >> 1 => Player.X is likely to win; Value >> 0 => Player.O is likely to win
		const value = board.winner === Player.X ? 1 - discount : 0 + discount;

		return {
			input: Converter.toPropertiesObject(board.moves, board.size),
			output: {
				win: value
			}
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

		/* // Initialize object with empty indicators - 0.5
		baseN(coordsRange, 2)
			.toArray()
			.map((coord) => {
				return coord.join("");
			})
			.forEach((coord) => {
				object[coord] = 0.5;
			}); */

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
			this.board.restart(this.lastPlayer);
			this.play();
			return;
		}
		console.log(`Player: ${nextMove.move.p} | Likely: ${nextMove.likely}`);
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
				case undefined:
					this.stats.draw++;
					break;
				default:
					break;
			}
			console.log(`Game ended | Winner: ${this.board.winner}`);
			console.log("Stats:" + JSON.stringify(this.stats));

			// Train the network
			await this.ai.train(this.board);

			// Switch out first player
			const nextPlayer = this.lastPlayer === Player.X ? Player.O : Player.X;
			this.lastPlayer = nextPlayer;

			// Begin new game
			this.board.restart(nextPlayer);
			this.play();
		};

		// Actual autoplay
		this.board.onMoveAdded = () => {
			this.play();
		};

		// Start the autoplay
		this.play();
	}
}
