import * as tf from "@tensorflow/tfjs";
import brain from "brain.js/src/index";
import { cartesianProduct } from "js-combinatorics";

import { Move, Player, Board } from "./index";

export class Learner {
	private brain: any;
	constructor() {
		this.brain = new brain.NeuralNetwork();
	}
	public train(board: Board) {
		this.brain.train(Converter.labelMoves(board), { log: true });
	}

	public nextMove(board: Board): Move {
		const possibleMoves = Generator
			.possibleMoves(board);
		// Network has not yet been trained, select random move
		if (!this.brain.isRunnable) {
			return Generator.randomItem(possibleMoves);
		} else {
			// Assign weights to moves
			const moveWeights =
				possibleMoves
					.map((move) => {
						return {
							move,
							likely: this.brain.run(Converter.normalizeMove(move, board))
						};
					});
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
			return !board.moves.includes(move);
		});

		return legalMoves;
	}

	public static randomMove(board: Board) {
		return Generator.randomItem(Generator.possibleMoves(board));
	}

	public static randomItem(array) {
		return array[Math.floor(Math.random() * array.length)];
	}

	private static getRandomInt(min: number, max: number) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
}

class Converter {
	public static labelMoves(board: Board) {
		return board.moves.map((move) => {
			return {
				input: Converter.normalizeMove(move, board),
				output: move.p === board.winner ? [1] : [0]
			};
		});
	}

	public static normalizeMove(move: Move, board: Board) {
		return {
			x: move.x / board.size,
			y: move.y / board.size,
			p: move.p === Player.O ? 0 : 1
		};
	}
}
