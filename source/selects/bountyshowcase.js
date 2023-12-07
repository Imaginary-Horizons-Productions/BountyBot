const { SelectWrapper } = require('../classes');

const mainId = "bountyshowcase";
module.exports = new SelectWrapper(mainId, 3000,
	/** Show the selected bounty's embed and record it's been showcased */
	(interaction, args, database) => {
		const [bountyId] = interaction.values;
		database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company }).then(async bounty => {
			if (bounty?.state !== "open") {
				interaction.reply({ content: "The selected bounty does not seem to be open.", ephemeral: true });
				return;
			}

			bounty.increment("showcaseCount");
			await bounty.save().then(bounty => bounty.reload());
			bounty.updatePosting(interaction.guild, bounty.Company, database);
			const hunter = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
			hunter.lastShowcaseTimestamp = new Date();
			hunter.save();
			bounty.asEmbed(interaction.guild, hunter.level, bounty.Company.festivalMultiplierString(), false, database).then(embed => {
				interaction.reply({ content: `${interaction.member} increased the reward on their bounty!`, embeds: [embed] });
			})
		})
	}
);
