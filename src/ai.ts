import * as tf from "@tensorflow/tfjs";
import brain from "brain.js/src/index";
import { cartesianProduct, baseN } from "js-combinatorics";

import { Move, Player, Board } from "./index";

export class Learner {
	private brainX: any;
	private brainO: any;
	constructor() {
		const options = {
			hiddenLayers: [16, 16],
			learningRate: 0.1
		};
		this.brainX = new brain.NeuralNetwork(options);
		this.brainO = new brain.NeuralNetwork(options);
	}

	public async train(board: Board) {
		await this.brainO.trainAsync(Converter.labelGame(board, Player.O), { log: true });
		await this.brainX.trainAsync(Converter.labelGame(board, Player.X), { log: true });
	}

	public nextMove(board: Board): Move {
		const currentBrain = board.currentPlayer === Player.X ? this.brainX : this.brainO;
		const possibleMoves = Generator
			.possibleMoves(board);

		// Network has not yet been trained, select random move
		if (!currentBrain.weights) {
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
							likely: currentBrain.run(newState)
						};
					})
					.sort((a, b) => {
						return b.likely[0] - a.likely[0];
					});

			/* if (moveWeights[0].likely < 0.9) {
				return Generator.randomItem(possibleMoves);
			} */

			// Choose the most likely move
			return moveWeights[0].move;
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
			output: (board.winner === p) ? [1] : [0]
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
