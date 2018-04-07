import * as tf from "@tensorflow/tfjs";
import brain from "brain.js/src/index";
import { cartesianProduct } from "js-combinatorics";

import { Move, Player, Board } from "./index";

export class Learner {
	private brainX: any;
	private brainO: any;
	constructor() {
		this.brainX = new brain.NeuralNetwork();
		this.brainO = new brain.NeuralNetwork();
	}

	public async train(board: Board) {
		await this.brainO.trainAsync(Converter.labelMoves(board, Player.O), { log: true });
		await this.brainX.trainAsync(Converter.labelMoves(board, Player.X), { log: true });
	}

	public nextMove(board: Board): Move {
		const currentBrain = board.currentPlayer === Player.X ? this.brainX : this.brainO;
		const possibleMoves = Generator
			.possibleMoves(board);

		// Network has not yet been trained, select random move
		if (!currentBrain.weights) {
			return Generator.randomItem(possibleMoves);
		} else {
			// Assign weights to moves
			const moveWeights =
				possibleMoves
					.map((move) => {
						return {
							move,
							likely: currentBrain.run(Converter.normalizeMove(move, board))
						};
					})
					.sort((a, b) => {
						return b.likely[0] - a.likely[0];
					});
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
	public static labelMoves(board: Board, p: Player) {
		return {
			input: board.toPropertiesObject(),
			output: (board.winner === p) ? [1] : [0]
		};
	}

	public static normalizeMove(move: Move, board: Board) {
		return {
			x: move.x / board.size,
			y: move.y / board.size,
			p: move.p === Player.O ? 0 : 1
		};
	}
}
