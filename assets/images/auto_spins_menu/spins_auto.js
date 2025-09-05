
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class spins_auto extends Phaser.Scene {

	constructor() {
		super("spins_auto");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// spins_auto_bg
		const spins_auto_bg = this.add.image(633, 366, "spins_auto_bg");
		spins_auto_bg.scaleX = 0.67;
		spins_auto_bg.scaleY = 0.67;

		// spins_auto_button1
		const spins_auto_button1 = this.add.image(493, 330, "spins_auto_button1");
		spins_auto_button1.scaleX = 0.67;
		spins_auto_button1.scaleY = 0.67;

		// spins_auto_button
		const spins_auto_button = this.add.image(633, 330, "spins_auto_button1");
		spins_auto_button.scaleX = 0.67;
		spins_auto_button.scaleY = 0.67;

		// spins_auto_button_1
		const spins_auto_button_1 = this.add.image(773, 330, "spins_auto_button1");
		spins_auto_button_1.scaleX = 0.67;
		spins_auto_button_1.scaleY = 0.67;

		// spins_auto_button_2
		const spins_auto_button_2 = this.add.image(493, 395, "spins_auto_button1");
		spins_auto_button_2.scaleX = 0.67;
		spins_auto_button_2.scaleY = 0.67;

		// spins_auto_button_3
		const spins_auto_button_3 = this.add.image(633, 395, "spins_auto_button1");
		spins_auto_button_3.scaleX = 0.67;
		spins_auto_button_3.scaleY = 0.67;

		// spins_auto_button_4
		const spins_auto_button_4 = this.add.image(773, 395, "spins_auto_button1");
		spins_auto_button_4.scaleX = 0.67;
		spins_auto_button_4.scaleY = 0.67;

		// spins_auto_button2
		const spins_auto_button2 = this.add.image(634, 473, "spins_auto_button2");
		spins_auto_button2.scaleX = 0.67;
		spins_auto_button2.scaleY = 0.67;

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
