const { InteractionWrapper } = require('../classes');

const customId = "secondtoast"; //TODONOW finish
module.exports = new InteractionWrapper(customId, 3000,
	/** Specs */
	(interaction, [toastId]) => {
		//TODONOW limit seconded crits per day
	}
);
