const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { token, botId, testGuildId } = require('../../config/auth.json');
const { commandFiles } = require('../commands/_commandDictionary');

const commands = [];
for (const file of commandFiles) {
	const command = require(`../commands/${file}`);
	if (command.data) {
		commands.push(command.data.toJSON());
	}
}

const rest = new REST({ version: 9 }).setToken(token);


(async () => {
	try {
		console.log('Started refreshing slash commands on test guild.');

		await rest.put(
			Routes.applicationGuildCommands(botId, testGuildId),
			{ body: commands },
		);

		console.log('Successfully reloaded slash commands on test guild.');
	} catch (error) {
		console.error(error);
	}
})();
