
export enum Player {
	O = "o",
	X = "x"
}

export class Board {
	public moves: Move[];
	public moveWeights: Array<{
		move: Move,
		likely: any
	}>;
	public size: number;
	public winSize: number;
	public winner: Player;
	public winningMoves: Move[];
	public currentPlayer: Player;
	public name: string;
	public onWin: () => void;
	public onMoveAdded: (m: Move) => void;
	constructor(size = 16, startingPlayer = Player.X, winSize = 5) {
		this.moves = [];
		this.size = size;
		this.winSize = winSize;
		this.winner = undefined;
		this.currentPlayer = startingPlayer;

		// Win callback
		this.onWin = () => false;
		this.onMoveAdded = () => false;
	}

	public restart(p: Player) {
		this.moves = [];
		this.currentPlayer = p;
		this.winner = undefined;
		this.winningMoves = [];
	}

	public toJSON() {
		return JSON.stringify({
			moves: this.moves,
			winner: this.winner
		});
	}

	public toObject() {
		return {
			moves: this.moves,
			winner: this.winner
		};
	}

	public isValidMove(m: Move) {
		return !this.moves.some((move) => move.x === m.x && move.y === m.y) && !!m && m.p === this.currentPlayer;
	}

	public addMove(m: Move) {
		// Don't mark already occupied col
		if (!this.isValidMove(m)) {
			return;
		} else if (this.winner) {
			return;
		}

		// Update the current player
		const cp = this.currentPlayer;
		this.currentPlayer = this.currentPlayer === Player.X ? Player.O : Player.X;

		// Add move to collection
		this.moves.push(m);

		// Determine win
		this.checkWin(m);

		// Fire event
		this.onMoveAdded(m);
	}

	public getMove(x, y) {
		return this.moves.find((move) => move.x === x && move.y === y);
	}

	public checkWin(lastMove?: Move) {
		// Nobody can win with less than 5 moves ;)
		if (this.moves.length < this.winSize * 2 - 1) {
			return false;
		}

		// If no last move supplied, check for all moves
		if (!lastMove) {
			this.checkWinRecursive();
		}

		// Moves that won the game
		const winningMoves: Move[] = [];

		let hasWon = false;

		// Delta positions
		const deltas = [[1, 0], [0, 1], [1, 1], [1, -1]];
		deltas.forEach((delta1) => {
			let [deltaRow, deltaCol] = delta1;
			let consecutiveItems = 1;
			[1, -1].forEach((delta) => {
				deltaRow *= delta;
				deltaCol *= delta;
				let nextRow = lastMove.y + deltaRow;
				let nextCol = lastMove.x + deltaCol;
				while (0 <= nextRow && nextRow < this.size && 0 <= nextCol && nextCol < this.size) {
					if (this.getMove(nextCol, nextRow) && this.getMove(nextCol, nextRow).p === lastMove.p) {
						consecutiveItems += 1;
						winningMoves.push(this.getMove(nextCol, nextRow));
						winningMoves.push(lastMove);
					} else {
						break;
					}
					if (consecutiveItems === this.winSize) {
						hasWon = true;
						break;
					}
					nextRow += deltaRow;
					nextCol += deltaCol;
				}
			});
		});

		if (hasWon) {
			this.winner = lastMove.p;
			this.winningMoves = winningMoves;
			this.onWin();
			return true;
		}
	}

	public render() {
		return this.renderBoard().concat(this.renderStats());
	}

	public renderStats() {
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
			   <tr class="move ${this.isWinMove(move) ? "winmove" : ""}">
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

	public renderBoard() {
		const rows = new Array(this.size).fill(1).map((row, y) => {
			const cols = new Array(this.size).fill(1).map((col, x) => {
				const move = this.getMove(x, y);
				const isWinningMove = move && this.isWinMove(move);
				const weight = this.moveWeights ? this.moveWeights.find((mW) => mW.move.x === x && mW.move.y === y) : undefined;
				return `<td class="col ${move ? move.p : ""} ${isWinningMove ? "wincol" : ""}" x="${x}" y="${y}">
					${weight && weight.likely.x !== 0 && weight.likely ? `<div class="">${weight.likely.toString().slice(0, 3)}</div>` : ""}
					</td>`;
			});

			return `
				<tr class="row">
						<td class="guide" > ${ y} </td>
				${ cols.join("")}
				</tr>`;
		});

		return `
		<table id="board">
			<thead>
			<tr>
			<th></th>
				${
			Array.apply(null, { length: this.size }).map(Number.call, Number).map((col) => {
				return `<th>${col}</th>`;
			})}
		 	 </tr>
			</thead>
			${ rows.join("")}
		</table>`;
	}

	private checkWinRecursive() {
		if (!this.moves.length) {
			return;
		}
		for (const move of this.moves) {
			if (this.checkWin(move)) {
				break;
			}
		}
	}

	private isWinMove(move: Move) {
		return this.winningMoves && this.winningMoves.some((vector) => {
			return vector.x === move.x && vector.y === move.y;
		});
	}
}

export class Move {
	public x: number;
	public y: number;
	public p: Player;
	public get playerValue() {
		return this.p === Player.X ? 1 : 0;
	}
	constructor(x: string, y: string, p = Player.X) {
		this.x = parseInt(x, 10);
		this.y = parseInt(y, 10);
		this.p = p;
	}
}