const log = console.log;

console.log = function () {
	log.apply(console, [`<t:${Math.floor(Date.now() / 1000)}> `, ...arguments]);
}

const error = console.error;

console.error = function () {
	error.apply(console, [`<t:${Math.floor(Date.now() / 1000)}> `, ...arguments]);
}

//#region Imports
const fsa = require('fs').promises;
const { Sequelize } = require('sequelize');
const path = require('path');
const basename = path.basename(__filename);
const { Client, ActivityType, IntentsBitField, Events, Routes, REST, MessageFlags } = require("discord.js");
const { MessageComponentWrapper } = require('./classes');

const { getCommand, slashData, setLogic: setCommandLogic } = require("./commands/_commandDictionary.js");
const { getButton, setLogic: setButtonLogic } = require("./buttons/_buttonDictionary.js");
const { getSelect, setLogic: setSelectLogic } = require("./selects/_selectDictionary.js");
const { getContextMenu, contextMenuData, setLogic: setContextMenuLogic } = require("./context_menus/_contextMenuDictionary.js");
const { setLogic: setItemLogic } = require("./items/_itemDictionary.js")
const { SAFE_DELIMITER, authPath, testGuildId, announcementsChannelId, lastPostedVersion, premium, SKIP_INTERACTION_HANDLING, commandIds } = require("./constants.js");
const { buildVersionEmbed } = require("./util/embedUtil.js");
const { commandMention } = require("./util/textUtil.js");
const logicBlob = require("./logic");
const runMode = process.argv[4] || "development";
//#endregion

//#region Shard Instances
const dbConnection = new Sequelize(require(__dirname + '/../config/config.json')[runMode]);
const models = {};

const dAPIClient = new Client({
	retryLimit: 5,
	presence: {
		activities: [{
			type: ActivityType.Custom,
			name: "🔰 Get started with /tutorial"
		}]
	},
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers]
});
/** @type {Map<string, Map<string, number>>} */
const interactionCooldowns = new Map();
//#endregion

//#region Database Setup
const dbReady = dbConnection.authenticate().then(async () => {
	return (await fsa.readdir(path.join(__dirname, "models"))).filter(directory => directory.indexOf('.') === -1);
}).then(directories => {
	return Promise.all(directories.map(async directory => {
		const files = (await fsa.readdir(path.join(__dirname, "models", directory))).filter(file =>
			file.indexOf('.') !== 0 &&
			file !== basename &&
			file.slice(-3) === '.js' &&
			file.indexOf('.test.js') === -1
		);

		return files.map(file => {
			const model = require(path.join(__dirname, "models", directory, file)).initModel(dbConnection);
			models[model.name] = model;
		});
	}));
}).then(() => {
	Object.keys(models).map(modelName => {
		if (models[modelName].associate) {
			models[modelName].associate(models);
		}
	});
	for (const interface in logicBlob) { // Set the database for the logic files that store it
		logicBlob[interface].setDB?.(dbConnection);
	}

	setCommandLogic(logicBlob);
	setButtonLogic(logicBlob);
	setSelectLogic(logicBlob);
	setContextMenuLogic(logicBlob);
	setItemLogic(logicBlob);

	return;
}).catch(console.error);
//#endregion

dAPIClient.login(require(authPath).token);

//#region Event Handlers
dAPIClient.on(Events.ClientReady, () => {
	console.log(`Connected as ${dAPIClient.user.tag}`);
	if (runMode === "production") {
		(() => {
			try {
				new REST({ version: 10 }).setToken(require(authPath).token).put(
					Routes.applicationCommands(dAPIClient.user.id),
					{ body: [...slashData, ...contextMenuData] }
				).then(commands => {
					for (const command of commands) {
						commandIds[command.name] = command.id;
					}
				})
			} catch (error) {
				console.error(error);
			}
		})()

		// Post Changelog
		if (announcementsChannelId) {
			fsa.readFile('./ChangeLog.md', { encoding: 'utf8' }).then(data => {
				let [currentFull, currentMajor, currentMinor, currentPatch] = data.match(/(\d+)\.(\d+)\.(\d+)/);
				let [_lastFull, lastMajor, lastMinor, lastPatch] = lastPostedVersion.match(/(\d+)\.(\d+)\.(\d+)/);

				if (parseInt(currentMajor) <= parseInt(lastMajor) && parseInt(currentMinor) <= parseInt(lastMinor) && parseInt(currentPatch) <= parseInt(lastPatch)) {
					return;
				}

				buildVersionEmbed(dAPIClient.user.displayAvatarURL()).then(embed => {
					dAPIClient.guilds.fetch(testGuildId).then(guild => {
						guild.channels.fetch(announcementsChannelId).then(announcementsChannel => {
							announcementsChannel.send({ embeds: [embed] }).then(message => {
								message.crosspost();
								fsa.writeFile('./config/versionData.json', JSON.stringify({
									announcementsChannelId,
									lastPostedVersion: currentFull,
								}), "utf-8");
							});
						})
					})
				}).catch(console.error);
			});
		} else {
			console.error("Patch notes post skipped due to falsy announcementsChannelId");
		}
	} else {
		dAPIClient.application.commands.fetch({ guildId: testGuildId }).then(commands => {
			commands.each(command => {
				commandIds[command.name] = command.id;
			})
		});
	}
});

dAPIClient.on(Events.InteractionCreate, async interaction => {
	await dbReady;
	if (interaction.isAutocomplete()) {
		const command = getCommand(interaction.commandName);
		const focusedOption = interaction.options.getFocused(true);
		const unfilteredChoices = command.autocomplete?.[focusedOption.name] ?? [];
		if (unfilteredChoices.length < 1) {
			console.error(`Attempted autocomplete on misconfigured command ${interaction.commandName} ${focusedOption.name}`);
		}
		const choices = unfilteredChoices.filter(choice => choice.value.toLowerCase().includes(focusedOption.value.toLowerCase()))
			.slice(0, 25);
		interaction.respond(choices);
	} else if (interaction.isContextMenuCommand()) {
		const contextMenu = getContextMenu(interaction.commandName);
		if (contextMenu.premiumCommand && !premium.paid.includes(interaction.user.id) && !premium.gift.includes(interaction.user.id)) {
			interaction.reply({ content: `The \`/${interaction.commandName}\` context menu option is a premium command. Learn more with ${commandMention("premium")}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		const cooldownTimestamp = contextMenu.getCooldownTimestamp(interaction.user.id, interactionCooldowns);
		if (cooldownTimestamp) {
			interaction.reply({ content: `Please wait, the \`/${interaction.commandName}\` context menu option is on cooldown. It can be used again <t:${cooldownTimestamp}:R>.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		contextMenu.execute(interaction, runMode);
	} else if (interaction.isCommand()) {
		const command = getCommand(interaction.commandName);
		if (command.premiumCommand && !premium.paid.includes(interaction.user.id) && !premium.gift.includes(interaction.user.id)) {
			interaction.reply({ content: `The \`/${interaction.commandName}\` command is a premium command. Learn more with ${commandMention("premium")}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		const cooldownTimestamp = command.getCooldownTimestamp(interaction.user.id, interactionCooldowns);
		if (cooldownTimestamp) {
			interaction.reply({ content: `Please wait, the \`/${interaction.commandName}\` command is on cooldown. It can be used again <t:${cooldownTimestamp}:R>.`, flags: [MessageFlags.Ephemeral] });
			return;
		}
		command.execute(interaction, runMode);
	} else if (interaction.customId.startsWith(SKIP_INTERACTION_HANDLING)) {
		return;
	} else {
		const [mainId, ...args] = interaction.customId.split(SAFE_DELIMITER);
		/** @type {MessageComponentWrapper} */
		let interactionWrapper;
		if (interaction.isButton()) {
			interactionWrapper = getButton(mainId);
		} else if (interaction.isAnySelectMenu()) {
			interactionWrapper = getSelect(mainId);
		}
		const cooldownTimestamp = interactionWrapper.getCooldownTimestamp(interaction.user.id, interactionCooldowns);

		if (cooldownTimestamp) {
			interaction.reply({ content: `Please wait, this interaction is on cooldown. It can be used again <t:${cooldownTimestamp}:R>.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		interactionWrapper.execute(interaction, runMode, args);
	}
});

dAPIClient.on(Events.ChannelDelete, async channel => {
	await dbReady;
	logicBlob.companies.findCompanyByPK(channel.guild.id).then(company => {
		if (company) {
			let shouldSaveCompany = false;
			if (channel.id === company.bountyBoardId) {
				company.bountyBoardId = null;
				shouldSaveCompany = true;
			} else if (channel.id === company.scoreboardChannelId) {
				company.scoreboardChannelId = null;
				shouldSaveCompany = true;
			}
			if (shouldSaveCompany) {
				company.save();
			}
		}
	})
});

dAPIClient.on(Events.MessageDelete, async message => {
	await dbReady;
	logicBlob.companies.findCompanyByPK(message.guild.id).then(company => {
		if (message.id === company.scoreboardMessageId) {
			company.scoreboardMessageId = null;
			company.save();
		}
	})
});

dAPIClient.on(Events.ThreadDelete, async thread => {
	await dbReady;
	logicBlob.companies.findCompanyByPK(thread.guild.id).then(company => {
		if (thread.id === company.evergreenThreadId) {
			company.evergreenThreadId = null;
			company.save();
		}
	})
})

dAPIClient.on(Events.GuildDelete, async guild => {
	await dbReady;
	logicBlob.hunters.deleteCompanyHunters(guild.id);
	logicBlob.toasts.deleteCompanyToastRecords(guild.id);

	logicBlob.bounties.deleteCompanyBounties(guild.id);
	logicBlob.bounties.deleteCompanyCompletions(guild.id);

	logicBlob.seasons.deleteCompanyParticipations(guild.id);
	logicBlob.seasons.deleteCompanySeasons(guild.id);

	logicBlob.ranks.deleteRanks(guild.id);
	logicBlob.companies.deleteCompany(guild.id);
});
//#endregion
