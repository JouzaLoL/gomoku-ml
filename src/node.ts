import { SelfPlaySim } from "./ai";
import { } from "./index";

const sim = new SelfPlaySim(new Board(3, Player.O, 3));
sim.startAutoPlay();