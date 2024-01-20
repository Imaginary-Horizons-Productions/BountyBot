const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { GLOBAL_MAX_BOUNTY_SLOTS } = require('../constants');

const mainId = "config-premium";
module.exports = new CommandWrapper(mainId, "Configure premium BountyBot settings for this server", PermissionFlagsBits.ManageGuild, true, false, 3000,
	(interaction, database, runMode) => {
		database.models.Company.findOrCreate({ where: { id: interaction.guildId } }).then(([company]) => {
			const updatePayload = {};
			let content = "The following server settings have been configured:";

			const xpCoefficient = interaction.options.getNumber("level-threshold-multiplier");
			if (xpCoefficient !== null) {
				updatePayload.xpCoefficient = xpCoefficient;
				content += `\n- The level-up xp coefficient has been set to ${xpCoefficient}.`;
			}

			const slots = interaction.options.getInteger("bounty-slots");
			if (slots !== null) {
				if (slots < 1 || slots > GLOBAL_MAX_BOUNTY_SLOTS) {
					interaction.reply({ content: `Your settings were not set because ${slots} is an invalid value for bounty slots (must be between 1 and 10 inclusive).`, ephemeral: true });
					return;
				}
				updatePayload.maxSimBounties = slots;
				content += `\n- Max bounty slots a bounty hunter can have (including earned slots) has been set to ${slots}.`;
			}

			company.update(updatePayload);
			interaction.reply({ content, ephemeral: true });
		});
	}
).setOptions(
	{
		type: "Number",
		name: "level-threshold-multiplier",
		description: "Configure the XP coefficient for bounty hunter levels (default 3)",
		required: false,
	},
	{
		type: "Integer",
		name: "bounty-slots",
		description: `Configure the max number (between 1 and ${GLOBAL_MAX_BOUNTY_SLOTS}) of bounty slots hunters can have (default 5)`,
		required: false
	}
);
