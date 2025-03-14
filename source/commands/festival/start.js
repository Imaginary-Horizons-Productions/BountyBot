const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Company } = require("../../models/companies/Company");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic"), Company]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer, company]) {
	const multiplier = interaction.options.getInteger("multiplier");
	if (multiplier < 2) {
		interaction.reply({ content: `Multiplier must be an integer that is 2 or more.`, flags: [MessageFlags.Ephemeral] })
		return;
	}
	company.update({ "festivalMultiplier": multiplier });
	interaction.guild.members.fetchMe().then(bountyBot => {
		const multiplierTag = ` [XP x ${multiplier}]`;
		const bountyBotName = bountyBot.nickname ?? bountyBot.displayName;
		if (bountyBotName.length + multiplierTag.length <= 32) {
			bountyBot.setNickname(`${bountyBotName}${multiplierTag}`);
		}
	})
	interaction.reply(company.sendAnnouncement({ content: `An XP multiplier festival has started. Bounty and toast XP will be multiplied by ${multiplier}.` }));
};

module.exports = {
	data: {
		name: "start",
		description: "Start an XP multiplier festival",
		optionsInput: [
			{
				type: "Integer",
				name: "multiplier",
				description: "The amount to multiply XP by",
				required: true
			}
		]
	},
	executeSubcommand
};
