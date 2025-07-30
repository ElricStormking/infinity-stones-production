
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class burst extends Phaser.Scene {

	constructor() {
		super("burst");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// ui_burstbg
		const ui_burstbg = this.add.image(641, 361, "ui_burstbg");
		ui_burstbg.scaleX = 0.68;
		ui_burstbg.scaleY = 0.68;

		// ui_threebg03_1
		const ui_threebg03_1 = this.add.image(643, 320, "ui_threebg03_1");
		ui_threebg03_1.scaleX = 0.67;
		ui_threebg03_1.scaleY = 0.67;

		// ui_threebg01
		const ui_threebg01 = this.add.image(385, 365, "ui_threebg01");
		ui_threebg01.scaleX = 0.67;
		ui_threebg01.scaleY = 0.67;

		// ui_threebg02
		const ui_threebg02 = this.add.image(904, 365, "ui_threebg02");
		ui_threebg02.scaleX = 0.67;
		ui_threebg02.scaleY = 0.67;

		// ui_burstbox
		const ui_burstbox = this.add.image(386, 570, "ui_burstbox");
		ui_burstbox.scaleX = 0.67;
		ui_burstbox.scaleY = 0.67;

		// ui_burstbox_1
		const ui_burstbox_1 = this.add.image(644, 570, "ui_burstbox");
		ui_burstbox_1.scaleX = 0.85;
		ui_burstbox_1.scaleY = 0.67;

		// ui_burstbox_2
		const ui_burstbox_2 = this.add.image(906, 570, "ui_burstbox");
		ui_burstbox_2.scaleX = 0.67;
		ui_burstbox_2.scaleY = 0.67;

		// ui_burst_buttonplayloop
		const ui_burst_buttonplayloop = this.add.image(646, 652, "ui_burst_buttonplayloop");
		ui_burst_buttonplayloop.scaleX = 0.67;
		ui_burst_buttonplayloop.scaleY = 0.67;

		// ui_number_bet_
		const ui_number_bet_ = this.add.image(750, 652, "ui_number_bet+");
		ui_number_bet_.scaleX = 0.67;
		ui_number_bet_.scaleY = 0.67;

		// ui_number_bet
		const ui_number_bet = this.add.image(543, 652, "ui_number_bet-");
		ui_number_bet.scaleX = 0.67;
		ui_number_bet.scaleY = 0.67;

		// ui_burst_buttonexit
		const ui_burst_buttonexit = this.add.image(840, 652, "ui_burst_buttonexit");
		ui_burst_buttonexit.scaleX = 0.67;
		ui_burst_buttonexit.scaleY = 0.67;

		// ui_burst_buttonplay
		const ui_burst_buttonplay = this.add.image(455, 652, "ui_burst_buttonplay");
		ui_burst_buttonplay.scaleX = 0.67;
		ui_burst_buttonplay.scaleY = 0.67;

		// text_1
		const text_1 = this.add.text(614, 498, "", {});
		text_1.text = "WIN";
		text_1.setStyle({ "fontSize": "30px" });

		// text
		const text = this.add.text(339, 498, "", {});
		text.text = "TOTAL";
		text.setStyle({ "fontSize": "30px" });

		// text_2
		const text_2 = this.add.text(877, 498, "", {});
		text_2.text = "BET";
		text_2.setStyle({ "fontSize": "30px" });

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
