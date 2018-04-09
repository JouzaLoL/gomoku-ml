import { SelfPlaySim } from "./ai";
import { Board, Player } from "./lib";

const sim = new SelfPlaySim(new Board(3, Player.O, 3));
sim.startAutoPlay();