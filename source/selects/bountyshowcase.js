const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');

const customId = "bountyshowcase";
module.exports = new InteractionWrapper(customId, 3000,
	/** Show the selected bounty's embed and record it's been showcased */
	(interaction, args) => {
		const [slotNumber] = interaction.values;
		database.models.Bounty.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
			bounty.increment("showcaseCount");
			await bounty.save().then(bounty => bounty.reload());
			const company = await database.models.Company.findByPk(interaction.guildId);
			bounty.updatePosting(interaction.guild, company);
			const hunter = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
			hunter.lastShowcaseTimestamp = new Date();
			hunter.save();
			return bounty.asEmbed(interaction.guild, hunter.level, company.eventMultiplierString())
		}).then(embed => {
			interaction.reply({ content: `${interaction.member} increased the reward on their bounty!`, embeds: [embed] });
		})
	}
);
