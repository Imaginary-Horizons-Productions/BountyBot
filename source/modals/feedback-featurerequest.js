const { EmbedBuilder } = require('discord.js');
const { InteractionWrapper } = require('../classes');
const { testGuildId, feedbackChannelId } = require('../constants');

const customId = "featurerequest";
module.exports = new InteractionWrapper(customId, 3000,
	/** Serialize feature request data and send to test server */
	(interaction, args) => {
		if (!testGuildId || !feedbackChannelId) {
			interaction.reply({ content: "The test server is not yet configured to receive feedback, thanks for your patience.", ephemeral: true });
		}
		const errors = [];
		const embed = new EmbedBuilder().setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
			.setTitle(`Feature Request: ${interaction.fields.getTextInputValue("title")}`)
			.addFields(
				{ name: "Reporter", value: `<@${interaction.user.id}>` },
				{ name: "User Demographic", value: interaction.fields.getTextInputValue("user") },
				{ name: "Functionality", value: interaction.fields.getTextInputValue("functionality") },
				{ name: "Benefit", value: interaction.fields.getTextInputValue("benefit") }
			);

		if (interaction.user.hexAccentColor) {
			embed.setColor(interaction.user.hexAccentColor);
		}

		const unvalidatedImageURL = interaction.fields.getTextInputValue("image");
		try {
			if (unvalidatedImageURL) {
				new URL(unvalidatedImageURL);
				embed.setImage(unvalidatedImageURL);
			}
		} catch (error) {
			errors.push(error.message);
		}

		interaction.client.guilds.fetch(testGuildId).then(testGuild => {
			return testGuild.channels.fetch(feedbackChannelId);
		}).then(feedbackChannel => {
			feedbackChannel.createInvite({ maxAge: 0 }).then(invite => {
				feedbackChannel.send({ embeds: [embed] });
				interaction.reply({ content: `Your feature request has been recorded${errors.length > 0 ? `, but the following errors were encountered: ${errors.join(", ")}` : ""}. You can join the Imaginary Horizons Productions test server to provide additional information here: ${invite.url}`, ephemeral: true })
			})
		})
	}
);
