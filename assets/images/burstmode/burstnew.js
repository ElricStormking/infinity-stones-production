
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class burstnew extends Phaser.Scene {

	constructor() {
		super("burstnew");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// ui_bn_bg
		const ui_bn_bg = this.add.image(638, 360, "ui_bn_bg");
		ui_bn_bg.scaleX = 0.68;
		ui_bn_bg.scaleY = 0.68;

		// ui_bn_under
		const ui_bn_under = this.add.image(639, 679, "ui_bn_under");
		ui_bn_under.scaleX = 0.67;
		ui_bn_under.scaleY = 0.67;

		// ui_bn_box
		const ui_bn_box = this.add.image(140, 220, "ui_bn_box");
		ui_bn_box.scaleX = 0.6;
		ui_bn_box.scaleY = 0.5;

		// ui_bn_box_1
		const ui_bn_box_1 = this.add.image(140, 320, "ui_bn_box");
		ui_bn_box_1.scaleX = 0.6;
		ui_bn_box_1.scaleY = 0.5;

		// ui_bn_box_2
		const ui_bn_box_2 = this.add.image(140, 420, "ui_bn_box");
		ui_bn_box_2.scaleX = 0.6;
		ui_bn_box_2.scaleY = 0.5;

		// ui_bn_box_3
		const ui_bn_box_3 = this.add.image(140, 520, "ui_bn_box");
		ui_bn_box_3.scaleX = 0.6;
		ui_bn_box_3.scaleY = 0.5;

		// ui_bn_number_score
		const ui_bn_number_score = this.add.image(576, 658, "ui_bn_number_score");
		ui_bn_number_score.scaleX = 0.67;
		ui_bn_number_score.scaleY = 0.67;

		// ui_bn_number_win
		const ui_bn_number_win = this.add.image(254, 658, "ui_bn_number_win");
		ui_bn_number_win.scaleX = 0.67;
		ui_bn_number_win.scaleY = 0.67;

		// ui_number_bet
		const ui_number_bet = this.add.image(929, 662, "ui_number_bet");
		ui_number_bet.scaleX = 0.67;
		ui_number_bet.scaleY = 0.674;

		// ui_bn_number_bet_
		const ui_bn_number_bet_ = this.add.image(1028, 660, "ui_bn_number_bet+");
		ui_bn_number_bet_.scaleX = 0.67;
		ui_bn_number_bet_.scaleY = 0.67;

		// ui_bn_number_bet
		const ui_bn_number_bet = this.add.image(832, 660, "ui_bn_number_bet-");
		ui_bn_number_bet.scaleX = 0.67;
		ui_bn_number_bet.scaleY = 0.67;

		// ui_bn_small_stop
		const ui_bn_small_stop = this.add.image(1181, 246, "ui_bn_small_stop");
		ui_bn_small_stop.scaleX = 0.9;
		ui_bn_small_stop.scaleY = 0.9;

		// ui_bn_small_menu
		const ui_bn_small_menu = this.add.image(1178, 468, "ui_bn_small_menu");
		ui_bn_small_menu.scaleX = 0.9;
		ui_bn_small_menu.scaleY = 0.9;

		// ui_bn_small_burst
		const ui_bn_small_burst = this.add.image(1178, 359, "ui_bn_small_burst");
		ui_bn_small_burst.scaleX = 0.9;
		ui_bn_small_burst.scaleY = 0.9;

		// ui_burst_spin1
		const ui_burst_spin1 = this.add.image(1179, 616, "ui_burst_spin1");
		ui_burst_spin1.scaleX = 0.67;
		ui_burst_spin1.scaleY = 0.67;

		// text_1
		const text_1 = this.add.text(89, 192, "", {});
		text_1.text = "Biggest Win";
		text_1.setStyle({  });

		// text
		const text = this.add.text(82, 293, "", {});
		text.text = "Bonus Rounds";
		text.setStyle({  });

		// text_2
		const text_2 = this.add.text(93, 393, "", {});
		text_2.text = "Bonus Wins";
		text_2.setStyle({  });

		// text_3
		const text_3 = this.add.text(77, 493, "", {});
		text_3.text = "Rounds played";
		text_3.setStyle({  });

		// ui_bn_magic_an_02
		const ui_bn_magic_an_02 = this.add.image(652, 293, "ui_bn_magic-an_02");
		ui_bn_magic_an_02.scaleX = 0.95;
		ui_bn_magic_an_02.scaleY = 0.95;

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
