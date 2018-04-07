import * as tf from "@tensorflow/tfjs";
import brain from "brain.js/src/index";

import { Move, Player, Board } from "./index";

export default class Learner {
	private brain: any;
	constructor() {
		this.brain = new brain.NeuralNetwork();
	}
	public train(board: Board) {
		this.brain.train(Converter.labelMoves(board), { log: true });
	}

	public nextMove(board: Board) {
		// Generate random moves
		this.

	}
}

class Generator {
	public static randomMove(board: Board, player?: Player) {
		const x = Generator.getRandomInt(0, board.size);
		const y = Generator.getRandomInt(0, board.size);
		return new Move(y.toString(), y.toString(), player);
	}

	private static getRandomInt(min: number, max: number) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
}

class Converter {
	public static labelMoves(board: Board) {
		return board.moves.map((move) => {
			return {
				input: {
					x: move.x / board.size,
					y: move.y / board.size,
					p: move.p === Player.O ? 0 : 1
				},
				output: move.p === board.winner ? [1] : [0]
			};
		});
	}
}
