//#region Imports
const { Client, ActivityType, IntentsBitField, Events, Routes, REST } = require("discord.js");
const { readFile, writeFile } = require("fs").promises;

const { getCommand, slashData } = require("./commands/_commandDictionary.js");
const { getButton } = require("./buttons/_buttonDictionary.js");
const { getSelect } = require("./selects/_selectDictionary.js");
const { SAFE_DELIMITER, authPath, testGuildId, announcementsChannelId, lastPostedVersion, premium } = require("./constants.js");
const { buildVersionEmbed } = require("./util/embedUtil.js");
const { database } = require("../database.js");
//#endregion

//#region Executing Code
const client = new Client({
	retryLimit: 5,
	presence: {
		activities: [{
			type: ActivityType.Listening,
			name: "/commands"
		}]
	},
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers]
});
/** @type {Map<string, Map<string, number>>} */
const interactionCooldowns = new Map();

client.login(require(authPath).token)
	.catch(console.error);
//#endregion

//#region Event Handlers
client.on(Events.ClientReady, () => {
	console.log(`Connected as ${client.user.tag}`);

	if (process.argv[4] === "prod") {
		(async () => {
			try {
				await new REST({ version: 9 }).setToken(require(authPath).token).put(
					Routes.applicationCommands(client.user.id),
					{ body: slashData }
				)
			} catch (error) {
				console.error(error);
			}
		})()

		// Post Changelog
		readFile('./ChangeLog.md', { encoding: 'utf8' }).then(data => {
			let [currentFull, currentMajor, currentMinor, currentPatch] = data.match(/(\d+)\.(\d+)\.(\d+)/);
			let [_lastFull, lastMajor, lastMinor, lastPatch] = lastPostedVersion.match(/(\d+)\.(\d+)\.(\d+)/);

			if (parseInt(currentMajor) <= parseInt(lastMajor)) {
				if (parseInt(currentMinor) <= parseInt(lastMinor)) {
					if (parseInt(currentPatch) <= parseInt(lastPatch)) {
						return;
					}
				}
			}

			buildVersionEmbed(client.user.displayAvatarURL()).then(embed => {
				client.guilds.fetch(testGuildId).then(guild => {
					guild.channels.fetch(announcementsChannelId).then(announcementsChannel => {
						announcementsChannel.send({ embeds: [embed] }).then(message => {
							message.crosspost();
							writeFile('./config/versionData.json', JSON.stringify({
								announcementsChannelId,
								lastPostedVersion: currentFull,
							}), "utf-8");
						});
					})
				})
			}).catch(console.error);
		});
	}
});

client.on(Events.InteractionCreate, interaction => {
	if (interaction.isModalSubmit()) {
		// Modal Submissions should be handled in the interactions that show them via awaitModalSubmission
		return;
	} else if (interaction.isCommand()) {
		const command = getCommand(interaction.commandName);
		if (command.premiumCommand && !premium.paid.includes(interaction.user.id) && !premium.gift.includes(interaction.user.id)) {
			interaction.reply({ content: `The \`/${interaction.commandName}\` command is a premium command. Learn more with \`/premium\`.`, ephemeral: true });
			return;
		}

		const cooldownTimestamp = command.getCooldownTimestamp(interaction.user.id, interactionCooldowns);
		if (cooldownTimestamp) {
			interaction.reply({ content: `Please wait, the \`/${interaction.commandName}\` command is on cooldown. It can be used again <t:${cooldownTimestamp}:R>.`, ephemeral: true });
			return;
		}

		command.execute(interaction);
	} else if (interaction.isAutocomplete()) {
		const command = getCommand(interaction.commandName);
		const focusedOption = interaction.options.getFocused(true);
		const unfilteredChoices = command.autocomplete?.[focusedOption.name] ?? [];
		if (unfilteredChoices.length < 1) {
			console.error(`Attempted autocomplete on misconfigured command ${interaction.commandName} ${focusedOption.name}`);
		}
		const choices = unfilteredChoices.filter(choice => choice.value.includes(focusedOption.value.toLowerCase()))
			.slice(0, 25);
		interaction.respond(choices);
	} else {
		const [mainId, ...args] = interaction.customId.split(SAFE_DELIMITER);
		let getter;
		if (interaction.isButton()) {
			getter = getButton;
		} else if (interaction.isAnySelectMenu()) {
			getter = getSelect;
		}
		const interactionWrapper = getter(mainId);
		const cooldownTimestamp = interactionWrapper.getCooldownTimestamp(interaction.user.id, interactionCooldowns);

		if (cooldownTimestamp) {
			interaction.reply({ content: `Please wait, this interaction is on cooldown. It can be used again <t:${cooldownTimestamp}:R>.`, ephemeral: true });
			return;
		}

		interactionWrapper.execute(interaction, args);
	}
});

client.on(Events.GuildDelete, guild => {
	database.models.Hunter.destroy({ where: { companyId: guild.id } });
	database.models.Toast.findAll({ where: { companyId: guild.id } }).then(toasts => {
		toasts.forEach(toast => {
			database.models.Recipient.destroy({ where: { toastId: toast.id } });
			database.models.Seconding.destroy({ where: { toastId: toast.id } });
			toast.destroy();
		})
	});

	database.models.Bounty.destroy({ where: { companyId: guild.id } });
	database.models.Completion.destroy({ where: { companyId: guild.id } });

	database.models.Participation.destroy({ where: { companyId: guild.id } });
	database.models.Season.destroy({ where: { companyId: guild.id } });

	database.models.Rank.destroy({ where: { companyId: guild.id } });
	database.models.Company.destroy({ where: { id: guild.id } });
});
//#endregion
