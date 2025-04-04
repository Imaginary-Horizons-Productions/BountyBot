const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { MAX_MESSAGE_CONTENT_LENGTH } = require("../../constants");

module.exports = new SubcommandWrapper("info", "Get the information about an existing seasonal rank",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		if (!ranks || !ranks.length) {
			interaction.reply({ content: `Could not find aany seasonal ranks. Please contact a server admin to make sure this isn't a mistake.`, flags: [MessageFlags.Ephemeral] });
			return;
		}
		const allRanksMsg = ranks.map((rank, index) => {
			return `${rank.rankmoji ?? ""}${rank.roleId ? `<@&${rank.roleId}>` : `Rank ${index}`}\nVariance Threshold: ${rank.varianceThreshold}`;
		}).join('\n');

		const msgJson = { flags: [MessageFlags.Ephemeral] };
		if (allRanksMsg.length < MAX_MESSAGE_CONTENT_LENGTH) { // Send large content as a text file
			msgJson.content = allRanksMsg;
		} else {
			msgJson.files = [new AttachmentBuilder(Buffer.from(allRanksMsg, 'utf16le'), { name: 'ranks.txt' })];
		}

		interaction.reply(msgJson);
	}
);
