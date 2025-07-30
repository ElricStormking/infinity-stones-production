
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class gamebattle extends Phaser.Scene {

	constructor() {
		super("gamebattle");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// ui_bg
		const ui_bg = this.add.image(640, 361, "ui_bg");
		ui_bg.scaleX = 0.68;
		ui_bg.scaleY = 0.68;

		// portrait_scarlet_witch
		const portrait_scarlet_witch = this.add.image(1155, 500, "portrait_scarlet_witch");
		portrait_scarlet_witch.scaleX = -0.72;
		portrait_scarlet_witch.scaleY = 0.72;

		// portrait_thanos
		const portrait_thanos = this.add.image(147, 341, "portrait_thanos");
		portrait_thanos.scaleX = 0.28;
		portrait_thanos.scaleY = 0.28;

		// ui_bottom_panel
		const ui_bottom_panel = this.add.image(633, 685, "ui_bottom_panel");
		ui_bottom_panel.scaleX = 0.67;
		ui_bottom_panel.scaleY = 0.67;

		// ui_plane
		const ui_plane = this.add.image(632, 347, "ui_plane");
		ui_plane.scaleX = 0.67;
		ui_plane.scaleY = 0.67;

		// ui_title
		const ui_title = this.add.image(631, 74, "ui_title");
		ui_title.scaleX = 0.67;
		ui_title.scaleY = 0.67;

		// ui_top
		const ui_top = this.add.image(354, 14, "ui_top");
		ui_top.scaleX = 0.67;
		ui_top.scaleY = 0.67;

		// ui_top_1
		const ui_top_1 = this.add.image(538, 14, "ui_top");
		ui_top_1.scaleX = 0.67;
		ui_top_1.scaleY = 0.67;

		// ui_top_2
		const ui_top_2 = this.add.image(722, 14, "ui_top");
		ui_top_2.scaleX = 0.67;
		ui_top_2.scaleY = 0.67;

		// ui_top_3
		const ui_top_3 = this.add.image(906, 14, "ui_top");
		ui_top_3.scaleX = 0.67;
		ui_top_3.scaleY = 0.67;

		// ui_freegame
		const ui_freegame = this.add.image(168, 549, "ui_freegame");
		ui_freegame.scaleX = 0.67;
		ui_freegame.scaleY = 0.67;

		// ui_number_score
		const ui_number_score = this.add.image(250, 675, "ui_number_score");
		ui_number_score.scaleX = 0.67;
		ui_number_score.scaleY = 0.67;

		// ui_number_win
		const ui_number_win = this.add.image(561, 675, "ui_number_win");
		ui_number_win.scaleX = 0.67;
		ui_number_win.scaleY = 0.67;

		// ui_number_bet
		const ui_number_bet = this.add.image(931, 675, "ui_number_bet");
		ui_number_bet.scaleX = 0.67;
		ui_number_bet.scaleY = 0.67;

		// ui_spin
		const ui_spin = this.add.image(1161, 636, "ui_spin");
		ui_spin.scaleX = 0.67;
		ui_spin.scaleY = 0.67;

		// ui_small_stop
		const ui_small_stop = this.add.image(1038, 578, "ui_small_stop");
		ui_small_stop.scaleX = 0.67;
		ui_small_stop.scaleY = 0.67;

		// ui_small_burst
		const ui_small_burst = this.add.image(1102, 512, "ui_small_burst");
		ui_small_burst.scaleX = 0.67;
		ui_small_burst.scaleY = 0.67;

		// ui_small_menu
		const ui_small_menu = this.add.image(1182, 499, "ui_small_menu");
		ui_small_menu.scaleX = 0.67;
		ui_small_menu.scaleY = 0.67;

		// ui_number_bet_
		const ui_number_bet_ = this.add.image(1034, 675, "ui_number_bet+");
		ui_number_bet_.scaleX = 0.67;
		ui_number_bet_.scaleY = 0.67;

		// ui_number_bet_1
		const ui_number_bet_1 = this.add.image(830, 675, "ui_number_bet-");
		ui_number_bet_1.scaleX = 0.67;
		ui_number_bet_1.scaleY = 0.67;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	// Write your code here

	create() {

		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
